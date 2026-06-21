"""数据对比引擎：性价比评分、推荐标注、排序。"""
from __future__ import annotations

import statistics
from dataclasses import dataclass
from typing import List

from .models import Product


@dataclass
class ScoredProduct:
    product: Product
    price_rank: int
    score: float
    label: str


def normalize(x: float, min_v: float, max_v: float) -> float:
    if max_v - min_v < 1e-9:
        return 0.5
    return (x - min_v) / (max_v - min_v)


def score_products(products: List[Product]) -> List[ScoredProduct]:
    """性价比综合评分 + 推荐标注。

    评分公式：
        score = 0.45 * (1 - 归一化价格) + 0.30 * 归一化销量 + 0.25 * 归一化评分
    其中价格越低越高分，销量/评分越高越高分。
    """
    if not products:
        return []
    prices = [p.price for p in products]
    sales = [p.sales for p in products]
    ratings = [p.store_rating for p in products]

    pmin, pmax = min(prices), max(prices)
    smin, smax = min(sales), max(sales)
    rmin, rmax = min(ratings), max(ratings)

    scored: List[ScoredProduct] = []
    for p in products:
        price_norm = normalize(p.price, pmin, pmax)
        sale_norm = normalize(p.sales, smin, smax)
        rate_norm = normalize(p.store_rating, rmin, rmax)
        score = 0.45 * (1 - price_norm) + 0.30 * sale_norm + 0.25 * rate_norm
        scored.append(ScoredProduct(product=p, price_rank=0, score=round(score, 4), label=""))

    # 价格排序 -> 名次
    by_price = sorted(scored, key=lambda s: s.product.price)
    for i, s in enumerate(by_price, 1):
        s.price_rank = i

    # 推荐标注
    best_price = by_price[0]
    best_score = max(scored, key=lambda s: s.score)
    best_rating = max(scored, key=lambda s: s.product.store_rating)
    best_sales = max(scored, key=lambda s: s.product.sales)
    best_price.label = "💰 最低价"
    best_rating.label = "⭐ 店铺评分最高"
    best_sales.label = "🔥 销量王"
    # 性价比最高 与 最低价/销量王 可能重叠
    if best_score is best_price or best_score is best_rating or best_score is best_sales:
        best_score.label += " | ✅ 性价比推荐"
    else:
        best_score.label = "✅ 性价比推荐"

    # 所有其他商品：若明显处于中位则标注 "持平"
    mean_price = statistics.mean(prices)
    for s in scored:
        if s.label:
            continue
        if abs(s.product.price - mean_price) / (mean_price or 1) < 0.05:
            s.label = "➖ 市场均价"
    return scored


def compare_summary(products: List[Product]) -> dict:
    """生成横向对比摘要：各平台最低价/均价/最低价商品等。"""
    by_platform: dict[str, List[Product]] = {}
    for p in products:
        by_platform.setdefault(p.platform, []).append(p)
    summary = {}
    for plat, items in by_platform.items():
        prices = [p.price for p in items]
        sales = [p.sales for p in items]
        ratings = [p.store_rating for p in items]
        cheapest = min(items, key=lambda p: p.price)
        summary[plat] = {
            "count": len(items),
            "min_price": round(min(prices), 2),
            "avg_price": round(sum(prices) / len(prices), 2),
            "max_price": round(max(prices), 2),
            "avg_sales": int(sum(sales) / len(sales)),
            "avg_rating": round(sum(ratings) / len(ratings), 2),
            "cheapest_id": cheapest.product_id,
            "cheapest_title": cheapest.title,
            "cheapest_price": cheapest.price,
            "cheapest_url": cheapest.url,
        }
    return summary

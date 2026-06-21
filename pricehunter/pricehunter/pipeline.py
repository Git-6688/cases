"""high-level pipeline。"""
from __future__ import annotations

from datetime import datetime
from typing import List, Optional

from .cleaner import clean_and_dedupe
from .compare import compare_summary, score_products
from .models import Product, SearchResult
from .scrapers import generate_trend, run_scrapers
from .visualize import platform_bar, trend_chart


def run_pipeline(keyword: str, max_items: int = 10,
                 platforms: Optional[List[str]] = None) -> dict:
    """执行完整采集 -> 清洗 -> 评分 -> 可视化流程，返回可直接 JSON 化的 dict。"""
    products_raw = run_scrapers(keyword, max_items=max_items, platforms=platforms)
    products = clean_and_dedupe(products_raw)
    products.sort(key=lambda p: p.price)
    trend_points = generate_trend(products)
    scored = score_products(products)
    summary = compare_summary(products)

    result = SearchResult(keyword=keyword, products=products,
                          scraped_at=datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                          trend_points=trend_points)

    trend_b64 = trend_chart(trend_points, keyword)
    bar_b64 = platform_bar(products, keyword)

    scored_dicts = []
    for s in scored:
        d = s.product.to_dict()
        d["score"] = s.score
        d["price_rank"] = s.price_rank
        d["label"] = s.label
        scored_dicts.append(d)
    # 再次按价格升序输出
    scored_dicts.sort(key=lambda d: d["price"])

    return {
        "keyword": keyword,
        "scraped_at": result.scraped_at,
        "count": len(products),
        "products": scored_dicts,
        "summary": summary,
        "trend_b64": trend_b64,
        "bar_b64": bar_b64,
        "raw_json": result.to_json(),
    }

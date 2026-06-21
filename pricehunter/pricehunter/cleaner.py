"""数据清洗与去重模块。"""
from __future__ import annotations

import hashlib
import re
from typing import List

from .models import Product


def _normalize_title(title: str) -> str:
    """对标题做归一化：小写、去除多余空白/标点/表情符号。"""
    if not title:
        return ""
    s = title.strip().lower()
    # 去除常见表情符号与标点
    s = re.sub(r"[\u2600-\u27BF\U00010000-\U0001FFFF]", "", s)
    s = re.sub(r"[【】\[\]()（）,，。.!！?？\"'`、|/\\\-_=+·•·]", " ", s)
    s = re.sub(r"\s+", " ", s)
    return s.strip()


def _dedup_key(p: Product) -> str:
    """去重键：平台 + 归一化标题前 40 字。若有 product_id 则优先使用。"""
    if p.product_id and p.platform:
        return f"{p.platform}:{p.product_id}".lower()
    return f"{p.platform}:{_normalize_title(p.title)[:40]}"


def dedupe(products: List[Product]) -> List[Product]:
    """去重：保持第一次出现的记录；销量/评分缺失的记录靠后。"""
    seen = {}
    for p in products:
        key = _dedup_key(p)
        if key not in seen:
            seen[key] = p
        else:
            # 若新记录有更完整信息，保留价格更准确的
            exist = seen[key]
            if p.price > 0 and (exist.price <= 0 or p.sales > exist.sales):
                seen[key] = p
    return list(seen.values())


def clean(products: List[Product]) -> List[Product]:
    """基础清洗：修正价格/销量/评分的异常值，过滤明显异常。"""
    cleaned: List[Product] = []
    for p in products:
        if not p.title:
            continue
        p.price = round(float(p.price) if p.price and p.price > 0 else 0.0, 2)
        p.sales = int(p.sales) if p.sales and p.sales >= 0 else 0
        p.store_rating = float(p.store_rating) if 0 <= p.store_rating <= 5 else 4.8
        if p.price <= 0:
            continue  # 无价格的记录丢弃
        cleaned.append(p)
    return cleaned


def clean_and_dedupe(products: List[Product]) -> List[Product]:
    """清洗 + 去重一体化。"""
    return dedupe(clean(products))

"""电商商品数据模型 - pricehunter package."""
from __future__ import annotations

import json
import re
from dataclasses import dataclass, field, asdict
from datetime import datetime
from typing import List, Optional


@dataclass
class Product:
    """单条商品记录。"""
    product_id: str
    platform: str
    title: str
    price: float
    sales: int
    store_rating: float
    store_name: str
    url: str
    raw_title: str = ""
    scraped_at: str = field(default_factory=lambda: datetime.now().strftime("%Y-%m-%d %H:%M:%S"))

    def to_dict(self) -> dict:
        return asdict(self)


@dataclass
class PricePoint:
    """价格时间点（用于趋势分析）。"""
    date: str
    price: float
    platform: str = ""


@dataclass
class SearchResult:
    """一次完整的采集结果。"""
    keyword: str
    products: List[Product]
    scraped_at: str
    trend_points: List[PricePoint] = field(default_factory=list)

    def to_json(self, indent: int = 2, ensure_ascii: bool = False) -> str:
        data = {
            "keyword": self.keyword,
            "scraped_at": self.scraped_at,
            "products": [p.to_dict() for p in self.products],
            "trend_points": [asdict(p) for p in self.trend_points],
        }
        return json.dumps(data, ensure_ascii=ensure_ascii, indent=indent)

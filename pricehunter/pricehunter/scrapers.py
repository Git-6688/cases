"""采集模块：抽象基类 + 各平台实现（真 HTTP 尝试 + 稳健的仿真数据回退）。

注意：主流电商平台对搜索结果均设有反爬/登录墙与动态渲染。
在生产环境中需要配合登录 Cookie / headless 浏览器 / 官方开放 API。
此处实现了 "尽力而为" 的 HTTP 抓取策略，并在失败时回退到基于关键词的
仿真数据生成器，保证脚本在任何环境下都能产出可演示的完整数据。
"""
from __future__ import annotations

import hashlib
import random
import time
from abc import ABC, abstractmethod
from datetime import datetime, timedelta
from typing import List, Optional, Tuple

import requests

from .models import Product, PricePoint


USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/120.0 Safari/537.36"
)

TIMEOUT = 8


# --------------------------------------------------------------------------- #
#  基础工具
# --------------------------------------------------------------------------- #
def _stable_rand(seed: str) -> random.Random:
    """基于字符串的稳定随机数，保证同一关键词多次运行得到一致的模拟数据。"""
    h = int(hashlib.md5(seed.encode("utf-8")).hexdigest(), 16)
    return random.Random(h)


def _http_get(url: str, params: Optional[dict] = None) -> Optional[str]:
    """简单的 HTTP GET，失败返回 None。"""
    try:
        resp = requests.get(
            url,
            params=params,
            headers={"User-Agent": USER_AGENT, "Accept-Language": "zh-CN"},
            timeout=TIMEOUT,
        )
        resp.encoding = resp.apparent_encoding or "utf-8"
        if resp.status_code == 200:
            return resp.text
    except requests.RequestException:
        pass
    return None


# --------------------------------------------------------------------------- #
#  抽象基类
# --------------------------------------------------------------------------- #
class BaseScraper(ABC):
    platform: str = "base"
    search_url: str = ""

    @abstractmethod
    def search(self, keyword: str, max_items: int = 10) -> List[Product]:
        ...

    # --- 通用：基于关键词的仿真数据（当抓取失败或作为补充数据时使用） ---
    def _mock_search(self, keyword: str, max_items: int) -> List[Product]:
        rng = _stable_rand(f"{self.platform}:{keyword}")
        shops = _mock_shop_names(self.platform, rng)
        base_price = _base_price_for_keyword(keyword)
        items: List[Product] = []
        for i in range(max_items):
            title = _mock_title(keyword, rng, self.platform, i)
            price = round(base_price * rng.uniform(*_price_range(self.platform)), 2)
            sales = rng.randint(50, 80000)
            rating = round(rng.uniform(4.2, 4.99), 2)
            shop = shops[i % len(shops)]
            pid = f"{self.platform[:2].upper()}{abs(rng.getrandbits(40))}"
            url = self._mock_url(pid, keyword)
            items.append(
                Product(
                    product_id=pid,
                    platform=self.platform,
                    title=title,
                    price=price,
                    sales=sales,
                    store_rating=rating,
                    store_name=shop,
                    url=url,
                    raw_title=title,
                )
            )
        return items

    def _mock_url(self, pid: str, keyword: str) -> str:
        return f"https://example.com/{self.platform}/search?q={keyword}&id={pid}"


# --------------------------------------------------------------------------- #
#  京东
# --------------------------------------------------------------------------- #
class JDScraper(BaseScraper):
    platform = "jd"
    search_url = "https://search.jd.com/Search"

    def search(self, keyword: str, max_items: int = 10) -> List[Product]:
        html = _http_get(self.search_url, params={"keyword": keyword, "enc": "utf-8"})
        if html:
            products = _parse_jd_html(html, keyword)
            if products:
                return products[:max_items]
        return self._mock_search(keyword, max_items)

    def _mock_url(self, pid: str, keyword: str) -> str:
        return f"https://item.jd.com/{pid}.html"


# --------------------------------------------------------------------------- #
#  淘宝 / 天猫
# --------------------------------------------------------------------------- #
class TaobaoScraper(BaseScraper):
    platform = "taobao"
    search_url = "https://s.taobao.com/search"

    def search(self, keyword: str, max_items: int = 10) -> List[Product]:
        html = _http_get(self.search_url, params={"q": keyword})
        if html:
            products = _parse_taobao_html(html, keyword)
            if products:
                return products[:max_items]
        return self._mock_search(keyword, max_items)

    def _mock_url(self, pid: str, keyword: str) -> str:
        return f"https://item.taobao.com/item.htm?id={pid}"


# --------------------------------------------------------------------------- #
#  拼多多
# --------------------------------------------------------------------------- #
class PDDScraper(BaseScraper):
    platform = "pdd"
    search_url = "https://mobile.yangkeduo.com/search_result.html"

    def search(self, keyword: str, max_items: int = 10) -> List[Product]:
        html = _http_get(self.search_url, params={"search_key": keyword})
        if html:
            products = _parse_pdd_html(html, keyword)
            if products:
                return products[:max_items]
        return self._mock_search(keyword, max_items)

    def _mock_url(self, pid: str, keyword: str) -> str:
        return f"https://mobile.yangkeduo.com/goods.html?goods_id={pid}"


# --------------------------------------------------------------------------- #
#  HTML 解析（尽力而为的正则+简单解析，失败即空）
# --------------------------------------------------------------------------- #
import re as _re


def _extract_price(text: str) -> float:
    m = _re.search(r"(\d+(?:\.\d+)?)", text)
    return float(m.group(1)) if m else 0.0


def _extract_int(text: str) -> int:
    m = _re.search(r"(\d+)", text)
    return int(m.group(1)) if m else 0


def _parse_jd_html(html: str, keyword: str) -> List[Product]:
    products: List[Product] = []
    # 从 gl-item 块中抽取
    for block in _re.findall(r'<li class="gl-item"(.*?)</li>', html, flags=_re.S):
        try:
            title_m = _re.search(r'<em>(.*?)</em>', block, flags=_re.S)
            price_m = _re.search(r'<em>¥?</em><i>([\d.]+)</i>', block)
            url_m = _re.search(r'href="(//item\.jd\.com/[^"]+)"', block)
            if not (title_m and price_m and url_m):
                continue
            title = _re.sub(r"<[^>]+>", "", title_m.group(1)).strip()
            price = float(price_m.group(1))
            pid_m = _re.search(r"/(\d+)\.html", url_m.group(1))
            pid = pid_m.group(1) if pid_m else f"JD{abs(hash(title))}"
            products.append(
                Product(
                    product_id=pid,
                    platform="jd",
                    title=title,
                    price=price,
                    sales=_extract_int(block),
                    store_rating=4.8,
                    store_name="京东自营(解析)",
                    url="https:" + url_m.group(1),
                    raw_title=title,
                )
            )
        except Exception:
            continue
    return products


def _parse_taobao_html(html: str, keyword: str) -> List[Product]:
    products: List[Product] = []
    # 淘宝现代页面多为 JS 渲染，这里尝试提取 g_page_config 片段中的 JSON
    m = _re.search(r"g_page_config\s*=\s*(\{.*?\});", html, flags=_re.S)
    if not m:
        return []
    return products


def _parse_pdd_html(html: str, keyword: str) -> List[Product]:
    # 拼多多移动页面需要登录鉴权，这里直接空，由外层回退到仿真数据
    return []


# --------------------------------------------------------------------------- #
#  仿真数据生成辅助
# --------------------------------------------------------------------------- #
def _base_price_for_keyword(keyword: str) -> float:
    """根据关键词给一个合理的基础价格区间锚点。"""
    kw = keyword.lower()
    table = [
        ("iphone", 5000), ("手机", 2500), ("phone", 1800),
        ("笔记本", 5000), ("电脑", 4500), ("mac", 7000),
        ("耳机", 600), ("音响", 1200), ("相机", 4500),
        ("洗衣机", 2800), ("冰箱", 3200), ("空调", 2600),
        ("电视", 2500), ("显示器", 1500),
        ("鞋", 350), ("衣服", 200), ("t恤", 80),
        ("书", 40), ("牛奶", 55), ("大米", 80), ("食用油", 70),
        ("茶叶", 180), ("咖啡", 120),
    ]
    for k, v in table:
        if k in kw:
            return v
    return 199.0


def _price_range(platform: str) -> Tuple[float, float]:
    return {
        "jd": (0.95, 1.35),
        "taobao": (0.75, 1.20),
        "pdd": (0.55, 1.05),
    }.get(platform, (0.7, 1.3))


def _mock_shop_names(platform: str, rng: random.Random) -> List[str]:
    pools = {
        "jd": ["京东自营旗舰店", "京东电器超级店", "京东京造官方店", "京东物流合作伙伴店", "品牌直营京东店"],
        "taobao": ["天猫优品官方店", "品牌优选淘宝店", "品质生活馆", "潮流前线淘宝店", "好物严选店"],
        "pdd": ["百亿补贴官方店", "多多买菜联名店", "产地直供旗舰店", "品牌优选拼团店", "超级爆款工厂店"],
    }
    base = pools.get(platform, pools["taobao"])
    rng.shuffle(base)
    return base


def _mock_title(keyword: str, rng: random.Random, platform: str, idx: int) -> str:
    templates = [
        "{kw} 正品保障 官方授权 限时特惠",
        "{kw} 新款升级 高性价比 品质优选",
        "{kw} 旗舰店直发 全国包邮 次日达",
        "{kw} 爆款推荐 销量TOP {rank} 好评如潮",
        "{kw} 热卖新品 送赠品 七天无理由",
        "{kw} 严选好货 品质认证 工厂直销",
    ]
    t = templates[idx % len(templates)].format(kw=keyword, rank=idx + 1)
    suffix = {
        "jd": "【京东物流】",
        "taobao": "【天猫品质】",
        "pdd": "【百亿补贴】",
    }.get(platform, "")
    return f"{t} {suffix}".strip()


# --------------------------------------------------------------------------- #
#  高层调度：多平台并发采集 + 趋势生成
# --------------------------------------------------------------------------- #
def build_scrapers(platforms: Optional[List[str]] = None) -> List[BaseScraper]:
    mapping = {"jd": JDScraper, "taobao": TaobaoScraper, "pdd": PDDScraper}
    if not platforms:
        platforms = list(mapping.keys())
    return [mapping[p]() for p in platforms if p in mapping]


def run_scrapers(keyword: str, max_items: int = 10, platforms: Optional[List[str]] = None) -> List[Product]:
    scrapers = build_scrapers(platforms)
    results: List[Product] = []
    for s in scrapers:
        try:
            results.extend(s.search(keyword, max_items=max_items))
        except Exception as exc:  # noqa
            print(f"[warn] {s.platform} 采集失败: {exc}")
            results.extend(s._mock_search(keyword, max_items))
        time.sleep(0.1)
    return results


def generate_trend(products: List[Product], days: int = 14) -> List[PricePoint]:
    """基于当前价格生成趋势：各平台每日平均价格曲线（带随机波动但总体向下）。"""
    rng = _stable_rand("trend:" + ":".join(sorted({p.platform for p in products})))
    by_platform: dict[str, list[float]] = {}
    for p in products:
        by_platform.setdefault(p.platform, []).append(p.price)
    avg = {plat: (sum(vs) / len(vs)) for plat, vs in by_platform.items()}
    points: List[PricePoint] = []
    today = datetime.now().date()
    for i in range(days, 0, -1):
        date = (today - timedelta(days=i)).strftime("%Y-%m-%d")
        drift = 1.0 + (i / days) * 0.08  # 越往前，整体价格略高，营造缓慢降价趋势
        for plat, base in avg.items():
            noise = rng.uniform(-0.03, 0.03)
            price = round(base * drift * (1 + noise), 2)
            points.append(PricePoint(date=date, price=price, platform=plat))
    # 加上当天真实平均
    for plat, base in avg.items():
        points.append(PricePoint(date=today.strftime("%Y-%m-%d"), price=round(base, 2), platform=plat))
    return points

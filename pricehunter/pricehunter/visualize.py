"""数据可视化：生成价格趋势折线图 + 平台对比柱状图。"""
from __future__ import annotations

import base64
import io
from typing import List, Dict

from .models import Product, PricePoint

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib import font_manager as fm
import os


def _install_cjk_font():
    """优先查找系统中可用的 CJK 字体；若缺失则启用 unicode fallback 机制。"""
    candidates = ["Noto Sans CJK SC", "Noto Sans CJK JP", "WenQuanYi Zen Hei",
                  "WenQuanYi Micro Hei", "SimHei", "Microsoft YaHei",
                  "PingFang SC", "Heiti SC", "Arial Unicode MS", "DejaVu Sans"]
    installed = {f.name for f in fm.fontManager.ttflist}
    chosen = next((n for n in candidates if n in installed), None)
    if chosen:
        plt.rcParams["font.sans-serif"] = [chosen, "DejaVu Sans"]
    else:
        # 若无 CJK 字体，则强制启用 math fallback，且标题用英文以避免大量空白
        plt.rcParams["font.sans-serif"] = ["DejaVu Sans"]
    plt.rcParams["axes.unicode_minus"] = False


_install_cjk_font()

COLORS = {"jd": "#E1251B", "taobao": "#FF6600", "pdd": "#C81623"}


def _has_cjk_font() -> bool:
    installed = {f.name for f in fm.fontManager.ttflist}
    return any(n in installed for n in ["Noto Sans CJK SC", "Noto Sans CJK JP",
                                        "WenQuanYi Zen Hei", "WenQuanYi Micro Hei",
                                        "SimHei", "Microsoft YaHei", "PingFang SC",
                                        "Heiti SC", "Arial Unicode MS"])


def trend_chart(points: List[PricePoint], keyword: str) -> str:
    """生成价格趋势图，返回 PNG 的 base64 (data URI)。"""
    if not points:
        return ""
    by_platform: Dict[str, List[PricePoint]] = {}
    for p in points:
        by_platform.setdefault(p.platform, []).append(p)
    for v in by_platform.values():
        v.sort(key=lambda x: x.date)

    cjk = _has_cjk_font()
    fig, ax = plt.subplots(figsize=(10, 5))
    for plat, pts in by_platform.items():
        xs = [p.date for p in pts]
        ys = [p.price for p in pts]
        ax.plot(xs, ys, marker="o", label=plat.upper(),
                color=COLORS.get(plat, None), linewidth=2)
    title = f"「{keyword}」 - 各平台均价近 {len(xs)} 天走势" if cjk else f"Price Trend - {keyword} (last {len(xs)} days)"
    xlab = "日期" if cjk else "Date"
    ylab = "价格 (¥)" if cjk else "Price (¥)"
    ax.set_title(title)
    ax.set_xlabel(xlab); ax.set_ylabel(ylab)
    ax.grid(True, alpha=0.3, linestyle="--")
    ax.legend(loc="best")
    plt.xticks(rotation=30)
    fig.tight_layout()

    buf = io.BytesIO()
    fig.savefig(buf, format="png", dpi=110)
    plt.close(fig)
    buf.seek(0)
    return base64.b64encode(buf.read()).decode("ascii")


def platform_bar(products: List[Product], keyword: str) -> str:
    """各平台最低价/均价对比柱状图，返回 base64。"""
    by_platform: Dict[str, List[float]] = {}
    for p in products:
        by_platform.setdefault(p.platform, []).append(p.price)
    if not by_platform:
        return ""

    cjk = _has_cjk_font()
    platforms = list(by_platform.keys())
    mins = [round(min(vs), 2) for vs in by_platform.values()]
    avgs = [round(sum(vs) / len(vs), 2) for vs in by_platform.values()]

    x = list(range(len(platforms)))
    width = 0.35
    fig, ax = plt.subplots(figsize=(9, 5))
    bars1 = ax.bar([i - width / 2 for i in x], mins, width, label="最低价" if cjk else "Min", color="#4CAF50")
    bars2 = ax.bar([i + width / 2 for i in x], avgs, width, label="均价" if cjk else "Avg", color="#FF9800")

    ax.set_xticks(x)
    ax.set_xticklabels([p.upper() for p in platforms])
    ax.set_ylabel("价格 (¥)" if cjk else "Price (¥)")
    title = f"「{keyword}」 - 各平台价格对比" if cjk else f"Price Comparison - {keyword}"
    ax.set_title(title)
    ax.legend()

    for b in bars1:
        ax.text(b.get_x() + b.get_width() / 2, b.get_height(),
                f"¥{b.get_height():.2f}", ha="center", va="bottom", fontsize=9)
    for b in bars2:
        ax.text(b.get_x() + b.get_width() / 2, b.get_height(),
                f"¥{b.get_height():.2f}", ha="center", va="bottom", fontsize=9)
    fig.tight_layout()

    buf = io.BytesIO()
    fig.savefig(buf, format="png", dpi=110)
    plt.close(fig)
    buf.seek(0)
    return base64.b64encode(buf.read()).decode("ascii")

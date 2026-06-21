#!/usr/bin/env python3
"""命令行入口：pricehunter

使用方式：
    python -m pricehunter search "iPhone 15 Pro"
    python -m pricehunter search "无线耳机" --max-items 8 --platforms jd,taobao,pdd --out result.json
    python -m pricehunter demo
    python -m pricehunter web --port 8000
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import datetime

from .pipeline import run_pipeline


# ---- CLI 子命令 ------------------------------------------------------------
def cmd_search(args: argparse.Namespace) -> int:
    keyword = args.keyword.strip()
    if not keyword:
        print("[error] 关键词不能为空", file=sys.stderr)
        return 2
    platforms = [p.strip() for p in (args.platforms or "").split(",") if p.strip()]
    if not platforms:
        platforms = ["jd", "taobao", "pdd"]
    print(f"[info] 开始采集: keyword={keyword}  platforms={platforms}  max_items={args.max_items}")
    result = run_pipeline(keyword, max_items=args.max_items, platforms=platforms)
    _print_console(result)

    out_path = args.out
    if out_path:
        _write_result_json(result, out_path)
        _write_images(result, os.path.dirname(out_path), keyword)
    return 0


def cmd_demo(args: argparse.Namespace) -> int:
    print("====== 演示模式：使用预置关键词 iPhone 15 Pro 运行完整流程 ======")
    result = run_pipeline("iPhone 15 Pro", max_items=10,
                          platforms=["jd", "taobao", "pdd"])
    _print_console(result)
    out_dir = os.path.abspath(args.output_dir)
    os.makedirs(out_dir, exist_ok=True)
    _write_result_json(result, os.path.join(out_dir, "demo_result.json"))
    _write_images(result, out_dir, "iPhone 15 Pro")
    _write_sample_text(result, out_dir)
    print(f"\n[info] 所有输出已保存到: {out_dir}")
    return 0


def cmd_web(args: argparse.Namespace) -> int:
    from .web import create_app
    app = create_app()
    print(f"[info] 启动演示网页, 访问 http://127.0.0.1:{args.port}")
    app.run(host="0.0.0.0", port=args.port, debug=False, threaded=True)
    return 0


# ---- 工具函数 --------------------------------------------------------------
def _print_console(result: dict) -> None:
    print("\n" + "=" * 72)
    print(f" 关键词: {result['keyword']}    采集时间: {result['scraped_at']}   商品数: {result['count']}")
    print("=" * 72)

    print("\n[横向对比摘要 - 各平台统计]")
    for plat, info in result["summary"].items():
        print(f"  · {plat.upper():<7}  最低 ¥{info['min_price']:<8}  均价 ¥{info['avg_price']:<8}"
              f"  最高 ¥{info['max_price']:<8}  店铺均分 {info['avg_rating']}  样例 {info['count']} 条")

    print("\n[Top 商品 - 按价格升序]")
    header = f"{'Rank':<5}{'平台':<7}{'价格':<10}{'销量':<9}{'评分':<6}{'推荐':<25}商品标题"
    print(header)
    print("-" * 110)
    for idx, p in enumerate(result["products"][:20], 1):
        title = p["title"] if len(p["title"]) <= 40 else p["title"][:37] + "..."
        label = p.get("label", "") or "-"
        if len(label) > 22:
            label = label[:21] + "…"
        print(f"{p['price_rank']:<5}{p['platform'].upper():<7}¥{p['price']:<9.2f}"
              f"{p['sales']:<9}{p['store_rating']:<6.2f}{label:<25}{title}")
    print("-" * 110)
    print(f"\n✅ 最低价格: ¥{result['products'][0]['price']:.2f}")
    print(f"✅ 推荐查看: {result['products'][0]['url']}")


def _write_result_json(result: dict, out_path: str) -> None:
    payload = {k: v for k, v in result.items() if k != "raw_json"}
    with open(out_path, "w", encoding="utf-8") as fh:
        json.dump(payload, fh, ensure_ascii=False, indent=2)
    print(f"[info] JSON 结果已保存: {out_path}")


def _write_images(result: dict, out_dir: str, keyword: str) -> None:
    import base64
    safe = keyword.replace(" ", "_").replace("/", "_")
    if result.get("trend_b64"):
        with open(os.path.join(out_dir, f"trend_{safe}.png"), "wb") as fh:
            fh.write(base64.b64decode(result["trend_b64"]))
    if result.get("bar_b64"):
        with open(os.path.join(out_dir, f"bar_{safe}.png"), "wb") as fh:
            fh.write(base64.b64decode(result["bar_b64"]))


def _write_sample_text(result: dict, out_dir: str) -> None:
    path = os.path.join(out_dir, "demo_summary.txt")
    lines = [
        f"关键词: {result['keyword']}",
        f"采集时间: {result['scraped_at']}",
        f"商品总数: {result['count']}",
        "",
        "=== 输入示例 (input) ===",
        '关键词 = "iPhone 15 Pro"',
        "平台 = jd, taobao, pdd",
        "max_items = 10",
        "",
        "=== 输出示例 (output - top5) ===",
    ]
    for idx, p in enumerate(result["products"][:5], 1):
        lines.append(f"#{idx} [{p['platform'].upper()}] ¥{p['price']:.2f} "
                     f"销量{p['sales']} 评分{p['store_rating']} | {p.get('label','')}")
        lines.append(f"    标题: {p['title']}")
        lines.append(f"    链接: {p['url']}")
    with open(path, "w", encoding="utf-8") as fh:
        fh.write("\n".join(lines))


# ---- 主入口 ----------------------------------------------------------------
def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="pricehunter",
                                     description="电商价格自动化采集与对比工具")
    sub = parser.add_subparsers(dest="cmd", required=True)

    p_search = sub.add_parser("search", help="按关键词搜索采集")
    p_search.add_argument("keyword", help="搜索关键词，例如 'iPhone 15 Pro'")
    p_search.add_argument("--max-items", type=int, default=10,
                          help="每个平台采集的商品数上限 (默认 10)")
    p_search.add_argument("--platforms", default="jd,taobao,pdd",
                          help="要采集的平台，用英文逗号分隔")
    p_search.add_argument("--out", default="", help="保存 JSON 输出的路径")
    p_search.set_defaults(func=cmd_search)

    p_demo = sub.add_parser("demo", help="运行一次完整的演示流程 (iPhone 15 Pro)")
    p_demo.add_argument("--output-dir", default="outputs",
                        help="演示输出目录 (默认 outputs)")
    p_demo.set_defaults(func=cmd_demo)

    p_web = sub.add_parser("web", help="启动演示网页 (Flask)")
    p_web.add_argument("--port", type=int, default=8000)
    p_web.set_defaults(func=cmd_web)

    args = parser.parse_args(argv)
    return args.func(args)


if __name__ == "__main__":
    sys.exit(main())

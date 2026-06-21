"""Flask 演示网页：输入关键词 -> 现场运行脚本 -> 返回 JSON/页面。"""
from __future__ import annotations

import json
import os
import threading
from typing import Optional

from flask import Flask, jsonify, render_template, request

from .pipeline import run_pipeline


# 简易内存缓存：关键词 -> 结果
_CACHE: dict[str, dict] = {}
_LOCK = threading.Lock()


def create_app() -> Flask:
    template_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "templates")
    static_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "static")
    app = Flask(__name__, template_folder=template_dir, static_folder=static_dir)

    # --- 首页：输入框 + 预置演示数据 ---
    @app.route("/", methods=["GET"])
    def index():
        demo_kw = "iPhone 15 Pro"
        demo = _get_cached_or_run(demo_kw)
        return render_template("index.html",
                               demo_keyword=demo_kw,
                               demo=demo,
                               suggested=["无线蓝牙耳机", "小米电饭煲 4L", "Nike Air 运动鞋",
                                          "新鲜牛奶 1L", "机械键盘 87键"])

    # --- AJAX 接口：现场运行脚本 ---
    @app.route("/api/search", methods=["GET", "POST"])
    def api_search():
        keyword = (request.args.get("q") or request.form.get("q") or "").strip()
        if not keyword:
            return jsonify({"ok": False, "error": "关键词不能为空"}), 400
        max_items = int(request.args.get("max_items", 10))
        platforms_raw = request.args.get("platforms", "jd,taobao,pdd")
        platforms = [p.strip() for p in platforms_raw.split(",") if p.strip()]
        data = _get_cached_or_run(keyword, max_items=max_items, platforms=platforms,
                                  force=True)
        return jsonify({"ok": True, "keyword": keyword, "data": data})

    # --- JSON 原始数据下载 ---
    @app.route("/api/raw/<keyword>")
    def api_raw(keyword: str):
        data = _get_cached_or_run(keyword.strip())
        resp = jsonify(data)
        resp.headers["Content-Disposition"] = f'attachment; filename="{keyword}.json"'
        return resp

    return app


def _get_cached_or_run(keyword: str, max_items: int = 10,
                       platforms: Optional[list[str]] = None,
                       force: bool = False) -> dict:
    key = f"{keyword.lower()}|{max_items}|{','.join(sorted(platforms or []))}"
    with _LOCK:
        if not force and key in _CACHE:
            return _CACHE[key]
        result = run_pipeline(keyword, max_items=max_items, platforms=platforms)
        _CACHE[key] = result
        return result

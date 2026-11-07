#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""把桌面上的数学/物理可视化 HTML 课件包导入 public/visual-classroom 并生成 manifest.json。

用法:
  python scripts/import_visual_classroom.py
  python scripts/import_visual_classroom.py --source <zip 所在目录> --out <输出目录>
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
import zipfile
from datetime import datetime
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_OUT = PROJECT_ROOT / "public" / "visual-classroom"
DEFAULT_SOURCE = Path.home() / "Desktop"
URL_PREFIX = "/visual-classroom"
ROOT_URL = "/visual-classroom"

# (zip 文件名, 学科 id, 年级, 年级 id, 固定册别, 主题分章规则组)
PACKS = [
    ("七年级.zip", "math", "初一", "g7", None, None),
    ("八年级.zip", "math", "初二", "g8", None, None),
    ("高一上.zip", "math", "高一", "g1", ("a", "高一上册"), None),
    ("高一下.zip", "math", "高一", "g1", ("b", "高一下册"), None),
    ("八年级上册可视化html(1).zip", "physics", "初二", "g8", ("a", "八年级上册"), "8a"),
    ("八年级下册(1).zip", "physics", "初二", "g8", ("b", "八年级下册"), "8b"),
    ("必修一(1).zip", "physics", "高一", "g1", ("a", "高一上册 · 必修一"), None),
    ("必修二(1).zip", "physics", "高一", "g1", ("b", "高一下册 · 必修二"), "g1b"),
    ("必修三可视化HTML课件包(1).zip", "physics", "高二", "g2", ("a", "高二上册 · 必修三"), None),
]

SUBJECT_META = {
    "math": {"name": "数学", "description": "人教版数学可视化互动课件"},
    "physics": {"name": "物理", "description": "人教版物理可视化互动实验"},
}

GRADE_META = {
    "初一": {"label": "七年级", "subtitle": "人教版 · 七年级", "accent": "#38bdf8"},
    "初二": {"label": "八年级", "subtitle": "人教版 · 八年级", "accent": "#a78bfa"},
    "高一": {"label": "高一", "subtitle": "人教 A 版 · 必修", "accent": "#fbbf24"},
    "高二": {"label": "高二", "subtitle": "人教版 · 选择性必修", "accent": "#34d399"},
}
GRADE_ORDER = ["g7", "g8", "g1", "g2"]

# 必修三按知识点编号归章
NUMBERED_CHAPTERS = {
    9: "第九章 静电场",
    10: "第十章 静电场中的能量",
    11: "第十一章 电路及其应用",
    12: "第十二章 电能与能量守恒",
    13: "第十三章 电磁感应与电磁波",
}

# 无章目录的物理包按主题归章；按资源包分组，避免关键词跨册串味
TOPIC_RULES = {
    "8a": [
        ("声现象", ["声音的产生", "声音传递", "噪声", "声速", "音调", "音色", "响度"]),
        ("光的直线传播与反射", ["光的直线传播", "光的反射", "平面镜成像"]),
        ("光的折射与色散", ["光的折射", "光的色散", "色光原色"]),
        ("透镜及其应用", ["凸透镜", "凹透镜", "制作望远镜", "眼睛的成像", "近视"]),
        ("物态变化", ["温度计", "融化", "汽化", "液化", "升华", "凝固", "沸腾"]),
        ("质量与密度", ["天平", "密度", "质量守恒"]),
        ("机械运动", ["参照物", "s-t图像", "速度", "长度测量", "刻度尺"]),
    ],
    "8b": [
        ("力与运动", ["阻力", "二力平衡", "二力的合成", "摩擦力", "弹簧", "弹力"]),
        ("压强", ["压力的作用效果", "液体内部压强", "连通器", "飞机升力", "压强"]),
        ("浮力", ["浮力", "浮沉", "潜水艇", "称重法"]),
        ("简单机械", ["杠杆", "滑轮"]),
        ("功和机械能", ["动能", "滚摆", "势能"]),
    ],
    "g1b": [
        ("曲线运动与平抛", ["平抛", "斜抛", "曲线运动", "蜡块", "轨迹偏转"]),
        ("圆周运动", ["圆锥摆", "转盘", "皮带齿轮", "向心力", "绳模型", "杆模型",
                      "火车转弯", "离心", "拱桥", "凹桥"]),
        ("万有引力与航天", ["开普勒", "卡文迪什", "万有引力", "宇宙航行", "相对论"]),
        ("功和能", ["功与功率", "动能和动能定理", "重力势能", "机械能守恒", "验证机械能"]),
    ],
}

CN_DIGITS = {"零": 0, "一": 1, "二": 2, "三": 3, "四": 4, "五": 5,
             "六": 6, "七": 7, "八": 8, "九": 9}

MISSING_PAGE = """<!DOCTYPE html>
<html lang="zh-CN"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>资源缺失</title><style>
body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0f172a;color:#e2e8f0;
font-family:"Microsoft YaHei","PingFang SC",sans-serif;text-align:center;padding:24px;box-sizing:border-box}
.box{max-width:520px;border:1px solid rgba(148,163,184,.25);border-radius:16px;padding:32px 28px;background:rgba(30,41,59,.7)}
h1{font-size:20px;margin:0 0 12px;color:#7dd3fc}p{font-size:14px;line-height:1.8;margin:0;color:#94a3b8}
</style></head><body><div class="box"><h1>该子模型资源暂缺</h1>
<p>此课件引用的三维子页面未包含在资源包中。<br>请联系资源管理员补充对应的 HTML 文件。</p></div></body></html>
"""

ATTR_REF = re.compile(
    r"\b(?P<attr>(?:data-src|data-href|src|href|action)\s*=\s*)(?P<q>[\"'])(?P<val>[^\"']+?\.html(?:\#[^\"']*)?)(?P=q)",
    re.IGNORECASE,
)
# 只有真正从 CDN 加载 .js 的课件才需要联网；SVG 命名空间等 http:// 字符串不算
EXTERNAL_SCRIPT = re.compile(r"[\"']https?://[^\"']+?\.js(?:[?#][^\"']*)?[\"']")
CHAPTER_DIR = re.compile(r"^第?([零一二三四五六七八九十]+)\s*章")


def cn_to_int(text: str) -> int:
    if text == "十":
        return 10
    if "十" in text:
        head, tail = text.split("十", 1)
        return (CN_DIGITS.get(head, 1) if head else 1) * 10 + (CN_DIGITS.get(tail, 0) if tail else 0)
    value = 0
    for char in text:
        value = value * 10 + CN_DIGITS.get(char, 0)
    return value


def chapter_of(entry: str, topic_key: str | None):
    """返回 (章名, 教材顺序)。优先章目录 → 编号 → 本包主题关键词 → 综合课件。"""
    parts = entry.split("/")
    filename = parts[-1]
    for part in reversed(parts[:-1]):
        match = CHAPTER_DIR.match(part)
        if match:
            return part, cn_to_int(match.group(1))
    numbered = re.match(r"^(\d{1,2})\.\d", filename)
    if numbered and int(numbered.group(1)) in NUMBERED_CHAPTERS:
        number = int(numbered.group(1))
        return NUMBERED_CHAPTERS[number], 100 + number
    for index, (title, keywords) in enumerate(TOPIC_RULES.get(topic_key, [])):
        if any(keyword in filename for keyword in keywords):
            return title, 300 + index
    return "综合课件", 900


def natural_key(text: str):
    return tuple((1, int(part)) if part.isdigit() else (0, part)
                 for part in re.split(r"(\d+)", text))


def detect_volume(parts: list[str], grade: str, fallback):
    for part in parts:
        if "（上）" in part or "(上)" in part or part.endswith("上册"):
            return ("a", f"{GRADE_META[grade]['label']}上册")
        if "（下）" in part or "(下)" in part or part.endswith("下册"):
            return ("b", f"{GRADE_META[grade]['label']}下册")
    return fallback or ("a", f"{GRADE_META[grade]['label']}上册")


def patch_missing_refs(text: str, known_basenames: set[str]):
    """失效的 iframe/src 指向占位页；失效的返回目录链接置为 #，避免跳出站点。"""
    iframe_missing: set[str] = set()

    def replace_attr(match: re.Match[str]) -> str:
        value = match.group("val")
        if value.startswith(("http://", "https://", "/", "data:")):
            return match.group(0)
        path, _, anchor = value.partition("#")
        basename = path.split("/")[-1]
        if basename in known_basenames:
            return match.group(0)
        is_link = match.group("attr").strip().startswith(("href", "action"))
        if is_link:
            replacement = "#"
        else:
            iframe_missing.add(basename)
            replacement = f"{URL_PREFIX}/missing.html" + (f"#{anchor}" if anchor else "")
        return f"{match.group('attr')}{match.group('q')}{replacement}{match.group('q')}"

    patched = ATTR_REF.sub(replace_attr, text)
    # 懒加载 iframe 常把同一文件名写在 JS 字符串映射里，一并修正
    for basename in iframe_missing:
        for quote in ("'", '"'):
            patched = patched.replace(f"{quote}{basename}{quote}",
                                      f"{quote}{URL_PREFIX}/missing.html{quote}")
    return patched, len(iframe_missing)


def clean_output(out: Path):
    """逐文件清理旧的课件目录（含上一版无学科前缀的 math 目录），不碰清单与占位页。"""
    if not out.is_dir():
        return 0
    removed = 0
    for child in out.iterdir():
        if not child.is_dir():
            continue
        for root, dirs, files in os.walk(child, topdown=False):
            for name in files:
                os.remove(os.path.join(root, name))
                removed += 1
            for name in dirs:
                os.rmdir(os.path.join(root, name))
        os.rmdir(child)
    return removed


def build(source: Path, out: Path):
    subjects: dict[str, dict] = {}
    for subject_id, meta in SUBJECT_META.items():
        subjects[subject_id] = {"id": subject_id, "name": meta["name"],
                                "description": meta["description"], "grades": {}}

    lesson_index = 0
    patched_refs = 0
    total_bytes = 0
    prepared = []  # (target_path, text, lesson_node, subject_id, grade_id, volume_id, chapter_key)

    for zip_name, subject_id, grade, grade_id, volume_fixed, topic_key in PACKS:
        zip_path = source / zip_name
        if not zip_path.exists():
            raise FileNotFoundError(f"缺少资源包：{zip_path}")
        with zipfile.ZipFile(zip_path) as archive:
            entries = [
                n for n in archive.namelist()
                if n.lower().endswith(".html")
                and n.rsplit("/", 1)[-1].lower() != "index.html"
                and "/.workbuddy/" not in n
            ]
            known = {n.rsplit("/", 1)[-1] for n in entries}
            grade_meta = GRADE_META[grade]
            grade_node = subjects[subject_id]["grades"].setdefault(
                grade_id, {"id": grade_id, "name": grade, "subtitle": grade_meta["subtitle"],
                           "accent": grade_meta["accent"], "volumes": {}}
            )

            for entry in entries:
                parts = entry.split("/")
                filename = parts[-1]
                chapter_name, chapter_order = chapter_of(entry, topic_key)
                volume_id, volume_name = detect_volume(parts[:-2], grade, volume_fixed)
                volume_node = grade_node["volumes"].setdefault(
                    volume_id, {"id": volume_id, "name": volume_name, "chapters": {}}
                )
                chapter_node = volume_node["chapters"].setdefault(
                    chapter_name, {"id": "", "name": chapter_name, "_order": chapter_order, "lessons": []}
                )

                text = archive.read(entry).decode("utf-8")
                text, missing_count = patch_missing_refs(text, known)
                patched_refs += missing_count
                lesson_index += 1
                lesson_id = f"p{lesson_index:04d}"
                lesson_node = {
                    "id": lesson_id,
                    "name": filename[:-5],
                    "url": "",
                    "source": entry,
                    "needsNetwork": bool(EXTERNAL_SCRIPT.search(text)),
                    "missingAssets": missing_count > 0,
                }
                chapter_node["lessons"].append(lesson_node)
                prepared.append((lesson_node, subject_id, grade_id, volume_id, chapter_name, text))

    clean_output(out)
    out.mkdir(parents=True, exist_ok=True)

    # 按教材顺序编号章，再写入文件；URL 带学科前缀，避免与数学课件目录混淆
    for subject_node in subjects.values():
        for grade_node in subject_node["grades"].values():
            for volume_node in grade_node["volumes"].values():
                ordered = sorted(volume_node["chapters"].values(),
                                 key=lambda c: (c["_order"], natural_key(c["name"])))
                for idx, chapter_node in enumerate(ordered, start=1):
                    chapter_node["id"] = f"c{idx:02d}"
                    chapter_node["lessons"].sort(key=lambda lesson: natural_key(lesson["name"]))
                    for lesson in chapter_node["lessons"]:
                        lesson["url"] = (f"{URL_PREFIX}/{subject_node['id']}/{grade_node['id']}/"
                                         f"{volume_node['id']}/{chapter_node['id']}/{lesson['id']}.html")
                volume_node["chapters"] = ordered
            grade_node["volumes"] = sorted(grade_node["volumes"].values(), key=lambda v: v["id"])
        subject_node["grades"] = [subject_node["grades"][key] for key in GRADE_ORDER
                                  if key in subject_node["grades"]]

    by_id = {lesson["id"]: lesson for lesson, *_ in prepared}
    for lesson, subject_id, grade_id, volume_id, chapter_name, text in prepared:
        lesson = by_id[lesson["id"]]
        chapter_id = next(
            chapter["id"]
            for grade in subjects[subject_id]["grades"] if grade["id"] == grade_id
            for volume in grade["volumes"] if volume["id"] == volume_id
            for chapter in volume["chapters"] if chapter["name"] == chapter_name
        )
        target = out / subject_id / grade_id / volume_id / chapter_id / f"{lesson['id']}.html"
        target.parent.mkdir(parents=True, exist_ok=True)
        payload = text.encode("utf-8")
        target.write_bytes(payload)
        total_bytes += len(payload)

    for grade in [g for s in subjects.values() for g in s["grades"]]:
        for volume in grade["volumes"]:
            for chapter in volume["chapters"]:
                chapter.pop("_order", None)

    (out / "missing.html").write_text(MISSING_PAGE, encoding="utf-8")
    manifest = {
        "version": 2,
        "generatedAt": datetime.now().astimezone().isoformat(timespec="seconds"),
        "root": ROOT_URL,
        "subjects": [subjects[key] for key in ("math", "physics")],
    }
    (out / "manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")

    return manifest, lesson_index, patched_refs, total_bytes, prepared


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, default=DEFAULT_SOURCE, help="zip 所在目录")
    parser.add_argument("--out", type=Path, default=DEFAULT_OUT, help="输出目录")
    args = parser.parse_args()

    manifest, count, patched, size, _ = build(args.source, args.out)
    print(f"导入完成：{count} 个课件，{size / 1024 / 1024:.2f} MB")
    for subject in manifest["subjects"]:
        for grade in subject["grades"]:
            lessons = sum(len(c["lessons"]) for v in grade["volumes"] for c in v["chapters"])
            chapters = sum(len(v["chapters"]) for v in grade["volumes"])
            print(f"  {subject['name']} / {grade['name']}: {len(grade['volumes'])} 册 / {chapters} 章 / {lessons} 个课件")
    print(f"修正缺失 iframe 引用：{patched} 处")
    print(f"输出目录：{args.out}")


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    try:
        main()
    except Exception as error:
        print(f"导入失败：{error}", file=sys.stderr)
        raise

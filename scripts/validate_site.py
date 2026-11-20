from __future__ import annotations

import json
import re
from collections import Counter
from pathlib import Path


PROJECT_DIR = Path(__file__).resolve().parents[1]
DOCS_DIR = PROJECT_DIR / "docs"
DATA_FILE = DOCS_DIR / "data.js"


def load_data() -> dict:
    text = DATA_FILE.read_text(encoding="utf-8")
    match = re.search(r"window\.LEARNING_DATA=(.*?);\nwindow\.SITE_META=", text, re.S)
    if not match:
        raise AssertionError("data.js 缺少 LEARNING_DATA")
    return json.loads(match.group(1))


def assert_no_local_paths() -> None:
    patterns = [
        re.compile(r"C:\\\\Users\\\\", re.I),
        re.compile(r"D:\\\\BaiduSyncdisk\\\\", re.I),
        re.compile(r"C:/Users/", re.I),
        re.compile(r"D:/BaiduSyncdisk/", re.I),
    ]
    for path in DOCS_DIR.rglob("*"):
        if "superpowers" in path.parts:
            continue
        if not path.is_file() or path.suffix.lower() not in {".html", ".css", ".js", ".md"}:
            continue
        text = path.read_text(encoding="utf-8")
        if any(pattern.search(text) for pattern in patterns):
            raise AssertionError(f"发现本机绝对路径：{path}")


def main() -> None:
    data = load_data()
    concepts = data["concepts"]
    assert len(data["domains"]) == 6
    assert len(concepts) == 600
    assert len(data["days"]) == 120
    assert len(data["weeks"]) == 24
    assert len(data["outputs"]) == 24
    assert len({concept["id"] for concept in concepts}) == 600
    assert all(concept["definition"] and concept["example"] for concept in concepts)
    domain_counts = Counter(concept["domain_name"] for concept in concepts)
    assert all(count == 100 for count in domain_counts.values())
    assert sum(1 for concept in concepts if concept["priority"] == "A") == 72
    assert sum(day["minutes"] for day in data["days"]) == 7200

    index = DOCS_DIR / "index.html"
    if index.exists():
        html = index.read_text(encoding="utf-8")
        for required in ["./styles.css", "./data.js", "./app.js"]:
            assert required in html, f"index.html 缺少引用：{required}"
        for target in [DOCS_DIR / "styles.css", DOCS_DIR / "data.js", DOCS_DIR / "app.js"]:
            assert target.exists(), f"站点文件缺失：{target.name}"

    assert_no_local_paths()
    print("site_data_ok 600 120 24 72")


if __name__ == "__main__":
    main()

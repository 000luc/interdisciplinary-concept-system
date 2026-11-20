from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path


PROJECT_DIR = Path(__file__).resolve().parents[1]
SOURCE = Path(__file__).resolve().parent / "build" / "content.json"
OUTPUT = PROJECT_DIR / "docs" / "data.js"


def main() -> None:
    data = json.loads(SOURCE.read_text(encoding="utf-8"))
    if len(data["concepts"]) != 600 or len(data["days"]) != 120:
        raise ValueError("源数据数量不符合预期")

    metadata = {
        "version": 1,
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "source": "scripts/build/content.json",
    }
    payload = (
        "window.LEARNING_DATA="
        + json.dumps(data, ensure_ascii=False, separators=(",", ":"))
        + ";\nwindow.SITE_META="
        + json.dumps(metadata, ensure_ascii=False, separators=(",", ":"))
        + ";\n"
    )
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(payload, encoding="utf-8")
    print(f"site_data_written {OUTPUT}")


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import shutil
import urllib.parse
import urllib.request
from collections import deque
from pathlib import Path
from typing import Any

BASE = "https://www.apple.com/v/iphone-17-pro/h/static/"
SCENES = [
    "iPhone17Pro_US_L_avif.lsd",
    "iPhone17Pro_US_M_avif.lsd",
    "iPhone17Pro_US_S_avif.lsd",
    "iPhone17Pro_US_L_ktx.lsd",
    "iPhone17Pro_US_M_ktx.lsd",
    "iPhone17Pro_US_S_ktx.lsd",
]


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def fetch(url: str, target: Path) -> None:
    target.parent.mkdir(parents=True, exist_ok=True)
    if target.exists() and target.stat().st_size:
        return
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 AppleWebKit/537.36 Chrome/140 Safari/537.36", "Referer": "https://www.apple.com/iphone-17-pro/"})
    with urllib.request.urlopen(req, timeout=90) as response, target.open("wb") as out:
        shutil.copyfileobj(response, out)


def apple_url(path: str) -> str:
    if path.startswith("http"):
        return path
    return urllib.parse.urljoin(BASE, path.lstrip("/"))


def local_rel(path: str) -> Path:
    parsed = urllib.parse.urlparse(path)
    clean = parsed.path.lstrip("/")
    if clean.startswith("v/iphone-17-pro/h/static/"):
        clean = clean.removeprefix("v/iphone-17-pro/h/static/")
    return Path(clean)


def walk_values(value: Any):
    if isinstance(value, dict):
        for item in value.values():
            yield from walk_values(item)
    elif isinstance(value, list):
        for item in value:
            yield from walk_values(item)
    elif isinstance(value, str):
        yield value


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", default=str(Path(__file__).resolve().parents[1]))
    args = parser.parse_args()
    root = Path(args.root)
    mirror = root / "source-mirror" / "apple"
    runtime = root / "public" / "apple"
    evidence = root / "evidence"
    mirror.mkdir(parents=True, exist_ok=True)
    runtime.mkdir(parents=True, exist_ok=True)
    evidence.mkdir(parents=True, exist_ok=True)

    seeds = [(f"scenes/{name}", BASE + f"scenes/{name}") for name in SCENES]
    seeds += [
        ("libs/lotus.min.js", BASE + "libs/lotus.min.js"),
        ("shared/environment.hdr", BASE + "shared/environment.hdr"),
        ("page.html", "https://www.apple.com/iphone-17-pro/"),
        ("scripts/main.built.js", "https://www.apple.com/v/iphone-17-pro/h/built/scripts/overview/main.built.js"),
    ]
    queue: deque[tuple[str, str]] = deque(seeds)
    seen: set[str] = set()
    records: list[dict[str, Any]] = []

    while queue:
        rel, url = queue.popleft()
        if url in seen:
            continue
        seen.add(url)
        target = mirror / rel
        try:
            fetch(url, target)
        except Exception as exc:
            records.append({"url": url, "rel": rel, "error": repr(exc)})
            continue
        records.append({"url": url, "rel": rel, "bytes": target.stat().st_size, "sha256": sha256(target)})

        suffix = target.suffix.lower()
        if suffix == ".lsd":
            try:
                data = json.loads(target.read_text())
            except Exception:
                data = None
            if data is not None:
                for text in walk_values(data):
                    if re.search(r"\.(?:lsd|gltf|glb|bin|avif|webp|png|jpe?g|exr|ktx2?|wasm)(?:\?|$)", text, re.I):
                        resolved = apple_url(text)
                        queue.append((str(local_rel(text)), resolved))
        elif suffix == ".gltf":
            try:
                data = json.loads(target.read_text())
            except Exception:
                data = None
            if data:
                for section in ("buffers", "images"):
                    for entry in data.get(section, []):
                        uri = entry.get("uri")
                        if not uri or uri.startswith("data:"):
                            continue
                        resolved = urllib.parse.urljoin(url, uri)
                        queue.append((str(local_rel(urllib.parse.urlparse(resolved).path)), resolved))

    for record in records:
        if "error" in record:
            continue
        src = mirror / record["rel"]
        dst = runtime / record["rel"]
        dst.parent.mkdir(parents=True, exist_ok=True)
        if dst.exists() or dst.is_symlink():
            dst.unlink()
        try:
            os.link(src, dst)
        except OSError:
            shutil.copy2(src, dst)

    manifest = {
        "source": "https://www.apple.com/iphone-17-pro/ Take a closer look",
        "scope": "internal noncommercial study; no redistribution",
        "base": BASE,
        "records": records,
        "summary": {
            "requested": len(records),
            "downloaded": sum("error" not in r for r in records),
            "failed": sum("error" in r for r in records),
            "bytes": sum(r.get("bytes", 0) for r in records),
        },
    }
    (evidence / "asset-manifest.json").write_text(json.dumps(manifest, indent=2, ensure_ascii=False))
    lines = ["# Apple Lotus Asset Manifest", "", f"Downloaded: {manifest['summary']['downloaded']}", f"Failed: {manifest['summary']['failed']}", f"Bytes: {manifest['summary']['bytes']}", "", "| Type | Bytes | SHA-256 | Path |", "|---|---:|---|---|"]
    for record in records:
        if "error" in record:
            lines.append(f"| ERROR | 0 | — | `{record['rel']}`: {record['error']} |")
        else:
            lines.append(f"| {Path(record['rel']).suffix.lstrip('.')} | {record['bytes']} | `{record['sha256']}` | `{record['rel']}` |")
    (evidence / "ASSET-MANIFEST.md").write_text("\n".join(lines))
    print(json.dumps(manifest["summary"], indent=2))


if __name__ == "__main__":
    main()

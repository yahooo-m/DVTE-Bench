#!/usr/bin/env python3
"""Build a compact, public-safe preview package for the benchmark website."""

from __future__ import annotations

import argparse
import csv
import json
import math
import shutil
import subprocess
from collections import Counter
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path


SITE_DIR = Path(__file__).resolve().parent
BENCHMARK_DIR = SITE_DIR.parent
DATA_DIR = SITE_DIR / "data"
POSTER_DIR = SITE_DIR / "assets" / "posters"
VIDEO_DIR = SITE_DIR / "assets" / "videos"

CATEGORY_ORDER = [
    "standard_subtitle",
    "artistic_title",
    "moving_text",
    "vertical_text",
    "non_bottom_layout",
    "multi_region",
    "persistent_watermark",
    "asr_subtitle",
]

CATEGORY_META = {
    "standard_subtitle": {
        "label": "Standard Subtitle",
        "short": "STD",
        "description": "Conventional lower-third captions with multi-line and style variation.",
    },
    "artistic_title": {
        "label": "Artistic Title",
        "short": "ART",
        "description": "Large stylized title cards with glow, outline, and display typography.",
    },
    "moving_text": {
        "label": "Moving Text",
        "short": "MOV",
        "description": "Frame-varying text trajectories with corresponding temporal masks.",
    },
    "vertical_text": {
        "label": "Vertical Text",
        "short": "VRT",
        "description": "Vertical writing layouts spanning Asian scripts and mixed scene positions.",
    },
    "non_bottom_layout": {
        "label": "Non-Bottom Layout",
        "short": "NBL",
        "description": "Text placed outside the conventional bottom subtitle region.",
    },
    "multi_region": {
        "label": "Multi-Region",
        "short": "MUL",
        "description": "Multiple simultaneous overlays distributed across distinct frame regions.",
    },
    "persistent_watermark": {
        "label": "Persistent Watermark",
        "short": "WMK",
        "description": "Small semi-transparent marks that persist near corners or frame edges.",
    },
    "asr_subtitle": {
        "label": "ASR Subtitle",
        "short": "ASR",
        "description": "Speech-aligned multilingual captions retained as a seen regression track.",
    },
}

# Two complementary views per type. The selector prefers these properties, then
# resolves deterministically by overlay count, duration, and sample name.
PREVIEW_RULES = {
    "standard_subtitle": [
        {"orientation": "landscape", "language": "en"},
        {"orientation": "portrait", "language": "zh"},
    ],
    "artistic_title": [
        {"orientation": "landscape", "language": "ko"},
        {"orientation": "portrait", "language": "zh"},
    ],
    "moving_text": [
        {"orientation": "landscape", "language": "ja"},
        {"orientation": "portrait", "language": "en"},
    ],
    "vertical_text": [
        {"orientation": "landscape", "language": "ko"},
        {"orientation": "portrait", "language": "zh"},
    ],
    "non_bottom_layout": [
        {"orientation": "landscape", "language": "th"},
        {"orientation": "portrait", "language": "ja"},
    ],
    "multi_region": [
        {"orientation": "landscape", "language": "en"},
        {"orientation": "portrait", "language": "zh"},
    ],
    "persistent_watermark": [
        {"orientation": "landscape", "language": "en"},
        {"orientation": "portrait", "language": "zh"},
    ],
    "asr_subtitle": [
        {"orientation": "landscape", "language": "en"},
        {"orientation": "landscape", "language": "zh"},
    ],
}

PUBLIC_FIELDS = [
    "name",
    "benchmark_track",
    "benchmark_type",
    "type_sample_index",
    "split",
    "orientation",
    "width",
    "height",
    "frames",
    "fps",
    "duration_sec",
    "overlay_count",
    "primary_language",
    "subtitle_text",
    "audio_present",
    "known_train_overlap",
    "ocr_status",
]


def read_rows() -> list[dict[str, str]]:
    rows: list[dict[str, str]] = []
    for category in CATEGORY_ORDER:
        metadata_path = BENCHMARK_DIR / category / "metadata.csv"
        with metadata_path.open(encoding="utf-8-sig", newline="") as handle:
            rows.extend(csv.DictReader(handle))
    return rows


def choose_previews(rows: list[dict[str, str]]) -> list[dict[str, str]]:
    previews: list[dict[str, str]] = []
    used: set[str] = set()
    for category in CATEGORY_ORDER:
        candidates = [row for row in rows if row["benchmark_type"] == category]
        for rule in PREVIEW_RULES[category]:
            matches = [
                row
                for row in candidates
                if row["name"] not in used
                and row["orientation"] == rule["orientation"]
                and row["primary_language"] == rule["language"]
            ]
            if not matches:
                matches = [
                    row
                    for row in candidates
                    if row["name"] not in used and row["orientation"] == rule["orientation"]
                ]
            if not matches:
                matches = [row for row in candidates if row["name"] not in used]
            matches.sort(
                key=lambda row: (
                    -int(row["overlay_count"]),
                    -float(row["duration_sec"]),
                    row["name"],
                )
            )
            selected = matches[0]
            used.add(selected["name"])
            previews.append(selected)
    return previews


def scaled_dimensions(row: dict[str, str], max_side: int = 720) -> tuple[int, int]:
    width, height = int(row["width"]), int(row["height"])
    ratio = min(1.0, max_side / max(width, height))
    scaled_width = max(2, int(math.floor(width * ratio / 2) * 2))
    scaled_height = max(2, int(math.floor(height * ratio / 2) * 2))
    return scaled_width, scaled_height


def run(command: list[str]) -> None:
    subprocess.run(command, check=True)


def transcode_video(source: Path, destination: Path, width: int, height: int, force: bool) -> None:
    if destination.exists() and not force:
        return
    destination.parent.mkdir(parents=True, exist_ok=True)
    run(
        [
            "ffmpeg",
            "-y",
            "-loglevel",
            "error",
            "-i",
            str(source),
            "-map",
            "0:v:0",
            "-an",
            "-vf",
            f"fps=18,scale={width}:{height}:flags=lanczos",
            "-c:v",
            "libx264",
            "-preset",
            "medium",
            "-crf",
            "28",
            "-pix_fmt",
            "yuv420p",
            "-movflags",
            "+faststart",
            str(destination),
        ]
    )


def make_poster(source: Path, destination: Path, duration: float, width: int, height: int, force: bool) -> None:
    if destination.exists() and not force:
        return
    destination.parent.mkdir(parents=True, exist_ok=True)
    run(
        [
            "ffmpeg",
            "-y",
            "-loglevel",
            "error",
            "-ss",
            f"{duration * 0.52:.3f}",
            "-i",
            str(source),
            "-frames:v",
            "1",
            "-vf",
            f"scale={width}:{height}:flags=lanczos",
            "-q:v",
            "5",
            str(destination),
        ]
    )


def public_item(row: dict[str, str], preview_id: str | None = None) -> dict[str, object]:
    item: dict[str, object] = {
        "id": row["name"],
        "type": row["benchmark_type"],
        "track": row["benchmark_track"],
        "split": row["split"],
        "index": int(row["type_sample_index"]),
        "orientation": row["orientation"],
        "width": int(row["width"]),
        "height": int(row["height"]),
        "frames": int(row["frames"]),
        "fps": float(row["fps"]),
        "duration": round(float(row["duration_sec"]), 3),
        "overlays": int(row["overlay_count"]),
        "language": row["primary_language"],
        "text": row["subtitle_text"],
        "audio": row["audio_present"].lower() == "true",
        "seen": row["known_train_overlap"].lower() == "true",
        "ocrStatus": row["ocr_status"],
    }
    if preview_id:
        item["previewId"] = preview_id
    return item


def write_public_csv(rows: list[dict[str, str]]) -> None:
    output = DATA_DIR / "benchmark_manifest.csv"
    with output.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=PUBLIC_FIELDS)
        writer.writeheader()
        for row in rows:
            writer.writerow({field: row[field] for field in PUBLIC_FIELDS})


def build(force: bool, workers: int) -> None:
    for directory in (DATA_DIR, POSTER_DIR, VIDEO_DIR):
        directory.mkdir(parents=True, exist_ok=True)

    rows = read_rows()
    preview_rows = choose_previews(rows)
    preview_lookup: dict[str, str] = {}
    preview_items: list[dict[str, object]] = []
    media_jobs: list[tuple[str, Path, Path, int, int, float]] = []

    for index, row in enumerate(preview_rows, start=1):
        preview_id = f"case-{index:02d}"
        preview_lookup[row["name"]] = preview_id
        width, height = scaled_dimensions(row)
        item = public_item(row, preview_id)
        item.update(
            {
                "label": CATEGORY_META[row["benchmark_type"]]["label"],
                "source": f"assets/videos/{preview_id}-source.mp4",
                "target": f"assets/videos/{preview_id}-target.mp4",
                "mask": f"assets/videos/{preview_id}-mask.mp4",
                "poster": f"assets/posters/{preview_id}-source.jpg",
                "sourcePoster": f"assets/posters/{preview_id}-source.jpg",
                "targetPoster": f"assets/posters/{preview_id}-target.jpg",
                "maskPoster": f"assets/posters/{preview_id}-mask.jpg",
            }
        )
        preview_items.append(item)
        media_jobs.extend(
            [
                (
                    "video",
                    BENCHMARK_DIR / row["source_video"],
                    VIDEO_DIR / f"{preview_id}-source.mp4",
                    width,
                    height,
                    float(row["duration_sec"]),
                ),
                (
                    "video",
                    BENCHMARK_DIR / row["target_video"],
                    VIDEO_DIR / f"{preview_id}-target.mp4",
                    width,
                    height,
                    float(row["duration_sec"]),
                ),
                (
                    "video",
                    BENCHMARK_DIR / row["alpha_mask"],
                    VIDEO_DIR / f"{preview_id}-mask.mp4",
                    width,
                    height,
                    float(row["duration_sec"]),
                ),
                (
                    "poster",
                    BENCHMARK_DIR / row["source_video"],
                    POSTER_DIR / f"{preview_id}-source.jpg",
                    width,
                    height,
                    float(row["duration_sec"]),
                ),
                (
                    "poster",
                    BENCHMARK_DIR / row["target_video"],
                    POSTER_DIR / f"{preview_id}-target.jpg",
                    width,
                    height,
                    float(row["duration_sec"]),
                ),
                (
                    "poster",
                    BENCHMARK_DIR / row["alpha_mask"],
                    POSTER_DIR / f"{preview_id}-mask.jpg",
                    width,
                    height,
                    float(row["duration_sec"]),
                ),
            ]
        )

    def process_job(job: tuple[str, Path, Path, int, int, float]) -> str:
        kind, source, destination, width, height, duration = job
        if kind == "video":
            transcode_video(source, destination, width, height, force)
        else:
            make_poster(source, destination, duration, width, height, force)
        return destination.name

    with ThreadPoolExecutor(max_workers=max(1, workers)) as executor:
        futures = [executor.submit(process_job, job) for job in media_jobs]
        for future in as_completed(futures):
            future.result()

    summary_path = BENCHMARK_DIR / "summary.json"
    with summary_path.open(encoding="utf-8") as handle:
        source_summary = json.load(handle)

    all_items = [public_item(row, preview_lookup.get(row["name"])) for row in rows]
    total_frames = sum(int(row["frames"]) for row in rows)
    total_seconds = sum(float(row["duration_sec"]) for row in rows)
    category_counts = Counter(row["benchmark_type"] for row in rows)
    language_counts = Counter(row["primary_language"] for row in rows)
    orientation_counts = Counter(row["orientation"] for row in rows)

    manifest = {
        "title": "DVTE-Bench",
        "subtitle": "Diverse Video Text Erasure Benchmark",
        "version": source_summary["benchmark_version"],
        "stats": {
            "samples": len(rows),
            "frames": total_frames,
            "minutes": round(total_seconds / 60, 1),
            "types": len(category_counts),
            "languages": len(language_counts),
            "ocrRejected": source_summary["ocr_rejected_count"],
            "seenRegression": source_summary["known_train_overlap_count"],
            "portrait": orientation_counts["portrait"],
            "landscape": orientation_counts["landscape"],
        },
        "categories": [
            {
                "id": category,
                **CATEGORY_META[category],
                "count": category_counts[category],
            }
            for category in CATEGORY_ORDER
        ],
        "languages": dict(language_counts.most_common()),
        "previews": preview_items,
        "items": all_items,
        "integrity": {
            "metadataSha256": source_summary["metadata_sha256"],
            "ocrConfigHash": source_summary["ocr_config_hash"],
            "targetPolicy": source_summary["target_policy"],
        },
    }
    (DATA_DIR / "benchmark.json").write_text(
        json.dumps(manifest, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )
    write_public_csv(rows)
    shutil.copy2(summary_path, DATA_DIR / "summary.json")
    print(
        f"Built {len(preview_items)} previews and {len(all_items)} metadata rows "
        f"in {SITE_DIR}"
    )


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--force", action="store_true", help="Rebuild existing preview media.")
    parser.add_argument("--workers", type=int, default=4, help="Parallel ffmpeg jobs.")
    args = parser.parse_args()
    build(force=args.force, workers=args.workers)


if __name__ == "__main__":
    main()

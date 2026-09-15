# DVTE-Bench

**Diverse Video Text Erasure Benchmark** is a paired benchmark with 1,631 clips,
136,090 frames, and 8 text types. This repository contains its static project
page and interactive sample explorer.

Project page: <https://yahooo-m.github.io/DVTE-Bench/>

## Results

Ours and four public baselines were evaluated on all 1,631 videos. All metrics
below are measured inside the dataset ground-truth masks.

| Method | Mask PSNR | Mask MAE | Mask MSE | Crop-SSIM |
| --- | ---: | ---: | ---: | ---: |
| Ours | **31.348** | **5.449** | **131.153** | **0.9053** |
| CLEAR | 16.880 | 33.470 | 2893.994 | 0.6193 |
| ProPainter | 26.152 | 11.084 | 598.561 | 0.8246 |
| MiniMax-Remover | 26.295 | 10.105 | 444.954 | 0.8399 |
| DiffuEraser | 24.963 | 11.923 | 553.245 | 0.8129 |

The project page includes full-benchmark, track-level, and per-type mask-level
breakdowns. Download the machine-readable table from
[`data/results.csv`](data/results.csv).

## Local preview

```bash
cd benchmark_artifacts/multitype_synth_v4_vlm_asr_ocr_clean_1631/website
python -m http.server 8765
```

Open `http://127.0.0.1:8765/`. The site must be served over HTTP because it
loads the benchmark manifest with `fetch()`.

## Rebuild website data

```bash
python build_site.py --workers 8
```

Use `--force` to regenerate existing preview media. The builder:

- reads all eight per-type `metadata.csv` files;
- exports a public manifest without local absolute paths;
- selects two representative samples per type;
- creates aligned Source, Target, and Mask previews;
- generates separate posters for all three preview streams.
- validates the completed full-benchmark evaluation and exports mask-level and
  per-type metrics for all methods;
- keeps the 1,563 main samples separate from the 68 seen ASR samples.

The website package is intentionally small. It exposes the complete searchable
metadata catalog but only 16 compressed media previews, rather than copying the
full 6.3 GB benchmark.

## Deployment

The directory is self-contained and compatible with GitHub Pages, Cloudflare
Pages, or any static file host. Publish the contents of `website/` as the site
root. No build command is required after `build_site.py` has been run.

For GitHub Pages, place these files at the repository root or configure a Pages
workflow to upload this directory. The included `.nojekyll` file prevents asset
paths from being rewritten.

## Evaluation note

The 68 `asr_preview_seen` samples overlap a known training manifest. They must
be reported as a seen regression track and not merged into unseen test results.

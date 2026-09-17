# DVTE-Bench

**Diverse Video Text Erasure Benchmark** is a paired benchmark with 1,631 clips,
136,090 frames, and 8 text types. This repository contains its static project
page and interactive sample explorer.

Project page: <https://yahooo-m.github.io/DVTE-Bench/>

## Results

Ours and four public baselines were evaluated on all 1,631 videos. PSNR columns
report the finite mean. Lower LPIPS and TWE gap are better; TWE GT is the
clean-target reference.

| Method | Whole PSNR | SSIM | LPIPS | TWE Pred | TWE GT | \|TWE - GT\| |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Ours | 37.805 | 0.9664 | **0.0262** | 9.065 | 9.121 | **0.056** |
| CLEAR | 19.833 | 0.7567 | 0.1979 | 9.751 | 9.121 | 0.630 |
| ProPainter | **38.940** | 0.9651 | 0.0345 | **8.985** | 9.121 | 0.135 |
| MiniMax-Remover | 38.756 | **0.9676** | 0.0276 | 9.035 | 9.121 | 0.086 |
| DiffuEraser | 37.969 | 0.9642 | 0.0301 | 9.186 | 9.121 | 0.065 |

| Method | Mask PSNR | Mask MAE | Mask MSE | Crop-SSIM | Timed videos | Seconds / frame | FPS |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Ours | **31.348** | **5.449** | **131.153** | **0.9053** | 128 | 1.470 | 0.680 |
| CLEAR | 16.880 | 33.470 | 2893.994 | 0.6193 | 1,631 | 1.378 | 0.726 |
| ProPainter | 26.152 | 11.084 | 598.561 | 0.8246 | 1,631 | 0.661 | 1.512 |
| MiniMax-Remover | 26.295 | 10.105 | 444.954 | 0.8399 | 1,631 | **0.480** | **2.085** |
| DiffuEraser | 24.963 | 11.923 | 553.245 | 0.8129 | 1,631 | 2.954 | 0.339 |

The project page reports one full-benchmark leaderboard over all 1,631 videos,
plus per-type whole-frame, perceptual, temporal, and mask-region breakdowns.
Download the machine-readable table from [`data/results.csv`](data/results.csv).

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
- validates the completed full-benchmark evaluation and exports whole-frame,
  perceptual, temporal, mask-region, runtime, and per-type metrics for all methods;
- aggregates all 1,631 videos into one primary leaderboard.

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

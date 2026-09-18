# DVTE-Bench

**Diverse Video Text Erasure Benchmark** is a paired benchmark with 1,631 clips,
136,090 frames, and 8 text types. This repository contains its static project
page and interactive sample explorer.

Project page: <https://yahooo-m.github.io/DVTE-Bench/>

## Results

Ours and four public baselines were evaluated on all 1,631 videos. Quality
results are reported only inside pixel-accurate dataset ground-truth masks.

| Method | Mask PSNR | Mask SSIM | Mask LPIPS | Mask DISTS | Mask VFID | TWE Pred | TWE GT | TWE Gap | TC | Flow Mean | Flow Var |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Ours | **30.799** | **0.8822** | **0.0408** | **0.0507** | **0.0835** | 9.31 | 9.32 | **0.01** | 4.25 | **0.333** | **0.592** |
| CLEAR | 16.025 | 0.5172 | 0.3209 | 0.2158 | 1.4736 | 10.24 | 9.32 | 0.91 | 11.03 | 0.901 | 2.817 |
| ProPainter | 25.900 | 0.7832 | 0.1166 | 0.0957 | 0.3879 | **8.14** | 9.32 | 1.18 | **4.03** | 0.650 | 1.560 |
| MiniMax-Remover | 26.167 | 0.8044 | 0.0977 | 0.0856 | 0.2806 | 8.71 | 9.32 | 0.61 | 4.56 | 0.799 | 2.307 |
| DiffuEraser | 24.843 | 0.7723 | 0.1130 | 0.0952 | 0.3285 | 10.19 | 9.32 | 0.86 | 5.32 | 0.669 | 1.938 |

| Method | Runtime setting | Timed videos | Seconds / frame | FPS |
| --- | --- | ---: | ---: | ---: |
| Ours | 768s + 4-step SEdit | 128 | 1.470 | 0.680 |
| CLEAR | Official inference | 1,631 | 1.378 | 0.726 |
| ProPainter | Official inference | 1,631 | 0.661 | 1.512 |
| MiniMax-Remover | Official inference | 1,631 | **0.480** | **2.085** |
| DiffuEraser | Official inference | 1,631 | 2.954 | 0.339 |

The project page reports one full-benchmark leaderboard over all 1,631 videos,
plus per-type pixel-mask breakdowns and runtime. Mask VFID is full-benchmark
only. Ours runtime measures 768s, 4-step SEdit diffusion only. Download the
machine-readable table from
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
- validates the completed full-benchmark evaluation and exports pixel-mask
  quality metrics, runtime, and per-type metrics for all methods;
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

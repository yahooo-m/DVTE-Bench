# DVTE-Bench

**Diverse Video Text Erasure Benchmark** is a paired benchmark with 1,631 clips,
136,090 frames, and 8 text types. This repository contains its static project
page and interactive sample explorer.

Project page: <https://yahooo-m.github.io/DVTE-Bench/>

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
- exports mask-region metrics for all completed methods on the shared
  800-video comparison subset, with 767 main samples separated from 33 seen ASR samples.

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

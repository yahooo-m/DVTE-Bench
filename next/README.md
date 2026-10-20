# DVTE-Bench dynamic showcase

The redesigned page is in `next/`. It uses the rounded type, cream/navy/orange palette, outlined panels, and restrained motion of the TCoVP showcase, with a text-erasure-specific presentation. It is a buildless static website with self-hosted fonts and no third-party runtime.

On the `feat/dvte-dynamic-showcase` publishing branch, the root entry redirects to `next/`. `original.html` is byte-identical to the previous `origin/main:index.html`; its original CSS, JavaScript, data, and assets remain in place. `main` is not modified.

## Preview

Serve the repository root, not `next/` alone. Media seeking requires a server that supports HTTP byte ranges.

The page offers a synchronized Source/Ours hero wipe; eight source-video taxonomy cards; sixteen paired examples with real recorded predictions; model, clean-reference, and alpha-mask views; a shared timeline; metric/category charts with full result tables; and a searchable 1,631-record catalog. Playback pauses off screen or when the document is hidden. Reduced-motion preferences stop the hero and hover videos; users may explicitly play the hero. Mobile navigation, controls, and labels support keyboard and assistive access.

## Recorded predictions

`model-previews.json` maps the exact original benchmark sample IDs to 32 real saved outputs: Ours for all 16 public previews, plus four baselines for case-03, case-06, case-08, and case-11. Each entry records frame counts, timing, encoding, original and preview hashes, and known training overlap. The hero uses case-11 (Multi-Region), Source versus recorded Ours. Clean references are separately and explicitly labeled as benchmark data.

Ours uses the LingBot 40K checkpoint, six inference steps, ground-truth box guidance, and the saved seamless paste-back. Pixel-accurate masks are used for scoring, not for conditioning Ours. ProPainter, MiniMax-Remover, and DiffuEraser use GT box masks and source paste-back outside an 8-pixel dilation; CLEAR is mask-free. The comparison preserves these different settings. The separate four-step speed probe is not reported or conflated with the six-step quality results.

The outputs were retrieved from the authorized result workspace on 2026-10-20. No new model inference or remote changes were needed. Public provenance contains no internal absolute paths, logs, or credentials.

New output previews follow the existing public preview transform: complete clip from frame zero, no crop or truncation, 18 fps, even dimensions with the long side at most 720 pixels, H.264 CRF 28, and no audio. All 32 match the public source preview dimensions and rate; 30 also match its exact encoded frame count. Ours case-13 and case-16 each have one fewer terminal frame from rounding. The manifest and case details disclose this; the player uses the shortest shared duration. No replacement tail frame is fabricated. Thumbnails use `contain` so edge watermarks remain visible.

## Results and dataset integrity

The original `data/` files remain unchanged. On 2026-10-20, the public result JSON and benchmark JSON were verified byte-for-byte against the remote website export, then all 545 numerical fields were checked against the latest complete pixel-mask evaluation, with zero differences. All five methods cover 1,631 videos. `assets/provenance/results-verification.json` records the hashes and checks. Older box-region/whole-frame tables are not substituted for this protocol.

The result explorer marks the true best value for each selection; it does not assume Ours wins every metric. Its full tables expose all original columns and exact stored precision. Mask PSNR displays finite means and the counts of infinite/zero-MSE videos; VFID is overall-only. Original CSV downloads remain available. Displayed method settings are refined from the verified prediction manifest without rewriting numerical data.

The benchmark contains 1,563 synthetic-overlay clips and 68 seen ASR regression samples with known training overlap. Both tracks remain in the full aggregate, and the page explicitly discloses this. Clean-target OCR auditing, eight category counts, orientation counts, and language labels follow the existing metadata.

## Fonts and assets

Fredoka, Nunito, and JetBrains Mono are self-hosted in `assets/fonts/`, with their OFL license files. All demonstration media are original benchmark previews or CPU encodes of the real saved predictions. No generated or manually repaired result imagery is used.

## Authors and institutions

The hero credits all seven authors in the order and with the affiliation numbers of the [DeOverlay paper](https://arxiv.org/html/2610.26081v1): Deshui Miao, Yuhang Ma, Shaoyong Jia, Wenzhao Gao, Yue Zhang, and Shaohui Jiao at ByteDance; Xin Li at Southern University of Science and Technology. Institution marks are unmodified assets from the official ByteDance and SUSTech websites, served locally. `assets/affiliations/sources.json` records their provenance. The hero also links to the paper and its Hugging Face Daily Papers page.

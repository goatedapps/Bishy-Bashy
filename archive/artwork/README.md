# Original artwork archive

This folder retains the 74 original PNG masters and their generation prompts/provenance.
It is outside Vite's `public/` directory and is not copied into the published website.
Historical source sheets and earlier versions are intentionally retained alongside current masters.

Run `python scripts/optimize-images.py` from the repository root to regenerate delivery artwork, or pass individual master names without `.png`.
The script reads PNGs here and writes the hashed WebP files to `public/assets/optimized/`.
`scripts/image-assets.json` is the current delivery inventory; artwork notes may also describe historical versions.

The Totem block master is retained once as `totem-blocks.png`.
Its original prompt is in [totem-artwork.md](totem-artwork.md), preserved from the retired prototype folder.

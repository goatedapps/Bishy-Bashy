# Shark Jumper artwork

Original illustrations generated on 2026-11-02 using the built-in image-generation tool.
The user’s screenshot informed the rising zigzag shark path and landed-grey mechanic; all characters and environmental artwork are original.
The protagonist is a puppy, with no seal or human rider.
Retained masters are `shark-sprites.png` and `bg-shark-lagoon.png`.
The final transparent sprite master retains the edit output; alpha checks confirm empty atlas-background pixels are fully transparent.
`python scripts/optimize-images.py shark-sprites bg-shark-lagoon` derives hashed delivery files.
The optimized pair totals 341,016 bytes versus 3,940,585 bytes for the final masters, a 91.3% reduction.

The supplied fall audio was found as `shark-splash.mp3` in Downloads and copied to `public/audio/` with its original filename.

## Sprite prompt

Original arcade sprite atlas 1536x1024 with EXACT 3 columns and 2 rows, all six cells exactly 512x512, fully transparent background.
Every object completely contained in own cell with at least 12 percent padding.
Polished cheerful hand-painted Japanese party game illustration, clear dark outlines, soft dimensional shading, cute rather than scary.
TOP LEFT cell: bright RED cartoon shark, complete short rounded side-view body facing right, toothy playful grin, little tail and dorsal fin, nearly horizontal broad upper back where a puppy can land.
TOP MIDDLE: identical shape shark in bright GREEN.
TOP RIGHT: identical shape shark in bright BLUE.
BOTTOM LEFT: same shark silhouette transformed into a smooth GREY STONE ROCK shark, rounded stone texture and gentle carved grin.
BOTTOM MIDDLE: tiny cute cream-and-caramel puppy with floppy ears and red neckerchief, side view facing right, energetic leaping pose, full body visible, all four little paws.
BOTTOM RIGHT: the SAME puppy wet, front paws reaching up as if climbing out of water onto a ledge, cute determined expression.
No platforms, no water, no ground shadows, no scenery, no letters, no frame, no cell dividers.
Actual alpha transparency, clean separate sprites.

## Transparency edit prompt

Remove ALL colored and dark background, gradient halos, and glow behind all six sprites.
Output a PNG with a fully transparent alpha background outside the actual shark/puppy silhouettes, no backdrop colors whatsoever.
Preserve exactly these six original illustrated characters, their colors and identity, and their precise three-column two-row sprite atlas positions.
Keep all six objects completely within their own equal 512x512 cells on the 1536x1024 canvas.
Do not add any content or background.
This is a transparent game atlas, the space around every sprite must be genuinely empty alpha, including between fins, paws, tails, water drops, and ears.

## Background prompt

Original illustrated environment for a cheerful arcade minigame Shark Jumper, no text, landscape 1536x1024.
Brilliant tropical turquoise lagoon seen from above at a slight side angle, gentle swirling azure water, soft broad wave patterns, sunny light, distant tiny palm-fringed island and a little sandy coastline confined to the top corners.
Polished hand-painted cartoon party-game style with thick friendly contours and subtle textured shading.
Keep central 85 percent clear calm aqua water for separately rendered colored sharks and a small puppy hopping upward along a zigzag path.
No animals, sharks, people, boats, foreground rocks, floating platforms, UI, numbers, words, bases or progress indicators.
Clear readable low-contrast water beneath gameplay, charming tropical holiday mood.

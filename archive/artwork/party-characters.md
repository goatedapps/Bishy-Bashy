# Player character artwork

Created with the built-in imagegen tool on 2026-10-31 for Dokidoki Dash! character selection, lobby seats, and podiums.
The untouched generated master is `party-characters.png`.
The sixteen disconnected character silhouettes were extracted from the master, centered with transparent padding into individual 256-pixel PNG masters named `party-character-00.png` through `party-character-15.png`, then optimized as hashed WebP delivery files using quality 86, method 6 and alpha quality 100.
All sixteen WebP images total 275,632 bytes.
The runtime registry and names live in `shared/characters.js`; the existing optimizer retains reproducible per-character delivery settings.

## Prompt

Create a polished original character-selection SPRITE ATLAS for the cute party game Dokidoki Dash.
Exactly SIXTEEN different adorable full-body chibi mascots arranged in a precise FOUR by FOUR invisible grid on a truly TRANSPARENT background.
Each cell same size, one character centered completely inside with 12% empty transparent padding on all sides; no character or accessories touching other cells.
Front-facing friendly expressive faces, large heads, tiny bodies, clean dark-purple outlines, soft painted highlights, appealing premium game illustration.
Reading order: row1 peach cat in star sweater, mint bunny with flower crown, lavender axolotl in overalls, sky blue bear with bow tie.
Row2 honey bee with tiny backpack, pink pig in raincoat, teal otter with striped scarf, cream sheep in beret.
Row3 golden corgi in sailor shirt, panda in red hoodie, caramel hamster in apron, red panda with round glasses.
Row4 purple penguin in cozy beanie, green frog in yellow vest, orange fox in purple cape, white seal with turquoise bow.
Keep all sixteen equally sized and distinct.
No words, lettering, numbers, grid lines, frames, backgrounds, shadows outside silhouettes or existing game characters.
Square canvas 2048 by 2048 preferred.
Actual transparency.

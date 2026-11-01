# Where’s Kaya artwork

Generated with the built-in imagegen tool on 2026-11-01.
The retained transparent master `kaya-sprites.png` is a 2×2 atlas: Kaya at top left, one kitten at top right, one opaque blanket at bottom left, and an empty cell at bottom right.
The game renders the kitten twice and blanket three times to guarantee identical appearances.
`bg-kaya-home.png` is the original illustrated background master.
The optimized 1024-pixel sprite atlas and 1280-pixel background total 288,570 bytes, down from 3,737,110 bytes of PNG masters.
Delivery uses hashed WebP files from `scripts/image-assets.json`, quality 86 and method 6, retaining sprite transparency.

## Sprite prompt

Use case: stylized-concept.
Asset type: original transparent 2x2 sprite atlas for a cute illustrated party game Where’s Kaya.
Precisely four equal square cells in a square canvas, no cell borders or text.
Top-left cell: full-body sitting cute Singapore Special mixed-breed dog Kaya, tan short fur, cream white muzzle and chest, expressive dark brown eyes, one perked ear and one folded ear, friendly dark nose, fluffy curved tail visible, warm chibi proportions.
Clearly a dog, not a cat.
Top-right cell: one adorable full-body sitting grey and cream kitten, triangular ears, big round green eyes, tiny pink nose and striped curled tail, visibly different species from dog.
Bottom-left cell: one fully opaque soft mint-blue blanket draped over a broad rounded animal-shaped mound, covers an animal completely from head to paws, no animal part visible; same rounded silhouette will be reused over dog and kittens so absolutely no species-specific outline, generic wide rounded top and soft fabric folds with scalloped lower edge.
Bottom-right cell: empty transparent space, no subject.
Every sprite entirely contained and centered in its own cell with roughly 10 percent margin.
Consistent polished painted cartoon illustration, thick clean dark-purple outlines, warm shading, friendly expressive character design matching a colorful family party game.
Transparent background in every cell and around all sprites.
No floor, shadows outside subjects, letters, labels, frames, scene or extra objects.

## Background prompt

Use case: illustration-story.
Asset type: original illustrated background for a shared-screen party game Where’s Kaya, landscape 3:2 composition.
Cozy cheerful Singapore home reading nook, warm peach wall, soft daylight, leafy plants in far corners, small window in upper left with tropical greenery, a tidy low bookshelf along upper background, broad inviting cream and sage patterned floor rug extending across the lower two thirds.
Keep the center and lower gameplay area open, simple, low contrast and visually quiet so three animal characters and shuffling blanket-covered mounds remain easy to track.
Polished colorful hand-painted cartoon game environment, gently textured, dark plum outlines on far edge furnishings, warm friendly mood.
No animals, people, cards, blankets, text, logos, counters or interface elements.

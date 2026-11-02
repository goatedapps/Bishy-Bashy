# Where’s Kaya artwork

## Photo-based Kaya update

Generated with the built-in imagegen tool on 2026-11-01 using the user-supplied dog photo as an identity reference and the original atlas as an illustration-style reference.
`kaya-dog-photo.png` is the retained transparent master; `../../public/assets/optimized/kaya-dog-photo-96d904a3df5d.webp` is its 512-pixel delivery sprite.
The master is 1,029,689 bytes and the optimized sprite is 37,440 bytes, a 96.4% reduction.
The shared `.kaya-dog` style uses this sprite in gameplay, posters, and the cat-paw tutorial; the kitten and blanket continue using the original atlas.
The reference photo remains outside the repository.

Prompt:

> Use case: identity-preserve.
> Create a single transparent full-body sitting dog game sprite of Kaya, using image 1 (the real dog photo) as the identity reference, and image 2 (the existing sprite atlas) as illustration style reference only.
> Output ONE dog centered in a square canvas, not an atlas.
> Kaya is a slender Singapore Special with short smooth reddish cinnamon/tan fur, TWO large upright pointed triangular ears, a narrow elongated tapered muzzle, black nose, dark almond-shaped brown eyes with subtle dark eye rims, lighter tan inner legs and underside, tiny pale toe tips.
> Preserve the real dog's facial proportions and warm rust-brown coloring.
> No white forehead blaze, no large white muzzle or white chest bib, no floppy ear, no fluffy coat or fluffy tail.
> Pose: seated upright facing the viewer with a gentle slight three-quarter angle, both front paws visible, slim smooth tail curled alongside the paws, soft friendly closed-mouth expression.
> Cute slightly enlarged expressive head but retain the long muzzle and lean body of this actual dog.
> Match image 2's polished painted cartoon game style, clean dark plum outline, warm shaded depth, friendly family party-game rendering.
> Entire dog including ears and paws contained within central 88 percent of square with even transparent margins.
> Truly transparent background.
> No floor, cast shadow, scene, bed, pillow, food, collar, clothes, text, labels, UI, other animals or extra objects.

## Original atlas and background

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

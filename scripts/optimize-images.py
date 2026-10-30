"""Derive delivery images from the retained PNG masters. Requires Pillow."""
from pathlib import Path
import hashlib
import json
import re
from PIL import Image

root = Path(__file__).resolve().parents[1]
destination = root / 'public/assets/optimized'
destination.mkdir(exist_ok=True)
sizes = {'totem-blocks': 768, 'perm-disco-sprites': 1152, 'facial-slot-faces': 1152,
         'fireworks-festival': 1280, 'mimicking-monkey': 512, 'jump-dino': 512,
         'jump-meat': 256, 'burger-chef-chibi': 512, 'burger-ingredients': 768, 'odd-pictures': 1024,
         'dice-jester': 512, 'facing-duck': 512, 'coin-raccoon': 512, 'dodge-fox': 512,
         'home-landscape-motion': 1672,
         **{f'bg-{name}': 1280 for name in [
             'totem-temple', 'perm-stage', 'slots-studio', 'monkey-jungle', 'jump-valley',
             'burger-kitchen', 'mistake-gallery', 'dice-carnival', 'facing-airfield',
             'coins-garden', 'dodge-track', 'letters-workshop']}}
mapping = {}
before = after = 0
for name, size in sizes.items():
    source = root / f'public/assets/{name}.png'
    with Image.open(source) as image:
        image.thumbnail((size, size), Image.Resampling.LANCZOS)
        temporary = destination / f'{name}.webp'
        image.save(temporary, 'WEBP', quality=86, method=6, alpha_quality=100)
    digest = hashlib.sha256(temporary.read_bytes()).hexdigest()[:12]
    target = destination / f'{name}-{digest}.webp'
    temporary.replace(target)
    mapping[name] = f'assets/optimized/{target.name}'
    before += source.stat().st_size
    after += target.stat().st_size
for sheet in (root / 'src').glob('*.css'):
    css = sheet.read_text(encoding='utf-8')
    original = css
    for name, asset in mapping.items():
        css = re.sub(r"/assets/(?:optimized/)?" + re.escape(name) + r"(?:-[0-9a-f]{12})?\.(?:png|webp)", '/' + asset, css)
        if f'var(--image-{name},' not in css:
            css = css.replace(f"url('/{asset}')", f"var(--image-{name},url('/{asset}'))")
    if css != original:
        sheet.write_text(css, encoding='utf-8')
for obsolete in destination.glob('*.webp'):
    if f'assets/optimized/{obsolete.name}' not in mapping.values():
        obsolete.unlink()
(root / 'scripts/image-assets.json').write_text(json.dumps(list(mapping.values()), indent=2) + '\n', encoding='utf-8')
print(f'Images: {before:,} -> {after:,} bytes ({100 * (1 - after / before):.1f}% smaller)')

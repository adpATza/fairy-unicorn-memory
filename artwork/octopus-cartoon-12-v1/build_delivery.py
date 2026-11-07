"""Copy unmodified generated cards, make review sheets, and verify the import ZIP."""
from pathlib import Path
import hashlib
import json
import shutil
import zipfile

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent
MANIFEST = ROOT / 'prompts-and-manifest.json'
data = json.loads(MANIFEST.read_text(encoding='utf-8'))
assert len(data['entries']) == 12
images = ROOT / 'images'
images.mkdir(exist_ok=True)
checks = []
pixel_hashes = set()

for entry in data['entries']:
    source = Path(entry['source'])
    target = ROOT / entry['file']
    if not target.exists():
        shutil.copy2(source, target)
    if source.exists():
        assert source.read_bytes() == target.read_bytes(), target.name
    with Image.open(target) as im:
        assert im.format == 'PNG'
        im.verify()
    with Image.open(target) as im:
        im.load()
        width, height = im.size
        assert width == height and width >= 1024
        pixel_hash = hashlib.sha256(im.convert('RGBA').tobytes()).hexdigest()
    assert pixel_hash not in pixel_hashes, f'Duplicate card: {target.name}'
    pixel_hashes.add(pixel_hash)
    entry.update(width=width, height=height,
                 sha256=hashlib.sha256(target.read_bytes()).hexdigest(),
                 decoded_pixel_sha256=pixel_hash)
    checks.append({key: entry[key] for key in
                   ['file', 'width', 'height', 'sha256', 'decoded_pixel_sha256']})

assert len(list(images.glob('*.png'))) == 12
data.update(unique_decoded_images=12, total_images=12,
            import_play_test='Not performed',
            review='All 12 final cards visually checked for eight visible arms, whole subjects, consistent cartoon treatment and thumbnail distinction.')
MANIFEST.write_text(json.dumps(data, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
(ROOT / 'SHA256SUMS.txt').write_text(''.join(f"{c['sha256']}  {c['file']}\n" for c in checks), encoding='utf-8')

FONT = 'C:/Windows/Fonts/segoeui.ttf'
LABELS = [
    '01 Violet - fan', '02 Coral - double wave', '03 Turquoise - spirals',
    '04 Golden - star spread', '05 Blue - side wave', '06 Rose - heart',
    '07 Lime - dancing', '08 Tangerine - dangling', '09 Indigo - fountain',
    '10 Peach - curled nest', '11 Magenta - swimming', '12 Mint - upside down',
]

def sheet(size, cell_w, cell_h, filename, subtitle):
    canvas = Image.new('RGB', (40 + 4 * cell_w, 100 + 3 * cell_h), '#f7f2e9')
    draw = ImageDraw.Draw(canvas)
    title_font = ImageFont.truetype(FONT, 27 if size > 100 else 21)
    label_font = ImageFont.truetype(FONT, 15 if size > 100 else 11)
    detail_font = ImageFont.truetype(FONT, 14 if size > 100 else 11)
    draw.text((20, 15), 'Cartoon Octopuses - 12 matching pairs', fill='#49324f', font=title_font)
    draw.text((20, 55), subtitle, fill='#68566c', font=detail_font)
    for i, entry in enumerate(data['entries']):
        x = 20 + (i % 4) * cell_w + (cell_w - size) // 2
        y = 90 + (i // 4) * cell_h
        with Image.open(ROOT / entry['file']) as im:
            thumb = im.convert('RGB').resize((size, size), Image.Resampling.LANCZOS)
            canvas.paste(thumb, (x, y))
        draw.text((20 + (i % 4) * cell_w + 5, y + size + 7), LABELS[i], fill='#49324f', font=label_font)
    canvas.save(ROOT / filename)

sheet(280, 310, 326, 'contact-sheet.png', 'One original image per pair. Different colours and arm formations; consistent cream backgrounds.')
sheet(96, 168, 130, 'thumbnail-review.png', '96 px cards for checking colour and silhouette at playing size.')

readme = '''CARTOON OCTOPUSES - 12 MATCHING PAIRS
Created 1 November 2026 using the built-in image_gen tool.

IMPORT
Open Deck library > Import an image folder and choose this package's images folder.
Each of the 12 unique images becomes one identical matching pair (24 playing cards).
Suggested name: Cartoon Octopuses. Domain: Octopuses. Style: Illustrated.
Suggested complexity: Medium; the colours and poses both vary.
The cards-only ZIP beside this folder contains exactly 12 PNGs with no nested folders.

FILES
images: full-resolution, unchanged generated PNGs, 1254 x 1254 pixels.
contact-sheet.png: labelled overview, labels outside the actual card images.
thumbnail-review.png: cards shown at 96 pixels for dense-board review.
prompts-and-manifest.json: prompts, source references, palette/pose plan and file hashes.
SHA256SUMS.txt and verification.json: package checks.

The game saves its own 1024 x 1024 normalized copies during import; originals stay untouched.
The package was checked for readable PNGs, 12 unique decoded images, square dimensions,
unchanged source copies and flat ZIP contents. All final images were visually reviewed
for eight visible arms. Import and play testing in the running game were not performed.
'''
(ROOT / 'START HERE.txt').write_text(readme, encoding='utf-8')

archive = ROOT.parent / f'{ROOT.name}-cards.zip'
with zipfile.ZipFile(archive, 'w', compression=zipfile.ZIP_DEFLATED) as z:
    for entry in data['entries']:
        path = ROOT / entry['file']
        z.write(path, path.name)
with zipfile.ZipFile(archive) as z:
    assert z.testzip() is None
    assert len(z.infolist()) == 12
    assert set(z.namelist()) == {Path(e['file']).name for e in data['entries']}
    assert all('/' not in name and '\\' not in name for name in z.namelist())
    for entry in data['entries']:
        assert hashlib.sha256(z.read(Path(entry['file']).name)).hexdigest() == entry['sha256']

verification = dict(total_images=12, unique_decoded_images=len(pixel_hashes),
                    dimensions=sorted({f"{c['width']}x{c['height']}" for c in checks}),
                    originals_preserved=True, source_copies_identical=True,
                    zip_entries=12, zip_flat=True, zip_bytes_verified=True,
                    zip_sha256=hashlib.sha256(archive.read_bytes()).hexdigest(),
                    review_sheets=['contact-sheet.png', 'thumbnail-review.png'],
                    visual_arm_counts=[8] * 12, import_play_test='Not performed')
(ROOT / 'verification.json').write_text(json.dumps(verification, indent=2) + '\n', encoding='utf-8')
print(json.dumps(verification, indent=2))
print(f'Delivery: {ROOT}')
print(f'Cards ZIP: {archive}')

"""Copy untouched generated PNGs, verify them and build the offline review package."""
from pathlib import Path
import argparse
import csv
import hashlib
import html
import json
import shutil
import textwrap
import zipfile

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent
parser = argparse.ArgumentParser()
parser.add_argument('--package', action='store_true')
args = parser.parse_args()
data = json.loads((ROOT / 'generation.json').read_text(encoding='utf-8'))
assert len(data['entries']) == 30
assert len({e['subject'] for e in data['entries']}) == 30
checks, figures, pixels = [], [], set()

for entry in data['entries']:
    record = json.loads((ROOT / 'records' / f"{entry['slot']:02d}.json").read_text(encoding='utf-8'))
    source = Path(record['path'])
    target = ROOT / entry['file']
    shutil.copy2(source, target)
    assert source.read_bytes() == target.read_bytes(), 'Copy mismatch'
    with Image.open(target) as im:
        assert im.format == 'PNG'
        im.verify()
    with Image.open(target) as im:
        im.load()
        width, height = im.size
        assert width == height and width >= 1024
        pixel_hash = hashlib.sha256(im.convert('RGB').tobytes()).hexdigest()
    assert pixel_hash not in pixels, f'Duplicate decoded image: {target.name}'
    pixels.add(pixel_hash)
    digest = hashlib.sha256(target.read_bytes()).hexdigest()
    entry.update(status='complete', width=width, height=height, sha256=digest,
                 decoded_pixel_sha256=pixel_hash, prompt=record['prompt'],
                 source=record['path'], reference=record['reference'], edits=record['edits'])
    checks.append({k: entry[k] for k in ['file', 'width', 'height', 'sha256', 'decoded_pixel_sha256']})
    name = html.escape(entry['subject'])
    category = html.escape(entry['category'])
    figures.append(f'<figure data-category="{category}" data-search="{name.lower()}"><a href="{entry["file"]}" target="_blank" rel="noopener"><img src="{entry["file"]}" alt="{name}" width="170" height="170"></a><figcaption><b>{entry["slot"]:02d} &middot; {name}</b><span>{entry["year"]} &middot; {category}</span></figcaption></figure>')

assert len(list((ROOT / 'images').glob('*.png'))) == 30
data.update(status='artwork_complete', total_images=30, unique_decoded_images=len(pixels),
            dimensions=sorted({(c['width'], c['height']) for c in checks}),
            matching_pairs=30, names_in_artwork=False,
            delivery='One unique image per matching pair; the game creates both identical cards.',
            import_play_test='Not performed; this is a standalone artwork collection.')
(ROOT / 'generation.json').write_text(json.dumps(data, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
(ROOT / 'checksums.json').write_text(json.dumps(checks, indent=2) + '\n', encoding='utf-8')
with (ROOT / 'models.csv').open('w', encoding='utf-8-sig', newline='') as f:
    writer = csv.DictWriter(f, fieldnames=['slot', 'subject', 'year', 'category', 'orientation', 'file'])
    writer.writeheader()
    writer.writerows({k: e[k] for k in writer.fieldnames} for e in data['entries'])

categories = ''.join(f'<option>{html.escape(c)}</option>' for c in dict.fromkeys(e['category'] for e in data['entries']))
page = '''<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Cars colour sketches - 30 matching pairs</title>
<style>
:root{--card:170px;color-scheme:light}*{box-sizing:border-box}body{margin:0;background:#f6f1e8;color:#243441;font:15px/1.45 "Segoe UI",Arial,sans-serif}main{max-width:1480px;margin:28px auto;padding:0 28px 40px}h1{font:normal 34px/1.15 Georgia,serif;margin:0 0 8px}p{margin:8px 0 14px;color:#56636a}nav{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:16px 0 20px}button,select,input[type=search]{font:inherit;border:1px solid #b9c3c6;border-radius:5px;background:#fffdf7;padding:7px 12px;color:#243441}button{cursor:pointer}button[aria-pressed=true]{background:#243f52;color:white;border-color:#243f52}label{display:flex;align-items:center;gap:6px;margin-left:8px}.gallery{display:grid;grid-template-columns:repeat(auto-fit,var(--card));gap:18px 14px;align-items:start}figure{margin:0;width:var(--card)}figure[hidden]{display:none}figure a{display:block;line-height:0}img{display:block;width:var(--card);height:var(--card);object-fit:contain}a:focus-visible,button:focus-visible,select:focus-visible,input:focus-visible{outline:3px solid #bf7e27;outline-offset:3px}figcaption{font-size:12px;line-height:1.3;padding-top:7px;min-height:60px}figcaption b{font-weight:600;display:block}figcaption span{display:block;color:#63737b;font-size:11px;margin-top:3px}body.blind figcaption{visibility:hidden}footer{font-size:13px;color:#63737b;border-top:1px solid #d5d7d0;margin-top:24px;padding-top:16px}@media print{nav,#count{display:none}main{padding:0;margin:0}.gallery{grid-template-columns:repeat(5,1fr);gap:10px}figure{width:auto;break-inside:avoid}img{width:100%;height:auto}h1{font-size:24px}footer{display:none}}
</style></head><body><main>
<h1>Cars colour sketches</h1>
<p>30 recognizable models &middot; 30 matching pairs &middot; original 1254 &times; 1254 PNGs</p>
<nav aria-label="Review controls">
<button data-size="170" aria-pressed="true">Gallery</button><button data-size="100" aria-pressed="false">Card size &middot; 100 px</button><button data-size="300" aria-pressed="false">Large details</button>
<label>Show <select id="category"><option value="all">All categories</option>''' + categories + '''</select></label>
<label>Find <input id="search" type="search" placeholder="Name or model" size="18"></label>
<label><input id="names" type="checkbox" checked>Names</label>
</nav><p id="count" aria-live="polite">Showing 30 of 30 cars</p>
<section class="gallery" aria-label="Car collection">''' + '\n'.join(figures) + '''</section>
<footer>Click a picture to open its full-size PNG. Import the <b>images</b> folder through Deck library &rarr; Import an image folder. Each picture makes one matching pair. Model names appear only in filenames and review material, outside the artwork.</footer></main>
<script>
for(const button of document.querySelectorAll('[data-size]'))button.addEventListener('click',()=>{document.documentElement.style.setProperty('--card',button.dataset.size+'px');for(const b of document.querySelectorAll('[data-size]'))b.setAttribute('aria-pressed',String(b===button))});
const category=document.querySelector('#category'),search=document.querySelector('#search');
function filter(){let n=0;const term=search.value.toLowerCase().trim();for(const f of document.querySelectorAll('figure')){f.hidden=(category.value!=='all'&&f.dataset.category!==category.value)||!f.dataset.search.includes(term);if(!f.hidden)n++}document.querySelector('#count').textContent='Showing '+n+' of 30 cars'}
category.addEventListener('change',filter);search.addEventListener('input',filter);
document.querySelector('#names').addEventListener('change',e=>document.body.classList.toggle('blind',!e.target.checked));
</script></body></html>'''
(ROOT / 'preview.html').write_text(page, encoding='utf-8')

def sheet(size, cell_w, cell_h, filename):
    canvas = Image.new('RGB', (40 + 6 * cell_w, 96 + 5 * cell_h), '#f6f1e8')
    draw = ImageDraw.Draw(canvas)
    font = ImageFont.truetype('C:/Windows/Fonts/segoeui.ttf', 11)
    title = ImageFont.truetype('C:/Windows/Fonts/georgia.ttf', 25)
    draw.text((20, 16), 'Cars colour sketches', font=title, fill='#243441')
    draw.text((20, 52), f'30 unique models / 30 matching pairs / pictures shown at {size} x {size} pixels', font=font, fill='#56636a')
    for i, e in enumerate(data['entries']):
        x = 20 + (i % 6) * cell_w
        y = 80 + (i // 6) * cell_h
        with Image.open(ROOT / e['file']) as im:
            thumb = im.convert('RGB').resize((size, size), Image.Resampling.LANCZOS)
        canvas.paste(thumb, (x, y))
        label = f"{e['slot']:02d} {e['subject']}"
        lines = textwrap.wrap(label, width=18 if size == 100 else 27)
        draw.multiline_text((x, y + size + 5), '\n'.join(lines), font=font, fill='#243441', spacing=2)
    canvas.save(ROOT / filename)

sheet(180, 196, 235, 'contact-sheet.png')
sheet(100, 144, 160, 'qa/card-size-proof.png')

(ROOT / 'START HERE.txt').write_text('''CARS COLOUR SKETCHES

30 unique square PNG illustrations, supporting 30 matching pairs.
High-quality graphite, coloured-pencil and watercolour sketches on warm ivory paper,
matching the aircraft collection. Original images are 1254 x 1254 pixels.

Open preview.html to browse by name or category. Use Card size to review at 100 pixels,
or click a picture to open the original. Toggle Names for a visual-only review.
contact-sheet.png shows the whole collection; qa/card-size-proof.png shows small cards.
models.csv lists every model and its example year. Names are outside the artwork.

In the game: Deck library -> Import an image folder -> choose the images folder.
Select all 30 pictures. Suggested domain: Cars; style: Illustrated; complexity: Easy.
Save the deck. The game creates two identical cards from each unique picture.
Select a smaller subset if desired. This delivery has not been imported or play-tested.

Generated with built-in image_gen. All prompts, references and corrections are in
generation.json and records/. checksums.json records file and decoded-pixel hashes.
build_delivery.py copies generated PNGs without editing their pixels, checks them,
and rebuilds the gallery and contact sheets. Original generated files stay untouched.
''', encoding='utf-8')

if args.package:
    assert data.get('visual_review') == 'complete', 'Finish visual review before packaging'
    package_files = [ROOT / e['file'] for e in data['entries']]
    package_files += [ROOT / n for n in ['preview.html', 'contact-sheet.png', 'START HERE.txt',
        'generation.json', 'checksums.json', 'models.csv', 'qa/card-size-proof.png', 'build_delivery.py']]
    package_files += sorted((ROOT / 'records').glob('*.json'))
    archive = ROOT.with_suffix('.zip')
    with zipfile.ZipFile(archive, 'x', compression=zipfile.ZIP_DEFLATED, compresslevel=1) as z:
        for file in package_files:
            z.write(file, arcname=str(Path(ROOT.name) / file.relative_to(ROOT)))
    with zipfile.ZipFile(archive) as z:
        assert z.testzip() is None
        image_names = [n for n in z.namelist() if '/images/' in n and n.endswith('.png')]
        assert len(image_names) == 30
        for entry in data['entries']:
            name = str(Path(ROOT.name) / entry['file']).replace('\\', '/')
            assert hashlib.sha256(z.read(name)).hexdigest() == entry['sha256']
    print(json.dumps({'archive': str(archive), 'bytes': archive.stat().st_size,
        'archive_images_verified': len(image_names), 'sha256': hashlib.sha256(archive.read_bytes()).hexdigest()}, indent=2))

print(json.dumps({'images': len(checks), 'unique_decoded_images': len(pixels),
    'dimensions': data['dimensions'], 'source_copies_verified': True,
    'preview': str(ROOT / 'preview.html')}, indent=2))

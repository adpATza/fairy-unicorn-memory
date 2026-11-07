"""Validate the original PNGs and build an offline review gallery; never edits images."""
from pathlib import Path
import hashlib
import html
import json

from PIL import Image

ROOT = Path(__file__).resolve().parent
PLAN = ROOT / 'generation.json'
data = json.loads(PLAN.read_text(encoding='utf-8'))
records = {int(p.stem): json.loads(p.read_text(encoding='utf-8'))
           for p in (ROOT / 'records').glob('*.json')}
assert set(records) == set(range(3, 31)), 'Expected 28 newly generated images'
assert len(data['entries']) == 30
assert sum(e['category'] == 'helicopter' for e in data['entries']) == 5
originals = ROOT.parent / 'aeroplanes' / 'style-review-v1'
approved = json.loads((originals / 'generation.json').read_text(encoding='utf-8'))
pixel_hashes = set()
checks = []
cards = []

for entry in data['entries']:
    slot = entry['slot']
    filename = Path(entry['file']).name
    file = ROOT / 'images' / filename
    payload = file.read_bytes()
    with Image.open(file) as image:
        assert image.format == 'PNG'
        image.verify()
    with Image.open(file) as image:
        image.load()
        width, height = image.size
        assert width == height and width >= 1024
        pixels = image.convert('RGB')
        pixel_hash = hashlib.sha256(pixels.tobytes()).hexdigest()
        assert pixel_hash not in pixel_hashes, 'Duplicate decoded pixels: ' + filename
        pixel_hashes.add(pixel_hash)
    digest = hashlib.sha256(payload).hexdigest()
    if slot <= 2:
        assert payload == (originals / filename).read_bytes(), 'Approved original changed'
        source = approved['samples'][slot - 1]
        entry['prompts'] = source['prompts']
        entry['source'] = source['source']
        entry['provenance'] = 'Approved style sample, copied without changes'
    else:
        record = records[slot]
        assert payload == Path(record['path']).read_bytes(), 'Source copy mismatch'
        entry['prompt'] = record['prompt']
        entry['composition_edits'] = record['edits']
        if 'orientation_requested' in record:
            entry['orientation_requested'] = record['orientation_requested']
        entry['source'] = record['path']
        entry['provenance'] = 'Built-in image_gen, individually generated and reviewed'
    entry.update(file='images/' + filename, status='complete', width=width, height=height,
                 sha256=digest, decoded_pixel_sha256=pixel_hash)
    checks.append({'file': entry['file'], 'width': width, 'height': height,
                   'sha256': digest, 'decoded_pixel_sha256': pixel_hash})
    name = html.escape(entry['subject'])
    category = html.escape(entry['category'])
    kind = 'helicopter' if entry['category'] == 'helicopter' else 'aeroplane'
    cards.append(f'<figure data-kind="{kind}"><a href="images/{filename}" target="_blank" rel="noopener"><img src="images/{filename}" alt="{name}" width="170" height="170"></a><figcaption><b>{slot:02d} &middot; {name}</b><span>{category}</span></figcaption></figure>')

assert len(list((ROOT / 'images').glob('*.png'))) == 30
data.update(status='artwork_complete', style_approved=True, total_images=30,
            aeroplane_images=25, helicopter_images=5, new_images_created=28,
            full_size_visual_review='complete', thumbnail_review='pending',
            delivery='30 unique PNGs, one image per matching pair; game creates both cards')
data['orientation_variations'] = json.loads((ROOT / 'orientation-plan.json').read_text(encoding='utf-8'))
PLAN.write_text(json.dumps(data, indent=2) + '\n', encoding='utf-8')
(ROOT / 'checksums.json').write_text(json.dumps(checks, indent=2) + '\n', encoding='utf-8')

page = '''<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Aircraft colour sketches - 30 pairs</title>
<style>
:root{--card:170px;color-scheme:light}*{box-sizing:border-box}body{margin:0;background:#f6f1e8;color:#243441;font:15px/1.45 "Segoe UI",Arial,sans-serif}main{max-width:1480px;margin:28px auto;padding:0 28px 40px}h1{font:normal 34px/1.15 Georgia,serif;margin:0 0 8px}p{margin:8px 0 14px;color:#56636a}nav{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:16px 0 20px}button,select{font:inherit;border:1px solid #b9c3c6;border-radius:5px;background:#fffdf7;padding:7px 12px;color:#243441;cursor:pointer}button[aria-pressed=true]{background:#243f52;color:white;border-color:#243f52}label{display:flex;align-items:center;gap:6px;margin-left:8px}.gallery{display:grid;grid-template-columns:repeat(auto-fit,var(--card));gap:18px 14px;align-items:start}figure{margin:0;width:var(--card)}figure[hidden]{display:none}figure a{display:block;background:#faf3e7;line-height:0}img{display:block;width:var(--card);height:var(--card);object-fit:contain}a:focus-visible,button:focus-visible,select:focus-visible{outline:3px solid #bf7e27;outline-offset:3px}figcaption{font-size:12px;line-height:1.3;padding-top:7px;min-height:52px}figcaption b{font-weight:600;display:block}figcaption span{display:block;color:#718087;font-size:11px;margin-top:3px}body.blind figcaption{visibility:hidden}footer{font-size:13px;color:#63737b;border-top:1px solid #d5d7d0;margin-top:24px;padding-top:16px}@media print{nav{display:none}main{padding:0;margin:0}.gallery{grid-template-columns:repeat(5,1fr);gap:10px}figure{width:auto;break-inside:avoid}img{width:100%;height:auto}h1{font-size:24px}footer{display:none}}
</style></head><body><main>
<h1>Aircraft colour sketches</h1>
<p>30 matching pairs &middot; 25 aeroplanes &middot; 5 helicopters &middot; original 1254 &times; 1254 PNGs</p>
<nav aria-label="Review controls">
<button data-size="170" aria-pressed="true">Gallery</button><button data-size="100" aria-pressed="false">Card size &middot; 100 px</button><button data-size="300" aria-pressed="false">Large details</button>
<label>Show <select id="kind"><option value="all">All 30 aircraft</option><option value="aeroplane">25 aeroplanes</option><option value="helicopter">5 helicopters</option></select></label>
<label><input id="names" type="checkbox" checked>Names</label>
</nav><section class="gallery" aria-label="Aircraft collection">
''' + '\n'.join(cards) + '''
</section><footer>Click an image to open the full-size PNG. Import the <b>images</b> folder through Deck library &rarr; Import an image folder. Each unique picture makes one matching pair. Names appear only in this gallery, outside the card artwork.</footer></main>
<script>
for(const button of document.querySelectorAll('[data-size]'))button.addEventListener('click',()=>{document.documentElement.style.setProperty('--card',button.dataset.size+'px');for(const b of document.querySelectorAll('[data-size]'))b.setAttribute('aria-pressed',String(b===button))});
document.querySelector('#kind').addEventListener('change',event=>{for(const f of document.querySelectorAll('figure'))f.hidden=event.target.value!=='all'&&f.dataset.kind!==event.target.value});
document.querySelector('#names').addEventListener('change',event=>document.body.classList.toggle('blind',!event.target.checked));
</script></body></html>
'''
(ROOT / 'preview.html').write_text(page, encoding='utf-8')
(ROOT / 'START HERE.txt').write_text('AIRCRAFT COLOUR SKETCHES\n\n30 unique square PNG illustrations, supporting 30 matching pairs.\n25 aeroplanes and 5 helicopters, including the approved Mustang and Spitfire.\n\nOpen preview.html to browse the collection. Use Card size to review at 100 pixels,\nor click any picture to open the original. Names are outside the artwork.\n\nIn the game: Deck library -> Import an image folder -> choose the images folder.\nSelect all 30 pictures. Suggested domain: Aircraft; style: Illustrated; complexity: Easy.\nSave the deck. The game creates two identical cards from each unique picture.\n\nGenerated with built-in image_gen, following docs/Artwork and Import Guide.html.\nAll generation prompts and composition edits are recorded in generation.json.\nChecksums are in checksums.json. Source artwork has not been modified by this script.\n', encoding='utf-8')
print(json.dumps({'images': len(checks), 'aeroplanes': 25, 'helicopters': 5,
                  'dimensions': sorted(set((x['width'], x['height']) for x in checks)),
                  'decoded_pixel_hashes': len(pixel_hashes),
                  'approved_originals_unchanged': True,
                  'preview': str(ROOT / 'preview.html')}, indent=2))

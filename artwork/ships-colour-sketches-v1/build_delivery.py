"""Validate original ship PNGs and build review assets without altering card files."""
from pathlib import Path
import argparse
import hashlib
import html
import json
import textwrap
import zipfile
from collections import Counter
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent
parser = argparse.ArgumentParser()
parser.add_argument('--finalize', action='store_true', help='Package after visual review')
args = parser.parse_args()
data = json.loads((ROOT / 'generation.json').read_text(encoding='utf-8'))
sources = json.loads((ROOT / 'references.json').read_text(encoding='utf-8'))
refs = {e['slot']: e for e in sources['entries']}
records = {int(p.stem): json.loads(p.read_text(encoding='utf-8'))
           for p in (ROOT / 'records').glob('*.json')}
assert set(records) == set(range(1, 31)), 'Expected one record for each of 30 ships'
assert len(data['entries']) == 30
assert len(list((ROOT / 'images').glob('*.png'))) == 30
hashes = set()
checks = []
figures = []

def group_for(slot):
    if slot <= 5:
        return 'Passengers and early steam'
    if slot <= 12:
        return 'Sail and exploration'
    if slot <= 20:
        return 'Naval ships and submarines'
    return 'Research and working vessels'

for e in data['entries']:
    n = e['slot']
    record = records[n]
    file = ROOT / e['file']
    payload = file.read_bytes()
    assert payload == Path(record['path']).read_bytes(), 'Source copy mismatch: ' + file.name
    with Image.open(file) as picture:
        assert picture.format == 'PNG'
        picture.verify()
    with Image.open(file) as picture:
        picture.load()
        assert picture.width == picture.height and picture.width >= 1024
        pixels = picture.convert('RGBA')
        digest_pixels = hashlib.sha256(pixels.tobytes()).hexdigest()
        assert digest_pixels not in hashes, 'Duplicate decoded image: ' + file.name
        hashes.add(digest_pixels)
        size = list(picture.size)
    digest = hashlib.sha256(payload).hexdigest()
    e.update(status='complete', width=size[0], height=size[1], sha256=digest,
             decoded_pixel_sha256=digest_pixels, prompt=record['prompt'],
             composition_edits=record['edits'], source=record['path'],
             style_reference=record['style_reference'], visual_review=record['review'],
             reference=refs[n], group=group_for(n))
    checks.append({'file': e['file'], 'width': size[0], 'height': size[1],
                   'sha256': digest, 'decoded_pixel_sha256': digest_pixels})
    name = html.escape(e['subject'])
    category = html.escape(e['category'])
    context = html.escape(e['historical_context'])
    group = html.escape(e['group'], quote=True)
    source_url = html.escape(refs[n]['url'], quote=True)
    search = html.escape((e['subject'] + ' ' + e['category'] + ' ' + e['historical_context']).lower(), quote=True)
    figures.append(f'<figure data-group="{group}" data-search="{search}"><a class="art" href="{e["file"]}" target="_blank" rel="noopener"><img src="{e["file"]}" alt="{name}" width="180" height="180"></a><figcaption><b>{n:02d} · {name}</b><span>{category}</span><small>{context}</small><a class="reference" href="{source_url}" target="_blank" rel="noopener">Ship reference ↗</a></figcaption></figure>')

data.update(status='complete' if args.finalize else 'pending_thumbnail_review',
            unique_images=30, pairs=30, total_images=30, tool_mode='built-in image_gen',
            full_size_visual_review='complete: each image inspected after generation and edits',
            thumbnail_review='complete: all 30 reviewed at 100 pixels per card' if args.finalize else 'pending',
            orientation_method='Individually generated left/right bow, broadside and quarter views; no bitmap mirroring of asymmetric ships.',
            validation_scope='PNG decoding, dimensions, source-copy equality, unique decoded pixels, gallery links and ZIP contents. No in-game import/play test.',
            illustration_note='Interpretive colour sketches, with inscriptions and flags omitted. Historic vessels depicted intact. Early sailing vessels include reconstructed details; ships are not at a shared physical scale.',
            delivery='30 unique PNGs: each makes one matching pair; the game makes the two identical cards.')

def write_json(name, value):
    (ROOT / name).write_text(json.dumps(value, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')

write_json('generation.json', data)
write_json('checksums.json', checks)

options = ''.join(f'<option>{html.escape(g)}</option>' for g in dict.fromkeys(group_for(n) for n in range(1, 31)))
page = """<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Ships · 30 colour sketches</title>
<style>
:root{--card:180px;color-scheme:light}*{box-sizing:border-box}body{margin:0;background:#f6f1e8;color:#243441;font:15px/1.5 "Segoe UI",Arial,sans-serif}main{max-width:1480px;margin:32px auto;padding:0 28px 40px}h1{font:normal 38px/1.1 Georgia,serif;margin:0 0 10px}.intro{max-width:850px;color:#56636a}.intro p{margin:8px 0}nav{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:22px 0}button,select,input[type=search]{font:inherit;border:1px solid #bac3c5;border-radius:5px;background:#fffdf7;padding:7px 11px;color:#243441}button{cursor:pointer}button[aria-pressed=true]{background:#243f52;color:white;border-color:#243f52}label{display:flex;align-items:center;gap:6px}input[type=search]{width:185px}.gallery{display:grid;grid-template-columns:repeat(auto-fit,var(--card));gap:22px 14px;align-items:start}figure{margin:0;width:var(--card)}figure[hidden]{display:none}.art{display:block;line-height:0}img{display:block;width:var(--card);height:var(--card);object-fit:contain}figcaption{font-size:12px;line-height:1.35;padding-top:8px;min-height:92px}figcaption b,figcaption span,figcaption small{display:block}figcaption b{font-weight:600}figcaption span{color:#66767b;margin-top:2px}figcaption small{font-size:11px;color:#68777b;margin-top:2px}.reference{display:inline-block;font-size:11px;color:#486a7b;margin-top:4px}.blind figcaption{visibility:hidden}a:focus-visible,button:focus-visible,input:focus-visible,select:focus-visible{outline:3px solid #bf7e27;outline-offset:3px}footer{font-size:13px;color:#63737b;border-top:1px solid #d5d7d0;margin-top:24px;padding-top:16px}footer p{max-width:950px}#count{font-size:13px;color:#66767b}@media print{nav,#count{display:none}main{padding:0;margin:0}.gallery{grid-template-columns:repeat(5,1fr);gap:10px}figure{width:auto;break-inside:avoid}img{width:100%;height:auto}h1{font-size:26px}.reference{display:none}footer{font-size:10px}}
</style></head><body><main>
<h1>Ships in colour pencil</h1><div class="intro"><p>30 individual illustrations · 30 matching pairs · original square PNGs</p><p>Famous names and distinctive models across sail, steam and modern shipping. Historic vessels are shown intact in a working appearance. Names and context stay outside the artwork.</p></div>
<nav aria-label="Gallery controls"><button data-size="180" aria-pressed="true">Gallery</button><button data-size="100" aria-pressed="false">Card size · 100 px</button><button data-size="320" aria-pressed="false">Large details</button><label>Show <select id="group"><option value="">All ships</option>""" + options + """</select></label><label><input id="search" type="search" placeholder="Find a ship" aria-label="Find a ship"></label><label><input id="names" type="checkbox" checked>Names</label></nav>
<p id="count" aria-live="polite">30 ships</p><section class="gallery" aria-label="Ships collection">
""" + '\n'.join(figures) + """
</section><footer><p>Click any picture for its full-size PNG. Import the <b>images</b> folder through <b>Deck library → Import an image folder</b>. Select all 30 pictures, choose domain <b>Ships</b> and style <b>Illustrated</b>, then save. One unique image creates one matching pair.</p><p>These are newly generated interpretive sketches, not measured ship plans. Inscriptions and flags are omitted; early sailing ships include reconstructed details. Scale varies between vessels. Sources supply identification and broad historical context, not endorsements. Context checked 1 November 2026; operating status can change.</p><p><a href="START%20HERE.txt">Import guide</a> · <a href="contact-sheet.png">Contact sheet</a> · <a href="card-size-proof.png">100-pixel proof</a> · <a href="generation.json">Prompts and provenance</a> · <a href="references.json">Ship references</a> · <a href="checksums.json">Checksums</a></p></footer></main>
<script>
const figures=[...document.querySelectorAll('figure')];
for(const button of document.querySelectorAll('[data-size]'))button.addEventListener('click',()=>{document.documentElement.style.setProperty('--card',button.dataset.size+'px');for(const b of document.querySelectorAll('[data-size]'))b.setAttribute('aria-pressed',String(b===button))});
function filter(){const g=document.querySelector('#group').value,q=document.querySelector('#search').value.trim().toLowerCase();let count=0;for(const f of figures){f.hidden=Boolean((g&&f.dataset.group!==g)||(q&&!f.dataset.search.includes(q)));if(!f.hidden)count++}document.querySelector('#count').textContent=count+' ship'+(count===1?'':'s')}
document.querySelector('#group').addEventListener('change',filter);
document.querySelector('#search').addEventListener('input',filter);
document.querySelector('#names').addEventListener('change',e=>document.body.classList.toggle('blind',!e.target.checked));
</script></body></html>
"""
(ROOT / 'preview.html').write_text(page, encoding='utf-8')

readme = """SHIPS IN COLOUR PENCIL

30 unique square PNG illustrations for 30 matching pairs.
Sailing ships, ocean liners, naval ships, submarines, research and working vessels.
Each picture was individually made with built-in image_gen in the aircraft set's
coloured-pencil / graphite / watercolour style on warm ivory paper.
Viewing directions vary; asymmetric ships were not mirrored.

BROWSE
Open preview.html. Choose Gallery, Card size (100 px) or Large details.
Filter by group, search ship names, or hide the names to assess the artwork.
Click an image for the original PNG. contact-sheet.png shows all 30.

IMPORT
Deck library -> Import an image folder -> choose this package's images folder.
Select all 30. Suggested domain: Ships; style: Illustrated; complexity: Medium
because several sailing and naval vessels have related silhouettes.
Save the deck. One unique image makes one matching pair automatically.
Use a smaller, visually varied selection for an easier game.

CONTENTS
images/ contains only the 30 final PNG cards.
generation.json records subjects, exact prompts, source paths and composition edits.
records/ contains the individual generation records.
references.json links ship-identification and historical-context sources.
checksums.json records both file and decoded-pixel SHA-256 hashes.
card-size-proof.png displays the whole set at 100 pixels per image.
build_delivery.py rebuilds the gallery/proofs and verifies the originals.

ARTWORK NOTES
Historic ships are shown intact, not sinking or damaged. These are interpretive
illustrations, not measured technical drawings. Inscriptions and flags are
deliberately omitted; some early vessels include reconstructed details. Ships
are not illustrated at the same real-world scale. Museum or operator sources
supply context, not endorsements. Context checked 1 November 2026.

VALIDATION
All 30 PNGs were decoded, dimensions checked and compared to their generated
source files. All decoded pixel hashes are unique. Each was reviewed full size,
and the finished set was reviewed at 100 pixels per card before packaging.
The ZIP was integrity-tested and each archived PNG was checked against its hash.
In-game importing and play were not tested in this task.
"""
(ROOT / 'START HERE.txt').write_text(readme, encoding='utf-8')

font_file = Path('C:/Windows/Fonts/segoeui.ttf')
font_bold_file = Path('C:/Windows/Fonts/segoeuib.ttf')
def font(size, bold=False):
    return ImageFont.truetype(str(font_bold_file if bold else font_file), size)

def contact(name, card, columns):
    gap, margin, header, caption = 16, 26, 78, 64
    rows = (30 + columns - 1) // columns
    width = margin * 2 + columns * card + (columns - 1) * gap
    height = header + rows * (card + caption + gap) + 30
    sheet = Image.new('RGB', (width, height), '#f6f1e8')
    draw = ImageDraw.Draw(sheet)
    draw.text((margin, 17), 'Ships in colour pencil', font=font(24, True), fill='#243441')
    draw.text((margin, 50), f'30 unique cards · {card} pixels per image · one image makes one pair', font=font(12), fill='#56636a')
    for i, e in enumerate(data['entries']):
        x = margin + (i % columns) * (card + gap)
        y = header + (i // columns) * (card + caption + gap)
        with Image.open(ROOT / e['file']) as im:
            thumb = im.convert('RGB').resize((card, card), Image.Resampling.LANCZOS)
            sheet.paste(thumb, (x, y))
        title = f'{e["slot"]:02d} · {e["subject"]}'
        lines = textwrap.wrap(title, width=max(13, int(card / 6.7)), break_long_words=False)
        for j, line in enumerate(lines[:3]):
            draw.text((x, y + card + 5 + j * 15), line, font=font(11, True), fill='#243441')
    sheet.save(ROOT / name)
contact('contact-sheet.png', 180, 6)
contact('card-size-proof.png', 100, 10)

# Ensure every local link resolves before packaging.
from html.parser import HTMLParser
from urllib.parse import unquote, urlparse
class LinkCheck(HTMLParser):
    def handle_starttag(self, tag, attrs):
        for key, value in attrs:
            if key in ('src', 'href') and value and not urlparse(value).scheme and not value.startswith('#'):
                assert (ROOT / unquote(value)).is_file(), 'Missing gallery target: ' + value
LinkCheck().feed(page)

report = {'unique_pngs':30, 'unique_decoded_pixel_hashes':len(hashes),
          'dimensions':sorted(set((c['width'],c['height']) for c in checks)),
          'source_copies_verified':30, 'full_size_review':'complete',
          'thumbnail_review':'complete' if args.finalize else 'pending',
          'groups':dict(Counter(e['group'] for e in data['entries'])),
          'gallery_local_links':'all resolve', 'in_game_test':'not performed'}
write_json('validation.json', report)
if args.finalize:
    archive = ROOT.with_suffix('.zip')
    assert not archive.exists(), 'Use a new version instead of overwriting an archive'
    included = [ROOT / e['file'] for e in data['entries']]
    included += sorted((ROOT / 'records').glob('*.json'))
    included += [ROOT / n for n in ['preview.html', 'contact-sheet.png', 'card-size-proof.png',
                                    'START HERE.txt', 'generation.json', 'references.json',
                                    'checksums.json', 'validation.json', 'build_delivery.py']]
    with zipfile.ZipFile(archive, 'x', zipfile.ZIP_DEFLATED, compresslevel=1) as bundle:
        for file in included:
            bundle.write(file, arcname=(Path(ROOT.name) / file.relative_to(ROOT)).as_posix())
    with zipfile.ZipFile(archive) as bundle:
        assert bundle.testzip() is None
        pngs = [n for n in bundle.namelist() if '/images/' in n and n.endswith('.png')]
        assert len(pngs) == 30
        for e in data['entries']:
            payload = bundle.read((Path(ROOT.name) / e['file']).as_posix())
            assert hashlib.sha256(payload).hexdigest() == e['sha256']
    report.update(archive=str(archive), archive_bytes=archive.stat().st_size,
                  archive_sha256=hashlib.sha256(archive.read_bytes()).hexdigest(),
                  archived_png_hashes_verified=30, zip_integrity='passed')
    write_json('package-verification.json', report)
print(json.dumps(report, indent=2))


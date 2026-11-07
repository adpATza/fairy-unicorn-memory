"""Build review sheets, an offline gallery and verified archives; never alter cards."""
from pathlib import Path
import argparse
import csv
import hashlib
import html
import json
import math
import shutil
import zipfile
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent
parser = argparse.ArgumentParser()
parser.add_argument('--finalize', action='store_true', help='Archive after visual review')
args = parser.parse_args()

def digest(payload):
    return hashlib.sha256(payload).hexdigest()

def save_json(name, value):
    (ROOT / name).write_text(json.dumps(value, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')

def region(slot):
    if slot == 1 or 44 <= slot <= 48:
        return 'Africa'
    if 2 <= slot <= 10:
        return 'Americas'
    if 11 <= slot <= 30:
        return 'Europe'
    if slot >= 49:
        return 'Oceania'
    return 'Asia'

manifest = json.loads((ROOT / 'generation.json').read_text(encoding='utf-8'))
records = [json.loads((ROOT / 'records' / f'{slot:02d}.json').read_text(encoding='utf-8'))
           for slot in range(1, 51)]
assert len({r['country'] for r in records}) == 50
assert len(list((ROOT / 'images').glob('*.png'))) == 50
checks = []
pixels_seen = set()
for record in records:
    slot = record['slot']
    file = ROOT / 'images' / f"{slot:02d}-{record['slug']}.png"
    payload = file.read_bytes()
    assert payload == Path(record['source_path']).read_bytes(), f'Source mismatch: {file.name}'
    with Image.open(file) as im:
        assert im.format == 'PNG'
        im.verify()
    with Image.open(file) as im:
        im = im.convert('RGBA')
        assert im.size == (1254, 1254), f'Unexpected dimensions: {file.name}'
        pixel_hash = digest(im.tobytes())
        assert pixel_hash not in pixels_seen, f'Duplicate decoded image: {file.name}'
        pixels_seen.add(pixel_hash)
    record.update(file=file.relative_to(ROOT).as_posix(), width=1254, height=1254,
                  sha256=digest(payload), decoded_pixel_sha256=pixel_hash,
                  region=region(slot), deck='A' if slot % 2 else 'B')
    checks.append({key: record[key] for key in
                   ('slot', 'country', 'file', 'width', 'height', 'sha256', 'decoded_pixel_sha256')})
    deck = ROOT / 'decks' / ('01-world-flags-a' if slot % 2 else '02-world-flags-b')
    deck.mkdir(parents=True, exist_ok=True)
    shutil.copy2(file, deck / file.name)
    assert digest((deck / file.name).read_bytes()) == record['sha256']

manifest.update(status='complete', entries=records, unique_images=50,
                date='2026-11-01', source_copies_unchanged=True,
                note='Native generated 1254 x 1254 PNGs; one image makes one matching pair.')
save_json('generation.json', manifest)
save_json('checksums.json', checks)
with (ROOT / 'countries.csv').open('w', newline='', encoding='utf-8-sig') as stream:
    writer = csv.DictWriter(stream, fieldnames=['slot', 'country', 'region', 'deck', 'file'])
    writer.writeheader()
    for record in records:
        writer.writerow({key: record[key] for key in writer.fieldnames})

def font(size, serif=False):
    path = Path('C:/Windows/Fonts') / ('georgia.ttf' if serif else 'segoeui.ttf')
    return ImageFont.truetype(str(path), size) if path.exists() else ImageFont.load_default()

def sheet(name, thumb, columns, title):
    gap, pad, heading, label = 16, 24, 88, 40
    rows = math.ceil(len(records) / columns)
    cell_w, cell_h = thumb, thumb + label
    board = Image.new('RGB', (pad * 2 + columns * cell_w + (columns - 1) * gap,
                             heading + rows * cell_h + (rows - 1) * gap + pad), '#f4f0e7')
    draw = ImageDraw.Draw(board)
    draw.text((pad, 16), title, fill='#263f3a', font=font(28, True))
    draw.text((pad, 52), f'50 countries / one image per pair / previews at {thumb} pixels',
              fill='#53645e', font=font(14))
    for index, record in enumerate(records):
        x = pad + (index % columns) * (cell_w + gap)
        y = heading + (index // columns) * (cell_h + gap)
        with Image.open(ROOT / record['file']) as original:
            board.paste(original.convert('RGB').resize((thumb, thumb), Image.Resampling.LANCZOS), (x, y))
        name_text = f"{record['slot']:02d} {record['country']}"
        if draw.textlength(name_text, font=font(12)) > thumb:
            words = name_text.split()
            line = ''
            lines = []
            for word in words:
                test = (line + ' ' + word).strip()
                if draw.textlength(test, font=font(12)) > thumb and line:
                    lines.append(line)
                    line = word
                else:
                    line = test
            lines.append(line)
            name_text = '\n'.join(lines)
        draw.multiline_text((x, y + thumb + 5), name_text, fill='#263f3a', font=font(12), spacing=2)
    board.save(ROOT / name)

sheet('contact-sheet.png', 180, 10, 'Country flags in colour pencil')
sheet('card-size-proof.png', 100, 10, 'Country flags at playing-card size')

figures = []
for r in records:
    country = html.escape(r['country'])
    figures.append(f'''<figure data-name="{country.lower()}" data-region="{r['region']}" data-deck="{r['deck']}">
<a href="{r['file']}" target="_blank"><img src="{r['file']}" alt="Coloured-pencil flag of {country}" width="1254" height="1254" loading="lazy"></a>
<figcaption><span>{r['slot']:02d} / {r['region']} / Deck {r['deck']}</span><strong>{country}</strong></figcaption></figure>''')

page = '''<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Country flags in colour pencil</title><style>
:root{color-scheme:light;--paper:#f4f0e7;--ink:#203f35;--muted:#657268;--line:#c9cfc2}
*{box-sizing:border-box}body{margin:0;background:var(--paper);color:var(--ink);font:16px/1.55 "Segoe UI",sans-serif}
main{max-width:1600px;margin:auto;padding:44px 36px 64px}.eyebrow{font-size:12px;letter-spacing:.18em;text-transform:uppercase}
header{display:flex;gap:32px;align-items:end;justify-content:space-between;border-bottom:1px solid var(--line);padding-bottom:24px}
h1{font:normal clamp(32px,4vw,56px)/1.1 Georgia,serif;margin:12px 0}header p{max-width:600px;margin:14px 0 0;color:var(--muted)}
a{color:inherit;text-underline-offset:4px}nav{display:flex;gap:18px;white-space:nowrap;font-size:14px}
.tools{display:flex;gap:12px;flex-wrap:wrap;align-items:center;padding:24px 0}input,select,button{font:inherit;color:var(--ink);background:#fffdf7;border:1px solid var(--line);border-radius:3px;padding:8px 12px}
input[type=search]{min-width:240px}label{display:flex;gap:8px;align-items:center}.count{color:var(--muted);font-size:14px;margin:0 0 12px}
#gallery{display:grid;grid-template-columns:repeat(auto-fill,minmax(205px,1fr));gap:24px 20px}figure{margin:0;min-width:0}figure a{display:block}img{display:block;width:100%;height:auto;aspect-ratio:1;object-fit:contain}
figcaption{padding-top:8px}figcaption span{display:block;color:var(--muted);font-size:11px;letter-spacing:.04em;text-transform:uppercase}figcaption strong{font-weight:500;font-size:16px}
body.small #gallery{grid-template-columns:repeat(auto-fill,100px);gap:22px 30px}body.small figcaption strong{font-size:12px}body.small figcaption span{display:none}
body.large #gallery{grid-template-columns:repeat(auto-fill,minmax(400px,1fr))}body.hidden-names figcaption{visibility:hidden}figure[hidden]{display:none}
details{border-top:1px solid var(--line);margin-top:40px;padding-top:22px}summary{cursor:pointer;font-family:Georgia,serif;font-size:23px}.notes{max-width:840px;color:var(--muted)}footer{margin-top:32px;color:var(--muted);font-size:12px}
@media(max-width:650px){main{padding:28px 18px}header{display:block}nav{margin-top:20px;flex-wrap:wrap}#gallery{grid-template-columns:repeat(2,minmax(0,1fr));gap:20px 12px}body.large #gallery{grid-template-columns:1fr}}
</style></head><body><main><header><div><div class="eyebrow">The memory collection / 50 countries</div>
<h1>Flags in colour pencil.</h1><p>Rich pencil colour, fine drawn edges and warm ivory paper. Fifty individual flag illustrations, ready to make fifty matching pairs across your collections.</p></div>
<nav><a href="contact-sheet.png">Contact sheet</a><a href="card-size-proof.png">Card-size proof</a><a href="countries.csv">Country list</a></nav></header>
<div class="tools"><input type="search" id="search" aria-label="Find a country" placeholder="Find a country...">
<select id="region" aria-label="Filter region"><option value="">All regions</option><option>Africa</option><option>Americas</option><option>Asia</option><option>Europe</option><option>Oceania</option></select>
<select id="deck" aria-label="Filter deck"><option value="">Both decks</option><option value="A">Deck A - 25 flags</option><option value="B">Deck B - 25 flags</option></select>
<select id="size" aria-label="Picture size"><option value="">Gallery</option><option value="small">Card size - 100 px</option><option value="large">Large details</option></select>
<label><input type="checkbox" id="names" checked>Show names</label></div>
<p class="count" id="count">50 countries</p><section id="gallery" aria-label="Flag collection">''' + '\n'.join(figures) + '''</section>
<details open><summary>Use these cards in the memory game</summary><div class="notes">
<p>Import <a href="decks/01-world-flags-a/">Deck A</a> or <a href="decks/02-world-flags-b/">Deck B</a> as a ready-made selection of 25 flags. Each folder contains only its 25 PNG files. Alternatively import the <a href="images/">images folder</a> and choose any 2-30 of the 50 flags. One unique picture makes one matching pair automatically.</p>
<p>In Deck library, choose Import an image folder, select a folder, review the pictures, name your deck and save. Suggested domain: Country flags; style: Illustrated. Difficulty depends on your selection: related tricolours and the Australian/New Zealand pair make a harder game.</p>
<p>Each card is an original 1254 x 1254 PNG generated individually with built-in image_gen. Country names appear here and in filenames, not as labels on the cards. Brazil retains its national motto; small heraldic details are drawn interpretations. These illustrations are for recognition and matching, not flag-manufacturing diagrams.</p>
<p><a href="START%20HERE.txt">Read the package guide</a> / <a href="generation.json">Prompts and provenance</a> / <a href="references.json">Flag reference notes</a></p>
</div></details><footer>Created 1 November 2026. Offline gallery / 50 different countries / two import folders of 25. In-game import and play were not tested.</footer>
</main><script>
const cards=[...document.querySelectorAll('figure')], search=document.querySelector('#search'), region=document.querySelector('#region'), deck=document.querySelector('#deck');
function filter(){let n=0;const q=search.value.trim().toLowerCase();cards.forEach(card=>{const show=card.dataset.name.includes(q)&&(!region.value||card.dataset.region===region.value)&&(!deck.value||card.dataset.deck===deck.value);card.hidden=!show;if(show)n++});document.querySelector('#count').textContent=n+' of 50 countries'}
search.addEventListener('input',filter);region.addEventListener('change',filter);deck.addEventListener('change',filter);
document.querySelector('#size').addEventListener('change',e=>{document.body.classList.remove('small','large');if(e.target.value)document.body.classList.add(e.target.value)});
document.querySelector('#names').addEventListener('change',e=>document.body.classList.toggle('hidden-names',!e.target.checked));
</script></body></html>'''
(ROOT / 'preview.html').write_text(page, encoding='utf-8')

readme = '''COUNTRY FLAGS IN COLOUR PENCIL

50 different well-known countries, one separate square PNG per country.
Each picture was individually generated with built-in image_gen, using the
butterfly thread 01a191d5-eb59-7430-9dcc-c615495770ff as the drawing-style reference.
The finished flag cards share coloured-pencil texture and warm cream paper.
Final PNGs retain their native generated 1254 x 1254 size without resampling.

BROWSE
Open preview.html to search countries, filter by region/deck, hide the names,
or compare Gallery, Card size (100 px) and Large details views.
Click any picture to open the full PNG. contact-sheet.png shows all 50.

IMPORT
The current game accepts 2-30 unique images per deck.
decks/01-world-flags-a and decks/02-world-flags-b each contain 25 different flags.
Both are mixed world selections; together they cover all 50 without overlap.
Alternatively choose any 2-30 pictures from images/ in the import screen.
One image makes one matching pair automatically. Never import preview sheets.
Suggested domain: Country flags; style: Illustrated. Choose complexity to suit
your subset: similar tricolours and Australia/New Zealand are more challenging.

CONTENTS
images/                 all 50 final PNGs, only card files
decks/                  two ready-to-import folders, 25 PNGs in each
preview.html            offline labelled gallery
contact-sheet.png       labelled collection overview at 180 px per card
card-size-proof.png     labelled overview at 100 px per card
countries.csv           country names, regions, deck selections and filenames
generation.json         all exact prompts, selected sources and revision records
records/                individual generation records
references.json         flag reference notes and official design sources
checksums.json          file and decoded-pixel SHA-256 hashes
verification.json       packaging validation and its boundaries
build_delivery.py       rebuild reviews and verify copies (requires Pillow)

ARTWORK NOTES
Flags are flat and front-facing so their key colours and symbols remain clear.
No country-name labels appear on cards. Genuine intrinsic national emblems and
mottos remain part of the flag. Austria and Peru use their plain civil flags.
These are artistic recognition cards, not measured manufacturing diagrams;
small heraldic details and proportions retain hand-drawn interpretation.

VALIDATION
All 50 PNGs decode successfully, are 1254 x 1254, have unique decoded pixels,
and are byte-identical to their selected generated source files. Import folders
are disjoint and contain 25 files each. Gallery image links were checked.
The artwork was visually reviewed individually and at thumbnail size.
In-game importing and play were not tested in this task.
'''
(ROOT / 'START HERE.txt').write_text(readme, encoding='utf-8')

from html.parser import HTMLParser
from urllib.parse import unquote
class LinkCheck(HTMLParser):
    def handle_starttag(self, tag, attrs):
        for key, value in attrs:
            if key in ('src', 'href') and value and not value.startswith(('http', '#')):
                assert (ROOT / unquote(value)).exists(), f'Missing gallery resource: {value}'
LinkCheck().feed(page)
sets = [{f.name for f in (ROOT / 'decks' / name).glob('*.png')}
        for name in ('01-world-flags-a', '02-world-flags-b')]
assert len(sets[0]) == len(sets[1]) == 25
assert not sets[0] & sets[1]
assert len(sets[0] | sets[1]) == 50
verification = dict(images=50, unique_countries=50, unique_decoded_images=len(pixels_seen),
                    dimensions=[1254, 1254], source_copies_verified=True,
                    import_folder_counts=[25, 25], import_folders_disjoint=True,
                    gallery_local_resources_verified=True, in_game_tested=False)
save_json('verification.json', verification)
if args.finalize:
    archive = ROOT.parent / (ROOT.name + '-cards.zip')
    with zipfile.ZipFile(archive, 'w', zipfile.ZIP_DEFLATED, compresslevel=6) as z:
        for r in records:
            file = ROOT / r['file']
            z.write(file, file.name)
    with zipfile.ZipFile(archive) as z:
        assert z.testzip() is None
        assert len(z.namelist()) == 50 and all('/' not in name for name in z.namelist())
        for r in records:
            assert digest(z.read(Path(r['file']).name)) == r['sha256']
    verification.update(cards_zip=archive.name, cards_zip_entries=50,
                        cards_zip_integrity=True, cards_zip_hashes_verified=True,
                        cards_zip_sha256=digest(archive.read_bytes()))
    save_json('verification.json', verification)
    package = ROOT.parent / (ROOT.name + '-complete.zip')
    files = sorted(f for f in ROOT.rglob('*') if f.is_file() and '__pycache__' not in f.parts)
    with zipfile.ZipFile(package, 'w', zipfile.ZIP_DEFLATED, compresslevel=6) as z:
        for file in files:
            z.write(file, ROOT.name + '/' + file.relative_to(ROOT).as_posix())
    with zipfile.ZipFile(package) as z:
        assert z.testzip() is None
        assert len(z.namelist()) == len(files)
        for file in files:
            name = ROOT.name + '/' + file.relative_to(ROOT).as_posix()
            assert digest(z.read(name)) == digest(file.read_bytes()), name
    save_json('package-verification.json', dict(complete_zip=package.name,
              entries=len(files), integrity=True, all_entries_hash_verified=True,
              sha256=digest(package.read_bytes())))
print(json.dumps(verification, indent=2))

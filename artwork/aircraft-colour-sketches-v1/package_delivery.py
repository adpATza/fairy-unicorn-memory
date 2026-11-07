"""Package the final 30-card collection after its visual review."""
from pathlib import Path
import hashlib
import json
import shutil
import zipfile

root = Path(__file__).resolve().parent
data = json.loads((root / 'generation.json').read_text(encoding='utf-8'))
assert len(data['entries']) == 30
assert sum(e['category'] == 'helicopter' for e in data['entries']) == 5
assert len(data['orientation_variations']['transforms']) == 12
assert sum(t['mirror_horizontally'] for t in data['orientation_variations']['transforms']) == 7
data.update(status='complete', thumbnail_review='complete: all 30 reviewed together at 100 pixels per card',
            gallery_browser_review='Unavailable: local browser use disabled in Work settings',
            orientation_visual_review='complete: varied headings with seven opposite-facing aircraft')
(root / 'generation.json').write_text(json.dumps(data, indent=2) + '\n', encoding='utf-8')
shutil.copy2(root / 'qa' / 'card-size-proof.png', root / 'contact-sheet.png')
archive = root.with_suffix('.zip')
files = [root / e['file'] for e in data['entries']]
files += [root / name for name in ['preview.html', 'contact-sheet.png', 'START HERE.txt',
                                  'generation.json', 'checksums.json', 'orientation-plan.json']]
with zipfile.ZipFile(archive, 'x', compression=zipfile.ZIP_DEFLATED, compresslevel=1) as bundle:
    for file in files:
        bundle.write(file, arcname=str(Path(root.name) / file.relative_to(root)))
with zipfile.ZipFile(archive) as bundle:
    assert bundle.testzip() is None
    images = [n for n in bundle.namelist() if '/images/' in n and n.endswith('.png')]
    assert len(images) == 30
    for entry in data['entries']:
        name = str(Path(root.name) / entry['file']).replace('\\', '/')
        assert hashlib.sha256(bundle.read(name)).hexdigest() == entry['sha256']
print(json.dumps({'archive': str(archive), 'bytes': archive.stat().st_size,
                  'archive_images_verified': len(images), 'helicopters': 5,
                  'orientation_variations': 12, 'mirrored_images': 7,
                  'sha256': hashlib.sha256(archive.read_bytes()).hexdigest()}, indent=2))

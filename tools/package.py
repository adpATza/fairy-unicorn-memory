"""Reproducible native Windows export, isolated verification and ZIP delivery."""
from pathlib import Path
import argparse, hashlib, json, os, shutil, subprocess, sys, uuid, zipfile
sys.stdout.reconfigure(encoding='utf8')
sys.stderr.reconfigure(encoding='utf8')

ROOT=Path(__file__).resolve().parents[1]
DIST=ROOT/'dist'
VERIFY=ROOT/'verification'

def run(command, logfile, env=None):
    print('Running:', ' '.join(str(x) for x in command), flush=True)
    result=subprocess.run([str(x) for x in command],cwd=ROOT,env=env,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,timeout=240)
    output=result.stdout.decode('utf8',errors='replace')
    (VERIFY/logfile).write_text(output,encoding='utf8')
    # Corrupt-file fixture deliberately triggers image-decoder diagnostics.
    cleaned=output
    start=cleaned.find('EXPECTED_IMPORT_ERROR_BEGIN')
    end=cleaned.find('EXPECTED_IMPORT_ERROR_END')
    if start>=0 and end>start:cleaned=cleaned[:start]+cleaned[end+len('EXPECTED_IMPORT_ERROR_END'):]
    if result.returncode or 'SCRIPT ERROR' in cleaned or '\nERROR:' in cleaned:
        print(output[-12000:]);raise RuntimeError(f'{logfile} failed: exit {result.returncode}')
    print(output[-1300:],flush=True)
    return output

def verify_game(command,name,visual=False):
    data=VERIFY/'runtime'/f'{name}-{uuid.uuid4().hex[:8]}'
    data.mkdir(parents=True)
    env=os.environ.copy();env['APPDATA']=str(data)
    flags=[] if visual else ['--headless']
    run(command+flags+['--','--self-test'],f'{name}-tests.log',env)
    report=data/'Fairy and Unicorn Memory'/'qa-report.json'
    result=json.loads(report.read_text(encoding='utf8'))
    if result['failures']:raise RuntimeError('Failed checks')
    shutil.copy2(report,VERIFY/f'{name}-report.json')
    artwork=report.parent/'qa-artwork'
    if artwork.exists():
        (VERIFY/'artwork').mkdir(exist_ok=True)
        for file in artwork.glob('*.png'):shutil.copy2(file,VERIFY/'artwork'/file.name)
    if visual:
        (VERIFY/'screenshots').mkdir(exist_ok=True)
        for file in report.parent.glob('*.png'):shutil.copy2(file,VERIFY/'screenshots'/file.name)
    run(command+['--headless','--','--persistence-check'],f'{name}-persistence.log',env)
    shutil.copy2(report,VERIFY/f'{name}-persistence-report.json')
    return result

def archives():
    folder=DIST/'Fairy and Unicorn Memory'
    with zipfile.ZipFile(DIST/'Fairy-Unicorn-Memory-Windows-x64.zip','w',zipfile.ZIP_DEFLATED,compresslevel=9) as z:
        for file in folder.rglob('*'):
            if file.is_file():z.write(file,'Fairy and Unicorn Memory/'+file.relative_to(folder).as_posix())
    excluded={'.git','.godot','.tools','dist','__pycache__'}
    with zipfile.ZipFile(DIST/'Fairy-Unicorn-Memory-Godot-Source.zip','w',zipfile.ZIP_DEFLATED,compresslevel=9) as z:
        for file in ROOT.rglob('*'):
            rel=file.relative_to(ROOT)
            if any(p in excluded for p in rel.parts) or rel.parts[:2]==('verification','runtime'):continue
            if rel.parts[0]=='verification' and (file.suffix in {'.log','.import'} or any(p.startswith('manual-images_') for p in rel.parts)):continue
            if file.is_file():z.write(file,'Fairy Unicorn Memory Source/'+rel.as_posix())
    hashes=[]
    for file in DIST.glob('*.zip'):
        hashes.append(hashlib.sha256(file.read_bytes()).hexdigest()+'  '+file.name)
        print(file.name,file.stat().st_size,flush=True)
    (DIST/'SHA256SUMS.txt').write_text('\n'.join(hashes)+'\n',encoding='utf8')

def main():
    p=argparse.ArgumentParser();p.add_argument('--godot',required=True);p.add_argument('--archive-only',action='store_true');a=p.parse_args()
    DIST.mkdir(exist_ok=True);VERIFY.mkdir(exist_ok=True)
    if a.archive_only:archives();return
    engine=Path(a.godot).resolve()
    version=subprocess.check_output([str(engine),'--version'],text=True).strip()
    if not version.startswith('4.7.2.'):raise RuntimeError('Use Godot 4.7.2, matching the brief.')
    run([engine,'--headless','--path',ROOT,'--editor','--import','--quit'],'import.log')
    for script in sorted((ROOT/'scripts').glob('*.gd')):
        run([engine,'--headless','--path',ROOT,'--check-only','--script',script],f'parse-{script.stem}.log')
    verify_game([engine,'--path',str(ROOT)],'source')
    folder=DIST/'Fairy and Unicorn Memory';folder.mkdir(exist_ok=True)
    exe=folder/'Fairy and Unicorn Memory.exe'
    run([engine,'--headless','--path',ROOT,'--export-release','Windows Desktop',exe],'export.log')
    for file in ['Artwork and Import Guide.html','GODOT-LICENSE.txt','GODOT-THIRD-PARTY.txt']:
        shutil.copy2(ROOT/'docs'/file,folder/file)
    shutil.copy2(ROOT/'LICENSE',folder/'LICENSE.txt')
    (folder/'START HERE.txt').write_text('FAIRY & UNICORN MEMORY\n\nLaunch Fairy and Unicorn Memory.exe. Keep its PCK beside it.\nWindows 64-bit, 1280 x 720, OpenGL 3.3. No installation or internet required.\n\nClick two cards to find a pair. Tab / arrows / Space also work. Escape pauses.\nDeck library imports your own pictures. The Adult guide explains artwork and importing.\n\nSettings and copied decks: %APPDATA%\\Fairy and Unicorn Memory\\\nBack up that folder to move collections. Original images remain untouched.\n',encoding='utf8')
    # Verify the EXE in a copied folder, away from the editable project resources.
    copied=VERIFY/'runtime'/f'portable-{uuid.uuid4().hex[:8]}'
    shutil.copytree(folder,copied)
    verify_game([str(copied/exe.name)],'exported',visual=True)
    archives()
if __name__=='__main__':main()

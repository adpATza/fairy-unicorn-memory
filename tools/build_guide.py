"""Builds the adult guide: Windows in-game text and HTML, plus the web edition's page.

python tools/build_guide.py          write all outputs
python tools/build_guide.py --check  report outputs that differ from the committed files
"""
from pathlib import Path
import html,re,sys
ROOT=Path(__file__).resolve().parents[1]
text='''[font_size=30][b]Artwork & importing[/b][/font_size]
Make a collection that belongs to your family. This game runs offline: it never generates pictures, changes their style, or sends them anywhere.

[font_size=26][b]One picture makes one matching pair[/b][/font_size]
Generate or draw ONE unique image for each pair. The game copies that same image onto two cards. Never generate two separate “matching” pictures: small differences make the pair unfair.
Use 2–30 unique images per deck. Recommended files: 1024 × 1024 PNG, with one large, fully visible subject and a 10% safe margin. JPEG and WebP are also supported. Include no text, numbers, card borders, watermarks, or unrelated objects.

[font_size=26][b]Reusable generation prompt[/b][/font_size]
Create one square memory-card illustration of [subject], in [style], for a [complexity] deck. Its distinguishing features are [features]. Keep the subject large, fully visible, and within a 10% safe margin. Maintain the deck’s consistent framing, lighting, and background treatment. Include no text, numbers, card border, watermark, or unrelated objects.

[font_size=26][b]Six planning examples[/b][/font_size]
[b]Easy mixed objects:[/b] A red rocket with blue fins, a yellow racing car, a green dinosaur, and a black-and-white penguin. Use clearly different silhouettes as well as bold colours.
[b]Easy animals:[/b] A wide-eared elephant, a long-eared rabbit, a round panda, and a crab with raised claws. Make each animal identifiable without relying only on colour.
[b]Easy vehicles:[/b] A racing car, a bus, a sailboat, a propeller plane, a bicycle, and an excavator. Keep complete wheels, wings and sails inside the safe margin.
[b]Easy robots:[/b] Different friendly robots with round or square heads, different antennas, and clearly different arm and leg positions. Use bold blue, orange, yellow and teal.
[b]Medium robots:[/b] Related robot characters with a shared palette. Vary several visible features such as head outline, antenna shape, eyes, hand positions and stance.
[b]Hard robots:[/b] The same blue robot in every image, distinguished by six large arm poses and five leg/expression combinations. Keep framing and background identical; make pose differences visible on small cards.

[font_size=26][b]Style and complexity are separate[/b][/font_size]
Illustrated describes drawn or painted artwork. Realistic describes lifelike rendering or photographs. Other covers collages and other treatments. A style tag describes existing pictures; it does not convert them. Easy, Medium and Hard describe how similar the subjects are, independently of style.

[font_size=26][b]A 30-image planning checklist[/b][/font_size]
Plan 30 unique feature combinations BEFORE producing images. For each numbered slot below, record the subject, major silhouette, distinguishing features, and a thumbnail-review tick. For a hard deck, combine six large body poses with five large head/limb expressions (6 × 5 = 30); verify that neighbouring combinations remain visibly different.
'''
for i in range(1,31):text+=f'☐ {i:02d} — Subject / silhouette / 2–3 visible features / thumbnail checked\n'
text+='''
[font_size=26][b]Review small, not just large[/b][/font_size]
Review all 30 together at about 70–120 pixels square, the size of a dense playing board. Cover the backgrounds and check that the subjects still differ. Do not rely exclusively on colour: shape, pose, expression, body outlines and large details should carry the difference. Remove accidental duplicates and retake cards that only differ in tiny details. Ask another adult to identify each card at thumbnail size.

[font_size=26][b]Import step by step[/b][/font_size]
1. Put one image per pair in a folder. PNG, JPEG and WebP files in that folder are accepted; nested folders are not scanned.
2. Open Deck library, then Import an image folder. Choose the folder.
3. Review square previews. Non-square images are fitted onto a consistent white square with a safe margin; they are never stretched or silently cropped.
4. Select 2–30 unique pictures. If there are more than 30, select your subset manually. Click a picture again to deselect it. Corrupt files and images with identical decoded pixels are rejected with reasons; differently encoded copies of the same pixels still count as duplicates.
5. Enter a deck name and domain (for example Animals, Vehicles, or Places). Choose a style and complexity that describe your pictures.
6. Save deck. The game copies normalized 1024 × 1024 PNGs into local storage. Originals stay untouched. The saved deck works after restarting the game or moving the original folder.
7. Return to setup. Only installed domain/style/complexity combinations appear. A 12-image deck supports at most 12 pairs. Select the collection and play.
Rename and Delete are available for custom decks in the library. Deletion asks for confirmation and removes only the game’s saved copies. Included decks cannot be deleted.

[font_size=26][b]Playing together[/b][/font_size]
Choose 1–4 players and any whole number from 2–30 pairs, subject to deck size. A match scores one point and its cards disappear, leaving the spaces empty. With Another turn after a match enabled, a match keeps the turn; otherwise each completed attempt advances the player. A mismatch stays visible for 1.5 seconds.
Use the mouse, or Tab / Shift+Tab to focus a card and Space / Enter to choose it. Arrow keys move between nearby cards. Hidden cards have neutral labels. Escape pauses; all artwork is concealed and the clock freezes. Reduced motion is in setup and pause. Sound is optional. Leaving or restarting an unfinished game asks for confirmation.

[font_size=26][b]Storage, backup & requirements[/b][/font_size]
Windows 64-bit; minimum 1280 × 720 game window and OpenGL 3.3 graphics. No Godot installation or internet connection is needed to play. Keep the EXE and PCK together.
Custom decks and preferences live in %APPDATA%\\Memory Card Game\\ (Godot’s writable user:// directory). To back up or move collections to another PC, close the game and copy that folder. On first launch, saved custom decks and preferences from the previous version are copied into this folder. Existing new-version data wins; the previous files are preserved. Unfinished rounds are not saved. There are no accounts, adverts, analytics, online play, or in-game AI calls.

[font_size=26][b]About the included artwork[/b][/font_size]
The six included decks contain 180 bold vector illustrations: Mix & Match, Wild Things, On the Move, Bots & Bolts, Bot Buddies, and Robot Replay. The first four offer clearly different shapes; the last two add progressively more similar robot characters. Backgrounds are white and the subjects use bold, readable colours. Editable SVGs and their deterministic generator are in the project; the feature plan is in docs/artwork-plan.csv. The previous starter artwork is preserved separately in the repository's classic-starter-decks source archive.
'''
def to_sections(source):
    sections=[]
    for part in source.split('\n\n'):
        p=html.escape(part)
        p=re.sub(r'\[font_size=\d+\]\[b\](.*?)\[/b\]\[/font_size\]',r'<h2>\1</h2>',p)
        p=p.replace('[b]','<strong>').replace('[/b]','</strong>')
        p=p.replace('\n','<br>')
        sections.append('<section>'+p+'</section>')
    return ''.join(sections)

page='''<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Memory Card Game · Adult guide</title><style>body{margin:0;background:#f2f7fe;color:#172c49;font:19px/1.75 "Segoe UI",sans-serif}main{max-width:900px;margin:54px auto;padding:0 30px 70px}header{border-bottom:2px solid #cbdcf1;padding-bottom:30px;margin-bottom:32px}h1,h2{font-family:"Segoe UI",sans-serif;font-weight:800;line-height:1.25;font-weight:normal}h1{font-size:46px}h2{font-size:29px;margin:1em 0 .6em}section{margin-bottom:26px}strong{color:#245bff}footer{border-top:1px solid #cbdcf1;padding-top:24px;font-size:15px}@media print{main{margin:0;max-width:100%}body{font-size:12pt;background:white}h2{break-after:avoid}section{break-inside:avoid}}</style><main><header><h1>Memory Card Game</h1><p>An adult’s guide to making, importing, and playing with your own collections.</p></header>'''+to_sections(text)+'''<footer>Offline guide • Version 2.0 • 7 November 2026<br>Made with Godot 4.7.2, using the Compatibility renderer.</footer></main></html>'''

# ---- Web edition: the same guide with the platform-specific sections replaced. ----
def section(source, title):
    """The block of `source` that starts with the given section heading."""
    start=source.rindex('[font_size=',0,source.index(f'[b]{title}[/b]'))
    end=source.find('\n\n[font_size=',start)
    return source[start:end if end>=0 else len(source)].rstrip('\n')

def heading(title):
    return f'[font_size=26][b]{title}[/b][/font_size]'

WEB_IMPORT=heading('Import step by step')+'''
1. Gather one picture per pair. On a phone or tablet they can come straight from your photo library; on a computer, put them in one folder. PNG, JPEG and WebP pictures are accepted; photos chosen on an iPhone or iPad are converted automatically.
2. Open Deck library, then Choose pictures. On a computer you can also Choose a folder (nested folders are not scanned) or drop pictures onto the library.
3. Review square previews. Non-square images are fitted onto a consistent white square with a safe margin; they are never stretched or silently cropped.
4. Select 2–30 unique pictures. If there are more than 30, select your subset manually. Tap or click a picture again to deselect it. Corrupt files and images with identical decoded pixels are rejected with reasons; differently encoded copies of the same pixels still count as duplicates.
5. Enter a deck name and domain (for example Animals, Vehicles, or Places). Choose a style and complexity that describe your pictures.
6. Save deck. The game saves normalized 1024 × 1024 PNGs in this browser’s storage on this device. Originals stay untouched. The saved deck keeps working after closing the app or deleting the original pictures.
7. Return to setup. Only installed domain/style/complexity combinations appear. A 12-image deck supports at most 12 pairs. Select the collection and play.
Rename and Delete are available for custom decks in the library. Deletion asks for confirmation and removes only the game’s saved copies. Included decks cannot be deleted.'''

WEB_PLAYING=heading('Playing together')+'''
Choose 1–4 players and any whole number from 2–30 pairs, subject to deck size. A match scores one point and its cards disappear, leaving the spaces empty. With Another turn after a match enabled, a match keeps the turn; otherwise each completed attempt advances the player. A mismatch stays visible for 1.5 seconds.
Every card always fits on the screen without scrolling. Setup recommends a maximum number of pairs for the current screen; more pairs are allowed, with smaller cards. Turning a phone or tablet sideways, or choosing Grid, often fits more pairs comfortably. Cards never move during a round, even when the screen rotates.
Tap or click a card. With a keyboard, use Tab / Shift+Tab to focus a card and Space / Enter to choose it; arrow keys move between nearby cards. Hidden cards have neutral labels. Escape or the Pause button pauses, and switching to another app pauses too; all artwork is concealed and the clock freezes. Reduced motion is in setup and pause. Sound is optional. Leaving or restarting an unfinished game asks for confirmation.'''

WEB_STORAGE=heading('Installing, storage & backup')+'''
Memory Card Game runs in current versions of Chrome, Edge, Firefox and Safari on phones, tablets, Chromebooks and computers. After the first visit, the whole game and all included decks are stored on the device and play without an internet connection.
To install it, use Install app on the setup screen or the browser menu in Chrome or Edge. On an iPhone or iPad, open the game in Safari, tap Share, then Add to Home Screen. Installed, it opens full screen like any other app. Updates download by themselves and are offered between rounds, never during one.
Custom decks and settings are saved in this browser on this device, never online. Clearing the browser’s site data deletes them, and a browser may remove them if the device runs very low on space; installing the app makes this much less likely. Use Deck library, then Back up decks, to save everything as one file, and Restore backup on any device to add its decks. Decks already on a device are kept.
The backup also works with the Windows edition: copy its decks folder into %APPDATA%\\Memory Card Game\\ on the PC. In the other direction, choose the Windows decks folder (or a ZIP of it) in the web library. Unfinished rounds are not saved. There are no accounts, adverts, analytics, online play, or in-game AI calls; pictures never leave the device.'''

web_text=text
for old_title,new_block in [('Import step by step',WEB_IMPORT),('Playing together',WEB_PLAYING),('Storage, backup & requirements',WEB_STORAGE)]:
    web_text=web_text.replace(section(text,old_title),new_block)

web_page='''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="theme-color" content="#f2f7fe">
<meta name="color-scheme" content="light">
<title>Memory Card Game · Adult guide</title>
<link rel="icon" href="icons/icon-192.png" type="image/png">
<style>body{margin:0;background:#f2f7fe;color:#172c49;font:19px/1.75 "Segoe UI",system-ui,-apple-system,"Noto Sans",Roboto,sans-serif}main{max-width:900px;margin:40px auto;padding:0 24px 70px}nav a{display:inline-block;padding:10px 18px;border-radius:12px;background:#e1ecff;color:#172c49;text-decoration:none}nav a:focus-visible{outline:3px solid #172c49;outline-offset:2px}header{border-bottom:2px solid #cbdcf1;padding:24px 0 30px;margin-bottom:32px}h1,h2{font-weight:800;line-height:1.25}h1{font-size:46px;margin:0 0 .3em}h2{font-size:29px;margin:1em 0 .6em}section{margin-bottom:26px;overflow-wrap:anywhere}h2+br{display:none}strong{color:#245bff}footer{border-top:1px solid #cbdcf1;padding-top:24px;font-size:15px}@media (max-width:600px){body{font-size:17px}h1{font-size:34px}h2{font-size:24px}main{margin-top:20px;padding:0 16px 50px}}@media print{nav{display:none}main{margin:0;max-width:100%}body{font-size:12pt;background:white}h2{break-after:avoid}section{break-inside:avoid}}</style>
</head>
<body>
<main><nav><a href="./">Back to the game</a></nav><header><h1>Memory Card Game</h1><p>An adult’s guide to making, importing, and playing with your own collections.</p></header>'''+to_sections(web_text)+'''<footer>Offline guide • Version 2.0 • Web edition</footer></main>
</body>
</html>
'''

OUTPUTS={'docs/adult-guide.txt':text,'docs/Artwork and Import Guide.html':page,'web/public/guide.html':web_page}
if '--check' in sys.argv:
    stale=[name for name,content in OUTPUTS.items() if not (ROOT/name).exists() or (ROOT/name).read_text(encoding='utf8')!=content]
    for name in stale:print('Out of date:',name)
    if stale:sys.exit(1)
    print('Guides are up to date.')
else:
    for name,content in OUTPUTS.items():(ROOT/name).write_text(content,encoding='utf8',newline='\n')
    print('Created in-game text, offline HTML guide and web edition guide.')

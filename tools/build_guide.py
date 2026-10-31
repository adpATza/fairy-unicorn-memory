from pathlib import Path
import html,re
ROOT=Path(__file__).resolve().parents[1]
text='''[font_size=30][b]Artwork & importing[/b][/font_size]
Make a collection that belongs to your family. This game runs offline: it never generates pictures, changes their style, or sends them anywhere.

[font_size=26][b]One picture makes one matching pair[/b][/font_size]
Generate or draw ONE unique image for each pair. The game copies that same image onto two cards. Never generate two separate “matching” pictures: small differences make the pair unfair.
Use 2–30 unique images per deck. Recommended files: 1024 × 1024 PNG, with one large, fully visible subject and a 10% safe margin. JPEG and WebP are also supported. Include no text, numbers, card borders, watermarks, or unrelated objects.

[font_size=26][b]Reusable generation prompt[/b][/font_size]
Create one square memory-card illustration of [subject], in [style], for a [complexity] deck. Its distinguishing features are [features]. Keep the subject large, fully visible, and within a 10% safe margin. Maintain the deck’s consistent framing, lighting, and background treatment. Include no text, numbers, card border, watermark, or unrelated objects.

[font_size=26][b]Six planning examples[/b][/font_size]
[b]Easy fairies:[/b] A curly-haired fairy with round wings and a bell-shaped dress, sitting with both hands on her knees. Other cards should have clearly different hair, wing silhouettes, clothing, and body positions.
[b]Medium fairies:[/b] A lavender fairy with pointed wings, a braided bun, a scalloped tunic, and arms raised. Keep a related palette across the deck, but vary several visible features.
[b]Hard fairies:[/b] The same dark-haired lavender fairy in every image. This card has arms spread wide, one knee lifted, and a surprised expression. Vary expressions and large arm and leg poses; keep the framing and background identical.
[b]Easy unicorns:[/b] A golden unicorn with a blue cropped mane, broad white blaze, and a rearing pose. Other cards should have clearly different coats, manes, silhouettes, and poses.
[b]Medium unicorns:[/b] A pale lavender unicorn with a wavy plum mane, two large shoulder patches, and one raised foreleg. Use related colours, but distinguish markings, mane shapes, and poses together.
[b]Hard unicorns:[/b] The same pale unicorn with the same purple mane. This card bows its head, closes its eyes, and stretches one front leg. Vary head angles, expressions, and leg arrangements, with large visible differences.

[font_size=26][b]Style and complexity are separate[/b][/font_size]
Illustrated is a drawn or painted treatment. Realistic fantasy means realistic rendering of imaginary subjects such as fairies and unicorns. Other covers photographs, collages, and other treatments. A deck’s style tag describes existing pictures; choosing a tag cannot convert them. Easy, Medium, and Hard describe how similar the subjects are, independently of style.

[font_size=26][b]A 30-image planning checklist[/b][/font_size]
Plan 30 unique feature combinations BEFORE producing images. For each numbered slot below, record the subject, major silhouette, distinguishing features, and a thumbnail-review tick. For a hard deck, combine six large body poses with five large head/limb expressions (6 × 5 = 30); verify that neighbouring combinations remain visibly different.
'''
for i in range(1,31):text+=f'☐ {i:02d} — Subject / silhouette / 2–3 visible features / thumbnail checked\n'
text+='''
[font_size=26][b]Review small, not just large[/b][/font_size]
Review all 30 together at about 70–120 pixels square, the size of a dense playing board. Cover the backgrounds and check that the subjects still differ. Do not rely exclusively on colour: shape, pose, expression, clothing, mane and wing outlines should carry the difference. Remove accidental duplicates and retake cards that only differ in tiny details. Ask another adult to identify each card at thumbnail size.

[font_size=26][b]Import step by step[/b][/font_size]
1. Put one image per pair in a folder. PNG, JPEG and WebP files in that folder are accepted; nested folders are not scanned.
2. Open Deck library, then Import an image folder. Choose the folder.
3. Review square previews. Non-square images are fitted onto a consistent cream square with a safe margin; they are never stretched or silently cropped.
4. Select 2–30 unique pictures. If there are more than 30, select your subset manually. Click a picture again to deselect it. Corrupt files and images with identical decoded pixels are rejected with reasons; differently encoded copies of the same pixels still count as duplicates.
5. Enter a deck name and domain (for example Fairies, Unicorns, or Birds). Choose a style and complexity that describe your pictures.
6. Save deck. The game copies normalized 1024 × 1024 PNGs into local storage. Originals stay untouched. The saved deck works after restarting the game or moving the original folder.
7. Return to setup. Only installed domain/style/complexity combinations appear. A 12-image deck supports at most 12 pairs. Select the collection and play.
Rename and Delete are available for custom decks in the library. Deletion asks for confirmation and removes only the game’s saved copies. Included decks cannot be deleted.

[font_size=26][b]Playing together[/b][/font_size]
Choose 1–4 players and any whole number from 2–30 pairs, subject to deck size. A match scores one point and its cards disappear, leaving the spaces empty. With Another turn after a match enabled, a match keeps the turn; otherwise each completed attempt advances the player. A mismatch stays visible for 1.5 seconds.
Use the mouse, or Tab / Shift+Tab to focus a card and Space / Enter to choose it. Arrow keys move between nearby cards. Hidden cards have neutral labels. Escape pauses; all artwork is concealed and the clock freezes. Reduced motion is in setup and pause. Sound is optional. Leaving or restarting an unfinished game asks for confirmation.

[font_size=26][b]Storage, backup & requirements[/b][/font_size]
Windows 64-bit; minimum 1280 × 720 desktop and OpenGL 3.3 graphics. No Godot installation or internet connection is needed to play. Keep the EXE and PCK together.
Custom decks and preferences live in %APPDATA%\\Fairy and Unicorn Memory\\ (Godot’s writable user:// directory). To back up or move collections to another PC, close the game and copy that folder. Unfinished rounds are not saved. There are no accounts, adverts, analytics, online play, or in-game AI calls.

[font_size=26][b]About the included artwork[/b][/font_size]
The six included decks contain 180 original vector illustrations, 30 per collection. Easy varies whole character features; Medium uses related palettes and several visible features; Hard uses a consistent character with 30 combinations of body and head/limb poses. Background treatment is consistent. Editable SVGs and their deterministic generator are in the project; their feature plan is in docs/artwork-plan.csv.
'''
(ROOT/'docs/adult-guide.txt').write_text(text,encoding='utf8')
sections=[]
for part in text.split('\n\n'):
    p=html.escape(part)
    p=re.sub(r'\[font_size=\d+\]\[b\](.*?)\[/b\]\[/font_size\]',r'<h2>\1</h2>',p)
    p=p.replace('[b]','<strong>').replace('[/b]','</strong>')
    p=p.replace('\n','<br>')
    sections.append('<section>'+p+'</section>')
page='''<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Fairy &amp; Unicorn Memory · Adult guide</title><style>body{margin:0;background:#f8f3e9;color:#503957;font:19px/1.75 "Segoe UI",sans-serif}main{max-width:900px;margin:54px auto;padding:0 30px 70px}header{border-bottom:2px solid #d9c7e0;padding-bottom:30px;margin-bottom:32px}h1,h2{font-family:Georgia,serif;line-height:1.25;font-weight:normal}h1{font-size:46px}h2{font-size:29px;margin:1em 0 .6em}section{margin-bottom:26px}strong{color:#79558d}footer{border-top:1px solid #d9c7e0;padding-top:24px;font-size:15px}@media print{main{margin:0;max-width:100%}body{font-size:12pt;background:white}h2{break-after:avoid}section{break-inside:avoid}}</style><main><header><h1>Fairy &amp; Unicorn Memory</h1><p>An adult’s guide to making, importing, and playing with your own collections.</p></header>'''+''.join(sections)+'''<footer>Offline guide • First release • 31 October 2026<br>Made with Godot 4.7.2, using the Compatibility renderer.</footer></main></html>'''
(ROOT/'docs/Artwork and Import Guide.html').write_text(page,encoding='utf8')
print('Created in-game text and offline HTML guide.')

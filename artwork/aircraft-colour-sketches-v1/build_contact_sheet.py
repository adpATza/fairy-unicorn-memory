"""Lay out the unchanged original images in a PDF for 100-pixel visual review."""
from pathlib import Path
import json
from reportlab.pdfgen import canvas
from reportlab.pdfbase.pdfmetrics import stringWidth

root = Path(__file__).resolve().parent
qa = root / 'qa'
qa.mkdir(exist_ok=True)
data = json.loads((root / 'generation.json').read_text(encoding='utf-8'))
pdf = canvas.Canvas(str(qa / 'card-size-proof.pdf'), pagesize=(866, 460))
pdf.setTitle('Aircraft colour sketches - card-size review')
pdf.setAuthor('Aircraft artwork collection')
pdf.setFillColorRGB(0.14, 0.21, 0.26)
pdf.setFont('Helvetica-Bold', 16)
pdf.drawString(28, 432, 'Aircraft colour sketches')
pdf.setFont('Helvetica', 9)
pdf.drawString(28, 413, '30 unique illustrations - 25 aeroplanes and 5 helicopters - rendered at 100 pixels per card')

for i, entry in enumerate(data['entries']):
    x = 28 + (i % 10) * 82
    y = 313 - (i // 10) * 113
    pdf.drawImage(str(root / entry['file']), x, y, width=72, height=72,
                  preserveAspectRatio=True, mask='auto')
    name = f"{entry['slot']:02d} {entry['subject']}"
    words = name.split()
    lines = []
    line = ''
    for word in words:
        candidate = (line + ' ' + word).strip()
        if stringWidth(candidate, 'Helvetica', 6.7) > 72 and line:
            lines.append(line)
            line = word
        else:
            line = candidate
    if line:
        lines.append(line)
    pdf.setFont('Helvetica', 6.7)
    for j, line in enumerate(lines):
        pdf.drawString(x, y - 12 - j * 8.5, line)

pdf.setFont('Helvetica', 8)
pdf.drawString(28, 30, 'One unique picture makes one matching pair. Names appear only on this proof, outside the artwork.')
pdf.showPage()
pdf.save()
print(qa / 'card-size-proof.pdf')

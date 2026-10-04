# usage: python3 tests/sheet.py out.png scale file1 file2 ...
import sys
from PIL import Image, ImageDraw
out, s = sys.argv[1], float(sys.argv[2])
files = sys.argv[3:]
ims = [Image.open(f).convert('RGB') for f in files]
h = max(i.size[1] for i in ims)
ims = [i.resize((int(i.size[0] * h / i.size[1] * s), int(h * s))) for i in ims]
W = sum(i.size[0] for i in ims) + 6 * (len(ims) - 1)
sheet = Image.new('RGB', (W, ims[0].size[1]), (30, 30, 30))
x = 0
for im, f in zip(ims, files):
    ImageDraw.Draw(im).text((6, 4), f.split('/')[-1].replace('.png', ''), fill=(255, 255, 0))
    sheet.paste(im, (x, 0)); x += im.size[0] + 6
sheet.save(out); print(sheet.size)

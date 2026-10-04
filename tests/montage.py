import sys, glob
from PIL import Image, ImageDraw
d, out, cols = sys.argv[1], sys.argv[2], int(sys.argv[3]) if len(sys.argv) > 3 else 4
files = sorted(glob.glob(d + '/*.png'))
ims = [Image.open(f).convert('RGB') for f in files]
w, h = ims[0].size
s = 0.5
tw, th = int(w * s), int(h * s)
rows = (len(ims) + cols - 1) // cols
sheet = Image.new('RGB', (tw * cols, th * rows))
for i, (im, f) in enumerate(zip(ims, files)):
    im = im.resize((tw, th))
    dr = ImageDraw.Draw(im)
    dr.text((8, 6), f.split('_')[-1].replace('.png', ''), fill=(255, 255, 255))
    sheet.paste(im, ((i % cols) * tw, (i // cols) * th))
sheet.save(out)
print(sheet.size)

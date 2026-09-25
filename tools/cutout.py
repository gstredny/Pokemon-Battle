"""Cut a kid's drawing out of a photo of a Monster Card.

  grid PHOTO OUT                       save PHOTO with a labeled grid, to read crop boxes from
  cut  PHOTO LEFT TOP RIGHT BOTTOM OUT crop that box, make the paper see-through, save a square PNG
  fit  LIFTED OUT                      square up a picture already lifted by lift-subject.swift
"""
import argparse

from PIL import Image, ImageDraw, ImageFont, ImageOps

SIZE = 256  # every cut-out is SIZE x SIZE
PAPER_TOLERANCE = 45  # a pixel this much darker than the paper still counts as paper
GRAY_TOLERANCE = 40  # a pixel whose R, G, B differ by no more than this has no color


def brightness(r, g, b):
    return 0.299 * r + 0.587 * g + 0.114 * b


def load_upright(path):
    """Open a photo and turn it the way the phone was held."""
    return ImageOps.exif_transpose(Image.open(path)).convert("RGB")


def paper_brightness(img):
    """Median brightness of the crop's outer edge, which is blank paper."""
    w, h = img.size
    edge = [(x, y) for x in range(w) for y in (0, h - 1)] + [(x, y) for y in range(h) for x in (0, w - 1)]
    values = sorted(brightness(*img.getpixel(p)) for p in edge)
    return values[len(values) // 2]


def is_paper(r, g, b, paper):
    return brightness(r, g, b) >= paper - PAPER_TOLERANCE and max(r, g, b) - min(r, g, b) <= GRAY_TOLERANCE


def cut_out(img, box):
    crop = img.crop(box)
    paper = paper_brightness(crop)
    rgba = crop.convert("RGBA")
    rgba.putdata([(r, g, b, 0 if is_paper(r, g, b, paper) else 255) for r, g, b, _ in rgba.get_flattened_data()])
    if rgba.getchannel("A").getbbox() is None:
        raise ValueError(f"nothing is drawn inside {box}")
    return fit_square(rgba)


def fit_square(rgba):
    """Trim the see-through edges and center the monster in a SIZE x SIZE square."""
    art = rgba.crop(rgba.getchannel("A").getbbox())
    scale = SIZE / max(art.size)
    art = art.resize((max(1, round(art.width * scale)), max(1, round(art.height * scale))), Image.LANCZOS)
    square = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    square.paste(art, ((SIZE - art.width) // 2, (SIZE - art.height) // 2))
    return square


def draw_grid(img, step=100):
    img = img.copy()
    d = ImageDraw.Draw(img)
    font = ImageFont.load_default(size=max(16, img.width // 70))
    for x in range(0, img.width, step):
        d.line([(x, 0), (x, img.height)], fill=(255, 0, 255), width=4 if x % 500 == 0 else 1)
        d.text((x + 3, 3), str(x), fill=(255, 0, 255), font=font)
    for y in range(0, img.height, step):
        d.line([(0, y), (img.width, y)], fill=(255, 0, 255), width=4 if y % 500 == 0 else 1)
        d.text((3, y + 3), str(y), fill=(255, 0, 255), font=font)
    img.thumbnail((1600, 1600))
    return img


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = parser.add_subparsers(dest="command", required=True)
    grid = sub.add_parser("grid")
    grid.add_argument("photo")
    grid.add_argument("out")
    cut = sub.add_parser("cut")
    cut.add_argument("photo")
    for side in ("left", "top", "right", "bottom"):
        cut.add_argument(side, type=int)
    cut.add_argument("out")
    fit = sub.add_parser("fit")
    fit.add_argument("lifted")
    fit.add_argument("out")
    args = parser.parse_args()

    if args.command == "fit":
        fit_square(Image.open(args.lifted).convert("RGBA")).save(args.out)
        return
    img = load_upright(args.photo)
    if args.command == "grid":
        draw_grid(img).save(args.out)
        return
    try:
        cut_out(img, (args.left, args.top, args.right, args.bottom)).save(args.out)
    except ValueError as err:
        raise SystemExit(str(err))


if __name__ == "__main__":
    main()

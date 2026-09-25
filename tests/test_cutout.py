import sys
import tempfile
import unittest
from pathlib import Path

from PIL import Image, ImageDraw

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "tools"))
from cutout import SIZE, cut_out, load_upright  # noqa: E402

PAPER = (228, 224, 216)  # paper in a phone photo is a little gray, not pure white


def fake_drawing():
    img = Image.new("RGB", (400, 300), PAPER)
    d = ImageDraw.Draw(img)
    d.ellipse((150, 100, 250, 200), fill=(220, 30, 30))  # red body
    d.line((100, 150, 300, 150), fill=(20, 20, 20), width=6)  # black marker line
    d.rectangle((280, 60, 300, 80), fill=(250, 225, 60))  # yellow crayon
    return img


class CutOutTest(unittest.TestCase):
    def test_paper_becomes_see_through_and_ink_stays(self):
        art = cut_out(fake_drawing(), (0, 0, 400, 300))
        self.assertEqual(art.size, (SIZE, SIZE))
        self.assertEqual(art.getpixel((0, 0))[3], 0)
        self.assertEqual(art.getpixel((SIZE // 2, SIZE // 2))[3], 255)

    def test_pale_yellow_crayon_is_kept(self):
        art = cut_out(fake_drawing(), (0, 0, 400, 300))
        yellow = [p for p in art.get_flattened_data() if p[3] == 255 and p[0] > 200 and p[1] > 180 and p[2] < 120]
        self.assertTrue(yellow)

    def test_shadowed_paper_still_disappears(self):
        img = fake_drawing()
        ImageDraw.Draw(img).rectangle((0, 0, 60, 300), fill=(195, 191, 184))  # shadow down one side
        # A kept shadow would widen the trimmed drawing and change every pixel.
        self.assertEqual(list(cut_out(img, (0, 0, 400, 300)).get_flattened_data()),
                         list(cut_out(fake_drawing(), (0, 0, 400, 300)).get_flattened_data()))

    def test_blank_box_is_refused(self):
        with self.assertRaises(ValueError):
            cut_out(Image.new("RGB", (100, 100), PAPER), (0, 0, 100, 100))

    def test_sideways_phone_photo_is_turned_upright(self):
        exif = Image.Exif()
        exif[0x0112] = 6  # "rotate 90": how phones mark a photo taken held sideways
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "card.jpg"
            Image.new("RGB", (200, 100), PAPER).save(path, exif=exif)
            self.assertEqual(load_upright(path).size, (100, 200))


if __name__ == "__main__":
    unittest.main()

from __future__ import annotations

from io import BytesIO
import unittest

from PIL import Image

from app.engine.image_preprocessor import prepare_query_variants


class CanonicalizeSquareTest(unittest.TestCase):
    def test_center_crops_landscape_and_scales_focal_length(self):
        image = Image.new("RGB", (1920, 1080), "white")
        encoded = BytesIO()
        image.save(encoded, format="JPEG")

        aspect, square = prepare_query_variants(encoded.getvalue(), 1080.0, 768)

        self.assertEqual(aspect.image_size, (768, 432))
        self.assertEqual(aspect.crop_origin, (0, 0))
        self.assertAlmostEqual(aspect.focal_length_px, 432.0)
        self.assertEqual(square.image_size, (768, 768))
        self.assertEqual(square.source_size, (1920, 1080))
        self.assertEqual(square.crop_origin, (420, 0))
        self.assertAlmostEqual(square.focal_length_px, 768.0)

    def test_center_crops_portrait(self):
        image = Image.new("RGB", (1080, 1920), "white")
        encoded = BytesIO()
        image.save(encoded, format="JPEG")

        aspect, square = prepare_query_variants(encoded.getvalue(), 1000.0, 768)

        self.assertEqual(aspect.image_size, (432, 768))
        self.assertEqual(square.image_size, (768, 768))
        self.assertEqual(square.crop_origin, (0, 420))


if __name__ == "__main__":
    unittest.main()

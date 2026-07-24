import unittest

from app.engine.localizer import ImageLocalizer, _Correspondence


class CorrespondenceSelectionTest(unittest.TestCase):
    def test_keeps_highest_score_without_query_or_point3d_duplicates(self):
        selected = ImageLocalizer._select_correspondences(
            [
                _Correspondence(1, 10, 0.7, "a.jpg"),
                _Correspondence(1, 11, 0.9, "b.jpg"),
                _Correspondence(2, 11, 0.8, "c.jpg"),
                _Correspondence(3, 12, 0.6, "a.jpg"),
            ]
        )

        self.assertEqual(
            [(item.query_index, item.point3d_id) for item in selected],
            [(1, 11), (3, 12)],
        )


if __name__ == "__main__":
    unittest.main()

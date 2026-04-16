import unittest

from tools.paddle_ocr_adapter import extract_text_from_prediction


class PaddleOcrAdapterTest(unittest.TestCase):
    def test_extracts_text_from_pipeline_style_result(self):
        prediction = [
            {
                "rec_texts": [
                    "老板：今天中午前给我一个版本",
                    "另外把风险点列一下",
                ]
            }
        ]

        text, lines = extract_text_from_prediction(prediction)

        self.assertEqual(
            text,
            "老板：今天中午前给我一个版本\n另外把风险点列一下",
        )
        self.assertEqual(
            lines,
            ["老板：今天中午前给我一个版本", "另外把风险点列一下"],
        )

    def test_extracts_text_from_legacy_ocr_style_result(self):
        prediction = [
            [
                [[[0, 0], [1, 0], [1, 1], [0, 1]], ("收到，先给结果", 0.99)],
                [[[0, 2], [1, 2], [1, 3], [0, 3]], ("我会补风险说明", 0.98)],
            ]
        ]

        text, lines = extract_text_from_prediction(prediction)

        self.assertEqual(
            text,
            "收到，先给结果\n我会补风险说明",
        )
        self.assertEqual(
            lines,
            ["收到，先给结果", "我会补风险说明"],
        )


if __name__ == "__main__":
    unittest.main()

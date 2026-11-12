import unittest
from scripts import compare_images as c


class CompareTests(unittest.TestCase):
    def test_find_image_interactions_and_legacy(self):
        interactions = {'steps': [{'type': 'thought'}, {'type': 'model_output', 'content': [{'type': 'text', 'text': 'hi'}, {'type': 'image', 'data': 'QUJD'}]}]}
        legacy = {'candidates': [{'content': {'parts': [{'text': 'x'}, {'inlineData': {'mimeType': 'image/png', 'data': 'REVG'}}]}}]}
        self.assertEqual(c.find_image(interactions), 'QUJD')
        self.assertEqual(c.find_image(legacy), 'REVG')
        self.assertIsNone(c.find_image({'steps': [{'content': [{'type': 'text', 'text': 'no image'}]}]}))

    def test_blind_page_hides_provider(self):
        brief = {'name': '달빛분식', 'industry': '분식', 'mood': '귀엽고 친근한', 'feature': ''}
        page = c.blind_page([(brief, [('A', '1_x.png'), ('B', '1_y.png')])])
        self.assertNotIn('OpenAI', page)
        self.assertNotIn('Gemini', page)
        self.assertIn('달빛분식', page)


if __name__ == '__main__':
    unittest.main()

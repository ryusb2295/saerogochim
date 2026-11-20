import base64
import json
import unittest
from unittest.mock import Mock, patch
import server

BRIEF = dict(name='한우랑', industry='한우 전문점', mood='귀여운', audience='가족', feature='캠핑 세트')
PNG = b'\x89PNG\r\n\x1a\n' + b'test'

class TextureTests(unittest.TestCase):
    def test_all_choices_and_legacy(self):
        self.assertNotIn('texture', server.validate(BRIEF))
        for texture in ('auto', *server.TEXTURES):
            brief = server.validate(dict(BRIEF, texture=texture))
            self.assertEqual(brief['texture'], texture)
            prompt = server.prompt_for(brief)
            self.assertIn('Never copy the ant', prompt)
            self.assertIn('Choose exactly ONE' if texture == 'auto' else server.TEXTURES[texture], prompt)

    def test_invalid_texture_is_rejected(self):
        for texture in (None, [], {}, 1, 'unknown', '__proto__'):
            with self.assertRaises(ValueError):
                server.validate(dict(BRIEF, texture=texture))

    def test_selected_reference_and_prompt_reach_provider(self):
        response = Mock()
        response.read.return_value = json.dumps({'data':[{'b64_json':base64.b64encode(PNG).decode()}]}).encode()
        response.__enter__ = Mock(return_value=response)
        response.__exit__ = Mock(return_value=False)
        for texture in server.TEXTURES:
            with patch.object(server.urllib.request, 'urlopen', return_value=response) as upstream:
                result=server.generate(server.validate(dict(BRIEF, texture=texture)))
            request=upstream.call_args.args[0]
            self.assertTrue(request.full_url.endswith('/images/edits'))
            self.assertIn(b'filename="texture-sheet.png"', request.data)
            self.assertIn(server.TEXTURES[texture].encode(),request.data)
            self.assertNotIn(b'filename="duck_1.png"', request.data)
            self.assertEqual(result['texture'],texture)

if __name__ == '__main__': unittest.main()

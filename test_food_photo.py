import base64
import json
import unittest
from unittest.mock import patch
import test_server
import server
BRIEF = test_server.BRIEF

PNG = base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==')
SOURCE = 'data:image/png;base64,' + base64.b64encode(PNG).decode()

class FoodPhotoTests(unittest.TestCase):
    def test_validate_food_photo_and_reject_bad_sources(self):
        self.assertEqual(server.validate(dict(BRIEF,image_mode='food',source_image=SOURCE))['source_image'],SOURCE)
        for source in ['', 'https://example.com/food.png', 'data:image/png;base64,not-a-png', SOURCE+'x']:
            with self.assertRaises(ValueError):
                server.validate(dict(BRIEF,image_mode='food',source_image=source))
        with self.assertRaises(ValueError):
            server.validate(dict(BRIEF,source_image=SOURCE))

    def test_food_request_uses_uploaded_photo_and_background_prompt(self):
        response=unittest.mock.MagicMock()
        response.__enter__.return_value.read.return_value=json.dumps({'data':[{'b64_json':base64.b64encode(PNG).decode()}]}).encode()
        with patch('urllib.request.urlopen',return_value=response) as call:
            result=server.generate(server.validate(dict(BRIEF,image_mode='food',source_image=SOURCE)))
        request=call.call_args.args[0]
        self.assertTrue(request.full_url.endswith('/images/edits'))
        self.assertIn(PNG,request.data)
        self.assertIn(b'Remove the background',request.data)
        self.assertNotIn(b'Create ONE original brand mascot',request.data)
        self.assertEqual(result['image_mode'],'food')

    def test_http_accepts_photo_payload_above_old_8k_limit(self):
        fixture=test_server.ServerTests();fixture.setUp()
        source='data:image/png;base64,'+base64.b64encode(PNG+b'0'*10000).decode()
        with patch.object(server,'generate',return_value={'image_mode':'food'}) as generate:
            result=fixture.request(dict(BRIEF,request_id='food-photo-123',image_mode='food',source_image=source))
        self.assertEqual(result[0],200)
        self.assertEqual(generate.call_args.args[0]['image_mode'],'food')

if __name__=='__main__': unittest.main()

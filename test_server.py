import io
import unittest
from types import SimpleNamespace
from unittest.mock import Mock, patch
import server

BRIEF = dict(name='한우랑', industry='캠핑용 한우 포장 전문점', mood='귀여운', audience='가족', feature='캠핑 세트')

class ServerTests(unittest.TestCase):
    def request(self, payload, **headers):
        raw=server.json.dumps(payload).encode()
        h=server.Handler.__new__(server.Handler)
        h.headers={'Host':'127.0.0.1:8000','Origin':'http://127.0.0.1:8000',
                   'Content-Type':'application/json','X-Gageon-Token':server.TOKEN,'Content-Length':str(len(raw)),**headers}
        h.server=SimpleNamespace(server_port=8000)
        h.path='/api/generate';h.connection=Mock();h.rfile=io.BytesIO(raw);h.reply=Mock()
        h.do_POST()
        return h.reply.call_args.args

    def setUp(self):
        server.RESULTS.clear();server.ATTEMPTS=0;server.API_KEY='test-only'

    def test_free_form_industry(self):
        self.assertEqual(server.validate(BRIEF)['industry'],BRIEF['industry'])

    def test_required_and_type(self):
        for invalid in [[],{},dict(BRIEF, industry=' '),dict(BRIEF,feature=7)]:
            with self.assertRaises(ValueError):server.validate(invalid)

    def test_origin_and_token(self):
        self.assertEqual(self.request(BRIEF, Origin='https://other.example')[0],403)
        self.assertEqual(self.request(BRIEF, **{'X-Gageon-Token':'invalid'})[0],403)

    def test_missing_key(self):
        server.API_KEY=''
        self.assertEqual(self.request(dict(BRIEF,request_id='test-12345'))[0],503)

    def test_success_and_duplicate(self):
        with patch.object(server,'generate',return_value={'image':'data:image/png;base64,example'}) as generate:
            payload=dict(BRIEF,request_id='test-12345')
            self.assertEqual(self.request(payload)[0],200)
            self.assertEqual(self.request(payload)[0],200)
            generate.assert_called_once_with(BRIEF)

    def test_busy(self):
        with server.LOCK:self.assertEqual(self.request(dict(BRIEF,request_id='test-12345'))[0],409)

    def test_limit(self):
        server.ATTEMPTS=20
        self.assertEqual(self.request(dict(BRIEF,request_id='test-12345'))[0],429)

    def test_provider_error(self):
        error=server.urllib.error.HTTPError('https://api.openai.com',401,'unauthorized',{},None)
        with patch.object(server,'generate',side_effect=error):
            code,result=self.request(dict(BRIEF,request_id='test-12345'))
            self.assertEqual(code,502);self.assertNotIn('test-only',str(result))

if __name__=='__main__':unittest.main()

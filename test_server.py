import io
import json
import unittest
from types import SimpleNamespace
from unittest.mock import Mock, patch
import server

BRIEF = dict(name='한우랑', industry='캠핑용 한우 포장 전문점', mood='귀여운', audience='가족', feature='캠핑 세트')

class ServerTests(unittest.TestCase):
    def request(self, payload, path='/api/generate', **headers):
        raw=server.json.dumps(payload).encode()
        h=server.Handler.__new__(server.Handler)
        h.headers={'Host':'127.0.0.1:8000','Origin':'http://127.0.0.1:8000',
                   'Content-Type':'application/json','X-Gageon-Token':server.TOKEN,'Content-Length':str(len(raw)),**headers}
        h.server=SimpleNamespace(server_port=8000)
        h.path=path;h.connection=Mock();h.rfile=io.BytesIO(raw);h.reply=Mock()
        h.do_POST()
        return h.reply.call_args.args

    def setUp(self):
        server.RESULTS.clear();server.ATTEMPTS=0;server.TEXT_ATTEMPTS=0;server.API_KEY='test-only'

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

    def test_static_files(self):
        h=server.Handler.__new__(server.Handler)
        h.headers={'Host':'127.0.0.1:8000'};h.server=SimpleNamespace(server_port=8000);h.reply=Mock()
        for path in server.STATIC:
            h.path=path;h.do_GET();self.assertEqual(h.reply.call_args.args[0],200)
        h.path='/server.py';h.do_GET();self.assertEqual(h.reply.call_args.args[0],404)

    def test_store_data(self):
        data=json.loads((server.ROOT/'data'/'gyeongsan-stores.json').read_text(encoding='utf-8'))
        self.assertTrue(data['rows'] and data['dongs'] and data['cats'])
        for d,c,name in data['rows']:
            self.assertLess(d,len(data['dongs']));self.assertLess(c,len(data['cats']));self.assertTrue(name)

    def test_provider_error(self):
        error=server.urllib.error.HTTPError('https://api.openai.com',401,'unauthorized',{},None)
        with patch.object(server,'generate',side_effect=error):
            code,result=self.request(dict(BRIEF,request_id='test-12345'))
            self.assertEqual(code,502);self.assertNotIn('test-only',str(result))

    def fake_openai(self, content):
        body=json.dumps({'choices':[{'message':{'content':json.dumps(content,ensure_ascii=False)}}]}).encode()
        resp=Mock();resp.read.return_value=body;resp.__enter__=Mock(return_value=resp);resp.__exit__=Mock(return_value=False)
        return patch.object(server.urllib.request,'urlopen',return_value=resp)

    def test_brand_success(self):
        good={'slogan':'가족이 함께 즐기는 한 끼','colors':['#6B3E2E','#C2553A','#E8C9A0','#F6E7D0'],'keywords':['#따뜻한','신선한','가족','신뢰']}
        with self.fake_openai(good):
            code,result=self.request(BRIEF,path='/api/brand')
        self.assertEqual(code,200);self.assertEqual(result['keywords'][0],'따뜻한');self.assertEqual(result['colors'][0],'#6b3e2e')

    def test_brand_bad_shape(self):
        for bad in [{'slogan':'x','colors':['red','#000000','#111111','#222222'],'keywords':['a','b','c','d']},
                    {'slogan':'','colors':['#000000']*4,'keywords':['a','b','c','d']},
                    {'slogan':'x','colors':['#000000']*4,'keywords':['a','b']}]:
            with self.fake_openai(bad):
                self.assertEqual(self.request(BRIEF,path='/api/brand')[0],502)

    def test_brand_limit(self):
        server.TEXT_ATTEMPTS=server.MAX_TEXT_ATTEMPTS
        self.assertEqual(self.request(BRIEF,path='/api/brand')[0],429)

if __name__=='__main__':unittest.main()

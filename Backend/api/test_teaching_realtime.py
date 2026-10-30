import base64
import hashlib
import hmac
import json
from unittest.mock import patch
from django.test import override_settings, TestCase
from . import test_teaching
from .teaching_realtime import sign

# Independent assertions reuse the existing class/lesson setup, not its test methods.
@override_settings(TEACHING_REALTIME_URL='wss://realtime.example/ws', TEACHING_REALTIME_SECRET='test-only-shared-secret-12345678901234567890')
class TeachingRealtimeTests(TestCase):
    setUp = test_teaching.TeachingTests.setUp
    post = test_teaching.TeachingTests.post
    ink = test_teaching.TeachingTests.ink
    batch = test_teaching.TeachingTests.batch
    pdf = test_teaching.TeachingTests.pdf
    def decode(self, proof, scope):
        expected=hmac.new(b'test-only-shared-secret-12345678901234567890',f"wortify-teaching-{scope}.v1.{proof['data']}".encode(),hashlib.sha256).hexdigest()
        self.assertEqual(proof['signature'],expected)
        return json.loads(base64.urlsafe_b64decode(proof['data']+'='*(-len(proof['data'])%4)))

    def test_ticket_role_room_and_short_expiry(self):
        response=self.client.post(self.url+'realtime/')
        self.assertEqual(response.status_code,200,response.content)
        data=response.json();self.assertEqual(data['url'],'wss://realtime.example/ws')
        ticket=self.decode(data['ticket'],'ticket')
        self.assertTrue(ticket['write']);self.assertEqual(ticket['room'],str(self.board.pk));self.assertEqual(ticket['exp']-ticket['iat'],60)
        self.client.force_login(self.student)
        ticket=self.decode(self.client.post(self.url+'realtime/').json()['ticket'],'ticket')
        self.assertFalse(ticket['write'])
        self.client.force_login(self.outsider);self.assertEqual(self.client.post(self.url+'realtime/').status_code,404)

    def test_membership_revocation_and_cross_language_are_enforced(self):
        self.client.force_login(self.student);self.room.members.remove(self.student)
        self.assertEqual(self.client.post(self.url+'realtime/').status_code,404)
        self.client.force_login(self.teacher)
        self.assertEqual(self.client.post(self.url.replace('/de/','/en/')+'realtime/').status_code,404)

    def test_durable_save_returns_signed_exact_batch_and_retry(self):
        batch=self.batch();response=self.post(batch);self.assertEqual(response.status_code,200)
        event=self.decode(response.json()['notification'],'event')
        self.assertEqual(event['revision'],1);self.assertEqual(event['operations'],batch['operations'])
        self.assertEqual(event['batch'],batch['batch']);self.board.refresh_from_db();self.assertEqual(self.board.revision,1)
        self.post(self.batch(revision=1))
        replay=self.decode(self.post(batch).json()['notification'],'event')
        self.assertEqual(replay['revision'],1,'retry signs its original revision, not the current head')
        self.assertEqual(replay['operations'],batch['operations'])

    def test_pdf_import_returns_signed_invalidation(self):
        response=self.client.post(self.url+'pdfs/',{'file':self.pdf()})
        self.assertEqual(response.status_code,201,response.content)
        event=self.decode(response.json()['notification'],'event')
        self.assertEqual(event['kind'],'invalidate');self.assertNotIn('operations',event)

    def test_invalid_relay_configuration_never_breaks_board_saves(self):
        for url,secret in [('wss://realtime.example/ws','short'),('https://bad.example/ws','x'*40)]:
            with self.settings(TEACHING_REALTIME_URL=url,TEACHING_REALTIME_SECRET=secret):
                self.assertEqual(self.client.post(self.url+'realtime/').status_code,400)
                self.board.refresh_from_db();response=self.post(self.batch(revision=self.board.revision))
                self.assertEqual(response.status_code,200);self.assertIsNone(response.json()['notification'])
        with self.settings(TEACHING_REALTIME_URL=''):
            self.assertEqual(self.client.post(self.url+'realtime/').json(),{'enabled':False})

    def test_ticket_signing_does_not_expose_the_secret(self):
        response=self.client.post(self.url+'realtime/')
        self.assertNotIn(b'test-only-shared-secret',response.content)
        self.assertEqual(response['Cache-Control'],'private, no-store')

    def test_ticket_requires_csrf(self):
        from django.test import Client
        client=Client(enforce_csrf_checks=True);client.force_login(self.teacher)
        self.assertEqual(client.post(self.url+'realtime/').status_code,403)

    def test_cross_language_golden_signature(self):
        with patch("api.teaching_realtime.time.time", return_value=1000):
            proof=sign("ticket", {"room":"11111111-1111-4111-8111-111111111111", "user":7, "write":True})
        self.assertEqual(proof, {'data': 'eyJ2IjoxLCJpYXQiOjEwMDAsImV4cCI6MTA2MCwicm9vbSI6IjExMTExMTExLTExMTEtNDExMS04MTExLTExMTExMTExMTExMSIsInVzZXIiOjcsIndyaXRlIjp0cnVlfQ', 'signature': 'd73ec80f2f046c2ef738ad277d1b4ce983d2b8438e5f52d3ea4300412f74d321'})

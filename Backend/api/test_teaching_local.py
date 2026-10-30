import io
import os
from unittest.mock import patch
from django.test import SimpleTestCase,override_settings
from .teaching_local import ensure_local_relay

class LocalClassActivationTests(SimpleTestCase):
    @override_settings(DEBUG=False)
    def test_production_never_activates_local_processes(self):
        with patch.dict(os.environ,{'WORTIFY_LOCAL_REALTIME_CONTROL':'http://127.0.0.1:9999/activate','WORTIFY_LOCAL_REALTIME_CONTROL_KEY':'x'*64}),patch('api.teaching_local.urlopen') as request:
            self.assertTrue(ensure_local_relay());request.assert_not_called()

    @override_settings(DEBUG=True)
    def test_missing_explicit_launcher_control_preserves_manual_configuration(self):
        with patch.dict(os.environ,{'WORTIFY_LOCAL_REALTIME_CONTROL':''}),patch('api.teaching_local.urlopen') as request:self.assertTrue(ensure_local_relay());request.assert_not_called()

    @override_settings(DEBUG=True)
    def test_only_loopback_control_url_and_private_header_are_used(self):
        for url in ['https://remote.example/activate','http://localhost:9999/activate','http://127.0.0.1:9999/other','http://127.0.0.1:9999/activate?secret=x']:
            with patch.dict(os.environ,{'WORTIFY_LOCAL_REALTIME_CONTROL':url,'WORTIFY_LOCAL_REALTIME_CONTROL_KEY':'x'*64}),patch('api.teaching_local.urlopen') as request:self.assertFalse(ensure_local_relay());request.assert_not_called()
        with patch.dict(os.environ,{'WORTIFY_LOCAL_REALTIME_CONTROL':'http://127.0.0.1:9999/activate','WORTIFY_LOCAL_REALTIME_CONTROL_KEY':'x'*64}),patch('api.teaching_local.urlopen',return_value=io.BytesIO(b'{"state":"starting"}')) as request:
            self.assertTrue(ensure_local_relay());req=request.call_args.args[0];self.assertEqual(req.get_method(),'POST');self.assertEqual(req.get_header('X-wortify-local-key'),'x'*64)

    @override_settings(DEBUG=True)
    def test_unavailable_control_falls_back_instead_of_breaking_ticket(self):
        with patch.dict(os.environ,{'WORTIFY_LOCAL_REALTIME_CONTROL':'http://127.0.0.1:9999/activate','WORTIFY_LOCAL_REALTIME_CONTROL_KEY':'x'*64}),patch('api.teaching_local.urlopen',side_effect=OSError('not running')):self.assertFalse(ensure_local_relay())

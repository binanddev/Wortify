"""Code-only tests: fake processes/handlers; no listening sockets or installers."""
import io
from pathlib import Path
import tempfile
import types
import unittest
from unittest.mock import Mock,patch
from tools import lazy_relay

class LazyRelayTests(unittest.TestCase):
    def relay(self,**kwargs):return lazy_relay.LazyRelay(Path('project'),'node',{},lambda:False,lambda port:False,8787,**kwargs)

    def test_constructor_does_not_check_or_start_class_dependencies(self):
        spawn=Mock();relay=self.relay(spawn=spawn);spawn.assert_not_called();self.assertEqual(relay.state,'idle')

    def test_activation_is_single_flight_and_immediately_returns_starting(self):
        relay=self.relay(spawn=Mock());worker=Mock();worker.is_alive.return_value=True
        with patch.object(lazy_relay.threading,'Thread',return_value=worker):
            self.assertEqual(relay.activate(),'starting');self.assertEqual(relay.activate(),'starting')
            worker.start.assert_called_once();relay.spawn.assert_not_called()

    def test_only_activation_worker_prepares_then_spawns_owned_relay(self):
        helper=Mock();helper.wait.return_value=0;child=Mock();child.poll.return_value=None
        spawn=Mock(side_effect=[helper,child]);stop=Mock()
        relay=lazy_relay.LazyRelay(Path('project'),'node',{},Mock(side_effect=[False,True]),lambda port:False,8787,spawn=spawn,stop=stop)
        relay._start();self.assertEqual(relay.state,'ready');self.assertEqual(spawn.call_count,2)
        self.assertIn('Realtime',spawn.call_args_list[0].args[0]);self.assertIn('--watch',spawn.call_args_list[1].args[0]);relay.close()
        self.assertIn(unittest.mock.call(child),stop.call_args_list)

    def test_a_foreign_port_fails_class_without_starting_or_killing_processes(self):
        spawn=Mock();stop=Mock();relay=lazy_relay.LazyRelay(Path('project'),'node',{},lambda:False,lambda port:True,8787,spawn=spawn,stop=stop)
        relay._start();self.assertEqual(relay.state,'unavailable');spawn.assert_not_called()
        self.assertTrue(all(call.args[0] is None for call in stop.call_args_list))

    def test_known_external_relay_can_be_reused_without_ownership(self):
        spawn=Mock();stop=Mock();relay=lazy_relay.LazyRelay(Path('project'),'node',{},lambda:True,lambda port:True,8787,spawn=spawn,stop=stop)
        relay._start();self.assertEqual(relay.state,'ready');relay.close();spawn.assert_not_called();self.assertTrue(all(call.args[0] is None for call in stop.call_args_list))

    def handler(self,path='/activate',key='a'*64,remote='127.0.0.1'):
        handler=object.__new__(lazy_relay.ActivationHandler);handler.path=path;handler.headers={'X-Wortify-Local-Key':key,'Content-Length':'2'};handler.client_address=(remote,1)
        handler.rfile=io.BytesIO(b'{}');handler.wfile=io.BytesIO();handler.server=types.SimpleNamespace(activation_key='a'*64,relay=Mock())
        handler.server.relay.activate.return_value='starting';handler.send_error=Mock();handler.send_response=Mock();handler.send_header=Mock();handler.end_headers=Mock();return handler

    def test_control_rejects_wrong_key_remote_and_path_without_activation(self):
        for args in ({'key':'bad'},{'remote':'192.168.1.2'},{'path':'/other'}):
            handler=self.handler(**args);handler.do_POST();handler.send_error.assert_called_once_with(403);handler.server.relay.activate.assert_not_called()

    def test_control_only_accepts_authenticated_small_activation_request(self):
        handler=self.handler();handler.do_POST();handler.send_response.assert_called_once_with(202);self.assertEqual(handler.wfile.getvalue(),b'{"state": "starting"}')
        handler=self.handler();handler.headers['Content-Length']='999';handler.do_POST();handler.send_error.assert_called_once_with(413);handler.server.relay.activate.assert_not_called()

if __name__=='__main__':unittest.main()

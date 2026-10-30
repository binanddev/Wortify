"""Launcher tests use fake health checks/processes. No web server is started."""
import hashlib
import io
import json
import importlib.util
import os
from pathlib import Path
import sys
import tempfile
import types
import unittest
from unittest.mock import patch,Mock

spec=importlib.util.spec_from_file_location('wortify_run_local',Path(__file__).with_name('run_local.py'))
launcher=importlib.util.module_from_spec(spec);spec.loader.exec_module(launcher)

class LocalLauncherTests(unittest.TestCase):
    def setUp(self):
        health=patch.object(launcher,'runtime_health',return_value=None);health.start();self.addCleanup(health.stop)

    def test_existing_old_backend_warns_without_blocking_core_reuse(self):
        with patch.object(launcher,'occupied',return_value=True),patch.object(launcher,'healthy',return_value=True),patch.object(launcher,'runtime_health',return_value={'local_realtime':{}}),patch('builtins.print') as report:
            self.assertEqual(launcher.check(),10)
            self.assertTrue(any('on-demand' in str(call.args) for call in report.call_args_list))

    def test_key_is_stable_and_production_realtime_is_overridden(self):
        with tempfile.TemporaryDirectory() as directory,patch.object(launcher,'ROOT',Path(directory)),patch.dict(os.environ,{'TEACHING_REALTIME_URL':'wss://production.example/ws','TEACHING_REALTIME_SECRET':'production-key'},clear=False):
            first=launcher.local_realtime_environment();key=os.environ['TEACHING_REALTIME_SECRET']
            self.assertEqual(first,launcher.local_realtime_environment());self.assertGreaterEqual(len(key),32);self.assertNotEqual(key,'production-key')
            self.assertEqual(os.environ['TEACHING_REALTIME_URL'],f'ws://127.0.0.1:{launcher.REALTIME}/ws')
            self.assertIn(f'http://localhost:{launcher.FRONTEND}',os.environ['ALLOWED_ORIGINS'])
            self.assertEqual(first,hashlib.sha256(key.encode()).hexdigest()[:16])

    def test_core_readiness_ignores_missing_or_foreign_relay(self):
        with patch.object(launcher,'occupied',return_value=True),patch.object(launcher,'healthy',return_value=True),patch.object(launcher,'relay_healthy',side_effect=AssertionError('Core must not inspect relay')):
            self.assertEqual(launcher.check(),10)

    def test_missing_core_still_requires_startup(self):
        with patch.object(launcher,'occupied',return_value=False),patch.object(launcher,'healthy',return_value=False),patch.object(launcher,'relay_healthy',side_effect=AssertionError('Core must not inspect relay')):
            self.assertEqual(launcher.check(),0)

    def test_foreign_core_port_is_not_killed(self):
        with patch.object(launcher,'occupied',return_value=True),patch.object(launcher,'healthy',return_value=False),patch.object(launcher.subprocess,'Popen') as popen:
            self.assertEqual(launcher.check(),1);popen.assert_not_called()

    def test_relay_health_matches_key_origins_and_protocol(self):
        secret='local-test-key-1234567890123456789012345'
        value={'service':'wortify-teaching-realtime','protocol':'teaching-v2-public','origins':['http://127.0.0.1:5173'],'key_id':hashlib.sha256(secret.encode()).hexdigest()[:16]}
        with patch.dict(os.environ,{'TEACHING_REALTIME_SECRET':secret,'ALLOWED_ORIGINS':'http://127.0.0.1:5173'}),patch.object(launcher,'urlopen',return_value=io.BytesIO(json.dumps(value).encode())):self.assertTrue(launcher.relay_healthy())
        value['protocol']='outdated'
        with patch.dict(os.environ,{'TEACHING_REALTIME_SECRET':secret,'ALLOWED_ORIGINS':'http://127.0.0.1:5173'}),patch.object(launcher,'urlopen',return_value=io.BytesIO(json.dumps(value).encode())):self.assertFalse(launcher.relay_healthy())

    def test_explicit_local_data_directory_does_not_change_workspace_identity(self):
        identity=launcher.IDENTITY
        with tempfile.TemporaryDirectory() as directory,patch.dict(os.environ,{'WORTIFY_LOCAL_DATA_DIR':directory}):
            database,media=launcher.local_data_paths()
            self.assertEqual(database,Path(directory).resolve()/'db.sqlite3');self.assertEqual(media,Path(directory).resolve()/'private_media')
            self.assertEqual(launcher.IDENTITY,identity)

    def run_main(self,class_failure=False):
        children=[Mock(pid=101),Mock(pid=102)]
        for child in children:child.poll.return_value=None
        environment=types.ModuleType('config.environment');environment.load_environment=lambda:None
        supervisor=Mock();control=Mock(url='http://127.0.0.1:9999/activate')
        with patch.dict(sys.modules,{'config.environment':environment}),patch.dict(os.environ,{'WORTIFY_NO_BROWSER':'1'},clear=False),patch.object(launcher,'local_realtime_environment',side_effect=OSError('Class key unavailable') if class_failure else None),patch.object(launcher,'check',return_value=0),patch.object(launcher,'healthy',return_value=False),patch.object(launcher,'all_ready',return_value=True),patch.object(launcher.shutil,'which',return_value='node'),patch.object(launcher.subprocess,'Popen',side_effect=children) as popen,patch.object(launcher,'stop_owned_process') as cleanup,patch.object(launcher.time,'sleep',side_effect=KeyboardInterrupt),patch.object(launcher.webbrowser,'open') as browser,patch.object(launcher,'LazyRelay',return_value=supervisor) as relay_factory,patch.object(launcher,'ActivationControl',return_value=control) as control_factory,patch.object(sys,'argv',['run_local.py']):
            self.assertEqual(launcher.main(),0);self.assertEqual(popen.call_count,2)
            self.assertIn('runserver',popen.call_args_list[0].args[0]);self.assertTrue(any('vite' in str(arg) for arg in popen.call_args_list[1].args[0]))
            browser.assert_not_called();supervisor.activate.assert_not_called();self.assertEqual(cleanup.call_count,2)
            if class_failure:relay_factory.assert_not_called();control_factory.assert_not_called()
            else:supervisor.close.assert_called_once();control.close.assert_called_once()

    def test_main_starts_only_core_children_and_keeps_relay_lazy(self):self.run_main()
    def test_class_configuration_failure_does_not_block_core(self):self.run_main(class_failure=True)

if __name__=='__main__':unittest.main()

"""Cold-process checks: test discovery itself imports teaching test fixtures."""
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import textwrap
from django.conf import settings
from django.test import SimpleTestCase


class ClassroomIsolationTests(SimpleTestCase):
    def run_isolated(self, script):
        with tempfile.TemporaryDirectory() as directory:
            environment_file=Path(directory)/'empty.env'
            environment_file.write_text('',encoding='utf-8')
            env={**os.environ,'DJANGO_SETTINGS_MODULE':'config.settings','DJANGO_ENV':'development',
                 'DJANGO_DEBUG':'1','DJANGO_ALLOWED_HOSTS':'testserver','DATABASE_URL':'',
                 'DJANGO_DATABASE_ENGINE':'sqlite','DJANGO_DB_PATH':str(Path(directory)/'unused.sqlite3'),
                 'MEDIA_STORAGE':'local','WORTIFY_LOCAL_REALTIME_CONTROL':'http://127.0.0.1:18788','WORTIFY_ENV_FILE':str(environment_file),'DJANGO_LOG_LEVEL':'ERROR'}
            env.pop('RENDER',None)
            result=subprocess.run([sys.executable,'-X','utf8','-c',textwrap.dedent(script)],
                                  cwd=settings.BASE_DIR,env=env,timeout=45,capture_output=True,text=True)
        self.assertEqual(result.returncode,0,result.stdout+'\n'+result.stderr)

    def test_health_session_resolution_and_docs_do_not_import_classroom_handlers(self):
        self.run_isolated("""
            import importlib.abc
            import sys
            class ClassroomBlocker(importlib.abc.MetaPathFinder):
                def find_spec(self,fullname,path=None,target=None):
                    if fullname.startswith('api.teaching') or fullname=='pypdf' or fullname.startswith('pypdf.'):
                        raise AssertionError('Unrelated request imported '+fullname)
            sys.meta_path.insert(0,ClassroomBlocker())
            import django
            django.setup()
            from django.test import Client
            from django.urls import resolve
            client=Client()
            health=client.get('/api/health/')
            assert health.status_code==200
            assert health.json()['local_realtime']['mode']=='on-demand'
            assert client.get('/api/session/').status_code==200
            # URL resolution and API documentation are declarations, not access.
            selected=resolve('/api/de/classes/1/boards/')
            assert selected.func.__module__=='api.teaching'
            assert selected.func.__name__=='boards'
            resolve('/api/de/classes/public/11111111-1111-4111-8111-111111111111/')
            from api.api_reference import reference_data
            rows=reference_data()['endpoints']
            board=next(row for row in rows if row['path']=='/api/{language}/classes/{pk}/boards/{board_id}/')
            assert board['source']=='api.teaching.board'
            assert board['methods']==['GET','POST']
            assert not any(name.startswith('api.teaching') or name=='pypdf' for name in sys.modules)
        """)

    def test_classroom_handler_is_initialized_only_on_first_classroom_request(self):
        self.run_isolated("""
            import sys
            import django
            django.setup()
            from django.test import Client
            client=Client()
            assert client.get('/api/health/').status_code==200
            assert 'api.teaching' not in sys.modules
            # The original handler still owns authentication; no database is needed.
            assert client.get('/api/de/classes/1/boards/').status_code==401
            assert 'api.teaching' in sys.modules
            assert 'pypdf' not in sys.modules
            assert client.get('/api/session/').status_code==200
        """)

    def test_language_gate_precedes_loading_the_classroom_handler(self):
        self.run_isolated("""
            import sys
            import django
            django.setup()
            from django.test import Client
            response=Client().get('/api/fr/classes/1/boards/')
            assert response.status_code==404
            assert 'api.teaching' not in sys.modules
        """)

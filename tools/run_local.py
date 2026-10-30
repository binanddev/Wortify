"""Start Wortify, reuse its healthy local servers, stop only child processes we own."""
import hashlib,json,os,secrets,shutil,signal,socket,subprocess,sys,time,webbrowser
from pathlib import Path
from urllib.request import urlopen
ROOT=Path(__file__).resolve().parents[1]
IDENTITY=hashlib.sha256(str(ROOT/'Backend').lower().encode()).hexdigest()[:16]
BACKEND=int(os.environ.get('WORTIFY_BACKEND_PORT','8000'))
FRONTEND=int(os.environ.get('WORTIFY_FRONTEND_PORT','5173'))
REALTIME=int(os.environ.get('WORTIFY_REALTIME_PORT','8787'))
if str(ROOT) not in sys.path:sys.path.insert(0,str(ROOT))
from tools.lazy_relay import LazyRelay,ActivationControl,stop_owned_process

def occupied(port):
    with socket.socket() as sock:
        return sock.connect_ex(('127.0.0.1',port))==0

def local_realtime_environment():
    """Stable, repo-local development key; never reuse production relay settings."""
    path=ROOT/'.venv/wortify-realtime.secret'
    path.parent.mkdir(parents=True,exist_ok=True)
    if not path.exists():
        try:
            with path.open('x',encoding='ascii') as stream:stream.write(secrets.token_hex(32))
            path.chmod(0o600)
        except FileExistsError:pass
    key=path.read_text(encoding='ascii').strip()
    if len(key)<32:raise RuntimeError('Local realtime key is invalid. Remove .venv/wortify-realtime.secret and retry.')
    os.environ.update(TEACHING_REALTIME_URL=f'ws://127.0.0.1:{REALTIME}/ws',TEACHING_REALTIME_SECRET=key,
                      ALLOWED_ORIGINS=f'http://127.0.0.1:{FRONTEND},http://localhost:{FRONTEND}',PORT=str(REALTIME),MAX_CONNECTIONS='1000')
    return hashlib.sha256(key.encode()).hexdigest()[:16]


def runtime_health(port):
    try:
        with urlopen(f'http://127.0.0.1:{port}/api/health/',timeout=2) as response:
            data=json.load(response)
            return data if data.get('app')=='Wortify' and data.get('workspace')==IDENTITY else None
    except Exception:return None


def healthy(port):return runtime_health(port) is not None


def relay_healthy():
    try:
        with urlopen(f'http://127.0.0.1:{REALTIME}/healthz',timeout=.5) as response:data=json.load(response)
        key_id=hashlib.sha256(os.environ['TEACHING_REALTIME_SECRET'].encode()).hexdigest()[:16]
        return data.get('service')=='wortify-teaching-realtime' and data.get('protocol')=='teaching-v2-public' and data.get('key_id')==key_id and set(data.get('origins',[]))==set(os.environ.get('ALLOWED_ORIGINS','').split(','))
    except Exception:return False


def all_ready():return healthy(BACKEND) and healthy(FRONTEND)


def local_data_paths():
    override=os.environ.get('WORTIFY_LOCAL_DATA_DIR','').strip()
    directory=(Path(override).expanduser().resolve() if override else ROOT/'Backend')
    directory.mkdir(parents=True,exist_ok=True)
    return directory/'db.sqlite3',directory/'private_media'


def check():
    # Core startup must not depend on Class files, configuration or relay ports.
    for port in (BACKEND,FRONTEND):
        if occupied(port) and not healthy(port):
            print(f'Cong {port} dang duoc ung dung khac hoac phien cu su dung. Dong dung cua so server do roi chay lai; Wortify khong tu dung tien trinh khac.',flush=True)
            return 1
    if healthy(BACKEND):
        existing=runtime_health(BACKEND)
        if existing is not None and existing.get('local_realtime',{}).get('mode')!='on-demand':
            print('Backend hien co chua dung Class on-demand. Web van duoc tai su dung; dung cua so backend cu va chay lai launcher de bat tu khoi dong Class.',flush=True)
    if all_ready():
        print(f'Wortify da chay: http://127.0.0.1:{FRONTEND}',flush=True)
        return 10
    return 0

def main():
    os.chdir(ROOT)
    sys.path.insert(0, str(ROOT/'Backend'))
    from config.environment import load_environment
    load_environment()
    # Direct invocation is also a local-only entry point.
    database,media=local_data_paths()
    os.environ.update(DJANGO_ENV='development', DJANGO_DEBUG='1', DATABASE_URL='',
                      DJANGO_DATABASE_ENGINE='sqlite', DJANGO_DB_PATH=str(database),
                      MEDIA_STORAGE='local', DJANGO_MEDIA_ROOT=str(media),RENDER='')
    os.environ.pop('WORTIFY_LOCAL_REALTIME_CONTROL',None)
    os.environ.pop('WORTIFY_LOCAL_REALTIME_CONTROL_KEY',None)
    class_available=True
    try:local_realtime_environment()
    except Exception as error:
        class_available=False
        os.environ.update(TEACHING_REALTIME_URL='',TEACHING_REALTIME_SECRET='')
        print(f'Class realtime configuration is unavailable; normal Wortify is unaffected: {error}',flush=True)
    state=check()
    if '--check' in sys.argv:return state
    if state==1:return 1
    if state==10:
        if os.environ.get('WORTIFY_NO_BROWSER')!='1':webbrowser.open(f'http://127.0.0.1:{FRONTEND}')
        return 0
    node=shutil.which('node')
    if not node:print('Node.js is required.');return 1
    flags=subprocess.CREATE_NEW_PROCESS_GROUP if os.name=='nt' else 0
    children=[]
    supervisor=control=None
    try:
        if class_available:
            try:
                supervisor=LazyRelay(ROOT,node,os.environ.copy(),relay_healthy,occupied,REALTIME)
                activation_key=secrets.token_hex(32)
                control=ActivationControl(supervisor,activation_key)
                os.environ.update(WORTIFY_LOCAL_REALTIME_CONTROL=control.url,WORTIFY_LOCAL_REALTIME_CONTROL_KEY=activation_key)
            except Exception as error:
                os.environ.update(TEACHING_REALTIME_URL='',TEACHING_REALTIME_SECRET='')
                print(f'Class activation unavailable; normal Wortify is unaffected: {error}',flush=True)
        if not healthy(BACKEND):
            children.append(subprocess.Popen([sys.executable,'-X','utf8',str(ROOT/'Backend/manage.py'),'runserver',f'127.0.0.1:{BACKEND}'],creationflags=flags,start_new_session=os.name!='nt'))
        if not healthy(FRONTEND):
            env={**os.environ,'DJANGO_DEV_ORIGIN':f'http://127.0.0.1:{BACKEND}'}
            children.append(subprocess.Popen([node,str(ROOT/'Frontend/node_modules/vite/bin/vite.js'),'--host','127.0.0.1','--port',str(FRONTEND)],cwd=ROOT/'Frontend',env=env,creationflags=flags,start_new_session=os.name!='nt'))
        for _ in range(60):
            if not all(p.poll() is None for p in children):raise RuntimeError('Server exited during startup.')
            if all_ready():break
            time.sleep(.5)
        else:raise RuntimeError('Servers did not become ready within 30 seconds.')
        print(f'\nWortify: http://127.0.0.1:{FRONTEND}\nBackend: http://127.0.0.1:{BACKEND}\nClass realtime: starts only when a Class board is opened.\nCtrl+C stops servers started by this window.\n',flush=True)
        if os.environ.get('WORTIFY_NO_BROWSER')!='1':webbrowser.open(f'http://127.0.0.1:{FRONTEND}')
        while all(p.poll() is None for p in children):time.sleep(.5)
    except KeyboardInterrupt:return 0
    finally:
        for manager in (control,supervisor):
            try:
                if manager:manager.close()
            except Exception as error:print(f'Local cleanup: {error}',flush=True)
        for process in children:
            stop_owned_process(process)
    return 1
if __name__=='__main__':sys.exit(main())

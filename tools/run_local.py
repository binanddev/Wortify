"""Start Wortify, reuse its healthy local servers, stop only child processes we own."""
import hashlib,json,os,shutil,signal,socket,subprocess,sys,time,webbrowser
from pathlib import Path
from urllib.request import urlopen
ROOT=Path(__file__).resolve().parents[1]
IDENTITY=hashlib.sha256(str(ROOT).lower().encode()).hexdigest()[:16]
BACKEND=int(os.environ.get('WORTIFY_BACKEND_PORT','8000'))
FRONTEND=int(os.environ.get('WORTIFY_FRONTEND_PORT','5173'))

def occupied(port):
    with socket.socket() as sock:
        return sock.connect_ex(('127.0.0.1',port))==0

def healthy(port):
    try:
        with urlopen(f'http://127.0.0.1:{port}/api/health/',timeout=2) as response:
            data=json.load(response)
            return data.get('app')=='Wortify' and data.get('workspace')==IDENTITY
    except Exception:return False

def check():
    for port in (BACKEND,FRONTEND):
        if occupied(port) and not healthy(port):
            print(f'Cong {port} dang duoc ung dung khac hoac phien cu su dung. Dong dung cua so server do roi chay lai; Wortify khong tu dung tien trinh khac.',flush=True)
            return 1
    if healthy(BACKEND) and healthy(FRONTEND):
        print(f'Wortify da chay: http://127.0.0.1:{FRONTEND}',flush=True)
        return 10
    return 0

def main():
    os.chdir(ROOT)
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
    try:
        if not healthy(BACKEND):
            children.append(subprocess.Popen([sys.executable,'-X','utf8','manage.py','runserver',f'127.0.0.1:{BACKEND}'],creationflags=flags,start_new_session=os.name!='nt'))
        if not healthy(FRONTEND):
            env={**os.environ,'DJANGO_DEV_ORIGIN':f'http://127.0.0.1:{BACKEND}'}
            children.append(subprocess.Popen([node,str(ROOT/'frontend-react/node_modules/vite/bin/vite.js'),'--host','127.0.0.1','--port',str(FRONTEND)],cwd=ROOT/'frontend-react',env=env,creationflags=flags,start_new_session=os.name!='nt'))
        for _ in range(60):
            if not all(p.poll() is None for p in children):raise RuntimeError('Server exited during startup.')
            if healthy(BACKEND) and healthy(FRONTEND):break
            time.sleep(.5)
        else:raise RuntimeError('Servers did not become ready within 30 seconds.')
        print(f'\nWortify: http://127.0.0.1:{FRONTEND}\nBackend: http://127.0.0.1:{BACKEND}\nCtrl+C stops servers started by this window.\n',flush=True)
        if os.environ.get('WORTIFY_NO_BROWSER')!='1':webbrowser.open(f'http://127.0.0.1:{FRONTEND}')
        while all(p.poll() is None for p in children):time.sleep(.5)
    except KeyboardInterrupt:return 0
    finally:
        for process in children:
            if process.poll() is not None:continue
            if os.name=='nt':subprocess.run(['taskkill','/PID',str(process.pid),'/T','/F'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
            else:os.killpg(process.pid,signal.SIGTERM)
        for process in children:
            try:process.wait(timeout=5)
            except subprocess.TimeoutExpired:process.kill()
    return 1
if __name__=='__main__':sys.exit(main())

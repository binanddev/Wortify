"""Start both local processes and tear down their exact process trees on exit."""
import os, shutil, signal, socket, subprocess, sys, time, webbrowser
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
os.chdir(ROOT)
for port in (8002,5173):
    with socket.socket() as sock:
        try:sock.bind(('127.0.0.1',port))
        except OSError:sys.exit(f'Port {port} is already in use. Stop the existing server first.')
node=shutil.which('node')
if not node:sys.exit('Node.js is required.')
flags=subprocess.CREATE_NEW_PROCESS_GROUP if os.name=='nt' else 0
children=[]
try:
    children.append(subprocess.Popen([sys.executable,'-X','utf8','manage.py','runserver','127.0.0.1:8002','--noreload'],creationflags=flags,start_new_session=os.name!='nt'))
    children.append(subprocess.Popen([node,str(ROOT/'frontend-react/node_modules/vite/bin/vite.js'),'--host','127.0.0.1'],cwd=ROOT/'frontend-react',creationflags=flags,start_new_session=os.name!='nt'))
    print('\nLernraum: http://127.0.0.1:5173\nAdmin: http://127.0.0.1:5173/manage\nCtrl+C stops both servers.\n',flush=True)
    if os.environ.get('LERNRAUM_NO_BROWSER')!='1':webbrowser.open('http://127.0.0.1:5173')
    while all(p.poll() is None for p in children):time.sleep(.5)
except KeyboardInterrupt:pass
finally:
    for p in children:
        if p.poll() is not None:continue
        if os.name=='nt':subprocess.run(['taskkill','/PID',str(p.pid),'/T','/F'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
        else:os.killpg(p.pid,signal.SIGTERM)
    for p in children:
        try:p.wait(timeout=5)
        except subprocess.TimeoutExpired:p.kill()

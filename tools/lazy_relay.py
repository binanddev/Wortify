"""Launcher-owned, loopback-only Class activation. Never imported by production Django."""
import hmac
import json
import os
from pathlib import Path
import subprocess
import threading
import time
from http.server import BaseHTTPRequestHandler,ThreadingHTTPServer


def stop_owned_process(process):
    if process is None or process.poll() is not None:return
    if os.name=='nt':
        subprocess.run(['taskkill','/PID',str(process.pid),'/T','/F'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,timeout=5)
    else:
        import signal
        try:os.killpg(process.pid,signal.SIGTERM)
        except ProcessLookupError:pass
    try:process.wait(timeout=5)
    except subprocess.TimeoutExpired:process.kill()


class LazyRelay:
    def __init__(self,root,node,env,healthy,occupied,port,spawn=subprocess.Popen,stop=stop_owned_process,clock=time.monotonic,sleep=time.sleep):
        self.root=Path(root);self.node=node;self.env=dict(env);self.healthy=healthy;self.occupied=occupied;self.port=port
        self.spawn=spawn;self.stop=stop;self.clock=clock;self.sleep=sleep
        self.lock=threading.Lock();self.closing=threading.Event();self.worker=None;self.helper=None;self.child=None
        self.state='idle';self.last_failure=0

    def activate(self):
        with self.lock:
            if self.closing.is_set():return 'unavailable'
            if self.state=='ready' and self.healthy():return 'ready'
            if self.worker and self.worker.is_alive():return 'starting'
            if self.state=='unavailable' and self.clock()-self.last_failure<5:return 'unavailable'
            self.state='starting'
            self.worker=threading.Thread(target=self._start,name='wortify-class-start',daemon=True)
            self.worker.start()
            return 'starting'

    def _launch(self,args,cwd):
        flags=subprocess.CREATE_NEW_PROCESS_GROUP if os.name=='nt' else 0
        return self.spawn(args,cwd=cwd,env=self.env,creationflags=flags,start_new_session=os.name!='nt')

    def _start(self):
        try:
            if self.healthy():self.state='ready';return
            if self.occupied(self.port):raise RuntimeError(f'Class relay port {self.port} is already in use; normal Wortify remains available.')
            if self.child is not None:
                self.stop(self.child);self.child=None
            # Even the dependency check belongs to Class activation, never app startup.
            args=[self.node,str(self.root/'tools/prepare_node.mjs'),'--project','Realtime']
            with self.lock:
                if self.closing.is_set():return
                self.helper=self._launch(args,self.root)
            if self.helper.wait(timeout=610)!=0:raise RuntimeError('Class relay dependencies are unavailable; using HTTP fallback.')
            with self.lock:
                self.helper=None
                if self.closing.is_set():return
                self.child=self._launch([self.node,'--watch',str(self.root/'Realtime/src/main.js')],self.root/'Realtime')
            deadline=self.clock()+10
            while not self.closing.is_set() and self.clock()<deadline:
                if self.child.poll() is not None:raise RuntimeError('Class relay exited; using HTTP fallback.')
                if self.healthy():self.state='ready';return
                self.sleep(.1)
            if not self.closing.is_set():raise RuntimeError('Class relay did not become ready; using HTTP fallback.')
        except Exception as error:
            self.state='unavailable';self.last_failure=self.clock()
            for process in (self.helper,self.child):
                try:self.stop(process)
                except Exception:pass
            self.helper=None;self.child=None
            if not self.closing.is_set():print(f'Class realtime: {error}',flush=True)

    def close(self):
        self.closing.set()
        with self.lock:
            processes=(self.helper,self.child)
        for process in processes:
            try:self.stop(process)
            except Exception:pass
        if self.worker and self.worker is not threading.current_thread():self.worker.join(timeout=6)


class ActivationHandler(BaseHTTPRequestHandler):
    def setup(self):
        super().setup();self.connection.settimeout(2)
    def log_message(self,*args):pass
    def do_GET(self):self.send_error(405)
    def do_POST(self):
        key=self.headers.get('X-Wortify-Local-Key','')
        if self.client_address[0]!='127.0.0.1' or self.path!='/activate' or not hmac.compare_digest(key.encode(),self.server.activation_key.encode()):
            self.send_error(403);return
        try:length=int(self.headers.get('Content-Length','0'))
        except ValueError:self.send_error(400);return
        if length<0 or length>128:self.send_error(413);return
        if length:self.rfile.read(length)
        state=self.server.relay.activate()
        raw=json.dumps({'state':state}).encode()
        self.send_response(503 if state=='unavailable' else 202 if state=='starting' else 200)
        self.send_header('Content-Type','application/json');self.send_header('Cache-Control','no-store');self.send_header('Content-Length',str(len(raw)));self.end_headers();self.wfile.write(raw)


class ActivationControl:
    def __init__(self,relay,key):
        self.server=ThreadingHTTPServer(('127.0.0.1',0),ActivationHandler)
        self.server.daemon_threads=True;self.server.activation_key=key;self.server.relay=relay
        self.url=f'http://127.0.0.1:{self.server.server_port}/activate'
        self.thread=threading.Thread(target=self.server.serve_forever,kwargs={'poll_interval':.2},name='wortify-class-control',daemon=True)
        self.thread.start()
    def close(self):
        self.server.shutdown();self.server.server_close();self.thread.join(timeout=2)

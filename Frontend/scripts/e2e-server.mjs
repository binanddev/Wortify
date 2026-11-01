import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const frontend = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const root = path.dirname(frontend);
const scratch = path.join(frontend, '.interface-preview');
mkdirSync(scratch, { recursive: true });
const data = mkdtempSync(path.join(scratch, 'e2e-'));
const emptyEnv = path.join(data, '.env');
writeFileSync(emptyEnv, '');
// Explicit values override developer/production env. Never migrate the normal DB.
const env = { ...process.env, WORTIFY_ENV_FILE: emptyEnv, DJANGO_ENV: 'development', DJANGO_DEBUG: '1',
  RENDER: '', DATABASE_URL: '', DJANGO_DATABASE_ENGINE: 'sqlite', DJANGO_DB_PATH: path.join(data, 'test.sqlite3'),
  DJANGO_MEDIA_ROOT: path.join(data, 'media'), MEDIA_STORAGE: 'local', FRONTEND_ORIGIN: '',
  DJANGO_ALLOWED_HOSTS: 'localhost,127.0.0.1', TEACHING_REALTIME_URL: '', TEACHING_REALTIME_SECRET: '',
  DJANGO_CSRF_TRUSTED_ORIGINS: 'http://127.0.0.1:15173', DJANGO_DEV_ORIGIN: 'http://127.0.0.1:18000' };
const python = process.env.E2E_PYTHON || (process.platform === 'win32' ? path.join(root, '.venv', 'Scripts', 'python.exe') : 'python3');
const manage = path.join(root, 'Backend', 'manage.py');
for (const args of [[manage, 'migrate', '--noinput'], [manage, 'shell', '-c', `exec(open(${JSON.stringify(path.join(frontend, 'e2e', 'fixtures.py'))}, encoding='utf-8').read())`]]) {
  const result = spawnSync(python, args, { cwd: root, env, stdio: 'inherit', windowsHide: true });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
}
const children = [
  spawn(python, [manage, 'runserver', '127.0.0.1:18000', '--noreload'], { cwd: root, env, stdio: 'inherit', windowsHide: true }),
  spawn(process.execPath, [path.join(frontend, 'node_modules', 'vite', 'bin', 'vite.js'), '--host', '127.0.0.1', '--port', '15173', '--strictPort'], { cwd: frontend, env, stdio: 'inherit', windowsHide: true }),
];
let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill();
  setTimeout(() => process.exit(code), 500).unref();
}
for (const child of children) {
  child.on('error', error => { console.error(error); stop(1); });
  child.on('exit', (code, signal) => { if (!stopping) { console.error(`E2E service exited unexpectedly: code=${code}, signal=${signal}`); stop(code || 1); } });
}
process.on('SIGINT', () => stop());
process.on('SIGTERM', () => stop());

import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const root = fileURLToPath(new URL('..', import.meta.url));
const server = await createServer({
  root,
  server: { host: '127.0.0.1', port: 4173, strictPort: true },
});

await server.listen();

const runner = spawn(process.execPath, ['node_modules/@playwright/test/cli.js', 'test'], {
  cwd: root,
  stdio: 'inherit',
});

const exitCode = await new Promise((resolve, reject) => {
  runner.once('error', reject);
  runner.once('exit', (code) => resolve(code ?? 1));
});

await server.close();
process.exitCode = exitCode;

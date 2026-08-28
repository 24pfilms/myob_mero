#!/usr/bin/env node

import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

if (process.platform !== 'win32') {
  console.error('Use scripts/start-all.ps1 from PowerShell on Windows.');
  process.exit(1);
}

const root = dirname(fileURLToPath(import.meta.url));
const launcher = spawn('powershell.exe', ['-NoLogo', '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', join(root, 'scripts', 'start-all.ps1')], {
  cwd: root,
  stdio: 'inherit',
  shell: false,
});
launcher.on('error', error => { console.error(`Launcher failed: ${error.message}`); process.exit(1); });
launcher.on('exit', code => process.exit(code ?? 1));

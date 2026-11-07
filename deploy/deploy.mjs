#!/usr/bin/env node
// Builds the web edition and publishes it to the server as a new release.
//
//   node deploy/deploy.mjs --host duke@102.214.11.223 --key "E:\ssh\duke-cloud"
//
// Options: --host user@server (required), --key path (optional SSH key),
// --site https://mg.antonduplessis.com (checked after switching),
// --skip-build (publish the existing web/dist), --keep 3 (releases kept).
//
// The release is uploaded as one archive, unpacked into its own folder, and
// made live by switching the "current" link in a single step, so visitors
// never see a half-uploaded site. Works on Windows, macOS and Linux (needs
// Node.js, npm, ssh, scp and tar, all standard on Windows 10 and later).
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SITE_DIR = '/var/www/memory-card-game';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const web = join(root, 'web');
const dist = join(web, 'dist');

const args = process.argv.slice(2);
const option = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
};
const host = option('host');
const key = option('key');
const site = option('site', 'https://mg.antonduplessis.com');
const keep = Math.max(1, Number(option('keep', '3')));
if (!host || !/^[\w.-]+@[\w.-]+$/.test(host)) {
  console.error('Usage: node deploy/deploy.mjs --host user@server [--key path] [--site url] [--skip-build] [--keep 3]');
  process.exit(1);
}

const sshOptions = [...(key ? ['-i', key, '-o', 'IdentitiesOnly=yes'] : []), '-o', 'PreferredAuthentications=publickey', '-o', 'BatchMode=yes', '-o', 'StrictHostKeyChecking=accept-new'];

function run(command, commandArgs, options = {}) {
  console.log(`> ${command} ${commandArgs.join(' ')}`);
  const result = spawnSync(command, commandArgs, { stdio: 'inherit', shell: false, ...options });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} exited with ${result.status}`);
}
const ssh = (script) => run('ssh', [...sshOptions, host, script]);

if (!args.includes('--skip-build')) {
  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  run(npm, ['ci'], { cwd: web, shell: process.platform === 'win32' });
  run(npm, ['run', 'build'], { cwd: web, shell: process.platform === 'win32' });
}
if (!existsSync(join(dist, 'sw.js')) || !existsSync(join(dist, 'index.html'))) throw new Error('web/dist is missing or incomplete; build first.');
const version = /const VERSION = "([0-9a-f]+)";/.exec(readFileSync(join(dist, 'sw.js'), 'utf8'))?.[1];
if (!version) throw new Error('web/dist/sw.js has no version');
const files = readdirSync(dist, { recursive: true, withFileTypes: true }).filter((entry) => entry.isFile()).length;
const release = `${new Date().toISOString().replace(/[-:]/g, '').replace(/\..*/, '')}-${version}`;

const work = mkdtempSync(join(tmpdir(), 'memory-card-game-deploy-'));
const archive = join(work, 'release.tar.gz');
try {
  run('tar', ['-czf', archive, '-C', dist, '.']);
  run('scp', [...sshOptions, archive, `${host}:/tmp/memory-card-game-${release}.tar.gz`]);
  ssh(
    [
      'set -eu',
      `cd ${SITE_DIR}`,
      `mkdir -p releases/${release}`,
      `tar -xzf /tmp/memory-card-game-${release}.tar.gz -C releases/${release}`,
      `rm -f /tmp/memory-card-game-${release}.tar.gz`,
      `test "$(find releases/${release} -type f | wc -l)" -eq ${files}`,
      `ln -sfn releases/${release} current.next`,
      'mv -Tf current.next current',
      `ls -1dt releases/*/ | tail -n +${keep + 1} | xargs -r rm -rf`,
      'echo "Live release: $(readlink current)"',
    ].join(' && '),
  );
} finally {
  rmSync(work, { recursive: true, force: true });
}

// Confirm the live site serves this release.
try {
  const response = await fetch(new URL('sw.js', `${site}/`), { cache: 'no-store' });
  const live = /const VERSION = "([0-9a-f]+)";/.exec(await response.text())?.[1];
  console.log(live === version ? `OK: ${site} serves release ${version}.` : `Warning: ${site} answered with version ${live ?? 'unknown'}, expected ${version}.`);
} catch (error) {
  console.log(`Published, but ${site} could not be checked (${error.message}). DNS or the certificate may still be pending.`);
}

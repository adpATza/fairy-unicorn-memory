import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = fileURLToPath(new URL('../..', import.meta.url));
const python = ['python3', 'python'].find((command) => !spawnSync(command, ['--version']).error);
const guide = readFileSync(new URL('../public/guide.html', import.meta.url), 'utf8');

describe('web guide', () => {
  it.skipIf(!python)('is up to date with tools/build_guide.py (run it after editing the guide)', () => {
    const run = spawnSync(python!, ['tools/build_guide.py', '--check'], { cwd: root, encoding: 'utf8' });
    expect(run.stdout + run.stderr).toContain('Guides are up to date.');
    expect(run.status).toBe(0);
  });

  it('keeps the shared artwork advice and prompt', () => {
    for (const text of ['One picture makes one matching pair', 'Reusable generation prompt', 'A 30-image planning checklist', '☐ 30', 'Review small, not just large']) {
      expect(guide).toContain(text);
    }
  });

  it('describes the web edition, not the Windows one', () => {
    for (const text of ['Choose pictures', 'Add to Home Screen', 'Back up decks', 'Restore backup', 'without scrolling', 'Web edition']) expect(guide).toContain(text);
    for (const text of ['EXE', 'PCK', 'OpenGL', 'Import an image folder', 'Godot']) expect(guide).not.toContain(text);
  });

  it('is a complete page with a way back to the game', () => {
    expect(guide).toMatch(/^<!doctype html>\n<html lang="en">/);
    expect(guide).toContain('<meta name="viewport"');
    expect(guide).toContain('<a href="./">Back to the game</a>');
  });
});

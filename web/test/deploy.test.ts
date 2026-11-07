import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import headers from '../security-headers.json' with { type: 'json' };

const read = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
const caddyfile = read('deploy/Caddyfile');
const setup = read('deploy/setup-server.sh');
const deploy = read('deploy/deploy.mjs');

describe('deployment files', () => {
  it('Caddy sends exactly the security headers the browser tests run under', () => {
    for (const [name, value] of Object.entries(headers)) expect(caddyfile).toContain(`\t\t${name} "${value}"`);
    expect(caddyfile).toContain('Strict-Transport-Security "max-age=31536000"');
    expect(caddyfile).toContain('-Server');
  });

  it("the policy allows the printable guide's inline style by its hash (rebuild the hash after changing the guide's style)", () => {
    const css = /<style>([\s\S]*?)<\/style>/.exec(read('web/public/guide.html'))![1]!;
    const hash = createHash('sha256').update(css).digest('base64');
    expect(headers['Content-Security-Policy']).toContain(`'sha256-${hash}'`);
    expect(headers['Content-Security-Policy']).not.toContain('unsafe-inline');
    expect(headers['Content-Security-Policy']).not.toContain('unsafe-eval');
  });

  it('serves the site from the folder the deploy script publishes to', () => {
    const site = /const SITE_DIR = '([^']+)'/.exec(deploy)![1]!;
    expect(caddyfile).toContain(`root * ${site}/current`);
    expect(setup).toContain(`SITE_DIR=${site}`);
    expect(caddyfile).toMatch(/^mg\.antonduplessis\.com \{/m);
  });

  it('the server setup allows SSH before enabling the firewall and opens only 22, 80 and 443', () => {
    expect(setup.indexOf('ufw allow 22/tcp')).toBeGreaterThan(-1);
    expect(setup.indexOf('ufw allow 22/tcp')).toBeLessThan(setup.indexOf('ufw --force enable'));
    expect([...setup.matchAll(/ufw allow (\S+)/g)].map((m) => m[1])).toEqual(['22/tcp', '80/tcp', '443/tcp']);
    expect(setup).toContain('ufw default deny incoming');
  });
});

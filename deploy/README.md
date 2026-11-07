# Self-hosting the web edition

How to serve the web edition from your own Ubuntu server with Caddy, at `https://mg.antonduplessis.com`. GitHub Pages (`.github/workflows/web.yml`) is an alternative; both can run at once.

| File | Purpose |
| --- | --- |
| `Caddyfile` | The site: automatic HTTPS, security headers, caching rules, compression |
| `setup-server.sh` | One-time server setup: Caddy from its official repository, firewall, site folder |
| `deploy.mjs` | Builds `web/` and publishes it as a new release, switching over in one step |

## 1. Point the domain at the server

At your DNS provider, add an **A record** for `mg.antonduplessis.com` pointing to the server's IPv4 address. If the server also has a public IPv6 address, add an **AAAA record** too; otherwise do not add one. Check it from any computer:

```bash
nslookup mg.antonduplessis.com
```

## 2. Prepare the server (once)

Copy `Caddyfile` and `setup-server.sh` to the server and run the script with `sudo` from the account that will deploy:

```bash
scp -i <key> deploy/Caddyfile deploy/setup-server.sh <user>@<server>:~/
```

```bash
ssh -i <key> <user>@<server> "sudo bash ~/setup-server.sh"
```

The firewall allows **22** (SSH), **80** and **443** (TCP) and denies all other incoming traffic. SSH is allowed before the firewall is switched on, so the session is not cut off. Port 443 serves the site. Caddy needs port 80 to obtain and renew the certificate and to redirect `http://` visitors to `https://`. If your hosting provider also has a firewall, open the same three ports there.

## 3. Deploy

From a computer with Node.js 22 or newer and this repository checked out:

```bash
node deploy/deploy.mjs --host <user>@<server> --key <path-to-key>
```

It runs `npm ci` and `npm run build` in `web/`, uploads the build as one archive, unpacks it into `/var/www/memory-card-game/releases/<time>-<version>`, and switches the `current` link to it in one step. It keeps the last three releases and then checks that the site serves the new version. To roll back, point `current` at an earlier release:

```bash
ssh <user>@<server> "cd /var/www/memory-card-game && ln -sfn releases/<earlier> current.next && mv -Tf current.next current"
```

Open players get the new version through the in-game update prompt between rounds.

## Security

- HTTPS only, with HSTS. Caddy renews the certificate by itself.
- A strict Content Security Policy: scripts, styles, images and connections only from the site itself. The one inline style, in the printable guide, is allowed by its hash. There are no third-party requests.
- Framing is blocked, MIME sniffing is off, no referrer is sent, camera, microphone, location, payment and USB access are disabled, and the `Server` header is removed.
- The headers live in `web/security-headers.json`. The browser tests run under exactly those headers, and a unit test checks that the Caddyfile matches them, so the policy cannot silently break the game. The whole browser suite also passes against Caddy serving this Caddyfile.
- The site is static files only: nothing runs on the server except Caddy. Players' custom decks never leave their devices.

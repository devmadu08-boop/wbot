# Madu AI WhatsApp Assistant

A complete WhatsApp automation dashboard for Windows 10 VPS using Baileys, Express, React, SQLite, OpenRouter, and node-cron.

## Quick Start

1. Install Node.js 20 LTS or newer.
2. Copy `.env.example` to `.env` and update the secrets.
3. Install dependencies:

```powershell
npm run install:all
```

4. Create the database:

```powershell
npm run migrate
```

5. Start development mode:

```powershell
npm run dev
```

Backend: `http://localhost:3000`  
Frontend: `http://localhost:5173`

Default login comes from `.env`: `ADMIN_USERNAME` and `ADMIN_PASSWORD`.

## Windows VPS Production

```powershell
npm install -g pm2
npm run install:all
npm run migrate
npm run pm2:start
pm2 save
pm2 startup
```

On Windows, `pm2 startup` may fail with `Init system not found`. Use the included Task Scheduler helper instead:

```powershell
npm run windows:startup
```

After a reboot, Windows runs `pm2 resurrect`, which reloads the process list saved by `pm2 save`.

## Frontend on Vercel, Backend on VPS

Deploy only the `client` folder on Vercel:

1. Import this GitHub repo in Vercel.
2. Recommended: set the Vercel project root directory to `client`.
3. Add this Vercel environment variable:

```txt
VITE_API_URL=http://YOUR_VPS_IP_OR_DOMAIN:3000
```

The repo also includes a root `vercel.json`, so deploying from the repository root works too. In that mode, Vercel builds `client` and serves `client/dist`.

4. On the VPS `.env`, allow the Vercel frontend origin:

```txt
CLIENT_ORIGIN=http://localhost:5173,https://wbot-nine.vercel.app
```

5. Restart the backend after changing `.env`:

```powershell
pm2 restart madu-ai-whatsapp-assistant
pm2 save
```

If the frontend is served over `https://`, the browser may block requests to an `http://` backend as mixed content. The best production setup is to put the VPS backend behind HTTPS using a domain, IIS reverse proxy, Nginx, Caddy, Cloudflare Tunnel, or another SSL proxy, then set `VITE_API_URL=https://api.your-domain.com`.

## Notes

- Baileys session files are stored in `BAILEYS_AUTH_DIR`.
- SQLite database defaults to `data/madu-assistant.sqlite`.
- OpenRouter API key can be set in `.env` or saved from the dashboard settings page.
- The app defaults to the `Asia/Colombo` timezone.
- Automation has safety controls: pause all, quiet hours, unknown-contact blocking, per-contact toggles, max replies per hour, urgent/stop keyword handling, and manual approval mode.

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

Use Windows Task Scheduler if PM2 startup does not register cleanly:

```powershell
pm2 resurrect
```

## Notes

- Baileys session files are stored in `BAILEYS_AUTH_DIR`.
- SQLite database defaults to `data/madu-assistant.sqlite`.
- OpenRouter API key can be set in `.env` or saved from the dashboard settings page.
- The app defaults to the `Asia/Colombo` timezone.
- Automation has safety controls: pause all, quiet hours, unknown-contact blocking, per-contact toggles, max replies per hour, urgent/stop keyword handling, and manual approval mode.

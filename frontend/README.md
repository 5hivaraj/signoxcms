# SignoX Frontend

Next.js app for SignoX digital signage CMS. Role-based dashboards (super-admin, client-admin, user-admin, staff) and standalone player at `/player`.

## Setup

1. **Env** – Create `.env`:
   ```env
   NEXT_PUBLIC_API_URL=http://localhost:5000/api
   NEXT_TELEMETRY_DISABLED=1
   ```

2. **Install** – `npm install`

## Run

- `npm run dev` – dev server (binds to `0.0.0.0` so reachable at LAN IP, e.g. `http://10.177.101.222:3000`)
- `npm run build` / `npm start` – production

Default login: `admin@signox.com` / `admin123`. Player: `/player` (pair with 6-digit code from Displays).

**Full project reference**: [../PROJECT.md](../PROJECT.md)

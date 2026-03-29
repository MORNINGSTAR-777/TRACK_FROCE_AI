# Bandobusth.AI — Full Deployment Guide
## Anantapur District Police — Real-Time Duty Monitoring System

---

## Project Structure

```
bandobusth_ai/
├── server.js              # Complete backend (Express + Socket.io + MongoDB)
├── package.json
├── .env.example           # Copy to .env and configure
└── public/
    ├── index.html         # Full frontend (Login + Admin + Officer + Constable)
    ├── manifest.json      # PWA manifest
    └── sw.js              # Service worker (offline support)
```

---

## Setup Instructions

### Step 1 — Prerequisites

```bash
# Node.js 18+
node --version

# MongoDB (local) OR use MongoDB Atlas (cloud, free tier)
mongod --version
```

### Step 2 — Install & Configure

```bash
# Navigate to project
cd bandobusth_ai

# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Edit .env with your values
nano .env
```

### Step 3 — Google Maps API Key (REQUIRED for maps)

1. Go to: https://console.cloud.google.com/
2. Create a project or select existing
3. Enable these APIs:
   - **Maps JavaScript API**
   - **Drawing Library** (bundled with Maps JS API)
   - **Geometry Library** (bundled)
4. Create credentials → API Key
5. Set your API key in TWO places:
   - `.env` file: `GOOGLE_MAPS_API_KEY=AIza...`
   - `public/index.html` line: `key=YOUR_GOOGLE_MAPS_API_KEY`

### Step 4 — Start the Server

```bash
# Development
npm run dev

# Production
npm start
```

Server starts on: http://localhost:5000

---

## Demo Credentials

| Role | Police ID | Password |
|------|-----------|----------|
| Head Admin | AP-HEAD-0001 | admin123 |
| Zone Officer | AP-OFF-0012 | officer123 |
| Constable | AP-CONST-0101 | const123 |
| Constable | AP-CONST-0102 | const123 |

---

## Features by Role

### Head Admin
- Master map — all zones + all constables live
- Add/edit/delete patrol zones (draw circles on Google Maps)
- VIP movement tracking with real-time position
- Personnel management — add officers and constables
- Analytics — discipline scores, attendance, violation breakdown
- All alerts — geofence exits, late arrivals, GPS off
- Alert escalation view

### Zone Officer
- Zone-specific map with live constable positions
- Real-time green (in zone) / red (outside zone) markers
- Zone alerts feed
- Constable status list

### Constable (Mobile PWA)
- Simple check-in / check-out button
- Zone name and Zone Officer name
- Duty start/end time display
- Real GPS tracking with navigator.geolocation.watchPosition
- Green (in zone) / Red (outside zone) status indicator
- Critical alerts only: zone exit, late arrival
- Discipline score display

---

## Real GPS Tracking

The system uses the browser's native Geolocation API:

```javascript
navigator.geolocation.watchPosition(
  (pos) => {
    socket.emit('location:update', {
      lat: pos.coords.latitude,
      lng: pos.coords.longitude,
      accuracy: pos.coords.accuracy,
    });
  },
  (err) => { /* GPS off alert */ },
  { enableHighAccuracy: true, maximumAge: 3000, timeout: 10000 }
);
```

Positions broadcast to Admin and Officer rooms via Socket.io.

---

## Geo-Fencing (Haversine Formula)

```javascript
function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3;
  const p1 = lat1 * Math.PI / 180;
  const p2 = lat2 * Math.PI / 180;
  const dp = (lat2 - lat1) * Math.PI / 180;
  const dl = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dp/2)**2 + Math.cos(p1)*Math.cos(p2)*Math.sin(dl/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
```

- Checked on every location update from constable
- If distance > zone.radius: violation created, marker turns red
- 1st violation → Zone Officer alerted
- 3rd violation → Head Admin escalation

---

## Alert Escalation

```
Constable exits zone
    → Alert created (severity: high)
    → Zone Officer notified via WebSocket

2nd violation today
    → Alert created (severity: high)
    → Zone Officer notified

3rd+ violation today
    → Alert created (severity: critical)
    → Head Admin escalation room notified
    → Zone Officer also notified
```

---

## Discipline Score

- Starts at 100 for each officer
- -2 points per geofence violation
- -1 point per late arrival
- Score visible in analytics, leaderboard, and officer row

---

## GPS Tampering Detection

If `navigator.geolocation` returns error code 1 (PERMISSION_DENIED):
- Frontend emits `alert:gps_off` via WebSocket
- Backend creates alert with type `gps_off`
- Admin and Officer receive real-time notification

---

## MongoDB Collections

| Collection | Purpose |
|------------|---------|
| users | All users (admin, officer, constable) with roles, zones, scores |
| zones | Patrol zones with center coordinates, radius, color, officer |
| trackinglogs | Every GPS location update with timestamp and zone status |
| alerts | All violations, late arrivals, GPS off events |
| dutylogs | Check-in / check-out records per shift |
| viptrackings | VIP movements with route history |

---

## API Endpoints

```
POST   /api/auth/login                  — Login
GET    /api/users                       — List all users
POST   /api/users                       — Create user (admin only)
GET    /api/zones                       — List all zones
POST   /api/zones                       — Create zone (admin/officer)
DELETE /api/zones/:id                   — Delete zone (admin)
POST   /api/zones/:id/assign            — Assign constable to zone
POST   /api/tracking/location           — HTTP location update (fallback)
GET    /api/tracking/live               — Live positions of all online users
POST   /api/duty/checkin                — Constable check-in
POST   /api/duty/checkout               — Constable check-out
GET    /api/alerts                      — Get alerts
PATCH  /api/alerts/:id/acknowledge      — Acknowledge alert
GET    /api/vip                         — List VIP movements
POST   /api/vip                         — Add VIP movement
GET    /api/analytics                   — District analytics
GET    /api/leaderboard                 — Discipline leaderboard
GET    /health                          — Health check
```

---

## WebSocket Events

| Event | Direction | Description |
|-------|-----------|-------------|
| `location:update` | C → S | Constable sends GPS coords |
| `location:update` | S → Admin/Officer | Broadcast position update |
| `zone:status` | S → Constable | In/out zone response |
| `alert:new` | S → All | New alert broadcast |
| `alert:geofence` | S → Constable | Zone violation (triggers fullscreen alert) |
| `alert:escalated` | S → Admin | 3rd violation escalation |
| `alert:acknowledged` | S → All | Alert dismissed |
| `duty:checkin` | S → Admin/Officer | Constable checked in |
| `duty:checkout` | S → Admin/Officer | Constable checked out |
| `alert:gps_off` | C → S | GPS disabled alert |
| `stats:update` | S → All | Live stats refresh |

---

## Production Deployment

```bash
# Install PM2
npm install -g pm2

# Start with PM2
pm2 start server.js --name bandobusth-ai

# Auto-restart on boot
pm2 startup
pm2 save

# Nginx reverse proxy (example)
# server {
#   listen 80;
#   server_name your-domain.com;
#   location / { proxy_pass http://localhost:5000; }
#   location /socket.io/ { proxy_pass http://localhost:5000; proxy_http_version 1.1; proxy_set_header Upgrade $http_upgrade; proxy_set_header Connection "upgrade"; }
# }
```

---

## Mobile PWA Install

Constables can install Bandobusth.AI as a native-like app:
1. Open the app URL in Chrome (Android) or Safari (iPhone)
2. Tap "Add to Home Screen"
3. App launches fullscreen without browser UI

GPS tracking works in PWA mode with the same accuracy as a native app.

---

## Important — Before Going Live

1. Replace `YOUR_GOOGLE_MAPS_API_KEY` in `index.html` with your real key
2. Set a strong `JWT_SECRET` in `.env`
3. Use HTTPS in production (required for GPS access by browser)
4. Set MongoDB Atlas for cloud persistence
5. Configure CORS_ORIGIN to your actual domain

# 🚨 BANDOBUSTH.AI — Live Tracking System Setup Guide

## Overview
Complete live tracking system with geofencing alerts, real-time WebSocket sync, and role-based access control for:
- **Head Admin** — View all officers and constables in real-time
- **Zone Officer** — Monitor assigned zone constables  
- **Constable** — Personal duty tracking with GPS alerts

---

## ✅ Features Implemented

### 1. **Live GPS Tracking**
- Real-time constable location updates via WebSocket
- 5-10 second update intervals from device GPS
- Animated marker movement on maps
- Offline fallback via HTTP

### 2. **Geofencing Alert System**
- 🚨 Alert sound (3 beeps) when constable exits zone boundary
- Haptic vibration feedback on mobile
- Full-screen warning modal for constable
- Admin dashboard real-time notif badge
- Escalation on repeated violations (3+ per day)

### 3. **Role-Based Live Tracking**

#### Head Admin Dashboard
- **Master Map**: All zones with all constables' live positions
- **Color coding**: Green (in zone) / Red (outside zone)  
- **Live Stats**: Active count, in-zone %, violations today
- **Alert Center**: All geofence, GPS, late arrival alerts
- **Search & Filter**: By zone, officer, status

#### Zone Officer Dashboard
- **Zone Map**: Only their assigned zone with constables
- **My Constables**: Live status list with scores
- **Zone Alerts**: Only my zone's violations & alerts
- **Quick Actions**: Acknowledge, escalate alerts

#### Constable Mobile View
- **Zone Status Card**: Current zone name, duty times, officer
- **Zone Indicator**: ✓ IN ZONE or ✗ OUTSIDE (with distance)
- **Duty Tracking**: Timer, GPS status, violations count
- **Check In/Out**: Start/end duty with auto GPS tracking

### 4. **WebSocket Real-Time Sync**
- Socket.IO bi-directional communication
- Automatic reconnection with exponential backoff
- Polling fallback if WebSocket unavailable
- Room-based access control (`role:admin`, `role:officer`, `user:userId`)

### 5. **Sound Alerts**
- Violation alert: 3 sequential beeps (500ms intervals)
- Repeating for 3 seconds during critical alerts
- Volume controlled (0.8)

---

## 🚀 Deployment Steps

### Step 1: Install Dependencies
```bash
cd /path/to/bandobusth_ai
npm install
```

**Required packages** (check `package.json`):
- `express` — REST API server
- `socket.io` — Real-time WebSocket
- `mongoose` — MongoDB ODM
- `bcryptjs` — Password hashing
- `jsonwebtoken` — Auth tokens
- `cors` — Cross-origin requests
- `helmet` — Security headers

### Step 2: Configure Environment Variables
Create `.env` file:
```env
NODE_ENV=production
PORT=5000
MONGO_URI=mongodb://localhost:27017/bandobusth_ai
JWT_SECRET=your_super_secret_key_here_change_in_production
CORS_ORIGIN=http://localhost:3000

# Optional
LOG_LEVEL=info
GEOFENCE_ALERT_COOLDOWN=300000  # 5 minutes between alerts per user
```

### Step 3: Start MongoDB
```bash
# Local MongoDB
mongod

# Or MongoDB Atlas (update MONGO_URI in .env)
```

### Step 4: Start Backend Server
```bash
node server.js
```

**Expected output:**
```
✓ MongoDB connected at mongodb://localhost:27017/bandobusth_ai
✓ Server running on http://localhost:5000
✓ Socket.IO listening for connections
```

### Step 5: Access Frontend
Open browser: `http://localhost:5000`

**Demo credentials:**
- **Police ID**: `AP-HEAD-0001`  
  **Password**: `admin123`  
  **Role**: Head Admin
  
- **Police ID**: `AP-OFF-0012`  
  **Password**: `officer123`  
  **Role**: Zone Officer
  
- **Police ID**: `AP-CONST-0101`  
  **Password**: `const123`  
  **Role**: Constable

---

## 🔄 System Architecture

```
┌─────────────────┐
│   Constable     │  ← GPS enabled, sends location every 5s
│   (PWA Mobile)  │
└────────┬────────┘
         │ WebSocket: location:update
         │ { lat, lng, inZone, distance }
         ↓
┌──────────────────────────────────────┐
│      Socket.IO Server (Node.js)      │
├──────────────────────────────────────┤
│ • Geofence checking (Haversine calc) │
│ • Alert generation & escalation      │
│ • Real-time broadcast to rooms       │
│ • User location caching              │
└────┬─────────────┬──────────────────┘
     │             │
  WebSocket      WebSocket
  to Admin      to Officer
     │             │
     ↓             ↓
┌─────────────┐  ┌──────────────┐
│ Admin UI    │  │ Officer UI   │
│ (All Data)  │  │ (Zone Data)  │
└─────────────┘  └──────────────┘

┌─────────────────────────────────────┐
│         MongoDB (Persistence)       │
├─────────────────────────────────────┤
│ • Users (admin, officer, constable) │
│ • Zones (patrol boundaries)         │
│ • TrackingLog (history)             │
│ • Alerts (violations, escalations)  │
│ • DutyLog (check in/out logs)      │
└─────────────────────────────────────┘
```

---

## 🔒 Role-Based Access Control

### Admin
- ✅ View all users, zones, tracking data
- ✅ Create zones, assign constables
- ✅ View all alerts & escalations
- ✅ Manage officers & constables
- ✅ Access analytics & leaderboards

### Zone Officer
- ✅ View only assigned zone
- ✅ View only their constables
- ✅ View only zone alerts
- ❌ Create zones or manage other zones
- ❌ Access admin analytics

### Constable
- ✅ View own position
- ✅ Check in/out duty
- ✅ Receive own alerts
- ❌ View other constables
- ❌ Access alerts menu

---

## 🗺️ Live Tracking Features

### Marker Colors on Map
- **Green Circle** (✓): Constable is inside zone boundary
- **Red Circle** (✗): Constable is outside zone boundary
- **Amber Circle** (◐): Device offline / GPS disabled

### Geofence Algorithm
Uses **Haversine formula** for accurate distance calculation:
- Distance = 2R × arctan2(√a, √(1-a))
- Where R = Earth radius (6,371 km)
- Violations triggered when: distance > zone.radius

### Alert Escalation Logic
1. **1st violation** → Alert to Zone Officer (severity: high)
2. **2nd violation** → Escalate to Admin (severity: critical)
3. **3rd+ violation** → Repeated alert + performance score -2

### Performance Scoring
- Base score: 100
- Per geofence violation: -2
- Per late arrival: -1
- Per GPS off incident: -3
- Resets monthly

---

## 📊 API Endpoints (Role-Protected)

### Authentication
```
POST /api/auth/login
  Body: { policeId, password }
  Returns: { token, user }
```

### Users
```
GET  /api/users              (admin, officer, constable)
POST /api/users              (admin only)
GET  /api/users/leaderboard  (public)
```

### Zones
```
GET    /api/zones                (all roles)
POST   /api/zones                (admin, officer)
PUT    /api/zones/:id            (admin)
DELETE /api/zones/:id            (admin)
POST   /api/zones/:id/assign     (admin, officer)
```

### Live Tracking
```
POST GET /api/tracking/location   (constable)
GET  /api/tracking/live           (admin, officer)
GET  /api/tracking/history/:userId (admin, officer)
```

### Alerts
```
GET    /api/alerts               (all roles)
PATCH  /api/alerts/:id/acknowledge (admin, officer)
```

### Duty
```
POST /api/duty/checkin          (constable)
POST /api/duty/checkout         (constable)
```

---

## 🔊 Sound Alert System

### Alert Triggers
1. **Geofence Violation** → playAlertSound('violation', 3)
2. **GPS Disabled** → playAlertSound('violation', 2)
3. **Repeated Violation** → playContinuousAlert(3000)

### Audio Implementation
- Uses Web Audio API with base64 encoded WAV data
- Fallback to browser native audio if not available
- Silent mode: Volume set to 0 on mute

### Customizing Sound
Edit in `index1.html` → Look for `ALERT_SOUNDS` object:
```javascript
const ALERT_SOUNDS = {
  violation: 'data:audio/wav;base64,...'  // Replace with your sound
};
```

---

## 📱 Mobile PWA Setup

### Service Worker
- Offline support with cached assets
- Background sync for location updates
- Push notifications for alerts

### Web App Install
1. Open app in browser
2. Click "Install" / "Add to Home Screen"
3. Adds to home screen as app
4. Can run offline with cached data

---

## 🐛 Troubleshooting

### Maps Not Loading
- Verify Leaflet CDN is accessible
- Check browser console for errors
- Ensure zones are created in admin dashboard

### Location Not Broadcasting
- Check GPS permission in browser
- Verify WebSocket connection (check browser DevTools → Network)
- Check backend logs for geofence check errors
- Fallback to HTTP if WebSocket fails

### Alerts Not Playing
- Check browser audio permission
- Test audio volume on device
- Verify speaker is not muted
- Check browser console for audio errors

### Performance Issues
- If many constables, reduce marker update frequency
- Use clustering for dense markers
- Archive old tracking logs (>30 days)
- Check MongoDB query indexes

---

## 📈 Scaling Considerations

### For 100+ Constables
1. **Database**: 
   - Add indexes on `userId`, `createdAt`
   - Archive tracking logs older than 30 days
   - Use sharding for TrackingLog collection

2. **Backend**:
   - Use clustering with `PM2`
   - Implement Redis for session store
   - Use message queue for alert processing

3. **Frontend**:
   - Implement marker clustering (Leaflet.markercluster)
   - Paginate personnel list
   - Lazy load alert history

### Deployment Recommendation
```bash
# Using PM2 for production
npm install -g pm2
pm2 start server.js -i max --name "bandobusth-api"
pm2 save
pm2 startup
```

---

## 🔐 Security Checklist

- [ ] Change JWT_SECRET to strong random value
- [ ] Enable HTTPS in production
- [ ] Set CORS_ORIGIN to specific domain
- [ ] Use environment-specific configs
- [ ] Enable MongoDB authentication
- [ ] Rate limit API endpoints
- [ ] Add request logging & monitoring
- [ ] Regular security audits
- [ ] Keep dependencies updated (`npm audit fix`)

---

## 📞 Support & Monitoring

### Health Check Endpoint
```
GET /health
Returns: { status, uptime, onlineUsers, db, timestamp }
```

### Monitoring Socket Connections
Check admin dashboard → Live count in topbar status

### View Live Positions API
```
GET /api/tracking/live
Returns: All online users' current { lat, lng, inZone, lastSeen }
```

---

## 🚀 Next Steps

1. **Customize Alert Sound** — Add your own beep/alarm
2. **Add Analytics** — Dashboard with daily violations, top performers
3. **Push Notifications** — Send alerts via Firebase Cloud Messaging
4. **Mobile App** — Build native iOS/Android apps
5. **Predictive Analytics** — ML for likely violations

---  

**Version**: 2.0  
**Last Updated**: March 2026  
**Status**: ✅ Production Ready

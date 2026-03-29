# BANDOBUSTH.AI — Quick Reference Card

## 🎮 Browser Console Commands (Copy & Paste)

### Test Geofence Violation
```javascript
// Constable outside zone boundary - triggers alert
socket.emit('location:update', {
  lat: 17.4000,
  lng: 78.5000,
  accuracy: 5,
  timestamp: new Date()
});
```

### Test Normal Position (In Zone)
```javascript
// Constable inside zone - no alert
socket.emit('location:update', {
  lat: 17.3850,
  lng: 78.4867,
  accuracy: 5,
  timestamp: new Date()
});
```

### Check WebSocket Connection
```javascript
console.log('Connected:', socket.connected);
console.log('Socket ID:', socket.id);
console.log('Transport:', socket.io.engine.transport.name);
```

### Play Alert Sound
```javascript
playAlertSound('violation', 3);  // 3 beeps
```

### Get Current Location Data
```javascript
console.log('Current zones:', APP.zones);
console.log('Current user:', APP.user);
console.log('Last location:', APP.lastLocation);
```

### Debug Geofence Calculation
```javascript
const result = checkGeofence(17.3850, 78.4867, APP.zones[0]._id);
console.log('Geofence result:', result);
// { inZone: true, distance: 25, inBounds: true }
```

### View All Alerts
```javascript
console.log('Alerts:', APP.alerts);
console.log('Real-time feed:', APP.alertFeed);
```

### Simulate Multiple Constables
```javascript
for (let i = 0; i < 5; i++) {
  setTimeout(() => {
    socket.emit('location:update', {
      lat: 17.3850 + (Math.random() * 0.01),
      lng: 78.4867 + (Math.random() * 0.01),
      accuracy: 5,
      timestamp: new Date()
    });
  }, i * 1000);
}
```

---

## 🔌 API Endpoints Quick Reference

### Authentication
```bash
POST   /api/auth/login
```

### Users
```bash
GET    /api/users              # Get all users
POST   /api/users              # Create new user
GET    /api/users/leaderboard  # Performance leaderboard
GET    /api/users/:id/profile  # User profile
PATCH  /api/users/:id          # Update user
```

### Zones
```bash
GET    /api/zones              # List all zones
POST   /api/zones              # Create zone
PUT    /api/zones/:id          # Update zone
DELETE /api/zones/:id          # Delete zone
POST   /api/zones/:id/assign   # Assign constable
```

### Tracking
```bash
POST   /api/tracking/location     # Submit location
GET    /api/tracking/live         # Get live positions
GET    /api/tracking/history/:id  # Get location history
GET    /api/tracking/live/:zoneId # Get zone constables
```

### Alerts
```bash
GET    /api/alerts                  # Get all alerts
GET    /api/alerts/today            # Today's alerts
PATCH  /api/alerts/:id/acknowledge  # Mark as read
```

### Duty
```bash
POST   /api/duty/checkin      # Start duty
POST   /api/duty/checkout     # End duty
GET    /api/duty/today/:userId # Today's duty log
```

---

## 🌐 WebSocket Events

### Client → Server
```javascript
socket.emit('location:update', { lat, lng, accuracy, timestamp });
socket.emit('alert:gps_off', { userId, timestamp });
socket.emit('duty:checkin', { userId, timestamp });
socket.emit('duty:checkout', { userId, timestamp });
```

### Server → Client (Listen)
```javascript
socket.on('location:update', (data) => { /* Handle */ });
socket.on('alert:geofence', (data) => { /* Handle */ });
socket.on('alert:gps_off', (data) => { /* Handle */ });
socket.on('zone:status', (data) => { /* Handle */ });
socket.on('disconnect', () => { /* Handle */ });
```

---

## 📂 File Structure Cheat Sheet

```
bandobusth_ai/
├── public/
│   ├── index1.html          ← Main frontend app
│   ├── sw.js                ← Service worker (offline)
│   └── manifest.json        ← PWA config
├── backend/
│   ├── models/              ← MongoDB schemas
│   │   ├── User.js
│   │   ├── Zone.js
│   │   ├── TrackingLog.js
│   │   └── Alert.js
│   ├── routes/              ← API endpoints
│   │   ├── auth.js
│   │   ├── users.js
│   │   ├── zones.js
│   │   ├── tracking.js
│   │   └── alerts.js
│   ├── middleware/          ← Authentication, logs
│   │   ├── auth.js
│   │   └── errorHandler.js
│   └── services/            ← Business logic
│       └── geofence.js
├── server.js                ← Main Node app
├── package.json             ← Dependencies
├── .env                     ← Configuration
├── verify-setup.js          ← System check script
├── QUICKSTART.md            ← This quick start
├── LIVE_TRACKING_SETUP.md   ← Full setup guide
├── TESTING_GUIDE.md         ← Testing procedures
└── DEPLOYMENT.md            ← Production deployment
```

---

## 🎯 Key Functions in Frontend (index1.html)

```javascript
// Authentication
login()              // Submit login form
logout()             // Clear session
getAuthToken()       // Get JWT token

// Navigation
navigateTo(page)     // Switch dashboard page
loadPage()           // Load HTML fragment

// Maps
createMap(id, opts)  // Initialize Leaflet map
renderZonesOnMap()   # Draw zone circles
renderMarkersOnMap() # Draw constable markers

// Tracking
startGPSTracking()   # Start real-time GPS watch
handleLocationUpdate(data)  # Handle incoming position
checkGeofence(lat, lng, zoneId)  # Haversine calculation
handleGeofenceAlert(data)  # Alert handling

// UI
showAlert(title, msg, type)  # Show modal alert
playAlertSound(type, count)  # Play beep sound
updateAlertBadge(count)      # Update badge number
```

---

## 🔑 Demo Credentials

| Role | Police ID | Password | Endpoint |
|------|-----------|----------|----------|
| Head Admin | AP-HEAD-0001 | admin123 | /admin-dashboard |
| Zone Officer | AP-OFF-0012 | officer123 | /officer-dashboard |
| Constable | AP-CONST-0101 | const123 | /constable-mobile |

---

## 💾 Database Models (Quick Reference)

### User Schema
```javascript
{
  policeId: String,        // Unique ID
  password: String,        // Hashed
  role: 'admin|officer|constable',
  name: String,
  zoneId: ObjectId,        // Zone assigned
  phone: String,
  violations: Number,      // Count of violations
  performanceScore: Number // Base 100, -2 per violation
}
```

### Zone Schema
```javascript
{
  name: String,           // Zone name
  lat: Number,           // Center latitude
  lng: Number,           // Center longitude
  radius: Number,        // Boundary in meters
  color: String,         // Hex color for map
  assignedOfficers: [ObjectId],
  assignedConstables: [ObjectId]
}
```

### TrackingLog Schema
```javascript
{
  userId: ObjectId,
  lat: Number,
  lng: Number,
  accuracy: Number,      // GPS accuracy meters
  inZone: Boolean,
  distanceFromZone: Number,
  timestamp: Date,
  deviceInfo: String
}
```

### Alert Schema
```javascript
{
  type: 'geofence_violation|gps_off|late_arrival',
  severity: 'low|high|critical',
  userId: ObjectId,
  zoneId: ObjectId,
  distance: Number,      // From zone boundary
  acknowledged: Boolean,
  acknowledgedBy: ObjectId,
  timestamp: Date
}
```

---

## ⚙️ Configuration (.env)

```bash
# Server
NODE_ENV=development        # production for deployment
PORT=5000                   # Server port
CORS_ORIGIN=http://localhost:3000

# Database
MONGO_URI=mongodb://localhost:27017/bandobusth_ai
# or MongoDB Atlas:
# MONGO_URI=mongodb+srv://user:pass@cluster.mongodb.net/db

# Security
JWT_SECRET=change_this_to_random_string

# Geofencing
GEOFENCE_ALERT_COOLDOWN=300000  # 5 minutes between alerts

# Logging
LOG_LEVEL=info              # info, debug, error
```

---

## 🐛 Common Errors & Fixes

| Error | Cause | Fix |
|-------|-------|-----|
| `Module not found: express` | Dependencies not installed | `npm install` |
| `Cannot connect to MongoDB` | DB not running | Start `mongod` |
| `Port 5000 already in use` | Another app using port | Change PORT in .env or kill process |
| `JWT decode error` | Token expired or invalid | Clear localStorage, login again |
| `CORS error: blocked` | Frontend/backend mismatch | Check CORS_ORIGIN in .env |
| `WebSocket connection failed` | Network issue | Check firewall, restart server |
| `No audio output` | Browser mute or no permission | Unmute, grant audio permission |

---

## 📊 Performance Tips

```javascript
// For large number of constables:

// 1. Reduce update frequency (currently 5-10s GPS interval)
//    Increase to 30-60s for 100+ constables

// 2. Enable marker clustering
const markersCluster = new L.MarkerClusterGroup();
APP.maps.master.addLayer(markersCluster);

// 3. Lazy load alert history
const ALERTS_PER_PAGE = 20;
let alertOffset = 0;

// 4. Archive old tracking logs
db.trackingLogs.deleteMany({ 
  timestamp: { $lt: new Date(Date.now() - 30*24*60*60*1000) }
});
```

---

## 🚀 Scaling Checklist

- [ ] Add MongoDB indexes: `db.trackingLogs.createIndex({ userId: 1, timestamp: -1 })`
- [ ] Enable Redis session store
- [ ] Use PM2 for process clustering
- [ ] Add HAProxy for load balancing
- [ ] Enable CDN for static assets
- [ ] Set up monitoring (New Relic, DataDog)
- [ ] Configure backups (hourly)
- [ ] Add rate limiting on API
- [ ] Implement caching layer

---

## 📞 Support Matrix

| Issue | Check | Tool |
|-------|-------|------|
| Backend not starting | Logs | `node server.js 2>&1` |
| Database issues | Connection | `mongo`, then `show dbs` |
| Frontend blank | Console | Browser F12 → Console tab |
| Slow performance | CPU/Memory | `top`, `ps aux` |
| WebSocket issues | Network | DevTools → Network → WS tab |

---

## 📝 Notes

- **Geofencing**: Accurate within 5-10 meters (GPS accuracy)
- **Alert delay**: < 2 seconds for geofence detection
- **Update frequency**: Every 5-10 seconds from constable device
- **Alert sound**: 3 beeps = violation, 2 beeps = info

---

Last Updated: March 2026  
Version: 2.0 Live Tracking  
Status: Production Ready ✅

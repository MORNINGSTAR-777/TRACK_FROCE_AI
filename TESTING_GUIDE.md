# BANDOBUSTH.AI — Testing & Troubleshooting Guide

## 🧪 Complete Testing Workflow

### Phase 1: Environment Setup (Pre-Deployment)

#### 1.1 Verify System Configuration
```bash
cd /path/to/bandobusth_ai
node verify-setup.js
```

**Expected output:**
```
✓ Node.js version
✓ package.json exists
✓ Package: express
✓ Package: socket.io
✓ Package: mongoose
... (all checks ✓)

Results: 18 passed, 0 failed
```

#### 1.2 Install Dependencies
```bash
npm install
```

#### 1.3 Create .env File
```bash
# Copy template
cp .env.example .env

# Edit with your settings
NODE_ENV=development
PORT=5000
MONGO_URI=mongodb://localhost:27017/bandobusth_ai
JWT_SECRET=test_secret_key_change_in_production
CORS_ORIGIN=http://localhost:3000
```

---

### Phase 2: Dependency Testing

#### 2.1 Database Connection
```bash
# Start MongoDB first
mongod

# In another terminal, test connection
node -e "
const mongoose = require('mongoose');
mongoose.connect('mongodb://localhost:27017/bandobusth_ai')
  .then(() => console.log('✓ MongoDB connected'))
  .catch(e => console.log('✗ MongoDB error:', e.message));
"
```

#### 2.2 Socket.IO Test
```javascript
// test-socket.js
const io = require('socket.io-client');
const socket = io('http://localhost:5000');

socket.on('connect', () => {
  console.log('✓ Connected to WebSocket');
  socket.emit('test', { message: 'hello' });
});

socket.on('disconnect', () => {
  console.log('✗ Disconnected');
});

setTimeout(() => {
  socket.disconnect();
  process.exit(0);
}, 2000);
```

Run: `node test-socket.js`

---

### Phase 3: Backend API Testing

#### 3.1 Start Backend Server
```bash
node server.js
```

**Expected startup logs:**
```
✓ MongoDB connected at mongodb://localhost:27017/bandobusth_ai
✓ Server running on http://localhost:5000
✓ Socket.IO listening for connections
```

#### 3.2 Test Authentication Endpoint
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "policeId": "AP-HEAD-0001",
    "password": "admin123"
  }'
```

**Expected response:**
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "_id": "...",
    "policeId": "AP-HEAD-0001",
    "role": "admin",
    "name": "Head Admin",
    "zoneId": null
  }
}
```

#### 3.3 Create Test Zone
```bash
# Get token from login response above
TOKEN="eyJhbGc..."

curl -X POST http://localhost:5000/api/zones \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Zone A",
    "lat": 17.3850,
    "lng": 78.4867,
    "radius": 500,
    "color": "#0EAD7A"
  }'
```

#### 3.4 List All Zones
```bash
curl http://localhost:5000/api/zones \
  -H "Authorization: Bearer $TOKEN"
```

#### 3.5 Get Live Tracking Data
```bash
curl http://localhost:5000/api/tracking/live \
  -H "Authorization: Bearer $TOKEN"
```

**Expected if locations haven't been submitted:**
```json
{
  "success": true,
  "data": [
    {
      "userId": "...",
      "userName": "Constable Name",
      "lat": 17.3850,
      "lng": 78.4867,
      "inZone": true,
      "lastSeen": "2026-03-20T10:30:45.123Z"
    }
  ]
}
```

---

### Phase 4: Frontend Testing

#### 4.1 Access Web App
Open browser: `http://localhost:5000`

#### 4.2 Test Login
1. Select role dropdown: **Admin**
2. Enter Police ID: `AP-HEAD-0001`
3. Enter Password: `admin123`
4. Click **Login**

**Expected:**
- ✓ Redirects to admin dashboard
- ✓ Shows "Head Admin" in top bar
- ✓ Map loads with zones (if any created)
- ✓ WebSocket connects (check DevTools → Network tab → socket.io)

#### 4.3 Test Zone Creation
1. Click **Add Zone** button
2. Fill in zone details:
   - Zone Name: `Test Zone`
   - Latitude: `17.3850`
   - Longitude: `78.4867`
   - Radius: `500` (meters)
3. Click **Create**

**Expected:**
- ✓ Zone appears on map as circle
- ✓ Zone added to zones list
- ✓ Modal closes after success

---

### Phase 5: Live Tracking Testing

#### 5.1 Test Location Update (Mobile/GPS Simulation)
**Option A: Real Mobile Device**
1. Open app on mobile: `http://<your-machine-ip>:5000` (must be on same network)
2. Login as constable: `AP-CONST-0101` / `const123`
3. Allow GPS permission
4. App auto-starts GPS tracking

**Option B: Simulate GPS (Desktop)**
```javascript
// In browser console (DevTools)
navigator.geolocation.getCurrentPosition(pos => {
  const lat = pos.coords.latitude;
  const lng = pos.coords.longitude;
  console.log('lat:', lat, 'lng:', lng);
  
  // Emit location to backend
  if (window.socket) {
    socket.emit('location:update', {
      lat: lat,
      lng: lng,
      accuracy: pos.coords.accuracy,
      timestamp: new Date()
    });
  }
});
```

#### 5.2 Monitor Real-Time Updates (Admin View)
1. Login as admin
2. Open DevTools → Network → WS
3. Filter by `socket.io`
4. Watch for incoming `location:update` messages

**Expected WebSocket messages:**
```json
{
  "type": "location:update",
  "data": {
    "lat": 17.3850,
    "lng": 78.4867,
    "inZone": true,
    "distance": 25.5
  }
}
```

---

### Phase 6: Geofencing Alert Testing

#### 6.1 Trigger Geofence Violation
1. Login as constable (with GPS enabled)
2. Move location manually via DevTools console:
```javascript
// Simulate moving OUTSIDE zone boundary (> 500m away)
socket.emit('location:update', {
  lat: 17.4000,  // About 2.5km from zone center
  lng: 78.5000,
  accuracy: 5,
  timestamp: new Date()
});
```

#### 6.2 Verify Alert Sound
**Expected for Constable:**
- 🔊 Alert sound plays (3 beeps, 500ms apart)
- 📳 Vibration pulses (if device supports)
- 🚨 Full-screen warning modal appears

**Expected for Admin/Officer:**
- 🔔 Alert badge appears on alert icon
- 📊 Alert feeds to "Alerts" dashboard
- 📢 Notification sound plays (2 beeps)

#### 6.3 Verify Backend Alert Creation
```bash
curl http://localhost:5000/api/alerts \
  -H "Authorization: Bearer $TOKEN"
```

**Response should include:**
```json
{
  "type": "geofence_violation",
  "severity": "high",
  "user": "...",
  "zone": "Test Zone",
  "distance": 2547,  // meters
  "timestamp": "2026-03-20T10:35:12.456Z"
}
```

---

### Phase 7: Performance Testing

#### 7.1 Load Multiple Constables
```javascript
// In browser console - simulate 10 constables
for (let i = 0; i < 10; i++) {
  setTimeout(() => {
    const lat = 17.3850 + (Math.random() * 0.01);
    const lng = 78.4867 + (Math.random() * 0.01);
    socket.emit('location:update', {
      lat, lng, accuracy: 5, timestamp: new Date()
    });
  }, i * 200);
}
```

**Expected:**
- ✓ All markers appear on map
- ✓ No lag or freezing
- ✓ Updates in real-time
- ✓ DevTools shows < 200ms latency

#### 7.2 Monitor Server Performance
```bash
# Check Node.js process memory
node -e "
const cluster = require('cluster');
const os = require('os');
const used = process.memoryUsage();
Object.keys(used).forEach(key => {
  console.log(key + ': ' + Math.round(used[key] / 1024 / 1024) + 'MB');
});
"
```

**Expected on idle:**
- ~60-80MB memory usage
- 0% CPU

**Expected under load (10 active constables):**
- ~120-150MB memory usage
- 5-15% CPU

---

## 🐛 Troubleshooting Common Issues

### Issue 1: Maps Not Loading

**Symptoms**: Blank map area, no zones visible

**Solution**:
```javascript
// Check Leaflet in console
console.log(L);  // Should show object with map functions
console.log(APP.maps);  // Should show map instances

// Verify CDN loaded
const script = document.querySelector('script[src*="leaflet"]');
console.log('Leaflet script loaded:', !!script);
```

**Fixes**:
- ✅ Clear browser cache (Ctrl+Shift+Del)
- ✅ Check CORS headers: `Access-Control-Allow-Origin: *` in server
- ✅ Verify OpenStreetMap tile server is accessible
- ✅ Check browser console for errors (F12 → Console tab)

---

### Issue 2: WebSocket Not Connecting

**Symptoms**: Real-time updates don't work, markers don't move

**Solution**:
```javascript
// In browser console
console.log(socket.connected);  // Should be true
console.log(socket.id);  // Should show socket ID
socket.on('disconnect', () => console.log('Disconnected!'));
```

**Fixes**:
- ✅ Check browser DevTools → Network → WS tab for socket.io connection
- ✅ Verify backend is running and Socket.IO initialized
- ✅ Check firewall isn't blocking port 5000
- ✅ Try polling fallback: Check `transport` in DevTools (should show WebSocket first, then polling)
- ✅ Restart Node server: `Ctrl+C`, then `node server.js`

---

### Issue 3: Alert Sound Not Playing

**Symptoms**: Geofence violation occurs but no sound

**Solution**:
```javascript
// Test audio API
const audio = new Audio('data:audio/wav;base64,...');
audio.play().then(() => console.log('✓ Audio plays'))
            .catch(e => console.log('✗ Audio error:', e.message));
```

**Fixes**:
- ✅ Check browser permissions: Settings → Privacy → Microphone/Audio
- ✅ Unmute device (physical switch on mobile)
- ✅ Check volume is not muted (system tray)
- ✅ Try playing audio first: `playAlertSound('violation', 1)` in console
- ✅ Check browser console for Audio API errors
- ✅ Try different browser (Chrome → Firefox to test)

---

### Issue 4: GPS Not Updating

**Symptoms**: Marker stays in same location, no movement

**Requirement**: Must use HTTPS or localhost for Geolocation API to work

**Solution**:
```javascript
// Check GPS permission status
navigator.permissions.query({name: 'geolocation'})
  .then(result => console.log('Permission:', result.state));

// Manually test GPS
navigator.geolocation.getCurrentPosition(
  pos => console.log('✓ GPS:', pos.coords.latitude, pos.coords.longitude),
  err => console.log('✗ GPS error:', err.message)
);
```

**Fixes**:
- ✅ Use HTTPS in production (or localhost for testing)
- ✅ Allow GPS permission on browser/device
- ✅ Check device location services are enabled (Settings → Location)
- ✅ Use real device or GPS emulator (Chrome DevTools → Sensors tab)
- ✅ Wait 10-15 seconds for first GPS lock (takes time to acquire satellites)

---

### Issue 5: Database Connection Failed

**Symptoms**: Server won't start, error about MongoDB

**Solution**:
```bash
# Verify MongoDB is running
mongo --eval "db.adminCommand('ping')"
# Should return: { ok: 1 }

# Check if port 27017 is listening
netstat -an | grep 27017
```

**Fixes**:
- ✅ Start MongoDB: `mongod` (or use MongoDB Atlas cloud)
- ✅ Check connection string in `.env`: `MONGO_URI=mongodb://localhost:27017/bandobusth_ai`
- ✅ Ensure port 27017 is not blocked by firewall
- ✅ Check MongoDB logs for errors: `tail -f /var/log/mongodb/mongod.log`

---

### Issue 6: 401 Unauthorized on API Calls

**Symptoms**: API returns `{ error: "Unauthorized" }` or missing token

**Causes**: JWT token missing, expired, or invalid

**Solution**:
```javascript
// Get token from login
const token = localStorage.getItem('token');
console.log('Token:', token ? token.substring(0, 20) + '...' : 'MISSING');

// Verify token format (should start with "eyJ")
```

**Fixes**:
- ✅ Login first to get token: `POST /api/auth/login`
- ✅ Include token in all requests: `Authorization: Bearer $TOKEN`
- ✅ Check token expiry (usually 7 days)
- ✅ Re-login if token expired
- ✅ Clear localStorage and try again: `localStorage.clear()`

---

### Issue 7: High Latency / Slow Updates

**Symptoms**: Markers update slowly (>2 second delay)

**Solution**:
```bash
# Check network latency
ping localhost
# Should show < 5ms

# Check WebSocket latency in DevTools
# Network tab → WS → Messages → Check response times
```

**Fixes**:
- ✅ Reduce location update frequency in `startGPSTracking()` (currently 5-10s)
- ✅ Check server CPU usage: `top` command
- ✅ Optimize MongoDB queries (add indexes)
- ✅ Use connection pooling in backend
- ✅ Implement marker clustering if 50+ markers
- ✅ Archive old tracking logs (>30 days)

---

## 📋 Testing Checklist

### Security Testing
- [ ] Test with invalid credentials (should fail)
- [ ] Test with expired token (should return 401)
- [ ] Test role-based access (constable can't access admin data)
- [ ] Test SQL injection in search fields
- [ ] Verify password hashing in database

### Functionality Testing
- [ ] Create zone as admin
- [ ] Assign constable to zone
- [ ] Constable logs in and updates location
- [ ] Admin receives real-time location update
- [ ] Move constable outside zone boundary
- [ ] Verify alert sound plays and shows modal
- [ ] Verify alert stored in database
- [ ] Check performance score updated -2

### Cross-Browser Testing
- [ ] Chrome (latest)
- [ ] Firefox (latest)
- [ ] Safari (if on Mac)
- [ ] Edge (if on Windows)
- [ ] Mobile Chrome
- [ ] Mobile Safari

### Network Testing
- [ ] Test with WiFi
- [ ] Test with 4G/5G
- [ ] Test with poor connection (throttle in DevTools)
- [ ] Test offline mode (PWA service worker)

### Load Testing
- [ ] 10 concurrent users
- [ ] 50 concurrent users
- [ ] Measure response times
- [ ] Check memory usage
- [ ] Monitor CPU

---

## 📊 Performance Benchmarks

**Expected Performance on Standard Server:**

| Metric | Target | Acceptable |
|--------|--------|-----------|
| Page Load | <2s | <3s |
| API Response | <200ms | <500ms |
| WebSocket Latency | <100ms | <300ms |
| Map Render (100 markers) | <1s | <2s |
| Memory (idle) | 80MB | 150MB |
| Memory (50 users) | 200MB | 400MB |
| CPU (idle) | <1% | <5% |
| CPU (50 users) | 15-20% | <30% |

---

## 🚀 Health Check Endpoint

```bash
# Monitor system health
curl http://localhost:5000/health
```

**Response:**
```json
{
  "status": "up",
  "uptime": "2:34:12",
  "onlineUsers": 5,
  "db": "connected",
  "timestamp": "2026-03-20T10:45:30.123Z"
}
```

---

## 📞 Getting Help

If issues persist:

1. **Check logs**:
   ```bash
   tail -f logs/error.log
   tail -f logs/access.log
   ```

2. **Enable debug mode**:
   ```bash
   DEBUG=* node server.js  # Verbose logging
   ```

3. **Check system resources**:
   ```bash
   ps aux | grep node  # Process info
   free -h              # Memory usage
   ```

4. **Isolate the problem**:
   - Backend working? Test with `curl`
   - Frontend working? Check browser DevTools
   - Database working? Use MongoDB CLI
   - Network working? Check firewall, CORS headers


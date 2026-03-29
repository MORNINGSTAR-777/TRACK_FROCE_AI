# ⚡ BANDOBUSTH.AI — Quick Start (2 Minutes)

## 🚀 Start Application

### Prerequisites
- Node.js v14+ installed
- MongoDB running locally (or MongoDB Atlas URL)
- Port 5000 available

### Step 1: Install & Configure (60 seconds)
```bash
cd /path/to/bandobusth_ai

# Install packages
npm install

# Create .env file
cat > .env << 'EOF'
NODE_ENV=development
PORT=5000
MONGO_URI=mongodb://localhost:27017/bandobusth_ai
JWT_SECRET=super_secret_key_change_later
CORS_ORIGIN=http://localhost:3000
EOF
```

### Step 2: Start Backend (10 seconds)
```bash
# Terminal 1 - Start MongoDB (if not running)
mongod

# Terminal 2 - Start Node server
node server.js
```

**Expected output:**
```
✓ MongoDB connected at mongodb://localhost:27017/bandobusth_ai
✓ Server running on http://localhost:5000
✓ Socket.IO listening for connections
```

### Step 3: Access App (10 seconds)
1. Open browser: `http://localhost:5000`
2. Login with demo account:
   - **Police ID**: `AP-HEAD-0001`
   - **Password**: `admin123`
   - **Role**: Admin
3. Click through to dashboard ✓

---

## 🎯 Test Live Tracking Feature

### Create Test Zone
1. Click **Add Zone** button
2. Fill in:
   - Zone Name: `Test Zone`
   - Latitude: `17.3850`
   - Longitude: `78.4867`
   - Radius: `500m`
3. Click **Create**
4. Zone appears on map as green circle ✓

### Simulate Constable Location
1. Open browser DevTools: `F12`
2. Go to **Console** tab
3. Paste and run:
```javascript
// Simulate constable sending location UPDATE
socket.emit('location:update', {
  lat: 17.3850,
  lng: 78.4867,
  accuracy: 5,
  timestamp: new Date()
});

console.log('✓ Location sent from zone center');
```
4. Watch map for marker animation ✓

### Trigger Geofence Violation Alert
1. In same console, run:
```javascript
// Simulate moving OUTSIDE zone (2.5km away)
socket.emit('location:update', {
  lat: 17.4000,
  lng: 78.5000,
  accuracy: 5,
  timestamp: new Date()
});

console.log('✓ Location sent from OUTSIDE zone');
```
2. Listen for **alert sound** (3 beeps) ✓
3. Check admin dashboard for alert badge ✓

---

## 👥 Login with Different Roles

### Admin Portal
- **URL**: `http://localhost:5000`
- **Police ID**: `AP-HEAD-0001`
- **Password**: `admin123`
- **View**: All zones, all constables, all alerts

### Zone Officer Portal
- **URL**: `http://localhost:5000`
- **Police ID**: `AP-OFF-0012`
- **Password**: `officer123`
- **View**: Only assigned zone, assigned constables

### Constable Mobile
- **URL**: `http://localhost:5000`
- **Police ID**: `AP-CONST-0101`
- **Password**: `const123`
- **View**: Personal GPS tracking, duty timer

---

## 🧪 Quick Verification

Run system check:
```bash
node verify-setup.js
```

Expected: All checks ✓

---

## 📱 Test on Mobile (Optional)

1. Get your machine IP:
   ```bash
   # Windows
   ipconfig  # Look for "IPv4 Address"
   
   # Mac/Linux
   ifconfig  # Look for inet address
   ```
   Example: `192.168.1.100`

2. On mobile phone (same WiFi):
   - Open: `http://192.168.1.100:5000` (replace with your IP)
   - Login as constable: `AP-CONST-0101` / `const123`
   - Grant GPS permission
   - Watch location update every 5-10 seconds ✓

---

## 🔊 Troubleshooting Quick Fixes

| Issue | Quick Fix |
|-------|-----------|
| Maps not showing | Clear browser cache (`Ctrl+Shift+Del`), refresh page |
| No real-time updates | Check DevTools → Network → WS tab for socket.io |
| Alert sound silent | Unmute device, check volume, browser permissions |
| Can't login | Check MongoDB is running, try demo credentials |
| Port 5000 in use | `netstat -an \| grep 5000` to find process, kill it |
| DNS/connection error | Ensure MongoDB connection string in `.env` is correct |

---

## 📚 Full Documentation

Once apps works, read:
- **Setup Guide**: `LIVE_TRACKING_SETUP.md` — Complete feature overview
- **Testing Guide**: `TESTING_GUIDE.md` — Full testing procedures
- **Deployment**: `DEPLOYMENT.md` — Production setup

---

## ✅ System Ready When

- ✓ `npm install` completes without errors
- ✓ MongoDB connects on startup
- ✓ Server runs on port 5000
- ✓ Frontend loads in browser
- ✓ Login works with demo credentials
- ✓ WebSocket shows in DevTools Network tab
- ✓ Zone can be created
- ✓ Alert sound plays on geofence violation

---

## 🎉 Done!

Live tracking system is running. Happy tracking! 🚨

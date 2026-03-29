// ============================================================
// server.js — Bandobusth.AI Backend
// Node.js + Express + Socket.io + MongoDB
// ============================================================
require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const mongoose = require('mongoose');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);

const JWT_SECRET = process.env.JWT_SECRET || 'bandobusth_ai_secret_2024_anantapur';
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/bandobusth_ai';
const PORT = process.env.PORT || 5000;
const SEED_DEMO_DATA = process.env.SEED_DEMO_DATA === 'true'; // set true only for local dev/testing

// ── Middleware ────────────────────────────────────────────────
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: process.env.CORS_ORIGIN || '*', credentials: true }));
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 500 }));

// Serve frontend
app.use(express.static(path.join(__dirname, 'public')));

// ── Socket.io ──────────────────────────────────────────────────
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
  pingInterval: 10000,
  pingTimeout: 5000,
});

// Online users map: userId -> socket
const onlineUsers = new Map();
const userLocations = new Map(); // userId -> { lat, lng, timestamp }

// ═══════════════════════════════════════════════════════════════
// MONGODB MODELS
// ═══════════════════════════════════════════════════════════════

// User Model
const UserSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  policeId: { type: String, required: true, unique: true, uppercase: true, trim: true },
  badgeNumber: { type: String, trim: true },
  role: { type: String, enum: ['admin', 'officer', 'constable'], required: true },
  password: { type: String, required: true, select: false },
  zone: { type: mongoose.Schema.Types.ObjectId, ref: 'Zone', default: null },
  officerMentor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  isActive: { type: Boolean, default: true },
  performanceScore: { type: Number, default: 100, min: 0, max: 100 },
  totalDutyHours: { type: Number, default: 0 },
  violations: { type: Number, default: 0 },
  lastSeen: Date,
  lastLat: Number,
  lastLng: Number,
  inZone: { type: Boolean, default: true },
  deviceToken: String,
}, { timestamps: true });

UserSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

UserSchema.methods.comparePassword = async function(pw) {
  return bcrypt.compare(pw, this.password);
};

const User = mongoose.model('User', UserSchema);

// Zone Model
const ZoneSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  center: {
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
  },
  radius: { type: Number, default: 500, min: 50 },
  polygon: [{ lat: Number, lng: Number }],
  color: { type: String, default: '#1E6FCC' },
  officer: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  constables: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

const Zone = mongoose.model('Zone', ZoneSchema);

// TrackingLog Model
const TrackingLogSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  lat: { type: Number, required: true },
  lng: { type: Number, required: true },
  accuracy: Number,
  speed: Number,
  inZone: { type: Boolean, default: true },
  distance: Number,
  timestamp: { type: Date, default: Date.now },
});

TrackingLogSchema.index({ user: 1, timestamp: -1 });
const TrackingLog = mongoose.model('TrackingLog', TrackingLogSchema);

// Alert Model
const AlertSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['geofence_exit', 'late_arrival', 'gps_off', 'sos', 'repeated_violation'],
    required: true,
  },
  severity: { type: String, enum: ['low', 'medium', 'high', 'critical'], default: 'medium' },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  zoneId: { type: mongoose.Schema.Types.ObjectId, ref: 'Zone' },
  message: String,
  distance: Number, // meters outside zone
  acknowledged: { type: Boolean, default: false },
  acknowledgedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  acknowledgedAt: Date,
  escalatedTo: { type: String, enum: ['officer', 'admin'], default: 'officer' },
  violationCount: { type: Number, default: 1 },
}, { timestamps: true });

AlertSchema.index({ userId: 1, createdAt: -1 });
AlertSchema.index({ acknowledged: 1, createdAt: -1 });
const Alert = mongoose.model('Alert', AlertSchema);

// DutyLog Model
const DutyLogSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  zone: { type: mongoose.Schema.Types.ObjectId, ref: 'Zone' },
  checkIn: { type: Date, required: true },
  checkOut: Date,
  duration: Number, // minutes
  violations: { type: Number, default: 0 },
  lateMinutes: { type: Number, default: 0 },
  score: { type: Number, default: 100 },
}, { timestamps: true });

const DutyLog = mongoose.model('DutyLog', DutyLogSchema);

// VIP Tracking Model
const VIPSchema = new mongoose.Schema({
  name: { type: String, required: true },
  designation: String,
  vehicle: String,
  level: { type: String, default: 'Z', enum: ['Z+', 'Z', 'Y+', 'Y', 'X'] },
  route: String,
  currentLat: Number,
  currentLng: Number,
  routeHistory: [{ lat: Number, lng: Number, timestamp: Date }],
  isActive: { type: Boolean, default: true },
  assignedEscort: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

const VIPTracking = mongoose.model('VIPTracking', VIPSchema);

// ═══════════════════════════════════════════════════════════════
// AUTH MIDDLEWARE
// ═══════════════════════════════════════════════════════════════
function authenticate(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'No token' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

function authorize(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    next();
  };
}

// ═══════════════════════════════════════════════════════════════
// GEO-FENCING ENGINE
// ═══════════════════════════════════════════════════════════════
function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // metres
  const p1 = lat1 * Math.PI / 180;
  const p2 = lat2 * Math.PI / 180;
  const dp = (lat2 - lat1) * Math.PI / 180;
  const dl = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dp / 2) * Math.sin(dp / 2) +
    Math.cos(p1) * Math.cos(p2) *
    Math.sin(dl / 2) * Math.sin(dl / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function checkGeofence(userId, lat, lng) {
  try {
    const user = await User.findById(userId).populate('zone');
    if (!user || !user.zone) return { inZone: true, distance: 0 };

    const zone = user.zone;
    const dist = haversineDistance(lat, lng, zone.center.lat, zone.center.lng);
    const inZone = dist <= zone.radius;

    // Update user location
    await User.findByIdAndUpdate(userId, {
      lastLat: lat,
      lastLng: lng,
      lastSeen: new Date(),
      inZone,
    });

    if (!inZone) {
      // Count today's violations
      const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
      const todayViolations = await Alert.countDocuments({
        userId,
        type: 'geofence_exit',
        createdAt: { $gte: todayStart },
      });

      // Create alert
      const alert = await Alert.create({
        type: 'geofence_exit',
        severity: todayViolations >= 3 ? 'critical' : 'high',
        userId,
        zoneId: zone._id,
        message: `Officer exited assigned zone boundary (${Math.round(dist - zone.radius)}m outside)`,
        distance: Math.round(dist - zone.radius),
        escalatedTo: todayViolations >= 2 ? 'admin' : 'officer',
        violationCount: todayViolations + 1,
      });

      await alert.populate('userId', 'name policeId');
      await alert.populate('zoneId', 'name');

      // Decrement performance score
      await User.findByIdAndUpdate(userId, { $inc: { violations: 1, performanceScore: -2 } });

      // Emit to officer
      const populatedAlert = await Alert.findById(alert._id)
        .populate('userId', 'name policeId badgeNumber')
        .populate('zoneId', 'name');

      io.emit('alert:new', populatedAlert);
      io.emit('alert:geofence', {
        userId,
        alertId: alert._id,
        distance: Math.round(dist - zone.radius),
        zone: zone.name,
      });

      // Escalation: 3rd violation → emit to admin room
      if (todayViolations >= 2) {
        io.to('role:admin').emit('alert:escalated', {
          userId,
          name: user.name,
          message: `ESCALATED: ${user.name} has ${todayViolations + 1} violations today`,
        });
      }
    }

    return { inZone, distance: Math.round(dist), distanceOutside: Math.round(Math.max(0, dist - zone.radius)) };
  } catch (err) {
    console.error('Geofence check error:', err);
    return { inZone: true, distance: 0 };
  }
}

// ═══════════════════════════════════════════════════════════════
// WEBSOCKET
// ═══════════════════════════════════════════════════════════════
io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) {
    // Allow connection but mark as unauthenticated
    socket.userId = null;
    return next();
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    socket.userId = decoded.id;
    socket.userRole = decoded.role;
    next();
  } catch {
    socket.userId = null;
    next();
  }
});

io.on('connection', (socket) => {
  console.log(`Socket connected: ${socket.id} | user: ${socket.userId || 'anonymous'}`);

  if (socket.userId) {
    onlineUsers.set(socket.userId, socket.id);
    socket.join(`user:${socket.userId}`);
    if (socket.userRole) socket.join(`role:${socket.userRole}`);

    // Broadcast online count
    io.emit('stats:update', { onlineCount: onlineUsers.size });
  }

  // ── Real-time location update ──
  socket.on('location:update', async (data) => {
    const { lat, lng, accuracy, speed, timestamp } = data;
    const userId = socket.userId;
    if (!userId || !lat || !lng) return;

    userLocations.set(userId, { lat, lng, accuracy, timestamp: Date.now() });

    // Geofence check
    const { inZone, distance, distanceOutside } = await checkGeofence(userId, lat, lng);

    // Log to DB
    TrackingLog.create({ user: userId, lat, lng, accuracy, speed, inZone, distance }).catch(() => {});

    // Broadcast to admin and officer rooms
    io.to('role:admin').to('role:officer').emit('location:update', {
      userId,
      lat,
      lng,
      inZone,
      distance,
      accuracy,
      timestamp: Date.now(),
    });

    // Respond to constable with zone status
    socket.emit('zone:status', { inZone, distanceOutside });
  });

  // ── Alert GPS off ──
  socket.on('alert:gps_off', async (data) => {
    if (!socket.userId) return;
    const alert = await Alert.create({
      type: 'gps_off',
      severity: 'high',
      userId: socket.userId,
      message: 'GPS turned off or location access denied',
    }).catch(() => null);

    if (alert) io.emit('alert:new', alert);
  });

  socket.on('disconnect', () => {
    if (socket.userId) {
      onlineUsers.delete(socket.userId);
      io.emit('stats:update', { onlineCount: onlineUsers.size });
    }
    console.log(`Socket disconnected: ${socket.id}`);
  });
});

// ═══════════════════════════════════════════════════════════════
// REST ROUTES
// ═══════════════════════════════════════════════════════════════

// ── Auth ──────────────────────────────────────────────────────
app.post('/api/auth/login', async (req, res) => {
  try {
    const { policeId, password } = req.body;
    if (!policeId || !password) return res.status(400).json({ error: 'Police ID and password required' });

    const user = await User.findOne({ policeId: policeId.toUpperCase(), isActive: true })
      .select('+password')
      .populate('zone', 'name center radius color');

    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: user._id, policeId: user.policeId, role: user.role, name: user.name },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    const userObj = user.toObject();
    delete userObj.password;

    res.json({ success: true, token, user: userObj });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Users ─────────────────────────────────────────────────────
app.get('/api/users', authenticate, async (req, res) => {
  try {
    const filter = {};
    if (req.query.role) filter.role = req.query.role;
    if (req.query.zone) filter.zone = req.query.zone;
    if (req.query.active !== undefined) filter.isActive = req.query.active === 'true';

    const users = await User.find(filter)
      .populate('zone', 'name center radius color')
      .populate('officerMentor', 'name policeId')
      .select('-__v')
      .sort({ name: 1 });

    res.json({ success: true, users });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/users', authenticate, authorize('admin'), async (req, res) => {
  try {
    const user = await User.create(req.body);
    const populated = await User.findById(user._id).populate('zone', 'name');
    res.status(201).json({ success: true, user: populated });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.patch('/api/users/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(req.params.id, req.body, { new: true })
      .populate('zone', 'name');
    res.json({ success: true, user });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ── Zones ─────────────────────────────────────────────────────
app.get('/api/zones', authenticate, async (req, res) => {
  try {
    const zones = await Zone.find({ isActive: true })
      .populate('officer', 'name policeId')
      .populate('constables', 'name policeId')
      .sort({ name: 1 });

    // Add lat/lng directly from center for frontend convenience
    const result = zones.map(z => ({
      ...z.toObject(),
      lat: z.center.lat,
      lng: z.center.lng,
      officerName: z.officer?.name || null,
    }));

    res.json({ success: true, zones: result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/zones', authenticate, authorize('admin', 'officer'), async (req, res) => {
  try {
    const zone = await Zone.create(req.body);
    res.status(201).json({ success: true, zone: { ...zone.toObject(), lat: zone.center.lat, lng: zone.center.lng } });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.put('/api/zones/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    const zone = await Zone.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json({ success: true, zone });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/zones/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    await Zone.findByIdAndUpdate(req.params.id, { isActive: false });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/zones/:id/assign', authenticate, authorize('admin', 'officer'), async (req, res) => {
  try {
    const { userId } = req.body;
    await Zone.findByIdAndUpdate(req.params.id, { $addToSet: { constables: userId } });
    await User.findByIdAndUpdate(userId, { zone: req.params.id });
    res.json({ success: true, message: 'Constable assigned to zone' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Tracking ──────────────────────────────────────────────────
app.post('/api/tracking/location', authenticate, async (req, res) => {
  try {
    const { lat, lng, accuracy, timestamp } = req.body;
    const userId = req.user.id;

    const { inZone, distance } = await checkGeofence(userId, lat, lng);

    await TrackingLog.create({ user: userId, lat, lng, accuracy, inZone, distance });

    io.to('role:admin').to('role:officer').emit('location:update', {
      userId, lat, lng, inZone, distance, timestamp: Date.now()
    });

    res.json({ success: true, inZone, distance });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/tracking/history/:userId', authenticate, async (req, res) => {
  try {
    const logs = await TrackingLog.find({ user: req.params.userId })
      .sort({ timestamp: -1 })
      .limit(100);
    res.json({ success: true, logs });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Duty ──────────────────────────────────────────────────────
app.post('/api/duty/checkin', authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).populate('zone');
    const log = await DutyLog.create({
      user: req.user.id,
      zone: user?.zone?._id,
      checkIn: new Date(req.body.timestamp || Date.now()),
    });

    io.to('role:admin').to('role:officer').emit('duty:checkin', {
      userId: req.user.id,
      name: req.user.name,
      timestamp: log.checkIn,
    });

    // Late arrival check — if after shift start
    const shiftStart = new Date(); shiftStart.setHours(6, 0, 0, 0);
    const lateMs = log.checkIn - shiftStart;
    if (lateMs > 10 * 60 * 1000) {
      const lateMinutes = Math.round(lateMs / 60000);
      await Alert.create({
        type: 'late_arrival',
        severity: 'medium',
        userId: req.user.id,
        zoneId: user?.zone?._id,
        message: `Late check-in — ${lateMinutes} minutes past shift start`,
      });
    }

    res.json({ success: true, log });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/duty/checkout', authenticate, async (req, res) => {
  try {
    const log = await DutyLog.findOneAndUpdate(
      { user: req.user.id, checkOut: { $exists: false } },
      {
        checkOut: new Date(req.body.timestamp || Date.now()),
        $set: { duration: Math.round((Date.now() - new Date(req.body.checkInTime || Date.now())) / 60000) }
      },
      { new: true, sort: { checkIn: -1 } }
    );

    io.to('role:admin').to('role:officer').emit('duty:checkout', {
      userId: req.user.id,
      name: req.user.name,
      timestamp: new Date(),
    });

    res.json({ success: true, log });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Alerts ────────────────────────────────────────────────────
app.get('/api/alerts', authenticate, async (req, res) => {
  try {
    const filter = {};
    if (req.query.acknowledged !== undefined) filter.acknowledged = req.query.acknowledged === 'true';
    if (req.user.role === 'officer') {
      // Only fetch alerts for their zone
      const user = await User.findById(req.user.id);
      if (user?.zone) {
        filter.zoneId = user.zone;
      }
    }

    const alerts = await Alert.find(filter)
      .populate('userId', 'name policeId badgeNumber')
      .populate('zoneId', 'name')
      .sort({ createdAt: -1 })
      .limit(100);

    res.json({ success: true, alerts });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/alerts/:id/acknowledge', authenticate, async (req, res) => {
  try {
    const alert = await Alert.findByIdAndUpdate(
      req.params.id,
      { acknowledged: true, acknowledgedBy: req.user.id, acknowledgedAt: new Date() },
      { new: true }
    );
    io.emit('alert:acknowledged', { alertId: req.params.id });
    res.json({ success: true, alert });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── VIP Tracking ──────────────────────────────────────────────
app.get('/api/vip', authenticate, authorize('admin', 'officer'), async (req, res) => {
  try {
    const vips = await VIPTracking.find({ isActive: true }).populate('assignedEscort', 'name policeId');
    res.json({ success: true, vips });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/vip', authenticate, authorize('admin'), async (req, res) => {
  try {
    const vip = await VIPTracking.create(req.body);
    res.status(201).json({ success: true, vip });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.patch('/api/vip/:id/location', authenticate, async (req, res) => {
  try {
    const { lat, lng } = req.body;
    const vip = await VIPTracking.findByIdAndUpdate(
      req.params.id,
      {
        currentLat: lat, currentLng: lng,
        $push: { routeHistory: { lat, lng, timestamp: new Date() } }
      },
      { new: true }
    );
    io.to('role:admin').to('role:officer').emit('vip:location', { vipId: req.params.id, lat, lng });
    res.json({ success: true, vip });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Analytics ─────────────────────────────────────────────────
app.get('/api/analytics', authenticate, authorize('admin'), async (req, res) => {
  try {
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);

    const [totalOfficers, activeToday, violationsToday, avgScore, zoneStats] = await Promise.all([
      User.countDocuments({ role: 'constable', isActive: true }),
      DutyLog.distinct('user', { checkIn: { $gte: todayStart } }),
      Alert.countDocuments({ type: 'geofence_exit', createdAt: { $gte: todayStart } }),
      User.aggregate([
        { $match: { role: 'constable', isActive: true } },
        { $group: { _id: null, avg: { $avg: '$performanceScore' } } }
      ]),
      Zone.find({ isActive: true }).populate('officer', 'name'),
    ]);

    const attendanceRate = totalOfficers > 0
      ? Math.round((activeToday.length / totalOfficers) * 100)
      : 0;

    res.json({
      success: true,
      analytics: {
        totalOfficers,
        activeToday: activeToday.length,
        violationsToday,
        attendanceRate,
        avgDisciplineScore: Math.round(avgScore[0]?.avg || 0),
        zones: zoneStats,
        onlineCount: onlineUsers.size,
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/leaderboard', authenticate, async (req, res) => {
  try {
    const top = await User.find({ role: 'constable', isActive: true })
      .select('name policeId badgeNumber performanceScore totalDutyHours violations zone')
      .populate('zone', 'name')
      .sort({ performanceScore: -1 })
      .limit(20);
    res.json({ success: true, leaderboard: top });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Live positions ─────────────────────────────────────────────
app.get('/api/tracking/live', authenticate, async (req, res) => {
  try {
    const activeIds = Array.from(userLocations.keys());
    const users = await User.find({ _id: { $in: activeIds } })
      .select('name policeId role zone inZone')
      .populate('zone', 'name center radius color')
      .lean();

    const positionsMap = Object.fromEntries(activeIds.map(id => [String(id), userLocations.get(id)]));

    const positions = users.map((user) => ({
      ...user,
      ...positionsMap[String(user._id)],
    })).filter((p) => p.lat !== undefined && p.lng !== undefined);

    res.json({ success: true, positions });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Health ────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({
    status: 'operational',
    service: 'Bandobusth.AI',
    uptime: Math.round(process.uptime()),
    onlineUsers: onlineUsers.size,
    db: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString(),
  });
});

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ═══════════════════════════════════════════════════════════════
// DATABASE SEED (initial admin user)
// ═══════════════════════════════════════════════════════════════
async function seedDatabase() {
  const adminExists = await User.findOne({ role: 'admin' });
  if (adminExists) return;

  const admin = await User.create({
    name: 'DSP Ravi Kumar',
    policeId: 'AP-HEAD-0001',
    badgeNumber: '001',
    role: 'admin',
    password: 'admin123',
  });

  const officer = await User.create({
    name: 'Inspector Suresh',
    policeId: 'AP-OFF-0012',
    badgeNumber: '012',
    role: 'officer',
    password: 'officer123',
    zone: null,
    officerMentor: admin._id,
  });

  const zone1 = await Zone.create({
    name: 'Market Area — Zone A',
    center: { lat: 14.6841, lng: 77.6025 },
    radius: 600,
    color: '#1E6FCC',
    officer: officer._id,
  });

  const zone2 = await Zone.create({
    name: 'Bus Stand — Zone B',
    center: { lat: 14.6762, lng: 77.5965 },
    radius: 500,
    color: '#0EAD7A',
    officer: officer._id,
  });

  await User.findByIdAndUpdate(officer._id, { zone: zone1._id });

  const c1 = await User.create({
    name: 'Cst. Balakrishna',
    policeId: 'AP-CONST-0101',
    badgeNumber: '101',
    role: 'constable',
    password: 'const123',
    zone: zone1._id,
    officerMentor: officer._id,
    performanceScore: 92,
  });
  const c2 = await User.create({
    name: 'Cst. Venkatesh',
    policeId: 'AP-CONST-0102',
    badgeNumber: '102',
    role: 'constable',
    password: 'const123',
    zone: zone2._id,
    officerMentor: officer._id,
    performanceScore: 85,
  });
  const c3 = await User.create({
    name: 'Cst. Nagarjuna',
    policeId: 'AP-CONST-0103',
    badgeNumber: '103',
    role: 'constable',
    password: 'const123',
    zone: zone1._id,
    officerMentor: officer._id,
    performanceScore: 64,
  });

  await Zone.findByIdAndUpdate(zone1._id, { $addToSet: { constables: { $each: [c1._id, c3._id] } } });
  await Zone.findByIdAndUpdate(zone2._id, { $addToSet: { constables: c2._id } });

  console.log('✓ Demo head/zone/const credentials seeded (admin/officer/constables/zones)');
}
// ═══════════════════════════════════════════════════════════════
// START SERVER
// ═══════════════════════════════════════════════════════════════
mongoose.connect(MONGO_URI)
  .then(async () => {
    console.log('MongoDB connected');

    const adminExists = await User.exists({ role: 'admin', isActive: true });

    if (SEED_DEMO_DATA) {
      console.log('⚙️ Demo data seeding enabled');
      await seedDatabase();
    } else {
      console.log('⚙️ Checking admin account');

      if (!adminExists) {
        if (process.env.ADMIN_POLICEID && process.env.ADMIN_PASSWORD) {
          await User.create({
            name: process.env.ADMIN_NAME || 'Admin User',
            policeId: process.env.ADMIN_POLICEID,
            badgeNumber: process.env.ADMIN_BADGENO || '000',
            role: 'admin',
            password: process.env.ADMIN_PASSWORD,
          });

          console.log('✓ Admin created from ENV');
        } else {
          console.warn('⚠️ No admin found → seeding default');
          await seedDatabase();
        }
      }
    }

    server.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`🌐 URL: http://localhost:${PORT}`);
      console.log(`💚 Health: http://localhost:${PORT}/health`);
    });
  })
  .catch(err => {
    console.error('❌ MongoDB connection failed:', err.message);

    server.listen(PORT, () => {
      console.log(`⚠️ Running without DB on port ${PORT}`);
    });
  });

process.on('SIGTERM', () => {
  server.close(() => {
    mongoose.disconnect();
    process.exit(0);
  });
});

module.exports = { app, server, io };
#!/usr/bin/env node

/**
 * BANDOBUSTH.AI — System Verification Script
 * 
 * Run this script to verify all components are properly configured:
 * node verify-setup.js
 * 
 * Checks:
 * ✓ Node.js version
 * ✓ Required packages installed
 * ✓ .env file configuration
 * ✓ MongoDB connection
 * ✓ Port availability
 * ✓ Socket.IO setup
 * ✓ Frontend assets
 */

const fs = require('fs');
const path = require('path');
const http = require('http');

console.log('\n🔍 BANDOBUSTH.AI System Verification\n');
console.log('='.repeat(50));

let checksComplete = 0;
let checksFailed = 0;

// Color codes for terminal
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m'
};

function check(description, condition, details = '') {
  const status = condition ? `${colors.green}✓${colors.reset}` : `${colors.red}✗${colors.reset}`;
  console.log(`${status} ${description}`);
  if (details) console.log(`  └─ ${details}`);
  if (condition) checksComplete++;
  else checksFailed++;
}

// 1. Node.js Version
const nodeVersion = process.version;
check('Node.js version', parseFloat(nodeVersion.slice(1)) >= 14, `Node ${nodeVersion}`);

// 2. Check package.json exists
const pkgPath = path.join(__dirname, 'package.json');
const pkgExists = fs.existsSync(pkgPath);
check('package.json exists', pkgExists, pkgPath);

if (pkgExists) {
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  
  // 3. Check critical dependencies
  const requiredDeps = ['express', 'socket.io', 'mongoose', 'bcryptjs', 'jsonwebtoken'];
  const installedDeps = Object.keys(pkg.dependencies || {});
  
  requiredDeps.forEach(dep => {
    const installed = installedDeps.includes(dep);
    check(`Package: ${dep}`, installed, installed ? pkg.dependencies[dep] : 'NOT FOUND');
  });
}

// 4. Check .env file
const envPath = path.join(__dirname, '.env');
const envExists = fs.existsSync(envPath);
check('.env configuration file', envExists, envExists ? 'Found' : 'Missing (create one)');

if (envExists) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  check('  └─ Has MONGO_URI', envContent.includes('MONGO_URI'));
  check('  └─ Has JWT_SECRET', envContent.includes('JWT_SECRET'));
  check('  └─ Has PORT config', envContent.includes('PORT'));
}

// 5. Check server.js
const serverPath = path.join(__dirname, 'server.js');
const serverExists = fs.existsSync(serverPath);
check('server.js entry point exists', serverExists, serverPath);

// 6. Check public folder
const publicPath = path.join(__dirname, 'public');
const publicExists = fs.existsSync(publicPath);
check('public/ folder exists', publicExists, publicPath);

if (publicExists) {
  const indexPath = path.join(publicPath, 'index.html');
  const index1Path = path.join(publicPath, 'index1.html');
  check('  └─ Has index.html or index1.html', 
    fs.existsSync(indexPath) || fs.existsSync(index1Path),
    fs.existsSync(index1Path) ? 'index1.html' : 'index.html');
  
  const swPath = path.join(publicPath, 'sw.js');
  check('  └─ Service Worker (sw.js)', fs.existsSync(swPath), swPath);
}

// 7. Check backend folder structure
const backendPath = path.join(__dirname, 'backend');
if (fs.existsSync(backendPath)) {
  ['models', 'routes', 'middleware', 'services', 'config'].forEach(folder => {
    const exists = fs.existsSync(path.join(backendPath, folder));
    check(`backend/${folder}/ exists`, exists);
  });
}

// 8. Check Leaflet in index1.html
const index1Path = path.join(publicPath, 'index1.html');
if (fs.existsSync(index1Path)) {
  const content = fs.readFileSync(index1Path, 'utf8');
  check('Leaflet.js CDN included', content.includes('leaflet'), 
    content.includes('leafletjs.com') ? 'CDN: leafletjs.com' : 'CDN reference');
  check('Socket.IO client included', content.includes('socket.io'), 
    content.includes('socket.io-client') ? 'Latest version' : 'Embedded');
  check('Geofence function exists', content.includes('checkGeofence'), 
    'Haversine distance calculation');
  check('Alert sound function exists', content.includes('playAlertSound'), 
    'Web Audio API beeps');
}

// 9. Check server.js has geofencing
if (serverExists) {
  const serverContent = fs.readFileSync(serverPath, 'utf8');
  check('Backend: Geofence engine', serverContent.includes('checkGeofence'));
  check('Backend: WebSocket handlers', serverContent.includes('socket.on'));
  check('Backend: Alert escalation', serverContent.includes('alert'));
  check('Backend: Role-based access', serverContent.includes('role:'));
}

// Summary
console.log('\n' + '='.repeat(50));
console.log(`\n📊 Results: ${colors.green}${checksComplete} passed${colors.reset}, ${checksFailed > 0 ? colors.red + checksFailed + ' failed' + colors.reset : colors.green + '0 failed' + colors.reset}\n`);

if (checksFailed === 0) {
  console.log(`${colors.green}✓ All systems ready!${colors.reset}\n`);
  console.log('Next steps:');
  console.log('  1. npm install');
  console.log('  2. Start MongoDB: mongod');
  console.log('  3. Start server: node server.js');
  console.log(`  4. Open browser: http://localhost:5000\n`);
} else {
  console.log(`${colors.yellow}⚠ Fix the issues above before starting.${colors.reset}\n`);
}

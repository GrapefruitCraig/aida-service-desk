require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const path = require('path');

const agentRouter = require('./routes/agent');

const app = express();
app.set('trust proxy', 1);
const PORT = process.env.PORT || 3001;

// ── Security ──────────────────────────────────────────────────────────────
app.use(helmet({ contentSecurityPolicy: false }));

app.use(cors());

// ── Rate limiting ─────────────────────────────────────────────────────────
app.use('/api/agent/chat', rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30,
  message: { error: 'Too many requests — please wait a moment' },
}));

// ── Middleware ─────────────────────────────────────────────────────────────
app.use(express.json({ limit: '1mb' }));
if (process.env.NODE_ENV !== 'test') app.use(morgan('dev'));

// ── Routes ─────────────────────────────────────────────────────────────────
app.use('/api/agent', agentRouter);

app.get('/api/ping', (req, res) => res.json({ ok: true, version: '1.0.0' }));

// ── Serve frontend in production ───────────────────────────────────────────
if (process.env.NODE_ENV === 'production') {
  const frontendDist = path.join(__dirname, '../../frontend/dist');
  app.use(express.static(frontendDist));
  app.get('*', (req, res) => res.sendFile(path.join(frontendDist, 'index.html')));
}

// ── Error handler ──────────────────────────────────────────────────────────
app.use((err, req, res, _next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`\n🤖 AIDA Service Desk running on http://localhost:${PORT}`);
  console.log(`   Halo PSA: ${process.env.HALO_BASE_URL || '⚠ not configured'}`);
  console.log(`   NinjaRMM: ${process.env.NINJA_BASE_URL || 'https://eu.ninjarmm.com'}`);
  console.log(`   Claude:   claude-sonnet-4-20250514\n`);
});

module.exports = app;

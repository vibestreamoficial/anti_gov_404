import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { Server } from 'socket.io';
import pool from './db/connection.js';
import authRoutes from './routes/auth.js';
import chatRoutes from './routes/chat.js';
import adminRoutes from './routes/admin.js';
import ownerRoutes from './routes/owner.js';
import botRoutes from './routes/bot.js';

dotenv.config();

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'DELETE']
  }
});

app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static('.'));

app.use('/api/auth', authRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/owner', ownerRoutes);
app.use('/api/bot', botRoutes);

app.get('/api/health', (_, res) => {
  res.json({ ok: true, service: 'anti_gov_404' });
});

app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'Not found' });
  }
  res.sendFile(new URL('./index.html', import.meta.url).pathname);
});

io.on('connection', (socket) => {
  socket.on('join_room', (room) => {
    socket.join(room);
  });

  socket.on('send_message', async ({ room, message }) => {
    if (!room || !message) return;
    io.to(room).emit('message_received', message);
  });
});

async function initDatabase() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email VARCHAR(255) UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      nick VARCHAR(50) UNIQUE NOT NULL,
      role VARCHAR(20) NOT NULL DEFAULT 'member',
      status VARCHAR(20) NOT NULL DEFAULT 'pending',
      ban_reason TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS applications (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      reason TEXT,
      how TEXT,
      status VARCHAR(20) NOT NULL DEFAULT 'pending',
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS messages (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      nick VARCHAR(50),
      role VARCHAR(20) DEFAULT 'member',
      text TEXT NOT NULL,
      type VARCHAR(20) DEFAULT 'text',
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS bans (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      nick VARCHAR(50),
      reason TEXT,
      banned_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS blacklist_patterns (
      id SERIAL PRIMARY KEY,
      pattern TEXT NOT NULL,
      severity VARCHAR(20) DEFAULT 'high',
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);

  const { rows } = await pool.query('SELECT COUNT(*) AS total FROM blacklist_patterns');
  if (Number(rows[0].total) === 0) {
    await pool.query(`
      INSERT INTO blacklist_patterns (pattern, severity) VALUES
      ('ameaça', 'critical'),
      ('te mato', 'critical'),
      ('fake news', 'high'),
      ('acusação falsa', 'high'),
      ('gore', 'critical'),
      ('nudes de menor', 'critical'),
      ('vender coca', 'critical'),
      ('hackear banco', 'critical'),
      ('atentado', 'critical');
    `);
  }
}

const PORT = process.env.PORT || 3000;

server.listen(PORT, async () => {
  await initDatabase();
  console.log(`Anti Gov 404 running on http://localhost:${PORT}`);
});

export { io };

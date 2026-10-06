import express from 'express';
import pool from '../db/connection.js';
import { verifyToken, requireRole } from '../middleware/auth.js';

const router = express.Router();

router.get('/dashboard', verifyToken, requireRole('owner'), async (req, res) => {
  try {
    const users = await pool.query('SELECT COUNT(*) AS total FROM users');
    const messages = await pool.query('SELECT COUNT(*) AS total FROM messages');
    const bans = await pool.query("SELECT COUNT(*) AS total FROM users WHERE status = 'banned'");
    const admins = await pool.query("SELECT COUNT(*) AS total FROM users WHERE role = 'admin'");

    return res.json({
      users: Number(users.rows[0].total),
      messages: Number(messages.rows[0].total),
      bans: Number(bans.rows[0].total),
      admins: Number(admins.rows[0].total)
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro no painel do dono' });
  }
});

router.get('/recent-bans', verifyToken, requireRole('owner'), async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT b.*, u.email
      FROM bans b
      LEFT JOIN users u ON u.id = b.user_id
      ORDER BY b.created_at DESC
      LIMIT 20
    `);
    return res.json(result.rows);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao buscar registros' });
  }
});

export default router;

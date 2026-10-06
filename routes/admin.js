import express from 'express';
import pool from '../db/connection.js';
import { verifyToken, requireRole } from '../middleware/auth.js';

const router = express.Router();

router.get('/dashboard', verifyToken, requireRole('admin', 'owner'), async (req, res) => {
  try {
    const pending = await pool.query("SELECT COUNT(*) AS total FROM users WHERE status = 'pending'");
    const approved = await pool.query("SELECT COUNT(*) AS total FROM users WHERE status = 'approved'");
    const banned = await pool.query("SELECT COUNT(*) AS total FROM users WHERE status = 'banned'");
    const messages = await pool.query('SELECT COUNT(*) AS total FROM messages');

    return res.json({
      pending: Number(pending.rows[0].total),
      approved: Number(approved.rows[0].total),
      banned: Number(banned.rows[0].total),
      messages: Number(messages.rows[0].total)
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro no dashboard' });
  }
});

router.get('/pending', verifyToken, requireRole('admin', 'owner'), async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT u.id, u.email, u.nick, u.created_at, a.reason, a.how
      FROM users u
      LEFT JOIN applications a ON a.user_id = u.id AND a.status = 'pending'
      WHERE u.status = 'pending'
      ORDER BY u.created_at ASC
    `);
    return res.json(result.rows);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao buscar pendentes' });
  }
});

router.get('/members', verifyToken, requireRole('admin', 'owner'), async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, email, nick, role, status, ban_reason, created_at FROM users WHERE status = 'approved' ORDER BY created_at ASC"
    );
    return res.json(result.rows);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao buscar membros' });
  }
});

router.post('/approve/:id', verifyToken, requireRole('admin', 'owner'), async (req, res) => {
  try {
    await pool.query("UPDATE users SET status = 'approved' WHERE id = $1", [req.params.id]);
    await pool.query("UPDATE applications SET status = 'approved' WHERE user_id = $1", [req.params.id]);
    return res.json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao aprovar usuário' });
  }
});

router.post('/reject/:id', verifyToken, requireRole('admin', 'owner'), async (req, res) => {
  try {
    await pool.query("UPDATE users SET status = 'banned', ban_reason = 'Solicitação recusada' WHERE id = $1", [req.params.id]);
    await pool.query("UPDATE applications SET status = 'rejected' WHERE user_id = $1", [req.params.id]);
    return res.json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao recusar usuário' });
  }
});

router.post('/ban', verifyToken, requireRole('admin', 'owner'), async (req, res) => {
  try {
    const { userId, reason } = req.body;
    await pool.query("UPDATE users SET status = 'banned', ban_reason = $1 WHERE id = $2", [reason || 'Banido por administração', userId]);
    await pool.query('INSERT INTO bans (user_id, nick, reason, banned_by) VALUES ($1, (SELECT nick FROM users WHERE id = $2), $3, $4)', [userId, userId, reason || 'Banido por administração', req.user.id]);
    return res.json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao banir usuário' });
  }
});

router.post('/promote/:id', verifyToken, requireRole('owner'), async (req, res) => {
  try {
    await pool.query("UPDATE users SET role = 'admin' WHERE id = $1", [req.params.id]);
    return res.json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao promover usuário' });
  }
});

router.post('/clear-chat', verifyToken, requireRole('admin', 'owner'), async (req, res) => {
  try {
    await pool.query('DELETE FROM messages');
    return res.json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao limpar chat' });
  }
});

export default router;

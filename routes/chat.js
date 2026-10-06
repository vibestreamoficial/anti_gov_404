import express from 'express';
import pool from '../db/connection.js';
import { verifyToken, requireRole } from '../middleware/auth.js';
import { detectThreats } from '../bot/detector.js';

const router = express.Router();

router.get('/messages', verifyToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM messages ORDER BY created_at ASC LIMIT 200'
    );
    return res.json(result.rows);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao buscar mensagens' });
  }
});

router.post('/message', verifyToken, async (req, res) => {
  try {
    const user = req.user;
    const { text, type = 'text' } = req.body;

    if (!text || String(text).trim() === '') {
      return res.status(400).json({ error: 'Mensagem vazia' });
    }

    const resultUser = await pool.query(
      'SELECT id, nick, role, status FROM users WHERE id = $1',
      [user.id]
    );

    const currentUser = resultUser.rows[0];
    if (!currentUser || currentUser.status !== 'approved') {
      return res.status(403).json({ error: 'Usuário não aprovado' });
    }

    const threat = await detectThreats(String(text));
    if (threat.flagged) {
      await pool.query('UPDATE users SET status = $1, ban_reason = $2 WHERE id = $3', ['banned', 'Mensagem detectada como conteúdo proibido pelo bot.', currentUser.id]);
      await pool.query('INSERT INTO bans (user_id, nick, reason, banned_by) VALUES ($1, $2, $3, $4)', [currentUser.id, currentUser.nick, 'Mensagem detectada como conteúdo proibido pelo bot.', currentUser.id]);
      return res.status(400).json({ error: 'Mensagem bloqueada por segurança.' });
    }

    const insert = await pool.query(
      'INSERT INTO messages (user_id, nick, role, text, type) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [currentUser.id, currentUser.nick, currentUser.role, String(text), type]
    );

    return res.json({ message: insert.rows[0] });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao enviar mensagem' });
  }
});

router.delete('/message/:id', verifyToken, requireRole('admin', 'owner'), async (req, res) => {
  try {
    await pool.query('DELETE FROM messages WHERE id = $1', [req.params.id]);
    return res.json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao apagar mensagem' });
  }
});

export default router;

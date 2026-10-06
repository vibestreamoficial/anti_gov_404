import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pool from '../db/connection.js';

const router = express.Router();

function signToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, nick: user.nick, role: user.role },
    process.env.JWT_SECRET || 'troque_esta_chave_por_uma_aleatoria',
    { expiresIn: '7d' }
  );
}

router.post('/register', async (req, res) => {
  try {
    const { email, password, nick, reason, how } = req.body;

    if (!email || !password || !nick) {
      return res.status(400).json({ error: 'Email, senha e nick são obrigatórios' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Senha deve ter ao menos 6 caracteres' });
    }

    const emailCheck = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (emailCheck.rows.length > 0) {
      return res.status(400).json({ error: 'Este e-mail já está cadastrado' });
    }

    const nickCheck = await pool.query('SELECT id FROM users WHERE nick = $1', [nick]);
    if (nickCheck.rows.length > 0) {
      return res.status(400).json({ error: 'Este nick já está em uso' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const userResult = await pool.query(
      'INSERT INTO users (email, password_hash, nick, role, status) VALUES ($1, $2, $3, $4, $5) RETURNING id, email, nick, role, status',
      [email, passwordHash, nick, 'member', 'pending']
    );

    const user = userResult.rows[0];

    await pool.query(
      'INSERT INTO applications (user_id, reason, how, status) VALUES ($1, $2, $3, $4)',
      [user.id, reason || '', how || '', 'pending']
    );

    const token = signToken(user);
    return res.json({ token, user });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro no cadastro' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email e senha são obrigatórios' });
    }

    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    const user = result.rows[0];

    if (!user) {
      return res.status(401).json({ error: 'Credenciais inválidas' });
    }

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) {
      return res.status(401).json({ error: 'Credenciais inválidas' });
    }

    const safeUser = {
      id: user.id,
      email: user.email,
      nick: user.nick,
      role: user.role,
      status: user.status,
      ban_reason: user.ban_reason
    };

    const token = signToken(safeUser);
    return res.json({ token, user: safeUser });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro no login' });
  }
});

router.get('/me', async (req, res) => {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) return res.status(401).json({ error: 'Token ausente' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'troque_esta_chave_por_uma_aleatoria');
    const result = await pool.query('SELECT id, email, nick, role, status, ban_reason FROM users WHERE id = $1', [decoded.id]);
    if (!result.rows[0]) return res.status(404).json({ error: 'Usuário não encontrado' });
    return res.json({ user: result.rows[0] });
  } catch (err) {
    return res.status(401).json({ error: 'Token inválido' });
  }
});

export default router;

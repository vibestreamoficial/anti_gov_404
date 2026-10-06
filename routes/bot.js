import express from 'express';
import { detectThreats, detectFakeNews, detectFalseAccusations } from '../bot/detector.js';
import { verifyToken } from '../middleware/auth.js';

const router = express.Router();

router.post('/analyze', verifyToken, async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || String(text).trim() === '') {
      return res.status(400).json({ error: 'Texto obrigatório' });
    }

    const threats = await detectThreats(String(text));
    const fakeNews = await detectFakeNews(String(text));
    const falseAccusations = await detectFalseAccusations(String(text));

    return res.json({
      threats,
      fakeNews,
      falseAccusations,
      overall: threats.flagged || fakeNews.detected || falseAccusations.detected ? 'ALTA' : 'BAIXA'
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao analisar texto' });
  }
});

export default router;

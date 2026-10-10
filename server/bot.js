const SUSPICIOUS = [
  'matar', 'vou te matar', 'te mato', 'assassinar', 'explodir', 'bomba', 'atentado',
  'sequestro', 'estupro', 'estuprar', 'ameaça', 'ameaçar',
  'mentiroso', 'mentirosa', 'calúnia', 'difama', 'acusação falsa', 'fake news',
  'notícia falsa', 'boato falso',
  'se mata', 'suicida', 'inútil', 'idiota pra caralho',
  'ddos', 'doxx', 'doxxing', 'swat', 'raid'
];

function analyze(text) {
  const t = String(text || '').toLowerCase();
  const hits = SUSPICIOUS.filter((w) => t.includes(w));
  if (!hits.length) {
    return { flagged: false, reason: null, hits: [] };
  }
  let category = 'conteúdo suspeito';
  if (hits.some((h) => ['matar', 'bomba', 'explodir', 'atentado', 'sequestro'].some((x) => h.includes(x)))) {
    category = 'ameaça/violência';
  } else if (hits.some((h) => h.includes('fake') || h.includes('calún') || h.includes('difama') || h.includes('acusação'))) {
    category = 'acusação falsa / fake news';
  } else if (hits.some((h) => ['doxx', 'swat', 'ddos'].some((x) => h.includes(x)))) {
    category = 'abuso técnico';
  }
  return {
    flagged: true,
    reason: category + ' (' + hits.slice(0, 3).join(', ') + ')',
    hits
  };
}

module.exports = { analyze, SUSPICIOUS };

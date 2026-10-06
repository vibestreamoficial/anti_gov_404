export async function detectThreats(text) {
  const patterns = [
    { regex: /ameaça|ameaçar|vou te matar|te mato|explodir|bomba|atentado/gi, type: 'threat' },
    { regex: /hackear banco|clonar cartão|phishing|golpe pix/gi, type: 'fraud' },
    { regex: /terrorismo|violência|matar|assassinar/gi, type: 'violent' },
    { regex: /drogas ilegais|vender coca|vender maconha/gi, type: 'illegal_drugs' },
    { regex: /gore|sangue real|vídeo de morte|snuff/gi, type: 'graphic' }
  ];

  const matches = patterns.filter(item => item.regex.test(text));
  const flagged = matches.length > 0;

  return {
    flagged,
    matches: matches.map(item => item.type),
    risk: flagged ? 'HIGH' : 'LOW',
    reason: flagged ? 'Conteúdo proibido ou potencialmente perigoso detectado.' : 'Nenhum padrão crítico identificado.'
  };
}

export async function detectFakeNews(text) {
  const regexes = [
    /fake news|notícia falsa|mentira sobre|hoax|conspiração/gi,
    /sem fonte|sem provas|ninguém confirmou|revelação secreta/gi,
    /breaking news.*sem.*fonte|viral.*sem.*prova/gi
  ];

  const detected = regexes.some((re) => re.test(text));
  return {
    detected,
    risk: detected ? 'MEDIUM' : 'LOW',
    reason: detected ? 'Padrões de desinformação ou sensacionalismo detectados.' : 'Sem indícios fortes de fake news.'
  };
}

export async function detectFalseAccusations(text) {
  const regexes = [
    /acusação falsa|calúnia|difamação|sem provas|acusa.*sem.*evidência/gi,
    /\[pessoa\].*(criminoso|terrorista|pedófilo)/gi,
    /alguém.*culpado.*sem.*prova/gi
  ];

  const detected = regexes.some((re) => re.test(text));
  return {
    detected,
    risk: detected ? 'MEDIUM' : 'LOW',
    reason: detected ? 'Possível difamação ou acusação sem base documental.' : 'Sem indícios de calúnia.'
  };
}

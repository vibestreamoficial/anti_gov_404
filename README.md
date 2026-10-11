# anti_gov_404

Chat com formulário, painel admin e bot de moderação.

## Site (GitHub Pages)

**https://vibestreamoficial.github.io/anti_gov_404/**

### Ativar Pages (1 vez)

1. https://github.com/vibestreamoficial/anti_gov_404/settings/pages
2. Source → **Deploy from a branch**
3. Branch: **main** / Folder: **/ (root)**
4. Save

> GitHub Pages só mostra a **interface**. Chat/API de verdade precisam de `npm start` (Node + SQLite).

## Rodar chat real (local / VPS)

```bash
npm install
npm start
```

Abra: http://localhost:3000

**Admin:** `admin` / `admin123` (troque em produção)

## O que tem

- Formulário → aprovação admin → chat global
- Texto + foto
- Bot (ameaças, fake news, acusações)
- Admin sem permissão → **HTTP 405**
- SQLite em `data/` (não sobe no Git)

## Aviso

Uso sob responsabilidade de quem hospeda. Não use para atividade ilegal.

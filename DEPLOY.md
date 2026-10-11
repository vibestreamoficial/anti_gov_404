# Chat multi-usuário real (outras pessoas)

GitHub Pages = só interface no navegador de cada um.
Para várias pessoas usarem juntos: hospede o Node.

## Opção rápida: Railway (grátis)

1. Crie conta em https://railway.app
2. New Project → Deploy from GitHub repo → `vibestreamoficial/anti_gov_404`
3. Root / start: `npm install && npm start`
4. Variável opcional: `PORT` (Railway define sozinho)
5. Gere domínio público (Settings → Networking → Generate Domain)

Abra o link do Railway no celular/PC de qualquer pessoa.

## Local

```bash
npm install
npm start
```

http://localhost:3000

Admin: admin / admin123

## O que funciona multi-usuário

- Solicitar acesso
- Admin aprova
- Chat global + foto
- Bot de moderação
- SQLite no servidor (não no GitHub)

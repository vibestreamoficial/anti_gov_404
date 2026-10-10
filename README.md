# anti_gov_404

Chat real com formulário, painel admin e bot de moderação.

## Stack

- Node.js + Express + Socket.IO
- SQLite (`data/anti_gov_404.db` — **não** vai pro Git)
- Frontend em `public/`

## Rodar

```bash
npm install
npm start
```

Abra: http://localhost:3000

**Admin:** `admin` / `admin123`  
(troque a senha em produção)

## Fluxo

1. Usuário solicita acesso (register)
2. Fica **pending**
3. Admin aceita no painel
4. Usuário entra no **chat global** (texto + foto)
5. Bot marca ameaças / fake news / acusações

## Segurança

- Rota admin sem permissão → **HTTP 405**
- Banco e uploads no `.gitignore`

## GitHub Pages

Pages só serve estático. Este projeto precisa de Node (Railway, Render, VPS).

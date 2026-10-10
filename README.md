# anti_gov_404

Chat com formulário de entrada, aprovação por administrador e moderação automática.

## O que tem

- Formulário de solicitação de acesso
- Aprovação manual no painel admin
- Após aceitar → usuário entra no **chat global**
- Chat em tempo real (texto + foto)
- Painel administrador (aceitar, banir, apagar mensagens)
- Acesso não autorizado ao painel → **HTTP 405**
- Bot de moderação (ameaças, acusações falsas, fake news, conteúdo suspeito)

## Banco de dados

- Usa **SQLite** (arquivo local no servidor)
- O arquivo do banco **não fica no repositório** (veja `.gitignore`)
- **Não usa Supabase**

## Estrutura sugerida

```
anti_gov_404/
├── public/           # frontend (HTML/CSS/JS)
├── server/           # Node.js (API + Socket.IO)
├── data/             # SQLite (ignorado pelo git)
├── uploads/          # fotos do chat (ignorado pelo git)
├── .gitignore
├── package.json
└── README.md
```

## Como rodar (local)

```bash
npm install
npm start
```

Abra: `http://localhost:3000`

## Fluxo

1. Usuário preenche o **formulário**
2. Fica **pendente**
3. Admin **aceita** no painel
4. Usuário é direcionado ao **chat global**
5. Pode conversar e enviar **foto**
6. Bot analisa mensagens suspeitas

## Painel admin

- Rota protegida
- Sem permissão → resposta **405 Method Not Allowed**
- Senha/token **não** devem aparecer neste README

## GitHub Pages

GitHub Pages **só serve arquivo estático**.  
Para chat real + banco, o site precisa estar em um servidor Node (VPS, Railway, Render, etc.).

## Aviso

Projeto para comunicação e moderação.  
Não use para atividade ilegal. O uso é de responsabilidade de quem hospeda.

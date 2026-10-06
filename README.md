# anti_gov_404 — Site Real (Supabase)

Grupo privado com:

- Cadastro + login com e-mail e senha (Supabase Auth)
- Formulário de solicitação de entrada
- Aprovação manual pelo administrador
- Chat global em tempo real (texto + foto)
- Painel de administrador (banir, aceitar, apagar mensagens)
- Painel do dono (promover admins)
- Bot de moderação real (detecta ameaças, fake news, gore, conteúdo ilegal e bane)

**Tudo real** — dados no banco Supabase, multi-usuário, sem localStorage/simulação.

---

## 1. Criar projeto Supabase (grátis)

1. Acesse [https://supabase.com](https://supabase.com) e crie uma conta
2. **New project** → escolha nome, senha do banco e região
3. Espere o projeto ficar pronto (~1 min)

## 2. Rodar o schema SQL

1. No painel do Supabase: **SQL Editor** → New query
2. Cole **todo** o conteúdo do arquivo `supabase/schema.sql`
3. Clique em **Run**

## 3. Ativar Realtime

1. Vá em **Database → Replication** (ou Publications)
2. Ative as tabelas: `messages`, `applications`, `profiles`

## 4. Pegar as chaves e configurar o site

1. Vá em **Project Settings → API**
2. Copie:
   - **Project URL**
   - **anon public** key
3. Abra o arquivo `config.js` no repositório e cole:

```js
const SUPABASE_URL = "https://xxxxx.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOi...";
```

4. Commit e push (ou edite direto no GitHub)

## 5. Ativar GitHub Pages

1. Abra: https://github.com/vibestreamoficial/anti_gov_404/settings/pages
2. Source → **Deploy from a branch**
3. Branch: **main** / Folder: **/ (root)**
4. Save

Site: **https://vibestreamoficial.github.io/anti_gov_404/**

## 6. Tornar-se o DONO (obrigatório uma vez)

1. Acesse o site e **Cadastre** sua conta (e-mail + senha + nick + motivo)
2. No Supabase → **SQL Editor** rode (troque pelo seu e-mail):

```sql
update public.profiles
set role = 'owner', status = 'approved'
where email = 'seu-email@exemplo.com';
```

3. Saia e entre de novo no site → você será **owner** e verá o painel completo.

---

## Fluxo de uso

| Papel | O que faz |
|-------|-----------|
| Visitante | Vê regras → Cadastra / Login |
| Novo usuário | Fica **pending** até admin aprovar |
| Membro aprovado | Entra no chat, envia mensagens e fotos |
| Admin | Aceita/recusa, bane, apaga mensagens, limpa chat |
| Owner | Tudo do admin + promove membros a admin |
| Bot | Detecta padrões proibidos e bane automaticamente |

---

## Observações

- Confirmação de e-mail: por padrão o Supabase pode exigir. Em **Authentication → Providers → Email** você pode desativar "Confirm email" para testes.
- Fotos são salvas como base64 no banco (ok para demo; para produção use Supabase Storage).
- O bot roda no cliente antes de enviar. Para proteção extra no servidor dá para adicionar um Edge Function depois.

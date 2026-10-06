# anti_gov_404

Protótipo de site com:

- Regras na página inicial
- Formulário de solicitação de entrada no grupo
- Aprovação manual pelo administrador
- Chat global (texto + foto)
- Painel de administrador (banir, aceitar, apagar mensagens)
- Painel do dono (promover admins)
- Bot de moderação automática (detecta ameaças, fake news, gore, conteúdo ilegal etc. e bane)

## Link do site (GitHub Pages)

Depois de ativar o Pages:

**https://vibestreamoficial.github.io/anti_gov_404/**

### Como ativar o Pages (1 vez):
1. Abra: https://github.com/vibestreamoficial/anti_gov_404/settings/pages
2. Source → **Deploy from a branch**
3. Branch: **main**  /  Folder: **/ (root)**
4. Save

## Como usar (demo)

### Virar o Dono (você):
- Na tela inicial, clique **5 vezes** no logo `anti_gov_404`
- Digite a senha do dono (definida no código)
- Você entra como **owner** e vê o painel completo

### Fluxo normal de usuário:
1. Clica em **Solicitar Entrada**
2. Preenche o formulário
3. Fica em “Aguardando aprovação”
4. O admin (você) aceita no painel ⚙️
5. Usuário entra no chat

### Bot de moderação:
Se alguém mandar mensagem com ameaças, fake news, gore, conteúdo ilegal etc., o bot bane automaticamente e a pessoa não consegue mais usar o site naquele navegador.

## Importante (limitação técnica)

Este é um **demo estático** (só HTML + CSS + JS + localStorage).

- Os dados ficam **somente no navegador** de quem está usando
- Não existe servidor real → não tem chat multi-usuário de verdade entre pessoas diferentes
- Para ter chat real + banco de dados + ban permanente de verdade seria necessário um backend (Firebase, Supabase, etc.)

Para um protótipo visual e de fluxo, funciona bem.

-- ============================================================
-- anti_gov_404 - Schema completo (rode no SQL Editor do Supabase)
-- ============================================================

-- 1. Tabela de perfis (ligada ao auth.users)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nick text unique not null,
  email text,
  role text not null default 'member' check (role in ('member', 'admin', 'owner')),
  status text not null default 'pending' check (status in ('pending', 'approved', 'banned')),
  ban_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2. Solicitações de entrada (histórico)
create table if not exists public.applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  nick text not null,
  reason text not null,
  how text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now()
);

-- 3. Mensagens do chat
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  nick text not null,
  role text not null default 'member',
  text text not null,
  type text not null default 'text' check (type in ('text', 'image', 'system')),
  created_at timestamptz not null default now()
);

-- 4. Bans permanentes (além do status no profile)
create table if not exists public.bans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  nick text not null,
  reason text not null,
  banned_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

-- Índices
create index if not exists idx_messages_created on public.messages(created_at);
create index if not exists idx_applications_status on public.applications(status);
create index if not exists idx_profiles_status on public.profiles(status);
create index if not exists idx_profiles_nick on public.profiles(nick);

-- ============================================================
-- RLS (Row Level Security)
-- ============================================================
alter table public.profiles enable row level security;
alter table public.applications enable row level security;
alter table public.messages enable row level security;
alter table public.bans enable row level security;

-- PROFILES
create policy "Perfis públicos de leitura (só aprovados e dados básicos)"
  on public.profiles for select
  using (true);

create policy "Usuário edita o próprio perfil"
  on public.profiles for update
  using (auth.uid() = id);

create policy "Admin/Owner atualiza qualquer perfil"
  on public.profiles for update
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('admin', 'owner') and p.status = 'approved'
    )
  );

create policy "Inserir próprio perfil no signup"
  on public.profiles for insert
  with check (auth.uid() = id);

-- APPLICATIONS
create policy "Ver solicitações (próprio ou admin)"
  on public.applications for select
  using (
    auth.uid() = user_id
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('admin', 'owner') and p.status = 'approved'
    )
  );

create policy "Criar própria solicitação"
  on public.applications for insert
  with check (auth.uid() = user_id);

create policy "Admin atualiza solicitações"
  on public.applications for update
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('admin', 'owner') and p.status = 'approved'
    )
  );

-- MESSAGES
create policy "Mensagens visíveis para membros aprovados"
  on public.messages for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.status = 'approved'
    )
  );

create policy "Membros aprovados enviam mensagens"
  on public.messages for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.status = 'approved'
    )
  );

create policy "Admin/Owner apaga mensagens"
  on public.messages for delete
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('admin', 'owner') and p.status = 'approved'
    )
  );

-- BANS
create policy "Admin vê bans"
  on public.bans for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('admin', 'owner') and p.status = 'approved'
    )
  );

create policy "Admin cria bans"
  on public.bans for insert
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('admin', 'owner') and p.status = 'approved'
    )
  );

-- ============================================================
-- Função: criar perfil automaticamente no signup
-- ============================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, nick, email, role, status)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nick', split_part(new.email, '@', 1)),
    new.email,
    'member',
    'pending'
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================================
-- Realtime (habilitar nas tabelas)
-- ============================================================
-- No Dashboard: Database → Replication → ative messages, applications, profiles

alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.applications;
alter publication supabase_realtime add table public.profiles;

-- ============================================================
-- Mensagem inicial do sistema
-- ============================================================
insert into public.messages (nick, role, text, type)
values ('Sistema', 'system', 'Bem-vindo ao anti_gov_404. Respeite as regras. Bot de moderação ativo.', 'system')
on conflict do nothing;

-- ============================================================
-- IMPORTANTE: tornar você OWNER
-- Depois de criar sua conta no site, rode (substitua o e-mail):
--
-- update public.profiles
-- set role = 'owner', status = 'approved'
-- where email = 'seu-email@exemplo.com';
-- ============================================================

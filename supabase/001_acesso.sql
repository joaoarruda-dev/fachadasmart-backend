-- Fachada Smart — acesso, liberação manual e cota mensal
-- Rodar uma vez no Supabase: SQL Editor → New query → colar → Run.
-- Instalação nova: só este arquivo basta (já inclui o 002). O 002 é só para quem rodou a versão antiga do 001.

-- 1. Uma linha por empresa. Nasce "pending": só usa depois que o João libera.
create table if not exists public.profiles (
  id uuid primary key references auth.users on delete cascade,
  email text not null,
  company text,
  status text not null default 'pending' check (status in ('pending', 'active', 'blocked')),
  quota_previas int not null default 50,   -- por mês
  quota_limpezas int not null default 50,  -- por mês
  paid_until date,
  notes text,
  created_at timestamptz not null default now()
);

-- 2. Uma linha por chamada de IA que consome cota.
create table if not exists public.generations (
  id bigserial primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('previa', 'limpeza')),
  status text not null default 'reserved' check (status in ('reserved', 'done', 'failed')),
  image_url text,  -- URL da imagem gerada (R2), preenchida quando status = 'done'
  created_at timestamptz not null default now()
);
create index if not exists generations_user_month on public.generations (user_id, created_at);

-- 3. Só o backend (service_role) lê e escreve. Navegador não acessa as tabelas.
alter table public.profiles enable row level security;
alter table public.generations enable row level security;

-- 4. Cria o profile no cadastro.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email) values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- 5. Uso do mês corrente (falhas não contam).
create or replace function public.usage_this_month(p_user uuid)
returns table (kind text, used bigint)
language sql stable security definer set search_path = public as $$
  select g.kind, count(*) from public.generations g
  where g.user_id = p_user and g.status <> 'failed'
    and g.created_at >= date_trunc('month', now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo'
  group by g.kind;
$$;

-- 6. Reserva 1 crédito de forma atômica. Retorna o motivo da recusa ou o id da reserva.
create or replace function public.reserve_generation(p_user uuid, p_kind text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  p public.profiles;
  v_quota int;
  v_used int;
  v_id bigint;
begin
  select * into p from public.profiles where id = p_user for update;  -- trava contra chamadas simultâneas
  if not found then return jsonb_build_object('ok', false, 'code', 'pending'); end if;
  if p.status <> 'active' then return jsonb_build_object('ok', false, 'code', p.status); end if;

  v_quota := case p_kind when 'previa' then p.quota_previas else p.quota_limpezas end;
  select count(*) into v_used from public.generations
    where user_id = p_user and kind = p_kind and status <> 'failed'
      and created_at >= date_trunc('month', now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo';

  if v_used >= v_quota then
    return jsonb_build_object('ok', false, 'code', 'quota', 'used', v_used, 'quota', v_quota);
  end if;

  insert into public.generations (user_id, kind) values (p_user, p_kind) returning id into v_id;
  return jsonb_build_object('ok', true, 'id', v_id, 'used', v_used + 1, 'quota', v_quota);
end $$;

-- 7. Fecha a reserva: 'done' consome a cota e guarda a URL da imagem, 'failed' devolve.
create or replace function public.finish_generation(p_id bigint, p_status text, p_image_url text default null)
returns void
language sql security definer set search_path = public as $$
  update public.generations
     set status = p_status,
         image_url = coalesce(p_image_url, image_url)
   where id = p_id and status = 'reserved';
$$;

-- 8. Funções só para o backend.
revoke all on function public.usage_this_month(uuid) from public, anon, authenticated;
revoke all on function public.reserve_generation(uuid, text) from public, anon, authenticated;
revoke all on function public.finish_generation(bigint, text, text) from public, anon, authenticated;
grant execute on function public.usage_this_month(uuid) to service_role;
grant execute on function public.reserve_generation(uuid, text) to service_role;
grant execute on function public.finish_generation(bigint, text, text) to service_role;

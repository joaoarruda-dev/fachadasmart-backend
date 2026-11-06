-- Fachada Smart — guarda a URL da imagem gerada em cada geração concluída.
-- Rodar uma vez no Supabase: SQL Editor → New query → colar → Run (depois do 001).

alter table public.generations add column if not exists image_url text;

-- A assinatura muda (novo parâmetro), então remove a versão antiga antes
drop function if exists public.finish_generation(bigint, text);

create or replace function public.finish_generation(p_id bigint, p_status text, p_image_url text default null)
returns void
language sql security definer set search_path = public as $$
  update public.generations
     set status = p_status,
         image_url = coalesce(p_image_url, image_url)
   where id = p_id and status = 'reserved';
$$;

revoke all on function public.finish_generation(bigint, text, text) from public, anon, authenticated;
grant execute on function public.finish_generation(bigint, text, text) to service_role;

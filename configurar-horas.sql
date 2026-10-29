-- Execute uma vez no SQL Editor do mesmo projeto Supabase.
begin;
create table if not exists public.controle_horas_pessoas (
 email text primary key, nome text not null
);
create table if not exists public.controle_horas (
 id uuid primary key default gen_random_uuid(),
 usuario_email text not null references public.controle_horas_pessoas(email),
 entrada timestamp without time zone not null,
 saida timestamp without time zone not null,
 intervalo_minutos integer not null check(intervalo_minutos>=0),
 criado_por uuid not null default auth.uid() references auth.users(id),
 criado_em timestamptz not null default now(),
 check(saida>entrada),
 check(extract(epoch from(saida-entrada))/60>=intervalo_minutos)
);
alter table public.controle_horas_pessoas enable row level security;
alter table public.controle_horas enable row level security;
drop policy if exists horas_pessoas_ler on public.controle_horas_pessoas;
create policy horas_pessoas_ler on public.controle_horas_pessoas for select to authenticated using(public.controle_autorizado());
drop policy if exists horas_ler on public.controle_horas;
create policy horas_ler on public.controle_horas for select to authenticated using(public.controle_autorizado());
drop policy if exists horas_inserir on public.controle_horas;
create policy horas_inserir on public.controle_horas for insert to authenticated with check(public.controle_autorizado() and criado_por=auth.uid());
drop policy if exists horas_excluir on public.controle_horas;
create policy horas_excluir on public.controle_horas for delete to authenticated using(public.controle_autorizado() and (criado_por=auth.uid() or lower(auth.jwt()->>'email')='alvaro.batistella@method-flow.com'));
grant select on public.controle_horas_pessoas to authenticated;
grant select,insert,delete on public.controle_horas to authenticated;
create or replace function public.controle_horas_sincronizar(p_usuarios jsonb)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if not public.controle_autorizado() or lower(coalesce(auth.jwt()->>'email',''))<>'alvaro.batistella@method-flow.com' then
  raise exception 'Somente o administrador pode atualizar a lista';
 end if;
 if jsonb_typeof(p_usuarios)<>'array' then raise exception 'Lista inválida'; end if;
 insert into public.controle_horas_pessoas(email,nome)
 select lower(trim(x->>'email')),coalesce(nullif(trim(x->>'nome'),''),x->>'email') from jsonb_array_elements(p_usuarios) x where coalesce(trim(x->>'email'),'')<>''
 on conflict(email) do update set nome=excluded.nome;
end; $$;
revoke all on function public.controle_horas_sincronizar(jsonb) from public;
grant execute on function public.controle_horas_sincronizar(jsonb) to authenticated;
commit;

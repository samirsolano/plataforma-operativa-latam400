-- ========================================================
-- LOGIN SEGURO — usuarios_app (proyecto rmlilqdhxbhpwkysucaz)
-- ========================================================
-- Antes el login descargaba la contraseña al navegador y la
-- comparaba ahí, así que usuarios_app tenía que ser legible por
-- anon con las contraseñas en texto plano. Ahora:
--   - login_usuario() y cambiar_password() validan en Supabase.
--   - Las contraseñas se guardan cifradas (bcrypt, pgcrypto).
--   - anon ya no puede leer la columna password.
--
-- Se aplica en dos fases para no cortar el login en producción:
-- FASE A antes de publicar el JS nuevo, FASE B después.

-- ========================================================
-- FASE A: funciones (aceptan texto plano y bcrypt)
-- ========================================================

create or replace function public.login_usuario(p_usuario text, p_password text)
returns table(id uuid, usuario text, nombre_completo text, rol text, activo boolean)
language plpgsql security definer set search_path = ''
as $$
begin
    return query
    select u.id, u.usuario, u.nombre_completo, u.rol, u.activo
    from public.usuarios_app u
    where u.usuario = p_usuario
      and case when u.password ~ '^\$2[aby]\$'
               then u.password = extensions.crypt(p_password, u.password)
               else u.password = p_password end;
end;
$$;

create or replace function public.cambiar_password(p_id uuid, p_usuario text, p_actual text, p_nueva text)
returns boolean
language plpgsql security definer set search_path = ''
as $$
declare
    v_id uuid;
begin
    if p_nueva is null or length(p_nueva) < 4 then
        return false;
    end if;

    select u.id into v_id
    from public.usuarios_app u
    where (case when p_id is not null then u.id = p_id else u.usuario = p_usuario end)
      and case when u.password ~ '^\$2[aby]\$'
               then u.password = extensions.crypt(p_actual, u.password)
               else u.password = p_actual end;

    if v_id is null then
        return false;
    end if;

    update public.usuarios_app
    set password = extensions.crypt(p_nueva, extensions.gen_salt('bf'))
    where id = v_id;

    return true;
end;
$$;

revoke all on function public.login_usuario(text, text) from public;
revoke all on function public.cambiar_password(uuid, text, text, text) from public;
grant execute on function public.login_usuario(text, text) to anon, authenticated;
grant execute on function public.cambiar_password(uuid, text, text, text) to anon, authenticated;

-- ========================================================
-- FASE B: cifrar, ocultar la columna y activar RLS
-- ========================================================

-- El módulo Usuarios sigue mandando la contraseña en texto plano
-- al crear/editar; este trigger la cifra antes de guardarla.
create or replace function public.cifrar_password_usuario()
returns trigger
language plpgsql set search_path = ''
as $$
begin
    if new.password !~ '^\$2[aby]\$' then
        new.password := extensions.crypt(new.password, extensions.gen_salt('bf'));
    end if;
    return new;
end;
$$;

drop trigger if exists trg_cifrar_password on public.usuarios_app;
create trigger trg_cifrar_password
    before insert or update of password on public.usuarios_app
    for each row execute function public.cifrar_password_usuario();

-- Cifra las que ya existen (el trigger lo hace al tocar la columna).
update public.usuarios_app set password = password
where password !~ '^\$2[aby]\$';

-- anon puede leer todo menos password (centro-proyectos-latam lee dni).
revoke select on public.usuarios_app from anon, authenticated;
grant select (id, usuario, dni, nombre_completo, rol, activo, created_at)
    on public.usuarios_app to anon, authenticated;

-- Permisivas a propósito, igual que el resto: el módulo Usuarios
-- crea/edita/borra con la publishable key. Cerrar esto de verdad
-- requiere Supabase Auth.
alter table public.usuarios_app enable row level security;

drop policy if exists "anon lee usuarios_app" on public.usuarios_app;
drop policy if exists "anon inserta usuarios_app" on public.usuarios_app;
drop policy if exists "anon actualiza usuarios_app" on public.usuarios_app;
drop policy if exists "anon elimina usuarios_app" on public.usuarios_app;

create policy "anon lee usuarios_app" on public.usuarios_app
    for select to anon using (true);
create policy "anon inserta usuarios_app" on public.usuarios_app
    for insert to anon with check (true);
create policy "anon actualiza usuarios_app" on public.usuarios_app
    for update to anon using (true) with check (true);
create policy "anon elimina usuarios_app" on public.usuarios_app
    for delete to anon using (true);

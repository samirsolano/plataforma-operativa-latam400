-- ========================================
-- PUENTE SAP <-> SUPABASE (proyecto WMS Dashboard)
-- ========================================
-- La web pide una ejecución con sap_solicitar_comando(); el script
-- tools/puente-sap/puente-sap.ps1 (en la PC con SAP abierto) la toma,
-- baja los datos de SAP y los sube con las funciones sap_puente_*.
-- El puente se identifica con un token cuyo hash vive en
-- sap_puente_tokens (sin políticas: solo lo leen estas funciones).

-- ---------- TABLAS ----------

create table if not exists public.sap_comandos (
    id            bigint generated always as identity primary key,
    comando       text not null check (comando in ('monitor_guias', 'ping')),
    parametros    jsonb not null default '{}'::jsonb,
    estado        text not null default 'pendiente'
                  check (estado in ('pendiente', 'en_proceso', 'ok', 'error')),
    solicitado_por text,
    equipo        text,
    filas         integer,
    mensaje       text,
    creado_en     timestamptz not null default now(),
    iniciado_en   timestamptz,
    terminado_en  timestamptz
);

create index if not exists sap_comandos_estado_idx
    on public.sap_comandos (estado, creado_en);

create table if not exists public.sap_guias (
    id               bigint generated always as identity primary key,
    comando_id       bigint not null references public.sap_comandos (id) on delete cascade,
    fo               text,
    entrega          text,
    serie            text,
    correlativo      text,
    transporte       text,
    placa            text,
    licencia         text,
    conductor        text,
    transportista_id text,
    transportista    text,
    cliente_id       text,
    cliente          text,
    peso             numeric,
    destino          text,
    org_ventas       text,
    cargado_en       timestamptz not null default now()
);

create index if not exists sap_guias_comando_idx on public.sap_guias (comando_id);

create table if not exists public.sap_puente_estado (
    equipo         text primary key,
    ultimo_latido  timestamptz not null default now()
);

create table if not exists public.sap_puente_tokens (
    hash       text primary key,
    equipo     text not null,
    activo     boolean not null default true,
    creado_en  timestamptz not null default now()
);

-- ---------- RLS ----------
-- La web (clave publicable) solo LEE comandos, guías y estado del
-- puente. Crear comandos y escribir datos va siempre por funciones.

alter table public.sap_comandos      enable row level security;
alter table public.sap_guias         enable row level security;
alter table public.sap_puente_estado enable row level security;
alter table public.sap_puente_tokens enable row level security;

drop policy if exists sap_comandos_lectura on public.sap_comandos;
create policy sap_comandos_lectura on public.sap_comandos
    for select to anon, authenticated using (true);

drop policy if exists sap_guias_lectura on public.sap_guias;
create policy sap_guias_lectura on public.sap_guias
    for select to anon, authenticated using (true);

drop policy if exists sap_puente_estado_lectura on public.sap_puente_estado;
create policy sap_puente_estado_lectura on public.sap_puente_estado
    for select to anon, authenticated using (true);

-- ---------- WEB: SOLICITAR ----------

create or replace function public.sap_solicitar_comando(
    p_comando text,
    p_parametros jsonb default '{}'::jsonb,
    p_solicitado_por text default null
) returns bigint
language plpgsql security definer set search_path = ''
as $$
declare
    v_id    bigint;
    v_desde date;
    v_hasta date;
    v_fos   jsonb;
begin
    if p_comando not in ('monitor_guias', 'ping') then
        raise exception 'Comando no permitido: %', p_comando;
    end if;

    p_parametros := coalesce(p_parametros, '{}'::jsonb);

    if p_comando = 'monitor_guias' then
        v_fos := p_parametros -> 'fos';

        if v_fos is not null then
            if jsonb_typeof(v_fos) <> 'array' or jsonb_array_length(v_fos) = 0
               or jsonb_array_length(v_fos) > 1000 then
                raise exception 'La lista de FO debe tener entre 1 y 1000 elementos';
            end if;
            if exists (select 1 from jsonb_array_elements_text(v_fos) f
                       where f !~ '^[0-9]{1,20}$') then
                raise exception 'Las FO solo pueden tener dígitos';
            end if;
            p_parametros := jsonb_build_object('fos', v_fos);
        else
            v_desde := (p_parametros ->> 'fecha_desde')::date;
            v_hasta := (p_parametros ->> 'fecha_hasta')::date;
            if v_desde is null or v_hasta is null then
                raise exception 'Indica fecha_desde y fecha_hasta, o una lista de FO';
            end if;
            if v_hasta < v_desde or v_hasta - v_desde > 31 then
                raise exception 'El rango de fechas debe ser de 0 a 31 días';
            end if;
            p_parametros := jsonb_build_object(
                'fecha_desde', v_desde, 'fecha_hasta', v_hasta);
        end if;
    else
        p_parametros := '{}'::jsonb;
    end if;

    if exists (select 1 from public.sap_comandos
               where comando = p_comando
                 and estado in ('pendiente', 'en_proceso')) then
        raise exception 'Ya hay un "%" pendiente o en proceso', p_comando;
    end if;

    insert into public.sap_comandos (comando, parametros, solicitado_por)
    values (p_comando, p_parametros, left(p_solicitado_por, 120))
    returning id into v_id;

    return v_id;
end;
$$;

-- ---------- PUENTE ----------

create or replace function public.sap_puente_validar(p_token text)
returns text
language plpgsql security definer set search_path = ''
as $$
declare
    v_equipo text;
begin
    select equipo into v_equipo
    from public.sap_puente_tokens
    where activo and hash = encode(sha256(convert_to(coalesce(p_token, ''), 'UTF8')), 'hex');

    if v_equipo is null then
        raise exception 'Token de puente inválido' using errcode = '28000';
    end if;

    return v_equipo;
end;
$$;

-- Marca latido y toma el comando pendiente más antiguo (o nada).
create or replace function public.sap_puente_tomar(p_token text)
returns setof public.sap_comandos
language plpgsql security definer set search_path = ''
as $$
declare
    v_equipo text := public.sap_puente_validar(p_token);
begin
    insert into public.sap_puente_estado (equipo, ultimo_latido)
    values (v_equipo, now())
    on conflict (equipo) do update set ultimo_latido = excluded.ultimo_latido;

    -- Comandos que quedaron colgados (p.ej. se cerró el puente a mitad)
    update public.sap_comandos
       set estado = 'error', terminado_en = now(),
           mensaje = 'Sin respuesta del puente por más de 15 minutos'
     where estado = 'en_proceso' and iniciado_en < now() - interval '15 minutes';

    return query
    update public.sap_comandos c
       set estado = 'en_proceso', iniciado_en = now(), equipo = v_equipo
     where c.id = (select id from public.sap_comandos
                   where estado = 'pendiente'
                   order by creado_en
                   limit 1
                   for update skip locked)
    returning c.*;
end;
$$;

create or replace function public.sap_puente_guardar_guias(
    p_token text, p_comando_id bigint, p_filas jsonb
) returns integer
language plpgsql security definer set search_path = ''
as $$
declare
    v_n integer;
begin
    perform public.sap_puente_validar(p_token);

    if not exists (select 1 from public.sap_comandos
                   where id = p_comando_id and estado = 'en_proceso') then
        raise exception 'El comando % no está en proceso', p_comando_id;
    end if;

    insert into public.sap_guias (
        comando_id, fo, entrega, serie, correlativo, transporte, placa,
        licencia, conductor, transportista_id, transportista,
        cliente_id, cliente, peso, destino, org_ventas)
    select p_comando_id, r.fo, r.entrega, r.serie, r.correlativo, r.transporte,
           r.placa, r.licencia, r.conductor, r.transportista_id, r.transportista,
           r.cliente_id, r.cliente, r.peso, r.destino, r.org_ventas
    from jsonb_to_recordset(p_filas) as r(
        fo text, entrega text, serie text, correlativo text, transporte text,
        placa text, licencia text, conductor text, transportista_id text,
        transportista text, cliente_id text, cliente text, peso numeric,
        destino text, org_ventas text);

    get diagnostics v_n = row_count;
    return v_n;
end;
$$;

create or replace function public.sap_puente_terminar(
    p_token text, p_comando_id bigint, p_estado text,
    p_filas integer default null, p_mensaje text default null
) returns void
language plpgsql security definer set search_path = ''
as $$
begin
    perform public.sap_puente_validar(p_token);

    if p_estado not in ('ok', 'error') then
        raise exception 'Estado final inválido: %', p_estado;
    end if;

    update public.sap_comandos
       set estado = p_estado, filas = p_filas,
           mensaje = left(p_mensaje, 2000), terminado_en = now()
     where id = p_comando_id and estado = 'en_proceso';
end;
$$;

-- sap_puente_validar es interna: nadie la llama directo.
revoke execute on function public.sap_puente_validar(text) from public, anon, authenticated;

grant execute on function public.sap_solicitar_comando(text, jsonb, text) to anon, authenticated;
grant execute on function public.sap_puente_tomar(text) to anon, authenticated;
grant execute on function public.sap_puente_guardar_guias(text, bigint, jsonb) to anon, authenticated;
grant execute on function public.sap_puente_terminar(text, bigint, text, integer, text) to anon, authenticated;

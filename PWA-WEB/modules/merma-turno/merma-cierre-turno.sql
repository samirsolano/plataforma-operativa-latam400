-- ========================================
-- MÓDULO "MERMA POR TURNO" — cierre de turno. Corre esto UNA VEZ en el
-- SQL Editor de WMS Dashboard (iaitqquphjohgsmelhcj), después de
-- merma-turno.sql.
-- ========================================
-- Flujo por turno:
--   - Turno abierto: lo que registran los auxiliares en Centro de
--     Proyectos queda con cruce_id = null.
--   - "CERRAR MERMA" (Plataforma): llama a merma_cerrar_turno(). Si
--     queda algún cambio PENDIENTE en la ruta de los auxiliares, no
--     cierra. Si no, crea un cierre (fila en merma_cruces) y le pasa
--     todas las líneas del turno abierto. El turno de relevo empieza
--     en blanco y sigue registrando normal (cruce_id = null).
--   - Sobre el cierre se hace el cruce con SAP (merma_sap), la
--     validación física (merma_validacion), el cruce final y el
--     Monitor. Nada se borra: solo deja de verse en el turno abierto.

-- El cierre existe antes de pegar SAP, así que la unidad de
-- manipulación se llena después (null permitido; sigue siendo única).
alter table public.merma_cruces alter column unidad_manipulacion drop not null;
alter table public.merma_cruces add column if not exists cerrado_at timestamptz not null default now();
alter table public.merma_cruces add column if not exists cerrado_por text;
alter table public.merma_cruces add column if not exists lineas int;

alter table public.merma_registros add column if not exists cruce_id bigint
    references public.merma_cruces (id) on delete set null;

create index if not exists merma_registros_cruce_idx on public.merma_registros (cruce_id);

-- Todo o nada: revisa pendientes, crea el cierre y le asigna las
-- líneas del turno abierto dentro de la misma transacción. El lock
-- evita que dos personas cierren a la vez.
create or replace function public.merma_cerrar_turno(p_usuario text)
returns public.merma_cruces
language plpgsql
security definer
set search_path = public
as $$
declare
    v_pendientes int;
    v_lineas int;
    v_cierre public.merma_cruces;
begin

    perform pg_advisory_xact_lock(hashtext('merma_cerrar_turno'));

    select count(*) filter (where estado <> 'HECHO'), count(*)
      into v_pendientes, v_lineas
      from public.merma_registros
     where cruce_id is null;

    if v_lineas = 0 then
        raise exception 'SIN_REGISTROS';
    end if;

    if v_pendientes > 0 then
        raise exception 'PENDIENTES:%', v_pendientes;
    end if;

    insert into public.merma_cruces (fecha, desde, hasta, grupo, grupo_filtro, cargado_por, cerrado_por, cerrado_at, lineas)
    select (now() at time zone 'America/Lima')::date,
           min(fecha), max(fecha),
           string_agg(distinct grupo, ' / '),
           '',
           p_usuario, p_usuario, now(), count(*)
      from public.merma_registros
     where cruce_id is null
    returning * into v_cierre;

    update public.merma_registros
       set cruce_id = v_cierre.id
     where cruce_id is null;

    return v_cierre;

end;
$$;

grant execute on function public.merma_cerrar_turno(text) to anon;

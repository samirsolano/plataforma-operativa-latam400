-- ========================================
-- ARREGLO DEL TIMEOUT AL GUARDAR PLANIFICACIÓN RECURSOS
-- Corre esto UNA VEZ (completo) en el SQL Editor del proyecto Supabase
-- de Planificación y Avance (iaitqquphjohgsmelhcj).
-- No borra datos. Mejor correrlo cuando nadie esté subiendo data SAP.
-- ========================================
-- Causa (2026-10-02): al guardar una fila de turno_colaboradores con un
-- usuario cambiado, el trigger trg_sync_tareas_sap_por_cambio_turno
-- hace un UPDATE sobre tareas_almacen_sap (~1 millón de filas)
-- filtrando por expresiones CASE sobre fecha/hora_confirmacion y por
-- confirmado_por. Ninguna de esas columnas tenía índice → recorría la
-- tabla entera → "statement timeout".
--
-- Además se corrige un error de cruce: "usuario_turno" puede tener
-- varios usuarios separados por coma ("E_A,E_B"), pero los triggers lo
-- comparaban con "=" contra un solo usuario, así que esas tareas nunca
-- se asignaban a nadie.

-- ---------- 1) ÍNDICES ----------

-- Lo que usa el UPDATE del trigger de sincronización
create index if not exists idx_tareas_almacen_sap_confirmado_por_fecha
    on public.tareas_almacen_sap (confirmado_por, fecha_confirmacion);

-- Lo que usa calcular_auxiliar_sap por cada tarea
create index if not exists idx_turno_colaboradores_fecha_turno
    on public.turno_colaboradores (fecha, turno);

-- Hora x Hora / Dashboard / Diálogo Diario / Productividad
create index if not exists idx_tareas_almacen_sap_fecha
    on public.tareas_almacen_sap (fecha);

-- ---------- 2) CALCULAR AUXILIAR (por cada tarea SAP) ----------
-- Igual que antes, pero:
--  - reconoce usuario_turno con varios usuarios separados por coma;
--  - si hay más de una coincidencia, prefiere quien tiene ese usuario
--    asignado para el turno (sobre el usuario fijo) y quien está activo
--    (antes "limit 1" sin orden elegía cualquiera).
create or replace function public.calcular_auxiliar_sap()
 returns trigger
 language plpgsql
as $function$
declare
  v_fecha date;
  v_turno text;
  v_usuario text;
begin

  v_usuario := new.confirmado_por;

  v_fecha := case
    when new.hora_confirmacion is null then new.fecha_confirmacion
    when extract(hour from new.hora_confirmacion) < 7 then new.fecha_confirmacion - 1
    else new.fecha_confirmacion
  end;

  v_turno := case
    when new.hora_confirmacion is null then null::text
    when extract(hour from new.hora_confirmacion) >= 7
     and extract(hour from new.hora_confirmacion) <= 18 then 'DIA'::text
    else 'NOCHE'::text
  end;

  new.auxiliar := (
    select tc.nombre_completo
    from turno_colaboradores tc
    where tc.fecha = v_fecha
      and tc.turno = v_turno
      and (
        v_usuario = any(string_to_array(replace(coalesce(tc.usuario_turno, ''), ' ', ''), ','))
        or tc.usuario_fijo = v_usuario
      )
    order by
      (v_usuario = any(string_to_array(replace(coalesce(tc.usuario_turno, ''), ' ', ''), ','))) desc,
      tc.activo desc,
      tc.id desc
    limit 1
  );

  return new;

end;
$function$;

-- ---------- 3) SINCRONIZAR AL CAMBIAR EL TURNO ----------
-- Misma lógica, pero filtrando primero por confirmado_por y por
-- fecha_confirmacion (columnas con índice) — la tarea de un turno con
-- fecha F siempre se confirma el día F o F+1 (turno noche) — y luego
-- con la fórmula exacta de fecha/turno de antes.
create or replace function public.sync_tareas_sap_por_cambio_turno()
 returns trigger
 language plpgsql
as $function$
declare
  v_usuarios text[];
begin

  -- Solo actuamos si cambió algo que afecta el cruce
  if (new.fecha is distinct from old.fecha)
     or (new.turno is distinct from old.turno)
     or (new.usuario_turno is distinct from old.usuario_turno)
     or (new.usuario_fijo is distinct from old.usuario_fijo) then

    v_usuarios := array_remove(array_remove(
        string_to_array(replace(coalesce(old.usuario_turno, ''), ' ', ''), ',')
        || string_to_array(replace(coalesce(new.usuario_turno, ''), ' ', ''), ',')
        || array[old.usuario_fijo, new.usuario_fijo],
      null), '');

    if coalesce(array_length(v_usuarios, 1), 0) = 0 then
      return new;
    end if;

    update public.tareas_almacen_sap t
    set auxiliar = auxiliar  -- no-op: solo dispara el BEFORE trigger que recalcula de verdad
    where
      t.confirmado_por = any(v_usuarios)
      and t.fecha_confirmacion in (old.fecha, old.fecha + 1, new.fecha, new.fecha + 1)
      and
      (case
         when t.hora_confirmacion is null then t.fecha_confirmacion
         when extract(hour from t.hora_confirmacion) < 7 then t.fecha_confirmacion - 1
         else t.fecha_confirmacion
       end) in (old.fecha, new.fecha)
      and
      (case
         when t.hora_confirmacion is null then null::text
         when extract(hour from t.hora_confirmacion) >= 7
          and extract(hour from t.hora_confirmacion) <= 18 then 'DIA'::text
         else 'NOCHE'::text
       end) in (old.turno, new.turno);

  end if;

  return new;

end;
$function$;

analyze public.tareas_almacen_sap;
analyze public.turno_colaboradores;

-- ---------- 4) COMPROBACIÓN ----------
-- Debe aparecer "Index Scan" o "Bitmap Index Scan" usando
-- idx_tareas_almacen_sap_confirmado_por_fecha (no "Seq Scan").
explain
select id from public.tareas_almacen_sap t
where t.confirmado_por = any(array['E_VSANTI', 'E_VSANTIH'])
  and t.fecha_confirmacion in (date '2026-10-01', date '2026-10-02');

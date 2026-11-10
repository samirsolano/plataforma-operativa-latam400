-- ========================================
-- OPTIMIZACIÓN: CRON "refrescar-auxiliar-sap" + DIÁLOGO DIARIO
-- Proyecto Supabase WMS Dashboard (iaitqquphjohgsmelhcj).
-- No borra datos ni cambia ningún resultado.
-- ========================================
-- Causa (2026-11-03): el cron refrescar-auxiliar-sap corre cada 15 min
-- y reescribía TODAS las tareas de los últimos 7 días (~26,000 filas,
-- 11-14 s cada vez), aunque el auxiliar no cambiara: el trigger
-- trg_llenar_auxiliar_tarea ya lo recalcula en cada UPDATE y pisa lo
-- que pone el cron. Eran ~2.5 millones de escrituras al día; mientras
-- corría, los reportes que leen la tabla (Diálogo Diario, Hora x Hora,
-- Productividad) pasaban el límite de 3 s de la clave pública
-- ("statement timeout" → error 500), y la tabla se inflaba.
--
-- El cron sigue haciendo falta: trg_sync_tareas_sap_por_cambio_turno
-- solo reacciona a UPDATE de turno_colaboradores, no a altas ni bajas.

-- ---------- 1) EL CÁLCULO DEL AUXILIAR, EN UN SOLO LUGAR ----------
-- Misma lógica que tenía calcular_auxiliar_sap() (ver
-- arreglo-trigger-auxiliar-sap.sql), ahora como función para que el
-- trigger y el cron usen exactamente la misma.
create or replace function public.auxiliar_sap_calculado(
    p_fecha_confirmacion date,
    p_hora_confirmacion time,
    p_usuario text
)
 returns text
 language sql
 stable
as $function$
    select tc.nombre_completo
    from public.turno_colaboradores tc
    where tc.fecha = case
            when p_hora_confirmacion is null then p_fecha_confirmacion
            when extract(hour from p_hora_confirmacion) < 7 then p_fecha_confirmacion - 1
            else p_fecha_confirmacion
          end
      and tc.turno = case
            when p_hora_confirmacion is null then null::text
            when extract(hour from p_hora_confirmacion) >= 7
             and extract(hour from p_hora_confirmacion) <= 18 then 'DIA'::text
            else 'NOCHE'::text
          end
      and (
        p_usuario = any(string_to_array(replace(coalesce(tc.usuario_turno, ''), ' ', ''), ','))
        or tc.usuario_fijo = p_usuario
      )
    order by
      (p_usuario = any(string_to_array(replace(coalesce(tc.usuario_turno, ''), ' ', ''), ','))) desc,
      tc.activo desc,
      tc.id desc
    limit 1;
$function$;

create or replace function public.calcular_auxiliar_sap()
 returns trigger
 language plpgsql
as $function$
begin

  new.auxiliar := public.auxiliar_sap_calculado(
    new.fecha_confirmacion, new.hora_confirmacion, new.confirmado_por
  );

  return new;

end;
$function$;

-- ---------- 2) CRON: SOLO LAS TAREAS CUYO AUXILIAR CAMBIA ----------
-- "set auxiliar = auxiliar" solo dispara el trigger, que recalcula.
-- Revisar las ~26,000 filas cuesta ~0.2 s; antes se reescribían todas.
    job_id := (select jobid from cron.job where jobname = 'refrescar-auxiliar-sap'),
    command := $cron$
    update public.tareas_almacen_sap t
    set auxiliar = auxiliar
    where t.fecha_confirmacion >= current_date - interval '7 days'
      and t.auxiliar is distinct from public.auxiliar_sap_calculado(
            t.fecha_confirmacion, t.hora_confirmacion, t.confirmado_por);
  $cron$
);

-- ---------- 3) ÍNDICE PARA DIÁLOGO DIARIO ----------
-- resumen_diario_sap suma tn por fecha/turno/proceso: con este índice
-- lo resuelve leyendo solo el índice, sin tocar la tabla.
create index if not exists idx_tareas_almacen_sap_resumen
    on public.tareas_almacen_sap (fecha, turno, proceso) include (tn);

analyze public.tareas_almacen_sap;

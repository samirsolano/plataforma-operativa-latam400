-- ========================================
-- FUNCIÓN "resumen_productividad_sap" — para el Resumen de
-- Productividad (top de colaboradores por rango de fechas). Corre
-- esto UNA VEZ en el SQL Editor del proyecto Supabase de
-- Planificación y Avance (iaitqquphjohgsmelhcj). Mismo criterio que
-- resumen-diario-sap.sql: suma del lado del servidor en vez de traer
-- las filas crudas de tareas_almacen_sap (inviable para un rango de
-- varias semanas), acá agrupado por colaborador en vez de por día.

-- tareas_almacen_sap ya pasó las 220,000 filas y (como dice
-- resumen-diario-sap.sql) no tiene índice para filtrar por fecha —
-- toda consulta que filtra por rango de fecha barre la tabla entera.
-- Con el "count(distinct ...)" que agrega esta función (más caro que
-- el simple "sum" de resumen_diario_sap) eso ya excede el
-- statement_timeout de Postgres y la función falla siempre
-- ("canceling statement due to statement timeout"), sin importar el
-- tamaño del rango pedido. Este índice es lo que faltaba: acota el
-- scan al rango de fecha antes de agrupar, y de paso acelera también
-- resumen_diario_sap y obtener_hora_x_hora (misma tabla, mismo
-- filtro por fecha). Seguro de correr en cualquier momento — no
-- cambia ni borra datos.
create index if not exists idx_tareas_almacen_sap_fecha
    on public.tareas_almacen_sap (fecha);

-- "dias" = cantidad de fechas distintas en las que ese colaborador
-- tuvo tareas de ese proceso dentro del rango — sirve para calcular
-- el promedio de TN por día trabajado en vez de solo el total
-- acumulado (que premia más los días trabajados que la eficiencia).

-- "horas" = cantidad de franjas fecha+hora distintas con al menos
-- una tarea de ese proceso — mismo campo "hora" (0-23) que ya usa
-- Hora x Hora (obtener_hora_x_hora) sobre esta misma tabla. Sirve
-- para el promedio de TN por hora trabajada.

-- Postgres no permite cambiar las columnas de salida de una función
-- con "create or replace" — hay que borrarla primero (ya existía con
-- 4 columnas de salida, ahora son 5).
drop function if exists public.resumen_productividad_sap(date, date);

create or replace function public.resumen_productividad_sap(p_desde date, p_hasta date)
returns table (auxiliar text, proceso text, tn numeric, dias bigint, horas bigint)
language sql
stable
as $$
    select auxiliar, proceso, sum(tn) as tn, count(distinct fecha) as dias,
           count(distinct (fecha, hora)) as horas
    from public.tareas_almacen_sap
    where fecha >= p_desde
      and fecha <= p_hasta
      and auxiliar is not null
    group by auxiliar, proceso
    order by tn desc;
$$;

grant execute on function public.resumen_productividad_sap(date, date) to anon;

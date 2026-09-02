-- ========================================
-- FUNCIÓN "resumen_productividad_sap" — para el Resumen de
-- Productividad (top de colaboradores por rango de fechas). Corre
-- esto UNA VEZ en el SQL Editor del proyecto Supabase de
-- Planificación y Avance (iaitqquphjohgsmelhcj). Mismo criterio que
-- resumen-diario-sap.sql: suma del lado del servidor en vez de traer
-- las filas crudas de tareas_almacen_sap (inviable para un rango de
-- varias semanas), acá agrupado por colaborador en vez de por día.

-- "dias" = cantidad de fechas distintas en las que ese colaborador
-- tuvo tareas de ese proceso dentro del rango — sirve para calcular
-- el promedio de TN por día trabajado en vez de solo el total
-- acumulado (que premia más los días trabajados que la eficiencia).
create or replace function public.resumen_productividad_sap(p_desde date, p_hasta date)
returns table (auxiliar text, proceso text, tn numeric, dias bigint)
language sql
stable
as $$
    select auxiliar, proceso, sum(tn) as tn, count(distinct fecha) as dias
    from public.tareas_almacen_sap
    where fecha >= p_desde
      and fecha <= p_hasta
      and auxiliar is not null
    group by auxiliar, proceso
    order by tn desc;
$$;

grant execute on function public.resumen_productividad_sap(date, date) to anon;

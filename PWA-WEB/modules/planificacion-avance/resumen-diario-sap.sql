-- ========================================
-- FUNCIÓN "resumen_diario_sap" — para el histórico (gráfico lineal)
-- de Diálogo Diario. Corre esto UNA VEZ en el SQL Editor del proyecto
-- Supabase de Planificación y Avance (iaitqquphjohgsmelhcj).
-- ========================================
-- Traer todas las filas crudas de un mes (~120,000 filas solo entre
-- agosto y septiembre) es inviable para graficar en el navegador.
-- Esta función suma del lado del servidor y devuelve una fila por
-- día+turno+proceso — liviana (unos cientos de filas para un mes),
-- no cambia ni borra nada de la tabla original.
-- "tareas_almacen_sap" no tenía índice para filtrar/ordenar por rango
-- de fecha (por eso el resto de reportes de Planificación y Avance
-- se ponía cada vez más lento a medida que crecía la tabla, hasta
-- llegar a colgarse). Ver el índice idx_tareas_almacen_sap_fecha en
-- resumen-productividad-sap.sql — corre ese índice UNA VEZ y
-- beneficia a esta función también.

create or replace function public.resumen_diario_sap(p_desde date)
returns table (fecha date, turno text, proceso text, tn numeric)
language sql
stable
as $$
    select fecha, turno, proceso, sum(tn) as tn
    from public.tareas_almacen_sap
    where fecha >= p_desde
    group by fecha, turno, proceso
    order by fecha asc;
$$;

grant execute on function public.resumen_diario_sap(date) to anon;

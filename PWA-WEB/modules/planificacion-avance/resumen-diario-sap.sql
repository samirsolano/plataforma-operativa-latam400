-- ========================================
-- FUNCIÓN "resumen_diario_sap" — para el histórico (gráfico lineal)
-- de Diálogo Diario. Corre esto UNA VEZ en el SQL Editor del proyecto
-- Supabase de Planificación y Avance (iaitqquphjohgsmelhcj).
-- ========================================
-- "tareas_almacen_sap" no tiene índice para filtrar/ordenar por rango
-- de fecha, y traer todas las filas crudas de un mes (~120,000 filas
-- solo entre agosto y septiembre) es inviable para graficar en el
-- navegador. Esta función suma del lado del servidor y devuelve una
-- fila por día+turno+proceso — liviana (unos cientos de filas para
-- un mes), no cambia ni borra nada de la tabla original.

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

-- ========================================
-- MÓDULO "ESTADO DE VIAJES" — script para correr en el SQL Editor
-- del proyecto Supabase (el mismo que usa "Toma de Lote Farmacia":
-- rmlilqdhxbhpwkysucaz).
-- ========================================
-- Agrega el campo "estado" a la tabla farmacia_viajes_activados
-- (que ya existe y tiene datos reales — por eso es un ALTER, no un
-- CREATE). Reemplaza el viejo modelo binario (sin fila = Disponible,
-- con fila = Activado) por 3 estados explícitos:
--
--   desactivado -> se puede reemplazar (volver a subir el Excel de
--                  ese viaje). Es el estado por defecto de un viaje
--                  recién cargado.
--   activo      -> en uso, bloqueado: no se puede reemplazar, hay
--                  que desactivarlo primero.
--   finalizado  -> cerrado. "Guardar" (archivar a una base global y
--                  limpiarlo de las tablas activas) queda pendiente
--                  de implementar más adelante.
--
-- Las filas que YA existían representan viajes activados bajo el
-- modelo viejo, así que se migran a estado='activo'.

alter table public.farmacia_viajes_activados
    add column if not exists estado text not null default 'desactivado';

update public.farmacia_viajes_activados
    set estado = 'activo'
    where estado = 'desactivado';

alter table public.farmacia_viajes_activados
    drop constraint if exists farmacia_viajes_activados_estado_check;

alter table public.farmacia_viajes_activados
    add constraint farmacia_viajes_activados_estado_check
    check (estado in ('activo', 'desactivado', 'finalizado'));

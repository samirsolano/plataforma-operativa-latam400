-- ========================================
-- MÓDULO "FECHA DE CITA" — script para correr en el SQL Editor
-- del proyecto Supabase (el mismo que usa "Toma de Lote Farmacia":
-- rmlilqdhxbhpwkysucaz).
-- ========================================
-- La plantilla de "1. Carga y Viajes" cambia la columna "N° CITA"
-- (número) por "FECHA DE CITA" (fecha). farmacia_data ya existe con
-- datos reales, por eso es un ALTER (agrega la columna nueva; no se
-- borra "n_cita" para no perder el histórico ya cargado con el
-- formato viejo, aunque la plantilla actual ya no la use).

alter table public.farmacia_data
    add column if not exists fecha_cita date;

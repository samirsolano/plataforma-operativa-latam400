-- ========================================
-- "BASE DE DATOS" (VIAJES GUARDADOS) — script para correr UNA VEZ en el
-- SQL Editor del proyecto Supabase de "Toma de Lote Farmacia"
-- (rmlilqdhxbhpwkysucaz) ANTES de publicar la versión de la app que
-- trae la pestaña "Base de Datos". Se puede correr más de una vez.
-- ========================================
-- Cuando un viaje está Finalizado, el botón "Guardar" (menú ⋮ de
-- Viajes Generados) toma una foto de TODA su información (plantilla,
-- lecturas, resumen por código, OC Portal, MARA, canal por OC, stock
-- físico SAP, cruce, data final y cruce de lotes) y la guarda aquí,
-- UNA fila por viaje. Luego borra ese viaje de las tablas de trabajo.
-- Desde la pestaña "Base de Datos" se descarga todo en un solo Excel.
--
-- "datos" guarda las hojas del Excel ya armadas:
--   { "version": 1, "hojas": [ { "nombre", "encabezados": [...], "filas": [[...]] } ] }

create table if not exists public.farmacia_viajes_guardados (
    viaje bigint primary key,
    fecha_cita date,
    ocs text,
    total_ocs integer,
    total_codigos integer,
    cantidad_programada numeric,
    cantidad_atendida numeric,
    cantidad_registrada numeric,
    total_lecturas integer,
    guardado_por text,
    guardado_en timestamptz not null default now(),
    datos jsonb not null
);

alter table public.farmacia_viajes_guardados enable row level security;

drop policy if exists "farmacia_viajes_guardados_select_anon" on public.farmacia_viajes_guardados;
drop policy if exists "farmacia_viajes_guardados_insert_anon" on public.farmacia_viajes_guardados;

create policy "farmacia_viajes_guardados_select_anon" on public.farmacia_viajes_guardados
    for select to anon using (true);
create policy "farmacia_viajes_guardados_insert_anon" on public.farmacia_viajes_guardados
    for insert to anon with check (true);

-- Al guardar, además de lo que ya borra "Eliminar viaje", se limpian el
-- canal de sus OC y el registro de Data Final exportada. Si esas tablas
-- no tenían política de DELETE para "anon", se crea aquí.
drop policy if exists "oc_canal_delete_anon" on public.oc_canal;
create policy "oc_canal_delete_anon" on public.oc_canal
    for delete to anon using (true);

drop policy if exists "data_final_generada_delete_anon" on public.data_final_generada;
create policy "data_final_generada_delete_anon" on public.data_final_generada
    for delete to anon using (true);

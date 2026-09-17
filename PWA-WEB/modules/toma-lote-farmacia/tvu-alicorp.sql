-- ========================================
-- MÓDULO "TVU ALICORP" — script para correr en el SQL Editor
-- del proyecto Supabase (el mismo que usa "Toma de Lote Farmacia":
-- rmlilqdhxbhpwkysucaz).
-- ========================================
-- Agrega el campo TVU (Tiempo de Vida Útil, en meses) a la tabla
-- mara_alicorp (basado en "Revision_TVU_Farma.xlsx": Mat, Des, TVU
-- — "Mat" es el mismo código de mara_alicorp.codigo). Es un ALTER
-- porque la tabla ya existe con datos reales.

alter table public.mara_alicorp
    add column if not exists tvu numeric;

-- La carga del TVU actualiza filas existentes (PATCH), no solo
-- inserta — mara_alicorp.sql nunca creó una política de UPDATE
-- para "anon" (solo select/insert/delete), así que hace falta
-- agregarla o el PATCH queda bloqueado por RLS.

drop policy if exists "mara_alicorp_update_anon" on public.mara_alicorp;

create policy "mara_alicorp_update_anon" on public.mara_alicorp
    for update to anon using (true) with check (true);

-- ========================================
-- MÓDULO "EDITAR CANTIDAD SOLICITADA" — script para correr en el SQL
-- Editor del proyecto Supabase (el mismo que usa "Toma de Lote
-- Farmacia": rmlilqdhxbhpwkysucaz), SOLO SI el botón ✎ de "Ctd.
-- Solicitada" del Resumen por Código da error de permisos.
-- ========================================
-- farmacia_data hasta ahora solo se insertaba/eliminaba desde la app
-- (nunca se actualizaba una fila existente), así que es posible que
-- nunca se le haya creado una política de UPDATE para "anon". Sin
-- esa política, el PATCH queda bloqueado por RLS aunque el botón se
-- vea bien en la app.

drop policy if exists "farmacia_data_update_anon" on public.farmacia_data;

create policy "farmacia_data_update_anon" on public.farmacia_data
    for update to anon using (true) with check (true);

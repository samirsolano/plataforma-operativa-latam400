-- ========================================
-- "CTD. ATENDIDA" — script para correr UNA VEZ en el SQL Editor del
-- proyecto Supabase de "Toma de Lote Farmacia" (rmlilqdhxbhpwkysucaz)
-- ANTES de publicar la versión de la app que muestra las 3 cantidades
-- (Programada / Atendida / Registrada) en el Resumen por Código.
-- ========================================
-- Ctd. Programada = farmacia_data.cantidad (lo que pide SAP; ya no se
-- edita desde la app).
-- Ctd. Atendida   = farmacia_data.cantidad_atendida (lo que realmente
-- sale). Vacía (NULL) significa "igual a la programada"; solo se llena
-- cuando alguien la ajusta con el botón ✎ (por ejemplo, no hay stock y
-- sale una caja menos).
-- Ctd. Registrada = suma de farmacia_lecturas.cantidad_cajas (lo que
-- sube el auxiliar), se compara contra la Atendida.

alter table public.farmacia_data
    add column if not exists cantidad_atendida numeric;

-- El ✎ hace UPDATE sobre farmacia_data; si la política no existe aún
-- (ver farmacia-data-editar.sql), se crea aquí también.
drop policy if exists "farmacia_data_update_anon" on public.farmacia_data;

create policy "farmacia_data_update_anon" on public.farmacia_data
    for update to anon using (true) with check (true);

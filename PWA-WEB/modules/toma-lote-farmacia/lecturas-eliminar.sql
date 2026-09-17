-- ========================================
-- MÓDULO "ELIMINAR LECTURA" — script para correr en el SQL Editor
-- del proyecto Supabase (el mismo que usa "Toma de Lote Farmacia":
-- rmlilqdhxbhpwkysucaz), SOLO SI el botón "Eliminar" del Resumen por
-- Código en "2. Lecturas y Evidencias" da error de permisos.
-- ========================================
-- farmacia_lecturas ya existe (la llena la app de escaneo), pero es
-- posible que nunca se le haya creado una política de DELETE para
-- "anon" (solo se usó para insertar/leer). Sin esa política, el
-- DELETE queda bloqueado por RLS aunque el botón se vea bien en la
-- app.

drop policy if exists "farmacia_lecturas_delete_anon" on public.farmacia_lecturas;

create policy "farmacia_lecturas_delete_anon" on public.farmacia_lecturas
    for delete to anon using (true);

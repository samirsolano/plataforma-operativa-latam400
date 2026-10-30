-- ========================================================
-- BASE DE COLABORADORES — estado (vacaciones)
-- Correr una sola vez en el SQL Editor del proyecto Supabase
-- "iaitqquphjohgsmelhcj" (donde ya vive matrix_colaboradores, creada
-- con sql/matrix_colaboradores.sql del repo Centro de Proyectos).
--
-- Agrega el estado de cada persona: ACTIVO o VACACIONES, con fecha
-- de retorno opcional. Quien está en VACACIONES no se carga en el
-- equipo del Checklist de Higiene. Sin esto el módulo igual lista,
-- agrega, edita y elimina — solo fallan los botones de vacaciones.
-- ========================================================

alter table matrix_colaboradores
    add column if not exists estado text not null default 'ACTIVO';

alter table matrix_colaboradores
    add column if not exists vacaciones_hasta date;

alter table matrix_colaboradores
    drop constraint if exists matrix_colaboradores_estado_check;

alter table matrix_colaboradores
    add constraint matrix_colaboradores_estado_check
    check (estado in ('ACTIVO','VACACIONES'));

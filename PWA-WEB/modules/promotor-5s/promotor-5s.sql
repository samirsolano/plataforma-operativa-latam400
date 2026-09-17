-- ========================================
-- MÓDULO "PROMOTOR 5S" — script para correr en el
-- SQL Editor del proyecto Supabase de Check List 5S
-- (iaitqquphjohgsmelhcj, el mismo que colaboradores_activos,
-- fotos_colaboradores, preguntas_checklist, etc.)
-- ========================================
-- Este proyecto no tiene migraciones ni ORM: cada tabla se crea a
-- mano en el dashboard de Supabase. Corre este script una sola vez.
--
-- Es una tabla independiente de "colaboradores_activos" (mismo
-- shape: zona/pasillo/turno/dni/nombre) porque el Promotor 5S de un
-- pasillo y turno no siempre es la misma persona que su Responsable
-- de limpieza — se administra aparte, desde el módulo "Promotor 5S"
-- (botón "Cargar desde Colaboradores Activos" para partir con el
-- mismo roster y ajustar solo lo que cambie). La foto de cada
-- promotor sigue viniendo de "fotos_colaboradores" por DNI, igual
-- que en el resto de la app — no se duplica acá.

create table if not exists public.promotores_5s (

    id bigint generated always as identity primary key,

    zona text not null,
    pasillo text not null,
    turno text not null check (turno in ('DIA','INTERMEDIO','NOCHE')),

    dni text not null,
    nombre text not null,

    activo boolean not null default true,
    updated_at timestamptz not null default now(),

    unique (zona, pasillo, turno)

);

create index if not exists idx_promotores_5s_pasillo on public.promotores_5s (zona, pasillo);

-- ========================================
-- RLS — mismas políticas permisivas que el resto del proyecto
-- (colaboradores_activos, fotos_colaboradores, etc.): se leen/escriben
-- desde el navegador con la publishable key (anon), sin backend
-- propio. El control real de quién puede editar vive en el front
-- (shared/auth.js + sesion.rol === "Administrador"/"Supervisor"),
-- no acá.
-- ========================================

alter table public.promotores_5s enable row level security;

drop policy if exists "promotores_5s_anon_rw" on public.promotores_5s;

create policy "promotores_5s_anon_rw" on public.promotores_5s
    for all to anon using (true) with check (true);

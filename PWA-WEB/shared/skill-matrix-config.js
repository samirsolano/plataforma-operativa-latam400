// ========================================
// SUPABASE DEL MÓDULO "SKILL MATRIX"
// ========================================
// Usa el mismo proyecto Supabase que "Planificación y Avance" /
// "Reconocimiento" (iaitqquphjohgsmelhcj) — ver modules/skill-matrix/
// skill-matrix.sql para el detalle de las 3 tablas.

const SUPABASE_URL_SKILL = "https://iaitqquphjohgsmelhcj.supabase.co/rest/v1";
const SUPABASE_KEY_SKILL = "sb_publishable_rvEz02miPj1MrBVgLd_auw_FlyrVscs";

async function skillFetch(ruta, opciones = {}){

    const headers = Object.assign(
        {
            apikey: SUPABASE_KEY_SKILL,
            Authorization: "Bearer " + SUPABASE_KEY_SKILL,
            "Content-Type": "application/json"
        },
        opciones.headers || {}
    );

    const respuesta = await fetch(
        SUPABASE_URL_SKILL + ruta,
        Object.assign({ cache: "no-store" }, opciones, { headers })
    );

    if(!respuesta.ok){
        const detalle = await respuesta.text();
        throw new Error(detalle || "Error al conectar con Supabase");
    }

    const texto = await respuesta.text();
    return texto ? JSON.parse(texto) : null;

}

// Supabase/PostgREST limita cada respuesta a 1000 filas por defecto —
// se pagina con el header Range hasta traer todo (skill_matrix_niveles
// tiene ~8000+ filas).
async function skillFetchTodo(ruta){

    const TAMANO_PAGINA = 1000;
    let desde = 0;
    let todas = [];

    while(true){

        const pagina = await skillFetch(ruta, {
            headers: { Range: desde + "-" + (desde + TAMANO_PAGINA - 1) }
        });

        if(!pagina || !pagina.length){
            break;
        }

        todas = todas.concat(pagina);

        if(pagina.length < TAMANO_PAGINA){
            break;
        }

        desde += TAMANO_PAGINA;

    }

    return todas;

}

// ========================================
// NIVELES: 0-Sin evaluar · 1-Necesita entrenamiento · 2-Entrenado ·
// 3-Multiplicador · 4-No aplica (ver skill-matrix.sql para el detalle
// de cómo se validó esta escala contra el Excel original).
// ========================================

const NIVELES_SKILL_MATRIX = [
    { valor: 0, etiqueta: "Sin evaluar", clase: "nivel-0" },
    { valor: 1, etiqueta: "Necesita entrenamiento", clase: "nivel-1" },
    { valor: 2, etiqueta: "Entrenado", clase: "nivel-2" },
    { valor: 3, etiqueta: "Multiplicador", clase: "nivel-3" },
    { valor: 4, etiqueta: "No aplica", clase: "nivel-4" }
];

function etiquetaNivelSkillMatrix(nivel){
    const info = NIVELES_SKILL_MATRIX.find(n => n.valor === nivel);
    return info ? info.etiqueta : "-";
}

function claseNivelSkillMatrix(nivel){
    const info = NIVELES_SKILL_MATRIX.find(n => n.valor === nivel);
    return info ? info.clase : "nivel-0";
}

// ========================================
// CRUD
// ========================================

async function obtenerHabilidadesSkillMatrix(){
    return skillFetchTodo("/skill_matrix_habilidades?select=codigo,categoria,nombre,orden&order=orden.asc");
}

async function obtenerColaboradoresSkillMatrix(){
    return skillFetchTodo("/skill_matrix_colaboradores?select=dni,nombre_completo,turno,cargo,activo&order=nombre_completo.asc");
}

async function obtenerNivelesSkillMatrix(){
    return skillFetchTodo("/skill_matrix_niveles?select=dni,codigo_habilidad,nivel");
}

// Upsert de un nivel individual (celda editada desde la grilla).
async function guardarNivelSkillMatrix(dni, codigoHabilidad, nivel, actualizadoPor){

    return skillFetch(
        "/skill_matrix_niveles",
        {
            method: "POST",
            headers: {
                Prefer: "resolution=merge-duplicates,return=representation"
            },
            body: JSON.stringify({
                dni: dni,
                codigo_habilidad: codigoHabilidad,
                nivel: nivel,
                actualizado_en: new Date().toISOString(),
                actualizado_por: actualizadoPor || ""
            })
        }
    );

}

// Sube en bloques (Supabase no acepta lotes gigantes de forma confiable).
async function subirEnBloques(ruta, filas, prefer){

    const TAMANO_BLOQUE = 200;

    for(let i = 0; i < filas.length; i += TAMANO_BLOQUE){

        const bloque = filas.slice(i, i + TAMANO_BLOQUE);

        await skillFetch(ruta, {
            method: "POST",
            headers: prefer ? { Prefer: prefer } : {},
            body: JSON.stringify(bloque)
        });

    }

}

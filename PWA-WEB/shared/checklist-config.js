// ========================================
// SUPABASE DE "CHECK LIST 5S"
// ========================================
// Las tablas colaboradores_activos, colaboradores_mensual y
// fotos_colaboradores viven en el mismo proyecto Supabase que
// "Planificación y Avance" (iaitqquphjohgsmelhcj), no en el proyecto
// principal de la plataforma (login/zonas). Las fotos en sí siguen
// guardadas en el bucket "colaboradores" del proyecto principal —
// aquí solo se guarda su URL completa, así que no hay conflicto.

const SUPABASE_URL_CHECKLIST = "https://iaitqquphjohgsmelhcj.supabase.co/rest/v1";
const SUPABASE_KEY_CHECKLIST = "sb_publishable_rvEz02miPj1MrBVgLd_auw_FlyrVscs";

async function checklistFetch(ruta, opciones = {}){

    const headers = Object.assign(
        {
            apikey: SUPABASE_KEY_CHECKLIST,
            Authorization: "Bearer " + SUPABASE_KEY_CHECKLIST,
            "Content-Type": "application/json"
        },
        opciones.headers || {}
    );

    // Sin esto, algunos navegadores sirven una respuesta vieja desde
    // su caché HTTP en vez de pedirla de nuevo — por eso a veces se
    // ve el roster desactualizado aunque ya se haya activado el mes.
    const respuesta = await fetch(
        SUPABASE_URL_CHECKLIST + ruta,
        Object.assign({ cache: "no-store" }, opciones, { headers })
    );

    if(!respuesta.ok){
        const detalle = await respuesta.text();
        throw new Error(detalle || "Error al conectar con Supabase");
    }

    const texto = await respuesta.text();
    return texto ? JSON.parse(texto) : null;

}

// ========================================
// ROSTER ACTIVO (reemplaza la hoja "COLABORADORES" del Sheet)
// ========================================
// "Carga Mensual → Activar Mes" escribe el roster del mes en esta
// tabla. Se devuelve con las mismas claves en mayúscula que usaba la
// hoja de Google (ZONA/TURNO/PASILLO/NOMBRE), para no tener que tocar
// toda la lógica de zonas/cuadrillas que ya asume ese formato.
async function obtenerRosterActivo(){

    const filas = await checklistFetch(
        "/colaboradores_activos?select=nombre,zona,pasillo,turno,supervisor&activo=eq.true"
    );

    return (filas || []).map(function(r){
        return {
            ZONA: r.zona,
            TURNO: r.turno,
            PASILLO: r.pasillo,
            NOMBRE: r.nombre,
            SUPERVISOR: r.supervisor
        };
    });

}

// ========================================
// CONFIGURACIÓN SUPABASE
// ========================================

const SUPABASE_URL = "https://iaitqquphjohgsmelhcj.supabase.co/rest/v1";
const SUPABASE_KEY = "sb_publishable_rvEz02miPj1MrBVgLd_auw_FlyrVscs";

// Helper genérico para llamar a la API REST de Supabase
async function supabaseFetch(ruta, opciones = {}){

    const headers = Object.assign(
        {
            apikey: SUPABASE_KEY,
            Authorization: "Bearer " + SUPABASE_KEY,
            "Content-Type": "application/json"
        },
        opciones.headers || {}
    );

    const respuesta = await fetch(
        SUPABASE_URL + ruta,
        Object.assign({}, opciones, { headers })
    );

    if(!respuesta.ok){
        const detalle = await respuesta.text();
        throw new Error(detalle || "Error al conectar con Supabase");
    }

    // POST/DELETE suelen responder sin cuerpo (204/201 vacío).
    const texto = await respuesta.text();
    return texto ? JSON.parse(texto) : null;

}

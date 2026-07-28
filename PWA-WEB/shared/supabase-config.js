// ========================================
// CONFIGURACIÓN SUPABASE
// ========================================

const SUPABASE_URL = "https://rmlilqdhxbhpwkysucaz.supabase.co/rest/v1";
const SUPABASE_KEY = "sb_publishable_xh4_NP7I2j1rUhCw1ckv4Q_H_s29G76";

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

    return respuesta.json();

}

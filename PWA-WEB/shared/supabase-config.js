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

    // Sin timeout, una conexión lenta o caída deja el await colgado
    // para siempre: la pantalla parece congelada y no hay forma de
    // salir de ahí salvo recargar toda la página.
    const controlador = new AbortController();
    const limite = setTimeout(() => controlador.abort(), 20000);

    let respuesta;

    try{
        respuesta = await fetch(
            SUPABASE_URL + ruta,
            Object.assign({}, opciones, { headers, signal: controlador.signal })
        );
    }catch(e){
        if(e.name === "AbortError"){
            throw new Error("La conexión tardó demasiado. Verifica tu internet e intenta de nuevo.");
        }
        throw e;
    }finally{
        clearTimeout(limite);
    }

    if(!respuesta.ok){
        const detalle = await respuesta.text();
        throw new Error(detalle || "Error al conectar con Supabase");
    }

    // POST/DELETE suelen responder sin cuerpo (204/201 vacío).
    const texto = await respuesta.text();
    return texto ? JSON.parse(texto) : null;

}

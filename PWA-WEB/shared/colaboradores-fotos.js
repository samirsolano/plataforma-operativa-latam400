// ========================================
// BANCO DE FOTOS DE COLABORADORES (por DNI)
// ========================================
// Compartido entre Carga Mensual, Colaboradores Activos
// y Fotos de Colaboradores. Requiere que supabase-config.js
// esté cargado antes que este archivo.

const STORAGE_URL_FOTOS = SUPABASE_URL.replace("/rest/v1", "/storage/v1");
const BUCKET_COLABORADORES = "colaboradores";

// Busca si ya existe una foto guardada para ese DNI.
async function buscarFotoColaborador(dni){

    if(!dni){
        return null;
    }

    const filas = await supabaseFetch(
        "/fotos_colaboradores?dni=eq." + encodeURIComponent(dni) + "&select=dni,nombre,foto"
    );

    return filas[0] || null;

}

// Sube el archivo al bucket "colaboradores" (nombrado por DNI) y
// guarda/actualiza el registro en fotos_colaboradores.
async function subirFotoColaborador(dni, archivo, nombre){

    const extension = archivo.name.split(".").pop().toLowerCase();
    const ruta = dni + "." + extension;

    const respuesta = await fetch(
        STORAGE_URL_FOTOS + "/object/" + BUCKET_COLABORADORES + "/" + ruta,
        {
            method: "POST",
            headers: {
                apikey: SUPABASE_KEY,
                Authorization: "Bearer " + SUPABASE_KEY,
                "Content-Type": archivo.type,
                "x-upsert": "true"
            },
            body: archivo
        }
    );

    if(!respuesta.ok){
        const detalle = await respuesta.text();
        throw new Error(detalle || "No se pudo subir la foto");
    }

    const url = STORAGE_URL_FOTOS + "/object/public/" + BUCKET_COLABORADORES + "/" + ruta;

    await supabaseFetch(
        "/fotos_colaboradores?on_conflict=dni",
        {
            method: "POST",
            headers: { Prefer: "resolution=merge-duplicates" },
            body: JSON.stringify({
                dni: dni,
                nombre: nombre || null,
                foto: url,
                updated_at: new Date().toISOString()
            })
        }
    );

    return url;

}

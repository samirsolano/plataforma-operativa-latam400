// ========================================
// GEMINI: leer la tabla del correo desde una foto
// ========================================
// Mismo mecanismo que la lectura de etiquetas de Farmacia en
// centro-proyectos (shared/gemini-config.js): se lanzan varios modelos
// en carrera escalonada porque cuando Google está saturado cada uno
// falla o tarda por su lado; gana la primera respuesta válida.
//
// La key NO va en el código (GitHub bloquea el push si la encuentra):
// se guarda en Supabase, tabla app_config (clave "gemini_api_key", ver
// migracion-drive.sql), y se lee la primera vez que hace falta.

let geminiApiKey = null;

async function obtenerGeminiApiKey(){

    if(geminiApiKey){
        return geminiApiKey;
    }

    const filas = await supabaseFetch("/app_config?clave=eq.gemini_api_key&select=valor");
    const valor = filas && filas[0] && String(filas[0].valor || "").trim();

    if(!valor){
        throw new Error("falta configurar la key de Gemini en Supabase (tabla app_config, clave gemini_api_key).");
    }

    geminiApiKey = valor;
    return geminiApiKey;

}

const GEMINI_MODELOS = ["gemini-3.5-flash-lite", "gemini-flash-lite-latest", "gemini-3.1-flash-lite"];
const GEMINI_ESCALON_MS = 6000;       // si un modelo no respondió en este tiempo, se suma el siguiente
const GEMINI_LIMITE_TOTAL_MS = 30000; // una tabla es más larga de leer que una etiqueta

const PROMPT_TABLA_CORREO = `Esta imagen es una captura de una tabla enviada por correo por un cliente de un almacén en Perú (detalle de pedidos y órdenes de compra a despachar). Arriba de la tabla puede haber un título (ej. "CENTRO 1054 - PUNTA NEGRA").

Extrae TODAS las filas de datos de la tabla, en el mismo orden. NO incluyas la fila de encabezados ni la fila de totales ("Total general").

Para cada fila devuelve estas claves (si una columna no existe en la tabla, deja ""):
- tipo: columna TIPO (ej. "Non Foods", "Soluciones")
- local_entrega: columna LOCAL DE ENTREGA
- tipo_oc: columna TIPO OC (ej. "Flujo Continuo", "Almacenaje")
- oc: columna OC (número de orden de compra, solo dígitos)
- pedido: columna PEDIDO (solo dígitos)
- fecha_entrega: columna FECHA DE ENTREGA en formato DD/MM/AAAA
- centro: columna CENTRO
- tm: columna TM's (número con punto decimal)
- pen: columna PEN (número sin separador de miles)
- ucos: columna UCO's (número sin separador de miles)

Copia los números EXACTAMENTE como se ven, dígito por dígito; no inventes ni completes datos.

Responde ÚNICAMENTE con un objeto JSON plano, sin texto adicional ni backticks, con esta forma: {"titulo": "", "filas": [{"tipo": "", "local_entrega": "", "tipo_oc": "", "oc": "", "pedido": "", "fecha_entrega": "", "centro": "", "tm": "", "pen": "", "ucos": ""}]}`;

async function llamarModeloGeminiTabla(modelo, key, base64, mediaType, signal){

    const resp = await fetch(
        "https://generativelanguage.googleapis.com/v1beta/models/" + modelo + ":generateContent",
        {
            method: "POST",
            signal: signal,
            headers: { "Content-Type": "application/json", "x-goog-api-key": key },
            body: JSON.stringify({
                contents: [{
                    parts: [
                        { inline_data: { mime_type: mediaType, data: base64 } },
                        { text: PROMPT_TABLA_CORREO }
                    ]
                }]
            })
        }
    );

    const data = await resp.json().catch(function(){ return {}; });

    if(!resp.ok){
        throw new Error((data.error && data.error.message) || ("Error HTTP " + resp.status));
    }

    const partes = (((data.candidates || [])[0] || {}).content || {}).parts || [];
    const texto = partes.map(function(p){ return p.text || ""; }).join("");
    const json = JSON.parse(texto.replace(/```json|```/g, "").trim());

    if(!json || !Array.isArray(json.filas) || json.filas.length === 0){
        throw new Error("no encontró filas en la imagen");
    }

    return json;

}

// Devuelve {titulo, filas:[...]} de la foto. Carrera escalonada entre
// GEMINI_MODELOS, como en la lectura de etiquetas.
async function leerTablaCorreoConGemini(base64, mediaType){

    const key = await obtenerGeminiApiKey();

    return new Promise(function(resolve, reject){

        const controles = [];
        let lanzados = 0;
        let fallidos = 0;
        let terminado = false;
        let timerEscalon = null;

        function terminar(){
            terminado = true;
            clearTimeout(timerEscalon);
            clearTimeout(timerTotal);
            controles.forEach(function(c){ c.abort(); });
        }

        function lanzarSiguiente(){

            if(terminado || lanzados >= GEMINI_MODELOS.length){
                return;
            }

            const modelo = GEMINI_MODELOS[lanzados++];
            const control = new AbortController();
            controles.push(control);

            clearTimeout(timerEscalon);
            timerEscalon = setTimeout(lanzarSiguiente, GEMINI_ESCALON_MS);

            llamarModeloGeminiTabla(modelo, key, base64, mediaType, control.signal)
                .then(function(datos){
                    if(terminado) return;
                    terminar();
                    resolve(datos);
                })
                .catch(function(err){
                    if(terminado) return;
                    console.warn("Gemini (" + modelo + "):", err.message);
                    fallidos++;
                    if(fallidos >= GEMINI_MODELOS.length){
                        terminar();
                        reject(new Error("no se pudo leer la imagen (el servicio está saturado o la foto no se ve clara)."));
                        return;
                    }
                    lanzarSiguiente();
                });

        }

        const timerTotal = setTimeout(function(){
            if(terminado) return;
            terminar();
            reject(new Error("la lectura está tardando demasiado (servicio lento). Prueba de nuevo."));
        }, GEMINI_LIMITE_TOTAL_MS);

        lanzarSiguiente();

    });

}

// ========================================
// SUPABASE DEL MÓDULO "RECONOCIMIENTO"
// ========================================
// Usa el mismo proyecto Supabase que "Planificación y Avance"
// (iaitqquphjohgsmelhcj) porque ahí ya vive la tabla "colaboradores"
// (DNI, nombre, jefe/supervisor) que este módulo reutiliza para
// llenar "Jefe Inmediato" y "Nombre" en el formulario de evaluación.

const SUPABASE_URL_RECON = "https://iaitqquphjohgsmelhcj.supabase.co/rest/v1";
const SUPABASE_KEY_RECON = "sb_publishable_rvEz02miPj1MrBVgLd_auw_FlyrVscs";

async function reconFetch(ruta, opciones = {}){

    const headers = Object.assign(
        {
            apikey: SUPABASE_KEY_RECON,
            Authorization: "Bearer " + SUPABASE_KEY_RECON,
            "Content-Type": "application/json"
        },
        opciones.headers || {}
    );

    const respuesta = await fetch(
        SUPABASE_URL_RECON + ruta,
        Object.assign({}, opciones, { headers })
    );

    if(!respuesta.ok){
        const detalle = await respuesta.text();
        throw new Error(detalle || "Error al conectar con Supabase");
    }

    const texto = await respuesta.text();
    return texto ? JSON.parse(texto) : null;

}

// ========================================
// OPCIONES DE CADA CRITERIO (texto guardado en BD → etiqueta visible)
// ========================================
// Cambiar aquí agrega/quita opciones de los <select> del formulario
// y de la fórmula de la nota (ver PUNTAJES_CRITERIOS más abajo).

const CRITERIOS_RECONOCIMIENTO = {

    COMPROMISO: {
        titulo: "COMPROMISO",
        campos: {
            ausentismo: {
                grupo: "Ausentismo",
                etiqueta: "Inasistencias injustificadas",
                opciones: [
                    { valor: "0", texto: "0 inasistencias" },
                    { valor: "1_mas", texto: "1 a más inasistencias" }
                ]
            },
            puntualidad: {
                grupo: "Puntualidad",
                etiqueta: "Tardanzas al Horario de Ingreso Injustificadas",
                opciones: [
                    { valor: "0", texto: "0 tardanzas" },
                    { valor: "1_mas", texto: "1 a más tardanzas" }
                ]
            },
            relaciones_companeros: {
                grupo: "Las buenas relaciones con los compañeros de trabajo",
                etiqueta: "Inconvenientes con compañeros de trabajo",
                opciones: [
                    { valor: "0", texto: "0 problemas con compañeros" },
                    { valor: "mas_1", texto: "Más de 1 problema con compañeros" }
                ]
            }
        }
    },

    OPERACIONES: {
        titulo: "OPERACIONES",
        campos: {
            calidad: {
                grupo: "Calidad",
                etiqueta: "Procesos sin error",
                opciones: [
                    { valor: "0", texto: "0 errores" },
                    { valor: "1", texto: "1 error" },
                    { valor: "2", texto: "2 errores" },
                    { valor: "3_mas", texto: "De 3 a más errores" }
                ]
            },
            productividad: {
                grupo: "Productividad",
                etiqueta: "Productividad esperada",
                opciones: [
                    { valor: "superior", texto: "> superior al target" },
                    { valor: "target", texto: "Target" },
                    { valor: "inferior", texto: "< inferior al target" }
                ]
            },
            inventario: {
                grupo: "Inventario",
                etiqueta: "Inventario OK",
                opciones: [
                    { valor: "superior", texto: "> superior al target" },
                    { valor: "target", texto: "Target" },
                    { valor: "inferior", texto: "< inferior al target" }
                ]
            }
        }
    },

    MEJORA_CONTINUA: {
        titulo: "MEJORA CONTINUA",
        campos: {
            aplicacion_5s: {
                grupo: "5S",
                etiqueta: "Aplicación de 5s en la operación",
                opciones: [
                    { valor: "100", texto: "100%" },
                    { valor: "90_99", texto: "90% a 99%" },
                    { valor: "70_89", texto: "70% a 89%" },
                    { valor: "menor_70", texto: "Menor a 70%" }
                ]
            },
            ideas_mejora: {
                grupo: "Ideas de mejora",
                etiqueta: "Sugerencia de idea de mejora implementada",
                opciones: [
                    { valor: "mas_3", texto: "Más de 3 ideas" },
                    { valor: "2", texto: "2 ideas" },
                    { valor: "1", texto: "1 idea" },
                    { valor: "0", texto: "0 idea" }
                ]
            },
            capacitaciones: {
                grupo: "Capacitaciones",
                etiqueta: "Capacitaciones al día",
                opciones: [
                    { valor: "mayor_igual_7", texto: "Mayor o igual a 7 hrs" },
                    { valor: "3_a_7", texto: "Mayor a 3 menor a 7" },
                    { valor: "menor_igual_3", texto: "Menor o igual a 3" }
                ]
            }
        }
    },

    SEGURIDAD: {
        titulo: "SEGURIDAD",
        campos: {
            reporte_ros: {
                grupo: "Reporte de ROS / Anomalías",
                etiqueta: "Participación de ROS / Anomalías",
                opciones: [
                    { valor: "mayor_igual_2", texto: "Mayor o igual a 2" },
                    { valor: "1", texto: "Reporte 1" },
                    { valor: "ninguno", texto: "Ninguno" }
                ]
            },
            capacitaciones_qhse: {
                grupo: "Capacitaciones de QHSE",
                etiqueta: "Participación en capacitaciones QHSE",
                opciones: [
                    { valor: "si", texto: "Sí ha participado" },
                    { valor: "no", texto: "No ha participado" }
                ]
            },
            actos_inseguros: {
                grupo: "Actos inseguros",
                etiqueta: "Realizó actos inseguros",
                opciones: [
                    { valor: "0", texto: "0 Incidencias" },
                    { valor: "1_mas", texto: "1 incidencia a más" }
                ]
            }
        }
    },

    MEDIO_AMBIENTE: {
        titulo: "MEDIO AMBIENTE",
        campos: {
            mejoras_green: {
                grupo: "Mejoras Green",
                etiqueta: "Sugerencia de ideas de mejora Green",
                opciones: [
                    { valor: "mayor_igual_2", texto: "Mayor o igual a 2" },
                    { valor: "menor_2", texto: "Menor a 2" },
                    { valor: "nunca", texto: "Nunca ha sugerido" }
                ]
            },
            credito_carbono: {
                grupo: "Programa crédito de carbono",
                etiqueta: "Uso consiente de recursos",
                opciones: [
                    { valor: "inferior", texto: "< inferior al target" },
                    { valor: "target", texto: "Target" },
                    { valor: "superior", texto: "> superior al target" }
                ]
            },
            dialogo_ambiental: {
                grupo: "Semanal Ambiental",
                etiqueta: "Participación de Diálogo",
                opciones: [
                    { valor: "siempre", texto: "Siempre" },
                    { valor: "menor_3_faltas", texto: "Menor a 3 faltas" },
                    { valor: "mayor_3_faltas", texto: "Mayor a 3 faltas" }
                ]
            }
        }
    }

};

// ========================================
// PUNTAJE DE CADA OPCIÓN (0 = peor, 1 = mejor dentro de su criterio)
// ========================================
// La nota final tiene un máximo de 5: cada una de las 5 categorías de
// arriba vale hasta 1 punto (promedio de sus 3 criterios), y se suman
// las 5. Cambiar estos números (o los pesos por categoría más abajo)
// ajusta la fórmula sin tocar el resto del código.

const PUNTAJES_CRITERIOS = {
    ausentismo:            { "0": 1, "1_mas": 0 },
    puntualidad:           { "0": 1, "1_mas": 0 },
    relaciones_companeros: { "0": 1, "mas_1": 0 },

    calidad:               { "0": 1, "1": 0.67, "2": 0.33, "3_mas": 0 },
    productividad:         { superior: 1, target: 0.7, inferior: 0.3 },
    inventario:            { superior: 1, target: 0.7, inferior: 0.3 },

    aplicacion_5s:         { "100": 1, "90_99": 0.75, "70_89": 0.4, menor_70: 0 },
    ideas_mejora:          { mas_3: 1, "2": 0.7, "1": 0.4, "0": 0 },
    capacitaciones:        { mayor_igual_7: 1, "3_a_7": 0.5, menor_igual_3: 0 },

    reporte_ros:           { mayor_igual_2: 1, "1": 0.5, ninguno: 0 },
    capacitaciones_qhse:   { si: 1, no: 0 },
    actos_inseguros:       { "0": 1, "1_mas": 0 },

    mejoras_green:         { mayor_igual_2: 1, menor_2: 0.5, nunca: 0 },
    credito_carbono:       { superior: 1, target: 0.7, inferior: 0.3 },
    dialogo_ambiental:     { siempre: 1, menor_3_faltas: 0.6, mayor_3_faltas: 0 }
};

const PESO_POR_CATEGORIA = 1; // 5 categorías x 1 punto = nota máxima 5

const UMBRAL_RECONOCIDO = 3.5; // nota mínima para el trofeo de "Reconocido"

// respuestas = { ausentismo: "0", puntualidad: "1_mas", ... } (15 claves)
function calcularNotaReconocimiento(respuestas){

    const notasPorCategoria = {};

    Object.keys(CRITERIOS_RECONOCIMIENTO).forEach(function(claveCategoria){

        const campos = Object.keys(CRITERIOS_RECONOCIMIENTO[claveCategoria].campos);

        const suma = campos.reduce(function(acumulado, campo){
            const puntaje = PUNTAJES_CRITERIOS[campo][respuestas[campo]];
            return acumulado + (typeof puntaje === "number" ? puntaje : 0);
        }, 0);

        notasPorCategoria[claveCategoria] = (suma / campos.length) * PESO_POR_CATEGORIA;

    });

    const notaFinal = Object.keys(notasPorCategoria)
        .reduce((acumulado, clave) => acumulado + notasPorCategoria[clave], 0);

    return {
        nota_compromiso: Math.round(notasPorCategoria.COMPROMISO * 100) / 100,
        nota_operaciones: Math.round(notasPorCategoria.OPERACIONES * 100) / 100,
        nota_mejora_continua: Math.round(notasPorCategoria.MEJORA_CONTINUA * 100) / 100,
        nota_seguridad: Math.round(notasPorCategoria.SEGURIDAD * 100) / 100,
        nota_medio_ambiente: Math.round(notasPorCategoria.MEDIO_AMBIENTE * 100) / 100,
        nota: Math.round(notaFinal * 10) / 10,
        estado: notaFinal >= UMBRAL_RECONOCIDO ? "Reconocido" : "Sin reconocimiento"
    };

}

function etiquetaOpcion(campo, valor){

    for(const claveCategoria in CRITERIOS_RECONOCIMIENTO){

        const campoInfo = CRITERIOS_RECONOCIMIENTO[claveCategoria].campos[campo];

        if(campoInfo){
            const opcion = campoInfo.opciones.find(o => o.valor === valor);
            return opcion ? opcion.texto : valor;
        }

    }

    return valor;

}

// ========================================
// COLABORADORES (Jefe Inmediato / Nombre) — tabla "colaboradores",
// compartida con Planificación Recursos.
// ========================================

async function obtenerJefesInmediatos(){

    const datos = await reconFetch("/colaboradores?select=supervisor");

    const set = {};
    (datos || []).forEach(d => { if(d.supervisor) set[d.supervisor] = true; });

    return Object.keys(set).sort();

}

async function obtenerColaboradoresPorJefe(jefe){

    const datos = await reconFetch(
        "/colaboradores?supervisor=eq." + encodeURIComponent(jefe) +
        "&select=id,dni,nombre_completo&order=nombre_completo.asc"
    );

    return datos || [];

}

// ========================================
// CRUD "reconocimientos"
// ========================================

async function obtenerReconocimientos(anio, trimestre){

    let query = "select=*&anio=eq." + encodeURIComponent(anio) + "&order=created_at.desc";

    if(trimestre){
        query += "&trimestre=eq." + encodeURIComponent(trimestre);
    }

    const datos = await reconFetch("/reconocimientos?" + query);

    return datos || [];

}

async function insertarReconocimiento(registro){

    const datos = await reconFetch(
        "/reconocimientos",
        {
            method: "POST",
            headers: { Prefer: "return=representation" },
            body: JSON.stringify(registro)
        }
    );

    if(!Array.isArray(datos) || datos.length === 0){
        throw new Error(
            "Supabase no devolvió la fila insertada. Revisa las políticas RLS " +
            "de la tabla 'reconocimientos' (ver reconocimiento.sql)."
        );
    }

    return datos[0];

}

async function actualizarPeReconocimiento(id, pe){

    const datos = await reconFetch(
        "/reconocimientos?id=eq." + id,
        {
            method: "PATCH",
            headers: { Prefer: "return=representation" },
            body: JSON.stringify({ pe: pe })
        }
    );

    return Array.isArray(datos) ? datos[0] : null;

}

async function eliminarReconocimiento(id){

    const datos = await reconFetch(
        "/reconocimientos?id=eq." + id,
        {
            method: "DELETE",
            headers: { Prefer: "return=representation" }
        }
    );

    if(!Array.isArray(datos) || datos.length === 0){
        throw new Error(
            "No se eliminó ninguna fila (id " + id + "). Revisa que exista la " +
            "política RLS 'reconocimientos_delete_anon' (ver reconocimiento.sql)."
        );
    }

    return datos[0];

}

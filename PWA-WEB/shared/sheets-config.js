// ========================================
// LECTURA DEL GOOGLE SHEET "CHECKLIST 5S"
// ========================================
// Este Sheet es alimentado por la app móvil de auditorías
// (repositorio centro-proyectos-latam). Aquí solo lo leemos
// como fuente de datos de solo lectura, vía exportación CSV.

const SHEET_ID_5S = "1zaBEmvYiBbfjFEWVYWxGC5aiRg86Nv36Una8Cg-W-xA";

const SHEET_GIDS_5S = {
    PREGUNTAS: "0",
    CABECERA_AUDITORIA: "1422046394",
    DETALLE_AUDITORIA: "1511828430",
    DAS_DIARIO: "558283745",
    COLABORADORES: "416892329",
    ZONAS: "1761834434",
    IMAGENES_APP: "110879254"
};

async function leerHojaCSV(nombreHoja){

    const gid = SHEET_GIDS_5S[nombreHoja];

    if(gid === undefined){
        throw new Error("Hoja no reconocida: " + nombreHoja);
    }

    const url =
        "https://docs.google.com/spreadsheets/d/" +
        SHEET_ID_5S +
        "/export?format=csv&gid=" +
        gid;

    const respuesta = await fetch(url);

    if(!respuesta.ok){
        throw new Error("No se pudo leer la hoja " + nombreHoja);
    }

    const texto = await respuesta.text();

    return parsearCSV(texto);

}

// Parser CSV simple que respeta comillas y comas dentro de campos.
function parsearCSV(texto){

    const filas = [];
    let fila = [];
    let campo = "";
    let dentroComillas = false;

    for(let i = 0; i < texto.length; i++){

        const c = texto[i];

        if(dentroComillas){

            if(c === '"'){

                if(texto[i + 1] === '"'){
                    campo += '"';
                    i++;
                }else{
                    dentroComillas = false;
                }

            }else{
                campo += c;
            }

        }else{

            if(c === '"'){
                dentroComillas = true;
            }else if(c === ","){
                fila.push(campo);
                campo = "";
            }else if(c === "\n" || c === "\r"){

                if(c === "\r" && texto[i + 1] === "\n"){
                    i++;
                }

                fila.push(campo);
                filas.push(fila);
                fila = [];
                campo = "";

            }else{
                campo += c;
            }

        }

    }

    if(campo !== "" || fila.length){
        fila.push(campo);
        filas.push(fila);
    }

    const filasConDatos = filas.filter(
        f => f.length > 1 || (f.length === 1 && f[0] !== "")
    );

    if(!filasConDatos.length){
        return [];
    }

    const encabezados = filasConDatos[0].map(h => h.trim());

    return filasConDatos.slice(1).map(function(f){

        const obj = {};

        encabezados.forEach(function(h, idx){
            obj[h] = f[idx] !== undefined ? f[idx].trim() : "";
        });

        return obj;

    });

}

// ========================================
// NORMALIZACIÓN DE DATOS
// ========================================
// El Sheet tiene inconsistencias manuales (ZONA 1 / Zona 1,
// DIA / DÍA), estas funciones las unifican.

function normalizarZona5S(zona){

    const match = String(zona || "").match(/zona\s*(\d+)/i);

    return match ? ("Zona " + match[1]) : String(zona || "").trim();

}

function normalizarTurno5S(turno){

    const v = String(turno || "").trim().toUpperCase();

    if(v === "DIA" || v === "DÍA"){
        return "DIA";
    }

    return v;

}

// El roster viejo del Sheet usa "Pasillo 1" y la carga mensual (ya
// migrada a Supabase) guarda "Pasillo 01" — sin esto, cualquier
// cruce por pasillo entre ambas fuentes falla en silencio para el
// 1 al 9.
function normalizarPasillo5S(pasillo){

    return String(pasillo || "")
        .trim()
        .replace(/\s+/g, " ")
        .replace(/\d+/, function(numero){
            return String(parseInt(numero, 10));
        });

}

// Convierte fecha del Sheet "DD/MM/YYYY" a formato ISO "YYYY-MM-DD".
function fechaSheetAISO(fechaTexto){

    const partes = String(fechaTexto || "").trim().split("/");

    if(partes.length !== 3){
        return null;
    }

    const [d, m, y] = partes;

    return y + "-" + m.padStart(2, "0") + "-" + d.padStart(2, "0");

}

// Interpreta horas en formato es-PE ("5:25:43 p. m.") y devuelve
// true si son antes de horaLimite (24h). El objetivo de "terminar
// temprano" es distinto según turno: turno Día se mide contra las
// 10:00 AM (horaLimite=10), turno Noche contra las 10:00 PM
// (horaLimite=22).
function horaAntesDeLimite(horaTexto, horaLimite){

    const match = String(horaTexto || "").match(
        /(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([ap])\.?\s*m\.?/i
    );

    if(!match){
        return false;
    }

    let horas = parseInt(match[1], 10);
    const ampm = match[4].toLowerCase();

    if(ampm === "p" && horas !== 12){
        horas += 12;
    }

    if(ampm === "a" && horas === 12){
        horas = 0;
    }

    return horas < horaLimite;

}

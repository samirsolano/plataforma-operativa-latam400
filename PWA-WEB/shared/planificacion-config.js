// ========================================
// SUPABASE DEL SISTEMA "PLANIFICACIÓN Y AVANCE"
// ========================================
// Este es un proyecto de Supabase distinto al del resto de la
// plataforma (viene del Apps Script original "Planificación y Avance").

const SUPABASE_URL_PLANIF = "https://iaitqquphjohgsmelhcj.supabase.co/rest/v1";
const SUPABASE_KEY_PLANIF = "sb_publishable_rvEz02miPj1MrBVgLd_auw_FlyrVscs";

async function planifFetch(ruta, opciones = {}){

    const headers = Object.assign(
        {
            apikey: SUPABASE_KEY_PLANIF,
            Authorization: "Bearer " + SUPABASE_KEY_PLANIF,
            "Content-Type": "application/json"
        },
        opciones.headers || {}
    );

    const respuesta = await fetch(
        SUPABASE_URL_PLANIF + ruta,
        Object.assign({}, opciones, { headers })
    );

    if(!respuesta.ok){
        const detalle = await respuesta.text();
        throw new Error(detalle || "Error al conectar con Supabase");
    }

    const texto = await respuesta.text();
    return texto ? JSON.parse(texto) : null;

}

function normalizarTurnoPlanif(turno){
    return (turno === "DÍA" || turno === "DIA") ? "DIA" : turno;
}

// ========================================
// LECTURA DEL GOOGLE SHEET "STATUS PENDIENTE"
// ========================================
// Reemplaza a Drive.js (SpreadsheetApp), que solo funciona dentro
// de Apps Script. Aquí leemos el mismo Sheet vía export CSV público.

const SHEET_ID_PLANIF = "1u2TIkV2ZxezVze-3ZeUF9LjqdZ1LLVAhQ0ag73cLXzI";
const GID_STATUS_PENDIENTE = "1133971139";

// Parser CSV simple → array de arrays (sin asumir encabezados en la fila 1,
// porque en este Sheet los encabezados están en la fila 5).
function parsearCSVFilas(texto){

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

    return filas;

}

async function leerStatusPendienteCSV(){

    const url =
        "https://docs.google.com/spreadsheets/d/" +
        SHEET_ID_PLANIF +
        "/export?format=csv&gid=" +
        GID_STATUS_PENDIENTE;

    const respuesta = await fetch(url);

    if(!respuesta.ok){
        throw new Error("No se pudo leer el Sheet STATUS PENDIENTE");
    }

    const texto = await respuesta.text();

    return parsearCSVFilas(texto);

}

// Equivalente a Drive.js → obtenerPlanificacion().
// Encabezados en la fila 5 (índice 4), datos desde la fila 6 (índice 5).
function obtenerPlanificacionDrive(filas){

    if(filas.length <= 5){
        return [];
    }

    const encabezados = filas[4];
    const columnas = {};

    encabezados.forEach(function(nombre, indice){
        columnas[String(nombre).trim()] = indice;
    });

    const columnasRequeridas = [
        "GESTIÓN", "FECHA DE CITA", "HORA DE CITA", "STATUS",
        "FO REAL", "CLIENTE", "TRANSPORTISTA", "SUM de PESO TN"
    ];

    const faltantes = columnasRequeridas.filter(c => columnas[c] === undefined);

    if(faltantes.length > 0){
        throw new Error("Faltan columnas esperadas en STATUS PENDIENTE: " + faltantes.join(", "));
    }

    const resultado = [];

    let gestionActual = "";
    let fechaActual = "";
    let horaActual = "";

    for(let i = 5; i < filas.length; i++){

        const fila = filas[i];

        if(String(fila[columnas["GESTIÓN"]] || "").trim() !== ""){
            gestionActual = String(fila[columnas["GESTIÓN"]]).trim();
        }

        if(String(fila[columnas["FECHA DE CITA"]] || "").trim() !== ""){
            fechaActual = String(fila[columnas["FECHA DE CITA"]]).trim();
        }

        if(String(fila[columnas["HORA DE CITA"]] || "").trim() !== ""){
            horaActual = String(fila[columnas["HORA DE CITA"]]).trim();
        }

        const status = String(fila[columnas["STATUS"]] || "").trim().toUpperCase();

        if(status !== "EN PROCESO" && status !== "POR LANZAR"){
            continue;
        }

        const foReal = String(fila[columnas["FO REAL"]] || "").trim();

        if(foReal === ""){
            continue;
        }

        resultado.push({

            gestion: gestionActual,

            fecha: fechaActual,
            hora: horaActual,

            foReal: foReal,
            cliente: String(fila[columnas["CLIENTE"]] || ""),
            transportista: String(fila[columnas["TRANSPORTISTA"]] || ""),
            pesoTN: Number(fila[columnas["SUM de PESO TN"]]) || 0,
            status: status

        });

    }

    return resultado;

}

// "DD/MM/YYYY" (o "DD/MM/YYYY HH:mm:ss") → "YYYY-MM-DD"
function convertirFechaPlanif(fecha){

    if(!fecha){
        return null;
    }

    fecha = String(fecha).trim().split(" ")[0];

    if(fecha === "" || fecha === "-" || fecha === "--"){
        return null;
    }

    const partes = fecha.split("/");

    if(partes.length !== 3){
        return null;
    }

    return partes[2] + "-" + partes[1].padStart(2, "0") + "-" + partes[0].padStart(2, "0");

}

// "H:mm" o "H:mm:ss" → "HH:mm:ss"
function normalizarHoraCitaPlanif(hora){

    const h = String(hora || "").trim();

    if(h === "" || h === "-"){
        return null;
    }

    const partes = h.split(":");

    if(partes.length < 2){
        return null;
    }

    const hh = partes[0].padStart(2, "0");
    const mm = (partes[1] || "00").padStart(2, "0");
    const ss = (partes[2] || "00").padStart(2, "0");

    return hh + ":" + mm + ":" + ss;

}

// ========================================
// PLANIFICACION_DIARIA (Supabase)
// ========================================

async function obtenerPlanificacionSupabase(fecha, turno){

    turno = normalizarTurnoPlanif(turno);

    const datos = await planifFetch(
        "/planificacion_diaria?select=*" +
        "&fecha=eq." + encodeURIComponent(fecha) +
        "&turno=eq." + encodeURIComponent(turno) +
        "&order=gestion.asc,fecha_cita.asc,hora_cita.asc"
    );

    return datos || [];

}

async function insertarPlanificacion(registro){

    return await planifFetch(
        "/planificacion_diaria",
        {
            method: "POST",
            headers: { "Prefer": "return=representation" },
            body: JSON.stringify(registro)
        }
    );

}

async function actualizarStatusDrive(id, status){

    return await planifFetch(
        "/planificacion_diaria?id=eq." + encodeURIComponent(id),
        {
            method: "PATCH",
            headers: { "Prefer": "return=representation" },
            body: JSON.stringify({ status_drive: status })
        }
    );

}

async function marcarPreparado(id){

    return await planifFetch(
        "/planificacion_diaria?id=eq." + encodeURIComponent(id),
        {
            method: "PATCH",
            headers: { "Prefer": "return=representation" },
            body: JSON.stringify({ status_drive: "PREPARADO" })
        }
    );

}

async function limpiarEstadoPlanificacion(fecha, turno){

    await planifFetch(
        "/planificacion_diaria" +
        "?fecha=eq." + encodeURIComponent(fecha) +
        "&turno=eq." + encodeURIComponent(turno),
        {
            method: "PATCH",
            headers: { "Prefer": "return=representation" },
            body: JSON.stringify({ estado_planificacion: null })
        }
    );

}

async function actualizarEstadoPlanificacion(fecha, turno, fo, peso){

    const datos = await planifFetch(
        "/planificacion_diaria" +
        "?fecha=eq." + encodeURIComponent(fecha) +
        "&turno=eq." + encodeURIComponent(turno) +
        "&fo_real=eq." + encodeURIComponent(fo) +
        "&peso_tn=eq." + peso,
        {
            method: "PATCH",
            headers: { "Prefer": "return=representation" },
            body: JSON.stringify({ estado_planificacion: "PLANIFICADO" })
        }
    );

    if(!Array.isArray(datos) || datos.length === 0){
        throw new Error("No se actualizó ningún registro para FO " + fo);
    }

    return datos;

}

async function guardarEstadoPlanificacion(fecha, turno, seleccionados){

    turno = normalizarTurnoPlanif(turno);

    await limpiarEstadoPlanificacion(fecha, turno);

    const errores = [];

    for(const item of seleccionados){

        try{
            await actualizarEstadoPlanificacion(fecha, turno, item.fo, item.peso);
        }catch(e){
            console.error("Error actualizando FO " + item.fo + ": " + e.message);
            errores.push({ fo: item.fo, error: e.message });
        }

    }

    if(errores.length > 0){
        console.error("Viajes que no se pudieron marcar:", errores);
    }

    return obtenerPlanificacionSupabase(fecha, turno);

}

// ========================================
// SINCRONIZAR (Drive → Supabase)
// ========================================
// Equivalente a Supabase.js → sincronizarPlanificacion() +
// actualizarEstadosDesdeDrive(), corriendo en el navegador.

// ========================================
// CALCULAR EXTRACCIÓN / PICKING (placeholder 80/20)
// ========================================
// ctd_extraccion: 80% del peso del viaje, convertido a paletas (480 kg c/u)
// tnl_picking:    20% del peso del viaje, en TN

function calcularExtraccionPicking(pesoTN){

    const peso = Number(pesoTN) || 0;

    return {
        ctd_extraccion: Math.round((peso * 0.80 * 1000) / 480),
        tnl_picking: Math.round(peso * 0.20 * 100) / 100
    };

}

async function insertarViajeDesdeDrive(fecha, turno, viaje){

    const fechaCita = convertirFechaPlanif(viaje.fecha);
    const horaCita = normalizarHoraCitaPlanif(viaje.hora);

    await insertarPlanificacion({

        fecha: fecha,
        turno: turno,

        estado_planificacion: null,

        gestion: viaje.gestion,

        fecha_cita: fechaCita,
        hora_cita: horaCita,

        fo_real: viaje.foReal,
        cliente: viaje.cliente,
        transportista: viaje.transportista,
        peso_tn: viaje.pesoTN,

        status_drive: viaje.status,

        ...calcularExtraccionPicking(viaje.pesoTN),

        fecha_importacion: new Date().toISOString()

    });

}

function claveViaje(foReal, pesoTN){
    return String(foReal).trim() + "|" + Number(pesoTN).toFixed(2);
}

async function sincronizarPlanificacionCliente(fecha, turno){

    turno = normalizarTurnoPlanif(turno);

    const filasCSV = await leerStatusPendienteCSV();
    const drive = obtenerPlanificacionDrive(filasCSV);

    const supabaseActual = await obtenerPlanificacionSupabase(fecha, turno);

    const indiceSupabase = {};

    supabaseActual.forEach(function(r){
        indiceSupabase[claveViaje(r.fo_real, r.peso_tn)] = r;
    });

    // Sheet vacío o Supabase vacío para esta fecha/turno: insertar todo.
    if(supabaseActual.length === 0){

        for(const viaje of drive){

            try{
                await insertarViajeDesdeDrive(fecha, turno, viaje);
            }catch(e){
                console.error("Error insertando viaje FO " + viaje.foReal + ": " + e.message);
            }

        }

        return obtenerPlanificacionSupabase(fecha, turno);

    }

    // Insertar los viajes de Drive que todavía no existen en Supabase.
    for(const viaje of drive){

        const clave = claveViaje(viaje.foReal, viaje.pesoTN);

        if(!indiceSupabase[clave]){

            try{
                await insertarViajeDesdeDrive(fecha, turno, viaje);
            }catch(e){
                console.error("Error insertando viaje nuevo FO " + viaje.foReal + ": " + e.message);
            }

        }

    }

    // Actualizar estados (EN PROCESO/POR LANZAR/PREPARADO) según Drive.
    const supabaseActualizado = await obtenerPlanificacionSupabase(fecha, turno);

    const indiceDrive = {};

    drive.forEach(function(v){
        indiceDrive[claveViaje(v.foReal, v.pesoTN)] = v;
    });

    for(const registro of supabaseActualizado){

        try{

            const clave = claveViaje(registro.fo_real, registro.peso_tn);
            const viajeDrive = indiceDrive[clave];

            if(viajeDrive){

                if(registro.status_drive !== viajeDrive.status){
                    await actualizarStatusDrive(registro.id, viajeDrive.status);
                }

            }else if(registro.status_drive !== "PREPARADO"){

                await marcarPreparado(registro.id);

            }

        }catch(e){
            console.error("Error actualizando estado del registro id " + registro.id + ": " + e.message);
        }

    }

    return obtenerPlanificacionSupabase(fecha, turno);

}

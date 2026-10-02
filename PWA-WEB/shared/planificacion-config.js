// ========================================
// SUPABASE DEL SISTEMA "PLANIFICACIÓN Y AVANCE"
// ========================================
// Este es un proyecto de Supabase distinto al del resto de la
// plataforma (viene del Apps Script original "Planificación y Avance").

const SUPABASE_URL_PLANIF = "https://iaitqquphjohgsmelhcj.supabase.co/rest/v1";
const SUPABASE_KEY_PLANIF = "sb_publishable_rvEz02miPj1MrBVgLd_auw_FlyrVscs";

// Fallas momentáneas (sin internet un instante, Supabase saturado,
// "statement timeout") hacían que guardar/cargar diera error y al
// segundo intento funcionara. Ahora se reintenta solo, hasta 2 veces,
// cuando la operación se puede repetir sin duplicar datos: lecturas,
// PATCH, DELETE y RPC. Un POST (inserción) NO se reintenta, porque si
// la primera vez sí llegó a grabarse se duplicarían filas.
const PLANIF_REINTENTOS = 2;

function esErrorTransitorioPlanif(status, detalle){
    return status === 0 || status === 408 || status === 429 || status >= 500 ||
        String(detalle || "").indexOf("57014") !== -1; // statement timeout
}

// Convierte la respuesta de error de Supabase en un mensaje legible
function mensajeErrorPlanif(status, detalle){

    let mensaje = detalle;

    try{
        const json = JSON.parse(detalle);
        mensaje = json.message || json.hint || detalle;
        if(json.code === "57014") mensaje = "La base de datos tardó demasiado en responder (timeout). Intenta de nuevo en unos segundos.";
    }catch(e){ /* no era JSON */ }

    if(status === 0) mensaje = "Sin conexión con el servidor. Revisa tu internet e intenta de nuevo.";

    return mensaje || ("Error al conectar con Supabase (HTTP " + status + ")");

}

async function planifFetch(ruta, opciones = {}){

    const headers = Object.assign(
        {
            apikey: SUPABASE_KEY_PLANIF,
            Authorization: "Bearer " + SUPABASE_KEY_PLANIF,
            "Content-Type": "application/json"
        },
        opciones.headers || {}
    );

    const metodo = String(opciones.method || "GET").toUpperCase();
    const repetible = metodo !== "POST" || ruta.indexOf("/rpc/") === 0;

    for(let intento = 0; ; intento++){

        let status = 0;
        let detalle = "";

        try{

            const respuesta = await fetch(
                SUPABASE_URL_PLANIF + ruta,
                Object.assign({}, opciones, { headers })
            );

            const texto = await respuesta.text();

            if(respuesta.ok){
                return texto ? JSON.parse(texto) : null;
            }

            status = respuesta.status;
            detalle = texto;

        }catch(errorRed){
            status = 0;
            detalle = errorRed && errorRed.message;
        }

        if(repetible && intento < PLANIF_REINTENTOS && esErrorTransitorioPlanif(status, detalle)){
            await new Promise(function(r){ setTimeout(r, 700 * (intento + 1)); });
            continue;
        }

        throw new Error(mensajeErrorPlanif(status, detalle));

    }

}

function normalizarTurnoPlanif(turno){
    return (turno === "DÍA" || turno === "DIA") ? "DIA" : turno;
}

// ========================================
// FECHA/TURNO ACTIVO (ventana real de planificación)
// ========================================
// Turno DÍA: 07:00–18:59:59 de la misma fecha.
// Turno NOCHE: 19:00–06:59:59 — empieza a las 19:00 de una fecha y
// cruza medianoche hasta las 07:00 del día siguiente; la "fecha" que
// le corresponde es la fecha en la que EMPEZÓ (19:00), no en la que
// amanece. Por eso entre 00:00 y 07:00 el turno activo sigue siendo
// NOCHE pero con la fecha de AYER.
function obtenerFechaTurnoActivo(){

    const ahora = new Date();
    const hora = ahora.getHours();

    function formatearFecha(d){
        return d.getFullYear() + "-" +
            String(d.getMonth() + 1).padStart(2, "0") + "-" +
            String(d.getDate()).padStart(2, "0");
    }

    if(hora >= 7 && hora < 19){
        return { fecha: formatearFecha(ahora), turno: "DIA" };
    }

    if(hora >= 19){
        return { fecha: formatearFecha(ahora), turno: "NOCHE" };
    }

    const ayer = new Date(ahora);
    ayer.setDate(ayer.getDate() - 1);

    return { fecha: formatearFecha(ayer), turno: "NOCHE" };

}

// Inicio y fin reales (Date local) de un turno, con el mismo criterio
// de arriba: DÍA = fecha 07:00 → fecha 19:00; NOCHE = fecha 19:00 →
// fecha+1 07:00 (la "fecha" del turno noche es el día en que empieza).
function rangoTurnoPlanif(fecha, turno){

    const partes = String(fecha).split("-").map(Number);
    const esNoche = normalizarTurnoPlanif(turno) === "NOCHE";

    const inicio = new Date(partes[0], partes[1] - 1, partes[2], esNoche ? 19 : 7, 0, 0);
    const fin = new Date(inicio.getTime());
    fin.setHours(fin.getHours() + 12);

    return { inicio: inicio, fin: fin };

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
// TNL DESPACHADAS (Sheet "L400", filtrado en el servidor de Google)
// ========================================
// A diferencia de leerStatusPendienteCSV (descarga el Sheet completo),
// acá se manda la consulta (fecha + turno) directo a Google vía su API
// de Visualization Query — Google filtra y solo devuelve la suma de la
// columna TN que corresponde, en vez de bajar las ~10,000 filas del
// Sheet completo (~5.9 MB) cada vez que se actualiza Hora x Hora.
//
// Columnas del Sheet L400 (por letra, ya verificadas): J = TN,
// AM = FECHA REPORTE (tipo fecha real), AN = TURNO REPORTE (DIA/NOCHE).
const SHEET_NOMBRE_L400 = "L400";

async function obtenerTnlDespachadasL400(fecha, turno){

    turno = normalizarTurnoPlanif(turno);

    const consulta = "select J where AM = date '" + fecha + "' and AN = '" + turno + "'";

    const url =
        "https://docs.google.com/spreadsheets/d/" + SHEET_ID_PLANIF +
        "/gviz/tq?tqx=out:csv&sheet=" + encodeURIComponent(SHEET_NOMBRE_L400) +
        "&tq=" + encodeURIComponent(consulta);

    const respuesta = await fetch(url);

    if(!respuesta.ok){
        throw new Error("No se pudo leer el Sheet L400");
    }

    const texto = await respuesta.text();
    const filas = parsearCSVFilas(texto);

    let suma = 0;

    filas.forEach(function(fila){
        const valor = Number(fila[0]);
        if(!isNaN(valor)) suma += valor;
    });

    return Math.round(suma * 100) / 100;

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

// Marca como PLANIFICADO exactamente las filas elegidas (por id) y
// desmarca el resto de la fecha/turno. Antes se buscaba cada viaje
// por FO + peso_tn exacto (comparar decimales con "eq" puede no
// encontrar la fila) en un PATCH por viaje, y si alguno fallaba solo
// se escribía en la consola: la pantalla decía "Guardado exitoso"
// aunque ese viaje quedara sin planificar.
async function guardarEstadoPlanificacion(fecha, turno, seleccionados){

    turno = normalizarTurnoPlanif(turno);

    const ids = seleccionados
        .map(function(item){ return Number(item.id); })
        .filter(function(id){ return id > 0; });

    const filtroTurno =
        "?fecha=eq." + encodeURIComponent(fecha) +
        "&turno=eq." + encodeURIComponent(turno);

    if(ids.length > 0){

        const marcados = await planifFetch(
            "/planificacion_diaria" + filtroTurno + "&id=in.(" + ids.join(",") + ")",
            {
                method: "PATCH",
                headers: { "Prefer": "return=representation" },
                body: JSON.stringify({ estado_planificacion: "PLANIFICADO" })
            }
        );

        const cantidad = Array.isArray(marcados) ? marcados.length : 0;

        if(cantidad !== ids.length){
            throw new Error(
                "Solo se pudieron marcar " + cantidad + " de " + ids.length +
                " viajes. Actualiza la tabla e inténtalo de nuevo."
            );
        }

    }

    await planifFetch(
        "/planificacion_diaria" + filtroTurno +
        (ids.length > 0 ? "&id=not.in.(" + ids.join(",") + ")" : ""),
        {
            method: "PATCH",
            headers: { "Prefer": "return=minimal" },
            body: JSON.stringify({ estado_planificacion: null })
        }
    );

    return obtenerPlanificacionSupabase(fecha, turno);

}

// ========================================
// SINCRONIZAR (Drive → Supabase)
// ========================================
// Equivalente a Supabase.js → sincronizarPlanificacion() +
// actualizarEstadosDesdeDrive(), corriendo en el navegador.

// ========================================
// CALCULAR EXTRACCIÓN / PICKING
// ========================================
// No hay forma de saber el split real de un viaje hasta que se
// trabaja (eso lo mide después tareas_almacen_sap, vía Diálogo
// Diario) — esto es una estimación al momento de planificar, usada
// para las metas de Hora x Hora y la necesidad de personal de
// Planificación Recursos (ver hora-x-hora-logica.js y
// recursos-logica.js, función obtenerNecesidadTurno).
//
// Calibrado el 2026-09-02 contra los 30 días reales de SAP
// (2026-08-01 en adelante, mismo dato que Diálogo Diario):
// Extracción 77.7% / Picking 22.3% — reemplaza el 80/20 original,
// que no venía de ninguna medición.
const EXTRACCION_PCT_ESTIMADO = 0.777;
const PICKING_PCT_ESTIMADO = 0.223;

// ctd_extraccion: % estimado del peso del viaje, convertido a paletas (480 kg c/u)
// tnl_picking:    % estimado del peso del viaje, en TN

function calcularExtraccionPicking(pesoTN){

    const peso = Number(pesoTN) || 0;

    return {
        ctd_extraccion: Math.round((peso * EXTRACCION_PCT_ESTIMADO * 1000) / 480),
        tnl_picking: Math.round(peso * PICKING_PCT_ESTIMADO * 100) / 100
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

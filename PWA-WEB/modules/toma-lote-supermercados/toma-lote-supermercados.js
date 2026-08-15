// ========================================
// SESIÓN Y PERMISOS
// ========================================
// Solo el rol Administrador puede ver este módulo.

const sesion = requerirSesion();

if(sesion){

    if(sesion.rol !== "Administrador"){
        window.location.href = "../inicio/home.html";
    }

    document.getElementById("nombreUsuario").textContent = sesion.nombre_completo;
    document.getElementById("rolUsuario").textContent = sesion.rol;

}

const btnPerfil = document.getElementById("btnPerfil");
const menuUsuario = document.getElementById("menuUsuario");

btnPerfil.addEventListener("click", function(e){

    e.stopPropagation();
    menuUsuario.style.display = menuUsuario.style.display === "block" ? "none" : "block";

});

document.addEventListener("click", function(){
    menuUsuario.style.display = "none";
});

document.getElementById("btnCerrarSesion").addEventListener("click", function(e){

    e.preventDefault();
    e.stopPropagation();
    cerrarSesion();

});

// ========================================
// TABS (links del sidebar)
// ========================================

document.querySelectorAll(".tab-link").forEach(function(link){

    link.addEventListener("click", function(e){

        e.preventDefault();

        document.querySelectorAll(".tab-link").forEach(function(l){
            l.classList.remove("activo");
        });

        document.querySelectorAll(".tab-contenido").forEach(function(c){
            c.classList.add("oculto");
        });

        link.classList.add("activo");
        document.getElementById(link.dataset.tab).classList.remove("oculto");

        if(link.dataset.tab === "tabObservaciones"){
            cargarObservaciones();
        }

    });

});

// ========================================
// DATA MODULADO
// ========================================

const archivoDataModulado = document.getElementById("archivoDataModulado");
const nombreDataModulado = document.getElementById("nombreDataModulado");
const fechaDataModulado = document.getElementById("fechaDataModulado");

// Columnas mínimas que debe traer el Excel para aceptar el archivo
// (nombres tal cual vienen en la hoja "DATA MODULADO" del SAP EWM).
const COLUMNAS_ESPERADAS_DATA_MODULADO = [
    "entrega", "tienda", "unidad de transporte", "n° orden de compra",
    "ean o upc (ean 14 spsa)", "cantidad umb", "fo"
];

async function leerFilasDataModuladoExcel(archivo){

    const buffer = await archivo.arrayBuffer();
    const libro = XLSX.read(buffer, { type: "array" });

    const nombreHoja =
        libro.SheetNames.find(n => n.trim().toLowerCase() === "data modulado") ||
        libro.SheetNames[0];

    const hoja = libro.Sheets[nombreHoja];

    return XLSX.utils.sheet_to_json(hoja, { defval: "" });

}

function validarFormatoDataModulado(filasCrudas){

    if(!filasCrudas.length){
        return "El archivo está vacío.";
    }

    const columnasArchivo = Object.keys(filasCrudas[0]).map(c => c.trim().toLowerCase());

    const faltantes = COLUMNAS_ESPERADAS_DATA_MODULADO.filter(
        esperada => !columnasArchivo.includes(esperada)
    );

    if(faltantes.length){
        return "Este archivo no tiene el formato de Data Modulado. Faltan las columnas: " +
            faltantes.join(", ") + ".";
    }

    return null;

}

function normalizarFilaDataModulado(filaOriginal){

    const mapaFila = {};

    Object.keys(filaOriginal).forEach(function(clave){
        mapaFila[clave.trim().toLowerCase()] = filaOriginal[clave];
    });

    function valor(clave){
        const v = mapaFila[clave];
        return (v === undefined || v === null) ? "" : v;
    }

    function num(clave){
        const n = Number(valor(clave));
        return isNaN(n) || valor(clave) === "" ? null : n;
    }

    function texto(clave){
        return String(valor(clave)).trim();
    }

    return {
        numero_almacen: num("número de almacén"),
        entrega: num("entrega"),
        posicion_entrega: num("posición de entrega"),
        tienda: num("tienda"),
        descripcion_tienda: texto("descripción de tienda"),
        unidad_transporte: num("unidad de transporte"),
        tipo_oc: texto("tipo de oc"),
        tipo_proceso: texto("tipo de proceso"),
        pedido: num("pedido"),
        posicion_pedido: num("posición de pedido"),
        orden_compra: num("n° orden de compra"),
        ean_upc: texto("ean o upc (ean 14 spsa)"),
        numero_producto_cliente: num("número de producto cliente"),
        denominacion_producto_cliente: texto("denomin.producto cliente"),
        cantidad_umb: num("cantidad umb"),
        fo: num("fo")
    };

}

archivoDataModulado.addEventListener("change", async function(e){

    const archivo = e.target.files[0];

    if(!archivo){
        return;
    }

    nombreDataModulado.textContent = "Leyendo " + archivo.name + "...";

    try{

        const filasCrudas = await leerFilasDataModuladoExcel(archivo);

        const errorFormato = validarFormatoDataModulado(filasCrudas);

        if(errorFormato){
            alert(errorFormato);
            nombreDataModulado.textContent = "-";
            archivoDataModulado.value = "";
            return;
        }

        const filasNormalizadas = filasCrudas
            .map(normalizarFilaDataModulado)
            .filter(f => f.entrega !== null && f.fo !== null);

        if(!filasNormalizadas.length){
            alert("No se encontraron filas válidas en el archivo (revisa columnas ENTREGA y FO).");
            nombreDataModulado.textContent = "-";
            archivoDataModulado.value = "";
            return;
        }

        // Data Modulado es la base de trabajo actual: si ya hay datos
        // cargados, se reemplazan por completo (no se acumulan cargas
        // viejas mezcladas con la nueva).
        const existentes = await supabaseFetch("/data_modulado?select=id&limit=1");

        if(existentes && existentes.length){

            const confirmado = confirm(
                "Ya hay Data Modulado cargada. ¿Deseas reemplazarla con este archivo (" +
                filasNormalizadas.length + " filas)?"
            );

            if(!confirmado){
                nombreDataModulado.textContent = "-";
                archivoDataModulado.value = "";
                return;
            }

            await supabaseFetch("/data_modulado?id=gt.0", { method: "DELETE" });

        }

        nombreDataModulado.textContent = "Guardando " + archivo.name + "...";

        const cargadoPor = (sesion && (sesion.nombre_completo || sesion.usuario)) || "";

        const filasParaInsertar = filasNormalizadas.map(function(f){
            return Object.assign({}, f, {
                archivo_origen: archivo.name,
                cargado_por: cargadoPor
            });
        });

        // PostgREST no acepta lotes gigantes en una sola petición de
        // forma confiable: se envía en bloques de 200.
        const TAMANO_BLOQUE = 200;

        for(let i = 0; i < filasParaInsertar.length; i += TAMANO_BLOQUE){

            const bloque = filasParaInsertar.slice(i, i + TAMANO_BLOQUE);

            await supabaseFetch("/data_modulado", {
                method: "POST",
                body: JSON.stringify(bloque)
            });

        }

        nombreDataModulado.textContent = archivo.name;
        fechaDataModulado.textContent = new Date().toLocaleDateString("es-PE");

        document.getElementById("totalRegistros").textContent =
            filasNormalizadas.length.toLocaleString("es-PE");

        const viajesUnicos = [...new Set(filasNormalizadas.map(f => f.unidad_transporte))];

        document.getElementById("totalViajes").textContent =
            viajesUnicos.length.toLocaleString("es-PE");

        cargarViajesReales(filasNormalizadas);

    }catch(err){

        console.error(err);
        alert("No se pudo cargar el archivo: " + err.message);
        nombreDataModulado.textContent = "-";
        archivoDataModulado.value = "";

    }

});

// ========================================
// VIAJES (a partir de Data Modulado real)
// ========================================
// Usuario sigue siendo visual por ahora — Viaje, Entregas, Registros,
// Modulación y Fase ya vienen de datos reales en Supabase.

function cargarViajesReales(filas, conteoModulacionPorViaje, conteoFasePorViaje){

    conteoModulacionPorViaje = conteoModulacionPorViaje || {};
    conteoFasePorViaje = conteoFasePorViaje || {};

    const porViaje = {};

    filas.forEach(function(f){

        const clave = f.unidad_transporte;
        if(clave === null || clave === undefined){
            return;
        }

        if(!porViaje[clave]){
            porViaje[clave] = { viaje: clave, entregas: new Set(), registros: 0 };
        }

        if(f.entrega !== null && f.entrega !== undefined){
            porViaje[clave].entregas.add(f.entrega);
        }

        porViaje[clave].registros++;

    });

    const viajes = Object.values(porViaje).sort((a, b) => a.viaje - b.viaje);

    const cmb = document.getElementById("cmbViaje");
    cmb.innerHTML = "";

    viajes.forEach(function(v){

        const option = document.createElement("option");
        option.value = String(v.viaje);
        option.textContent = v.viaje + " - " + v.entregas.size + " entrega(s)";
        cmb.appendChild(option);

    });

    const tbody = document.getElementById("tblViajes");
    tbody.innerHTML = "";

    viajes.forEach(function(v){

        const tr = document.createElement("tr");

        const conteoModulacion = conteoModulacionPorViaje[v.viaje] || 0;
        const conteoFase = conteoFasePorViaje[v.viaje] || 0;

        const estadoModulacion = conteoModulacion > 0
            ? "Cargada (" + conteoModulacion + ")"
            : "Pendiente";

        const estadoFase = conteoFase > 0
            ? "Cargada (" + conteoFase + ")"
            : "Pendiente";

        tr.innerHTML = `
            <td>${v.viaje}</td>
            <td>${v.entregas.size}</td>
            <td>${v.registros}</td>
            <td>${estadoModulacion}</td>
            <td>${estadoFase}</td>
            <td><span class="estado disponible">Disponible</span></td>
            <td>-</td>
            <td>Ver</td>
        `;

        tbody.appendChild(tr);

    });

}

// Trae el conteo de filas de Modulación ya guardadas por viaje, para
// pintar la columna "Modulación" de la tabla de arriba.
async function obtenerConteoModulacionPorViaje(){

    try{

        const filas = await supabaseFetch("/modulacion?select=viaje");

        const conteo = {};

        (filas || []).forEach(function(f){
            conteo[f.viaje] = (conteo[f.viaje] || 0) + 1;
        });

        return conteo;

    }catch(e){
        console.error(e);
        return {};
    }

}

// Trae el conteo de filas de Fase ya guardadas por viaje, para pintar
// la columna "Fase" de la tabla de arriba.
async function obtenerConteoFasePorViaje(){

    try{

        const filas = await supabaseFetch("/fase?select=viaje");

        const conteo = {};

        (filas || []).forEach(function(f){
            conteo[f.viaje] = (conteo[f.viaje] || 0) + 1;
        });

        return conteo;

    }catch(e){
        console.error(e);
        return {};
    }

}

// Vuelve a traer Data Modulado + conteos de Modulación/Fase y repinta
// la tabla de viajes — se usa después de procesar un viaje y al abrir
// la página.
async function refrescarVistaViajes(){

    const filas = await supabaseFetch(
        "/data_modulado?select=unidad_transporte,entrega"
    );

    if(!filas || !filas.length){
        return;
    }

    const conteoModulacion = await obtenerConteoModulacionPorViaje();
    const conteoFase = await obtenerConteoFasePorViaje();

    cargarViajesReales(filas, conteoModulacion, conteoFase);

}

// ========================================
// CARGAR RESUMEN YA EXISTENTE (al abrir la página)
// ========================================
// Si ya se cargó Data Modulado antes (en otra sesión), se muestra de
// una vez sin tener que volver a subir el archivo.

async function cargarResumenExistente(){

    try{

        const filas = await supabaseFetch(
            "/data_modulado?select=unidad_transporte,entrega,archivo_origen,created_at&order=created_at.desc"
        );

        if(!filas || !filas.length){
            return;
        }

        document.getElementById("totalRegistros").textContent =
            filas.length.toLocaleString("es-PE");

        const viajesUnicos = [...new Set(filas.map(f => f.unidad_transporte))];

        document.getElementById("totalViajes").textContent =
            viajesUnicos.length.toLocaleString("es-PE");

        nombreDataModulado.textContent = filas[0].archivo_origen || "-";
        fechaDataModulado.textContent =
            new Date(filas[0].created_at).toLocaleDateString("es-PE");

        const conteoModulacion = await obtenerConteoModulacionPorViaje();
        const conteoFase = await obtenerConteoFasePorViaje();

        cargarViajesReales(filas, conteoModulacion, conteoFase);

    }catch(e){
        console.error(e);
    }

}

cargarResumenExistente();

// ========================================
// MODULACIÓN Y FASE (real)
// ========================================
// Cadena de validación al procesar un viaje:
//   Modulación  <-> Data Modulado   por "entrega"
//   Fase        <-> Modulación      por "fase" (el código de lote de
//                                    la modulación) y línea por línea
//                                    por "Orden de almacén"
// Todo queda filtrado siempre al viaje seleccionado en el desplegable.

async function guardarEnBloques(tabla, filas){

    const TAMANO_BLOQUE = 200;

    for(let i = 0; i < filas.length; i += TAMANO_BLOQUE){

        const bloque = filas.slice(i, i + TAMANO_BLOQUE);

        await supabaseFetch("/" + tabla, {
            method: "POST",
            body: JSON.stringify(bloque)
        });

    }

}

function excelSerialADate(serial){

    if(serial === "" || serial === null || serial === undefined || isNaN(Number(serial))){
        return null;
    }

    const epochMs = Date.UTC(1899, 11, 30);

    return new Date(epochMs + Number(serial) * 86400000).toISOString().split("T")[0];

}

async function leerFilasModulacionExcel(archivo){

    const buffer = await archivo.arrayBuffer();
    const libro = XLSX.read(buffer, { type: "array" });

    const nombreHoja =
        libro.SheetNames.find(n => n.trim().toLowerCase() === "modulacion") ||
        libro.SheetNames[0];

    const hoja = libro.Sheets[nombreHoja];

    return XLSX.utils.sheet_to_json(hoja, { header: 1, defval: "" });

}

function validarFormatoModulacion(filas){

    if(!filas.length){
        return "El archivo está vacío.";
    }

    const encabezado = filas[0].map(c => String(c).trim().toLowerCase());

    if(encabezado[0] !== "estatus" || encabezado[3] !== "wt modulacion" || encabezado[21] !== "entrega"){
        return "Este archivo no tiene el formato esperado de Modulación " +
            "(Estatus en columna A, WT modulacion en D, entrega en V).";
    }

    return null;

}

function normalizarFilaModulacion(fila, viaje, archivo, cargadoPor){

    function num(indice){
        const v = fila[indice];
        return (v === "" || v === null || v === undefined || isNaN(Number(v))) ? null : Number(v);
    }

    function texto(indice){
        const v = fila[indice];
        return (v === null || v === undefined) ? "" : String(v).trim();
    }

    return {
        viaje: viaje,
        estatus: texto(0),
        ubicacion: texto(1),
        fase: num(2),
        wt_modulacion: num(3),
        orden_compra: num(4),
        ean_upc: texto(5),
        numero_producto: texto(6),
        denominacion_producto: texto(7),
        ctd_teor_um_base: num(8),
        unidad_medida_base: texto(9),
        ctd_teor_um_altern1: num(10),
        un_medida_altern1: texto(11),
        volumen: num(12),
        ctd_teor_um_altern2: num(13),
        un_medida_altern2: texto(14),
        lpn: texto(15),
        numero_producto_cliente: texto(16),
        lote: texto(17),
        fecha_expiracion: excelSerialADate(fila[18]),
        numero_documento_referencia: num(19),
        orden_almacen: num(20),
        entrega: num(21),
        archivo_origen: archivo,
        cargado_por: cargadoPor
    };

}

// Modulación <-> Data Modulado, por "entrega". Devuelve el número de
// filas guardadas, o null si el usuario canceló en algún paso.
async function procesarModulacion(viaje, archivo, cargadoPor){

    const filasCrudas = await leerFilasModulacionExcel(archivo);

    const errorFormato = validarFormatoModulacion(filasCrudas);

    if(errorFormato){
        alert(errorFormato);
        return null;
    }

    const filasNormalizadas = filasCrudas
        .slice(1)
        .map(f => normalizarFilaModulacion(f, viaje, archivo.name, cargadoPor))
        .filter(f => f.entrega !== null || f.wt_modulacion !== null);

    if(!filasNormalizadas.length){
        alert("No se encontraron filas válidas en el archivo de Modulación.");
        return null;
    }

    // Aviso (no bloqueante): toda entrega de Modulación debe existir
    // en Data Modulado para el viaje seleccionado.
    const entregasDataModulado = await supabaseFetch(
        "/data_modulado?select=entrega&unidad_transporte=eq." + viaje
    );

    const entregasValidas = new Set((entregasDataModulado || []).map(f => f.entrega));

    const entregasSinCoincidencia = [...new Set(
        filasNormalizadas
            .map(f => f.entrega)
            .filter(e => e !== null && !entregasValidas.has(e))
    )];

    if(entregasSinCoincidencia.length){

        const continuar = confirm(
            "Ojo: " + entregasSinCoincidencia.length + " entrega(s) de Modulación no aparecen en " +
            "Data Modulado para el viaje " + viaje + " (" +
            entregasSinCoincidencia.slice(0, 5).join(", ") +
            (entregasSinCoincidencia.length > 5 ? "..." : "") +
            "). ¿Seguro que es el archivo correcto? ¿Continuar de todos modos?"
        );

        if(!continuar){
            return null;
        }

    }

    // Modulación es por viaje: si ya hay datos para este viaje, se
    // reemplazan solo los de ese viaje (no los de los demás).
    const existentes = await supabaseFetch(
        "/modulacion?select=id&viaje=eq." + viaje + "&limit=1"
    );

    if(existentes && existentes.length){

        const confirmado = confirm(
            "Ya hay Modulación cargada para el viaje " + viaje + ". ¿Reemplazarla con este archivo (" +
            filasNormalizadas.length + " filas)?"
        );

        if(!confirmado){
            return null;
        }

        await supabaseFetch("/modulacion?viaje=eq." + viaje, { method: "DELETE" });

    }

    await guardarEnBloques("modulacion", filasNormalizadas);

    return filasNormalizadas.length;

}

// ========================================
// FASE
// ========================================
// Encabezados únicos en este archivo (a diferencia de Modulación), así
// que acá sí se puede leer por nombre de columna.

const COLUMNAS_ESPERADAS_FASE = [
    "orden de almacén", "fase", "tarea de almacén"
];

async function leerFilasFaseExcel(archivo){

    const buffer = await archivo.arrayBuffer();
    const libro = XLSX.read(buffer, { type: "array" });

    const nombreHoja =
        libro.SheetNames.find(n => n.trim().toLowerCase() === "fase") ||
        libro.SheetNames[0];

    const hoja = libro.Sheets[nombreHoja];

    return XLSX.utils.sheet_to_json(hoja, { defval: "" });

}

function validarFormatoFase(filasCrudas){

    if(!filasCrudas.length){
        return "El archivo está vacío.";
    }

    const columnasArchivo = Object.keys(filasCrudas[0]).map(c => c.trim().toLowerCase());

    const faltantes = COLUMNAS_ESPERADAS_FASE.filter(
        esperada => !columnasArchivo.includes(esperada)
    );

    if(faltantes.length){
        return "Este archivo no tiene el formato de Fase. Faltan las columnas: " +
            faltantes.join(", ") + ".";
    }

    return null;

}

function normalizarFilaFase(filaOriginal, viaje, archivo, cargadoPor){

    const mapaFila = {};

    Object.keys(filaOriginal).forEach(function(clave){
        mapaFila[clave.trim().toLowerCase()] = filaOriginal[clave];
    });

    function valor(clave){
        const v = mapaFila[clave];
        return (v === undefined || v === null) ? "" : v;
    }

    function num(clave){
        const n = Number(valor(clave));
        return isNaN(n) || valor(clave) === "" ? null : n;
    }

    function texto(clave){
        return String(valor(clave)).trim();
    }

    function fecha(clave){
        return excelSerialADate(valor(clave));
    }

    return {
        viaje: viaje,
        tarea_almacen: num("tarea de almacén"),
        orden_almacen: num("orden de almacén"),
        status_tarea: texto("status de tarea de almacén"),
        producto: texto("producto"),
        descripcion_producto: texto("descripción de producto"),
        fecaduc_fepreferecons: fecha("fecaduc/fepreferecons"),
        lote: texto("lote"),
        tipo_stocks: texto("tipo de stocks"),
        ctd_prev_proced_uma: num("ctd.prev.proced.uma"),
        ctd_real_dest_uma: num("ctd.real dest.uma"),
        ctd_dif_dest_uma: num("ctd.dif.dest.en uma"),
        ubic_procedencia: texto("ubic.procedencia"),
        ubicacion_destino: texto("ubicación de destino"),
        un_medida_alternat: texto("un.medida alternat."),
        cl_proceso_almacen: texto("cl.proceso almacén"),
        ubic_dest_original: texto("ubic.dest.original"),
        un_manipulac_origen: texto("un.manipulac.origen"),
        ump_destino: texto("ump destino"),
        confirmado_por: texto("confirmado por"),
        fecha_confirmacion: fecha("fecha confirmación"),
        hora_confirmacion: texto("hora de confirmación"),
        autor: texto("autor"),
        fecha_creacion: fecha("fecha de creación"),
        hora_creacion: texto("hora de creación"),
        grupo_consolidacion: num("grupo consolidación"),
        fase: num("fase"),
        peso_carga: num("peso de carga"),
        unidad_peso: texto("unidad de peso"),
        cola: texto("cola"),
        tipo_proceso_almacen: texto("tipo proceso almacén"),
        denominacion_tipo_proceso: texto("denomin.tipo proceso almacén"),
        denominacion_tipo_stocks: texto("denominación de tipo de stocks"),
        ctd_prev_proced_umb: num("ctd.prev.proced.umb"),
        ctd_real_dest_umb: num("ctd.real dest.umb"),
        ctd_dif_dest_umb: num("ctd.dif.dest.en umb"),
        unidad_medida_base: texto("unidad medida base"),
        archivo_origen: archivo,
        cargado_por: cargadoPor
    };

}

// Fase <-> Modulación: primero por "fase" (código de lote), después
// línea por línea por "Orden de almacén". Devuelve el número de filas
// guardadas, o null si el usuario canceló o si todavía no hay
// Modulación cargada para este viaje.
async function procesarFase(viaje, archivo, cargadoPor){

    const modulacionViaje = await supabaseFetch(
        "/modulacion?select=fase,orden_almacen&viaje=eq." + viaje
    );

    if(!modulacionViaje || !modulacionViaje.length){
        alert("Todavía no hay Modulación cargada para el viaje " + viaje +
            " — carga Modulación primero, Fase se valida contra ella.");
        return null;
    }

    const filasCrudas = await leerFilasFaseExcel(archivo);

    const errorFormato = validarFormatoFase(filasCrudas);

    if(errorFormato){
        alert(errorFormato);
        return null;
    }

    const filasNormalizadas = filasCrudas
        .map(f => normalizarFilaFase(f, viaje, archivo.name, cargadoPor))
        .filter(f => f.orden_almacen !== null || f.tarea_almacen !== null);

    if(!filasNormalizadas.length){
        alert("No se encontraron filas válidas en el archivo de Fase.");
        return null;
    }

    const fasesModulacion = new Set(modulacionViaje.map(f => f.fase));

    const fasesSinCoincidencia = [...new Set(
        filasNormalizadas
            .map(f => f.fase)
            .filter(f => f !== null && !fasesModulacion.has(f))
    )];

    if(fasesSinCoincidencia.length){

        const continuar = confirm(
            "Ojo: el código de Fase de este archivo (" + fasesSinCoincidencia.join(", ") +
            ") no coincide con el de Modulación para el viaje " + viaje +
            ". ¿Seguro que es el archivo correcto? ¿Continuar de todos modos?"
        );

        if(!continuar){
            return null;
        }

    }

    // Línea por línea: cada Orden de almacén de Fase debe existir en
    // Modulación para este viaje.
    const ordenesModulacion = new Set(modulacionViaje.map(f => f.orden_almacen));

    const ordenesSinCoincidencia = [...new Set(
        filasNormalizadas
            .map(f => f.orden_almacen)
            .filter(o => o !== null && !ordenesModulacion.has(o))
    )];

    if(ordenesSinCoincidencia.length){

        const continuar = confirm(
            "Ojo: " + ordenesSinCoincidencia.length + " Orden(es) de almacén de Fase no calzan línea " +
            "por línea con Modulación del viaje " + viaje + " (" +
            ordenesSinCoincidencia.slice(0, 5).join(", ") +
            (ordenesSinCoincidencia.length > 5 ? "..." : "") +
            "). ¿Continuar de todos modos?"
        );

        if(!continuar){
            return null;
        }

    }

    const existentes = await supabaseFetch(
        "/fase?select=id&viaje=eq." + viaje + "&limit=1"
    );

    if(existentes && existentes.length){

        const confirmado = confirm(
            "Ya hay Fase cargada para el viaje " + viaje + ". ¿Reemplazarla con este archivo (" +
            filasNormalizadas.length + " filas)?"
        );

        if(!confirmado){
            return null;
        }

        await supabaseFetch("/fase?viaje=eq." + viaje, { method: "DELETE" });

    }

    await guardarEnBloques("fase", filasNormalizadas);

    return filasNormalizadas.length;

}

document.getElementById("btnProcesar").addEventListener("click", async function(){

    const btnProcesar = document.getElementById("btnProcesar");

    const viajeTexto = document.getElementById("cmbViaje").value;
    const archivoModulacionInput = document.getElementById("archivoModulacion").files[0];
    const archivoFaseInput = document.getElementById("archivoFase").files[0];

    if(!viajeTexto){
        alert("Seleccione un viaje.");
        return;
    }

    if(!archivoModulacionInput && !archivoFaseInput){
        alert("Seleccione al menos un archivo (Modulación y/o Fase).");
        return;
    }

    const viaje = Number(viajeTexto);
    const cargadoPor = (sesion && (sesion.nombre_completo || sesion.usuario)) || "";

    btnProcesar.disabled = true;

    const resultados = [];

    try{

        if(archivoModulacionInput){

            btnProcesar.textContent = "Procesando Modulación...";

            const guardadas = await procesarModulacion(viaje, archivoModulacionInput, cargadoPor);

            if(guardadas !== null){
                resultados.push("Modulación: " + guardadas + " filas.");
                document.getElementById("archivoModulacion").value = "";
            }

        }

        if(archivoFaseInput){

            btnProcesar.textContent = "Procesando Fase...";

            const guardadas = await procesarFase(viaje, archivoFaseInput, cargadoPor);

            if(guardadas !== null){
                resultados.push("Fase: " + guardadas + " filas.");
                document.getElementById("archivoFase").value = "";
            }

        }

        if(resultados.length){
            alert("Viaje " + viaje + " procesado.\n" + resultados.join("\n"));
        }

        await refrescarVistaViajes();

    }catch(err){

        console.error(err);
        alert("No se pudo procesar el viaje: " + err.message);

    }finally{

        btnProcesar.disabled = false;
        btnProcesar.textContent = "PROCESAR VIAJE";

    }

});

// ========================================
// OBSERVACIONES
// ========================================
// Se calcula sola comparando Data Modulado (cantidad solicitada)
// contra Modulación (cantidad modulada), agrupado por Orden de Compra
// + Número de producto CLIENTE — mismo criterio que la hoja
// OBSERVACIONES del Excel original. No se sube ningún archivo acá.

function formatearNumeroToma(n){
    return Number(n || 0).toLocaleString("es-PE", { maximumFractionDigits: 2 });
}

async function cargarObservaciones(){

    const tbody = document.getElementById("tblObservaciones");
    tbody.innerHTML = `<tr><td colspan="7" class="sin-datos">Calculando...</td></tr>`;

    try{

        const [dataModulado, modulacionFilas] = await Promise.all([
            supabaseFetch(
                "/data_modulado?select=fo,orden_compra,numero_producto_cliente," +
                "denominacion_producto_cliente,cantidad_umb"
            ),
            supabaseFetch(
                "/modulacion?select=orden_compra,numero_producto_cliente,ctd_teor_um_base"
            )
        ]);

        if(!dataModulado || !dataModulado.length){
            tbody.innerHTML =
                `<tr><td colspan="7" class="sin-datos">Carga Data Modulado y Modulación para ver las observaciones.</td></tr>`;
            return;
        }

        function claveGrupo(ordenCompra, numeroProducto){
            return ordenCompra + "|" + numeroProducto;
        }

        const solicitado = {};

        dataModulado.forEach(function(f){

            const clave = claveGrupo(f.orden_compra, f.numero_producto_cliente);

            if(!solicitado[clave]){
                solicitado[clave] = {
                    fo: f.fo,
                    ordenCompra: f.orden_compra,
                    producto: f.denominacion_producto_cliente,
                    ctdSolicitada: 0
                };
            }

            solicitado[clave].ctdSolicitada += Number(f.cantidad_umb || 0);

        });

        const modulado = {};

        (modulacionFilas || []).forEach(function(f){

            const clave = claveGrupo(f.orden_compra, f.numero_producto_cliente);

            modulado[clave] = (modulado[clave] || 0) + Number(f.ctd_teor_um_base || 0);

        });

        const filas = Object.keys(solicitado).map(function(clave){

            const s = solicitado[clave];
            const ctdModulada = modulado[clave] || 0;
            const diferencia = s.ctdSolicitada - ctdModulada;

            return {
                fo: s.fo,
                ordenCompra: s.ordenCompra,
                producto: s.producto,
                ctdSolicitada: s.ctdSolicitada,
                ctdModulada: ctdModulada,
                diferencia: diferencia,
                filtro: diferencia === 0 ? "OK" : "REVISAR"
            };

        });

        // Los descuadres (REVISAR) van primero — son los que hay que
        // atender; los que ya calzan (OK) quedan al final.
        filas.sort(function(a, b){

            if(a.filtro !== b.filtro){
                return a.filtro === "REVISAR" ? -1 : 1;
            }

            return (a.fo - b.fo) || (a.ordenCompra - b.ordenCompra);

        });

        tbody.innerHTML = "";

        if(!filas.length){
            tbody.innerHTML = `<tr><td colspan="7" class="sin-datos">Sin datos para comparar.</td></tr>`;
            return;
        }

        filas.forEach(function(f){

            const tr = document.createElement("tr");

            const colorFiltro = f.filtro === "OK" ? "#15803d" : "#c0392b";

            tr.innerHTML = `
                <td>${f.fo}</td>
                <td>${f.ordenCompra}</td>
                <td>${f.producto || "-"}</td>
                <td>${formatearNumeroToma(f.ctdSolicitada)}</td>
                <td>${formatearNumeroToma(f.ctdModulada)}</td>
                <td>${formatearNumeroToma(f.diferencia)}</td>
                <td style="color:${colorFiltro};font-weight:700;">${f.filtro}</td>
            `;

            tbody.appendChild(tr);

        });

    }catch(e){

        console.error(e);
        tbody.innerHTML = `<tr><td colspan="7" class="sin-datos">No se pudo calcular Observaciones.</td></tr>`;

    }

}

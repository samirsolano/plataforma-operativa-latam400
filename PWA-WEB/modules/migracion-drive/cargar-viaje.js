// ========================================
// FACTURACIÓN › CARGAR VIAJE
// ========================================
// 1. Cruce de Viajes: se pegan los FO copiados de SAP y se cruzan con
//    los viajes ya SUBIDOS de md_viajes (función md_viajes_existentes):
//    quedan solo los nuevos. Lo cruzado o procesado que no se subió
//    vuelve a salir como nuevo.
//    Los nuevos se guardan en la misma md_viajes (estado NUEVO, con
//    fecha_cruce y cruzado_por): así "Cruzados sin subir" muestra todo
//    lo que se cruzó y no se subió, y se puede retomar.
// 2/3. Se suben el Monitor GRE y el VL06F (Excel de SAP), se leen en el
//    navegador con SheetJS y se quedan solo las entregas de los viajes
//    nuevos.
// 4. Procesar viajes: calcula la gestión y la acción de cada entrega
//    con md_reglas_gestion (misma lógica que la consulta "Consulta1"
//    de la plantilla F-LAT-055, ver migracion-drive.sql), suma el VL06F
//    por entrega y por viaje y guarda md_viajes + md_entregas.
//
// Tablas en el Supabase principal (supabaseFetch, shared/supabase-config.js).

const cargaViaje = {
    cruce: null,     // { fecha, totalPegados, nuevos: [], existian: [], descripcion? }
    sinSubir: [],    // md_viajes cruzados que todavía no están SUBIDO
    monitor: null,   // filas del Monitor GRE (objetos por encabezado)
    vl06f: null      // filas del VL06F
};

// Columnas que tienen que venir en cada archivo (nombre exacto de SAP).
const COLUMNAS_MONITOR = ["Entrega", "Orden de flete (FO)"];
const COLUMNAS_VL06F = ["Entrega", "Peso total"];

// Orden en que se muestran las gestiones; las que no estén acá van al final.
const ORDEN_GESTIONES = [
    "CANAL MODERNO", "RL CMP", "RL AS", "N/S CHICO",
    "LARGA DISTANCIA", "TRASLADO", "DEX"
];

function textoCantidadViajes(cantidad){
    return cantidad + (cantidad === 1 ? " viaje" : " viajes");
}

// Igual que LimpiarTexto de la plantilla: mayúsculas, sin espacios
// invisibles ni dobles, sin espacios al inicio/fin.
function limpiarTexto(valor){

    if(valor === null || valor === undefined){
        return "";
    }

    return String(valor)
        .replace(/ /g, " ")
        .replace(/[\u0000-\u001f]/g, "")
        .split(" ")
        .filter(function(parte){ return parte !== ""; })
        .join(" ")
        .toUpperCase();

}

// Entregas, FO y códigos de SAP a veces llegan como número: se pasan a
// texto sin decimales para que crucen siempre igual.
function textoCodigo(valor){

    if(valor === null || valor === undefined){
        return "";
    }

    if(typeof valor === "number"){
        return String(Math.round(valor));
    }

    return String(valor).trim();

}

function numero(valor){

    if(typeof valor === "number"){
        return valor;
    }

    const n = Number(String(valor || "").replace(/\s/g, "").replace(",", "."));

    return isNaN(n) ? 0 : n;

}

function redondear(valor, decimales){
    const factor = Math.pow(10, decimales);
    return Math.round(valor * factor) / factor;
}

// ========================================
// 1. CRUCE DE VIAJES
// ========================================

function viajesPegados(){

    const viajes = document.getElementById("cvTextoPegado").value
        .split(/\r?\n/)
        .map(function(linea){ return linea.trim(); })
        .filter(function(linea){ return linea !== ""; });

    return { total: viajes.length, unicos: Array.from(new Set(viajes)) };

}

function abrirPegarViajes(){
    document.getElementById("cvModalPegar").style.display = "flex";
    document.getElementById("cvTextoPegado").focus();
}

function cerrarPegarViajes(){
    document.getElementById("cvModalPegar").style.display = "none";
}

function contarViajesPegados(){

    const pegados = viajesPegados();
    const repetidos = pegados.total - pegados.unicos.length;

    document.getElementById("cvContadorViajes").textContent =
        textoCantidadViajes(pegados.unicos.length) +
        (repetidos === 1 ? " (1 repetido no se cuenta)" : "") +
        (repetidos > 1 ? " (" + repetidos + " repetidos no se cuentan)" : "");

}

// La respuesta de una función "returns setof text" puede venir como
// ["fo", ...] o como [{ md_viajes_existentes: "fo" }, ...].
function leerListaRpc(respuesta){

    return (respuesta || []).map(function(fila){
        if(typeof fila === "string") return fila;
        return fila.fo || fila.md_viajes_existentes;
    });

}

async function cruzarViajesPegados(){

    const viajes = viajesPegados().unicos;

    if(viajes.length === 0){
        alert("Pega primero los viajes copiados de SAP.");
        return;
    }

    const boton = document.querySelector("#cvModalPegar .cv-btn-subir");
    boton.disabled = true;
    boton.textContent = "⏳ Cruzando...";

    try{

        const existentes = new Set(leerListaRpc(await supabaseFetch(
            "/rpc/md_viajes_existentes",
            { method: "POST", body: JSON.stringify({ p_viajes: viajes }) }
        )));

        const nuevos = viajes.filter(function(v){ return !existentes.has(v); });
        const existian = viajes.filter(function(v){ return existentes.has(v); });

        // Los nuevos quedan en md_viajes: los que no estaban entran como
        // NUEVO; a los cruzados antes y no subidos solo se les actualiza
        // el último cruce (el upsert solo toca estas columnas, no pisa el
        // estado ni lo ya procesado).
        const ahora = new Date().toISOString();
        const cruzadoPor = sesion ? sesion.nombre_completo : null;

        await guardarEnLotes("md_viajes", "fo", nuevos.map(function(fo){
            return { fo: fo, fecha_cruce: ahora, cruzado_por: cruzadoPor, actualizado_en: ahora };
        }));

        cerrarPegarViajes();

        mostrarResultadoCruce({
            fecha: ahora,
            totalPegados: viajes.length,
            nuevos: nuevos,
            existian: existian
        });

        abrirModalViajes("nuevos");
        buscarSinSubir();

    }catch(error){

        console.error(error);
        alert("No se pudo hacer el cruce con la base de datos: " + (error.message || error));

    }finally{

        boton.disabled = false;
        boton.textContent = "🔀 Cruzar viajes";

    }

}

// Deja el cruce como el actual: contadores del paso 1, ventana de la
// tarjeta Nuevos y filtro de los archivos de los pasos 2 y 3.
function mostrarResultadoCruce(cruce){

    cargaViaje.cruce = cruce;

    const fecha = new Date(cruce.fecha);

    document.getElementById("cvArchivoViajes").textContent =
        "📋 " + (cruce.descripcion || textoCantidadViajes(cruce.totalPegados) + " pegados") + " · " +
        fecha.toLocaleDateString() + " " +
        fecha.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

    document.getElementById("cvTotalPegados").textContent = cruce.totalPegados;
    document.getElementById("cvTotalExistian").textContent = cruce.totalPegados - cruce.nuevos.length;
    document.getElementById("cvTotalNuevos").textContent = cruce.nuevos.length;

    // Si ya había archivos cargados, se vuelven a filtrar contra este cruce.
    describirArchivo("monitor");
    describirArchivo("vl06f");
    actualizarBotonProcesar();

}

// ========================================
// CRUZADOS SIN SUBIR
// ========================================
// Todo lo de md_viajes que se cruzó y todavía no está SUBIDO (NUEVO,
// PROCESADO o PENDIENTE), con quién y cuándo lo cruzó. Sirve para
// controlar qué quedó sin subir y para retomarlo si se cerró la página.

async function buscarSinSubir(){

    const boton = document.getElementById("cvBtnUltimoCruce");

    try{

        cargaViaje.sinSubir = await supabaseFetch(
            "/md_viajes?select=fo,estado,gestion,cliente,fecha_cruce,cruzado_por" +
            "&estado=neq.SUBIDO&order=fecha_cruce.desc.nullslast&limit=2000"
        ) || [];

        const total = cargaViaje.sinSubir.length;

        boton.style.display = total ? "block" : "none";
        boton.textContent = "🕘 " + textoCantidadViajes(total) +
            (total === 1 ? " cruzado sin subir" : " cruzados sin subir");

    }catch(error){
        console.error("No se pudieron leer los viajes sin subir:", error);
    }

}

const ESTADOS_SIN_SUBIR = {
    "NUEVO": '<span class="cv-estado cv-estado-nuevo">NUEVO</span>',
    "PROCESADO": '<span class="cv-estado cv-estado-ok">PROCESADO</span>',
    "PENDIENTE": '<span class="cv-estado cv-estado-pendiente">PENDIENTE</span>'
};

function abrirSinSubir(){

    const viajes = cargaViaje.sinSubir;

    document.getElementById("cvSinSubirTexto").textContent =
        textoCantidadViajes(viajes.length) + " que se cruzaron y todavía no se subieron a Status Pendiente." +
        " En el próximo cruce vuelven a salir como nuevos.";

    document.getElementById("cvSinSubirTabla").innerHTML = viajes.map(function(v){
        return '<tr>' +
            '<td>' + escaparHtml(v.fo) + '</td>' +
            '<td>' + (ESTADOS_SIN_SUBIR[v.estado] || escaparHtml(v.estado)) + '</td>' +
            '<td>' + escaparHtml(v.gestion || "-") + '</td>' +
            '<td>' + (v.fecha_cruce ? fechaHoraSp(v.fecha_cruce) : "-") + '</td>' +
            '<td>' + escaparHtml(v.cruzado_por || "-") + '</td>' +
        '</tr>';
    }).join("");

    document.getElementById("cvBtnCopiarSinSubir").textContent = "📋 Copiar viajes";
    document.getElementById("cvModalSinSubir").style.display = "flex";

}

function cerrarSinSubir(){
    document.getElementById("cvModalSinSubir").style.display = "none";
}

function copiarSinSubir(){

    const texto = cargaViaje.sinSubir.map(function(v){ return v.fo; }).join("\n");
    const boton = document.getElementById("cvBtnCopiarSinSubir");

    (navigator.clipboard ? navigator.clipboard.writeText(texto) : Promise.reject()).then(function(){
        boton.textContent = "✅ Copiados";
        setTimeout(function(){ boton.textContent = "📋 Copiar viajes"; }, 2000);
    }).catch(function(){
        alert("No se pudo copiar. Usa Retomar: los viajes quedan en la tarjeta Nuevos para copiarlos.");
    });

}

// Deja los sin subir como el cruce actual, para subir el Monitor GRE y
// el VL06F y procesarlos sin volver a pegarlos.
function retomarSinSubir(){

    const nuevos = cargaViaje.sinSubir.map(function(v){ return v.fo; });

    cerrarSinSubir();

    mostrarResultadoCruce({
        fecha: new Date().toISOString(),
        totalPegados: nuevos.length,
        nuevos: nuevos,
        existian: [],
        descripcion: textoCantidadViajes(nuevos.length) + " sin subir retomados"
    });

    abrirModalViajes("nuevos");

}

// ========================================
// VENTANA VER / COPIAR VIAJES (tarjetas Nuevos / Ya existían)
// ========================================

function abrirModalViajes(tipo){

    const cruce = cargaViaje.cruce;

    if(!cruce){
        alert("Todavía no hay un cruce de viajes. Pega los viajes y toca Cruzar viajes.");
        return;
    }

    const esNuevos = tipo === "nuevos";
    const viajes = esNuevos ? cruce.nuevos : cruce.existian;

    document.getElementById("cvModalViajesTitulo").textContent =
        esNuevos ? "✅ Viajes nuevos" : "Viajes que ya estaban subidos";

    document.getElementById("cvModalViajesTexto").textContent =
        textoCantidadViajes(viajes.length) +
        (esNuevos ? ", uno por línea. Cópialos y pégalos en SAP." : ", uno por línea.");

    document.getElementById("cvModalViajesLista").value = viajes.join("\n");
    document.getElementById("cvBtnCopiarModal").textContent = "📋 Copiar";
    document.getElementById("cvModalViajes").style.display = "flex";

}

function cerrarModalViajes(){
    document.getElementById("cvModalViajes").style.display = "none";
}

// Si el portapapeles del navegador no responde, igual quedan
// seleccionados para copiarlos con Ctrl + C.
function copiarViajesModal(){

    const lista = document.getElementById("cvModalViajesLista");
    const boton = document.getElementById("cvBtnCopiarModal");

    lista.focus();
    lista.select();

    function avisarCopiado(){
        boton.textContent = "✅ Copiados";
        setTimeout(function(){ boton.textContent = "📋 Copiar"; }, 2000);
    }

    function copiarSeleccion(){
        if(document.execCommand("copy")){
            avisarCopiado();
        }else{
            alert("No se pudo copiar solo: los viajes ya quedaron seleccionados, cópialos con Ctrl + C.");
        }
    }

    if(navigator.clipboard && navigator.clipboard.writeText){
        navigator.clipboard.writeText(lista.value).then(avisarCopiado).catch(copiarSeleccion);
    }else{
        copiarSeleccion();
    }

}

// ========================================
// 2 / 3. MONITOR GRE Y VL06F
// ========================================

const ARCHIVOS_CARGAR_VIAJE = {
    monitor: { etiqueta: "cvArchivoMonitor", columnas: COLUMNAS_MONITOR, nombre: "Monitor GRE" },
    vl06f: { etiqueta: "cvArchivoVl06f", columnas: COLUMNAS_VL06F, nombre: "VL06F" }
};

// Lee la primera hoja del Excel. Los encabezados tienen que estar en la
// primera fila (así sale el export de SAP).
function leerExcel(archivo){

    return archivo.arrayBuffer().then(function(buffer){

        const libro = XLSX.read(buffer, { type: "array" });
        const hoja = libro.Sheets[libro.SheetNames[0]];

        return XLSX.utils.sheet_to_json(hoja, { defval: null, raw: true });

    });

}

async function leerArchivoCargarViaje(input, tipo){

    const config = ARCHIVOS_CARGAR_VIAJE[tipo];
    const etiqueta = document.getElementById(config.etiqueta);
    const archivo = input.files && input.files[0];

    cargaViaje[tipo] = null;
    etiqueta.className = "cv-archivo";

    if(!archivo){
        etiqueta.textContent = "Ningún archivo seleccionado";
        actualizarBotonProcesar();
        return;
    }

    etiqueta.textContent = "⏳ Leyendo " + archivo.name + "...";

    try{

        const filas = await leerExcel(archivo);
        const encabezados = filas.length ? Object.keys(filas[0]) : [];
        const faltan = config.columnas.filter(function(c){ return encabezados.indexOf(c) === -1; });

        if(faltan.length){
            throw new Error("al archivo le faltan las columnas: " + faltan.join(", ") +
                ". ¿Es el " + config.nombre + "?");
        }

        cargaViaje[tipo] = { nombre: archivo.name, filas: filas };
        describirArchivo(tipo);

    }catch(error){

        console.error(error);
        etiqueta.className = "cv-archivo cv-error";
        etiqueta.textContent = "❌ " + archivo.name + ": " + (error.message || error);
        input.value = "";

    }

    actualizarBotonProcesar();

}

// Cuántas filas del archivo son de los viajes nuevos del cruce actual.
function describirArchivo(tipo){

    const datos = cargaViaje[tipo];

    if(!datos){
        return;
    }

    const etiqueta = document.getElementById(ARCHIVOS_CARGAR_VIAJE[tipo].etiqueta);
    const entregas = tipo === "monitor" ? entregasMonitorNuevas() : null;

    let detalle = datos.filas.length + " filas";

    if(cargaViaje.cruce && tipo === "monitor"){
        detalle += " · " + entregas.length + " entregas de viajes nuevos";
    }

    if(cargaViaje.cruce && tipo === "vl06f"){
        const delCruce = new Set(entregasMonitorNuevas().map(function(e){ return e.entrega; }));
        const lineas = cargaViaje.monitor
            ? datos.filas.filter(function(f){ return delCruce.has(textoCodigo(f["Entrega"])); }).length
            : null;
        if(lineas !== null) detalle += " · " + lineas + " líneas de viajes nuevos";
    }

    etiqueta.className = "cv-archivo cv-ok";
    etiqueta.textContent = "📄 " + datos.nombre + " · " + detalle;

}

// Entregas del Monitor GRE que pertenecen a los viajes nuevos del cruce.
function entregasMonitorNuevas(){

    if(!cargaViaje.monitor || !cargaViaje.cruce){
        return [];
    }

    const nuevos = new Set(cargaViaje.cruce.nuevos);
    const vistas = new Set();

    return cargaViaje.monitor.filas
        .map(function(f){
            return {
                entrega: textoCodigo(f["Entrega"]),
                fo: textoCodigo(f["Orden de flete (FO)"]),
                fila: f
            };
        })
        .filter(function(e){
            if(!e.entrega || !nuevos.has(e.fo) || vistas.has(e.entrega)) return false;
            vistas.add(e.entrega);
            return true;
        });

}

// "Procesar viajes" se activa cuando hay cruce con viajes nuevos y
// están los dos archivos.
function actualizarBotonProcesar(){

    const faltan = [];

    if(!cargaViaje.cruce) faltan.push("cruza los viajes");
    else if(cargaViaje.cruce.nuevos.length === 0) faltan.push("no hay viajes nuevos en el cruce");
    if(!cargaViaje.monitor) faltan.push("sube el Monitor GRE");
    if(!cargaViaje.vl06f) faltan.push("sube el VL06F");

    document.getElementById("cvBtnProcesarViajes").disabled = faltan.length > 0;

    document.getElementById("cvProcesarTexto").textContent = faltan.length > 0
        ? "Falta: " + faltan.join(", ") + "."
        : "Listo para procesar los viajes nuevos.";

}

// ========================================
// 4. GESTIÓN (md_reglas_gestion)
// ========================================
// Misma prioridad que la plantilla: 1. cliente (por código de
// destinatario, mapeado en la vista Clientes: plantas de Alicorp, CD
// MASS...; si no, por nombre), 2. Lima - Lima/Callao
// por organización de ventas (RL AS / RL CMP), 3. Lima provincia,
// 4. destino (empieza con), 5. LARGA DISTANCIA. La acción (PROCESAR /
// SUBIR) solo la define la regla de cliente. "nombre" viene de la
// regla DESTINATARIO (ej. CD ALICORP AREQUIPA en vez de "Prd
// Terminado 01").

function calcularGestion(reglas, cliente, destinatarioCodigo, destino, organizacion){

    cliente = limpiarTexto(cliente);
    destino = limpiarTexto(destino);
    const codigo = textoCodigo(destinatarioCodigo);
    const org = Number(organizacion);

    // El código manda sobre el nombre: un mismo cliente (ej. COMPAÑIA
    // HARD DISCOUNT) tiene varios CD, cada uno con su código.
    const reglaCliente =
        reglas.find(function(r){
            return r.tipo_regla === "DESTINATARIO" && codigo !== "" && textoCodigo(r.destinatario_codigo) === codigo;
        }) ||
        reglas.find(function(r){
            return r.tipo_regla === "CLIENTE" && limpiarTexto(r.cliente) === cliente;
        });

    const accion = reglaCliente ? reglaCliente.accion : "SUBIR";

    if(reglaCliente && reglaCliente.gestion){
        return { gestion: reglaCliente.gestion, accion: accion, nombre: reglaCliente.nombre || null };
    }

    const esLimaLima = destino.indexOf("LIMA - LIMA") === 0;
    const esLimaCallao = esLimaLima || destino.indexOf("CALLAO") === 0;

    if(esLimaCallao && org === 1012){
        return { gestion: "RL AS", accion: accion };
    }

    if(esLimaCallao && (org === 1010 || org === 1011)){
        return { gestion: "RL CMP", accion: accion };
    }

    const reglasDestino = reglas.filter(function(r){
        return r.tipo_regla === "DESTINO" || r.tipo_regla === "TIPO_DESTINO";
    });

    const limaProvincia = reglasDestino.find(function(r){
        return r.tipo_regla === "TIPO_DESTINO" && limpiarTexto(r.destino) === "LIMA PROVINCIA";
    });

    if(limaProvincia && destino.indexOf("LIMA") === 0 && !esLimaLima){
        return { gestion: limaProvincia.gestion, accion: accion };
    }

    const reglaDestino = reglasDestino.find(function(r){
        const d = limpiarTexto(r.destino);
        return d !== "" && destino.indexOf(d) === 0;
    });

    if(reglaDestino && reglaDestino.gestion){
        return { gestion: reglaDestino.gestion, accion: accion };
    }

    return { gestion: "LARGA DISTANCIA", accion: accion };

}

// ========================================
// 4. PROCESAR VIAJES
// ========================================

// Suma el VL06F por entrega (una fila por material → una por entrega).
function resumirVl06f(entregasBuscadas){

    const resumen = {};

    cargaViaje.vl06f.filas.forEach(function(f){

        const entrega = textoCodigo(f["Entrega"]);

        if(!entregasBuscadas.has(entrega)){
            return;
        }

        if(!resumen[entrega]){
            resumen[entrega] = {
                documento_modelo: textoCodigo(f["Documento modelo"]) || null,
                destinatario_codigo: textoCodigo(f["Destinatario mcía."]) || null,
                destinatario_nombre: f["Nombre destinatario de mercancías"] || null,
                lugar_destinatario: f["Lugar destinatario mercancías"] || null,
                solicitante: textoCodigo(f["Solicitante"]) || null,
                organizacion_ventas: textoCodigo(f["Organización ventas"]) || null,
                ruta: f["Ruta"] || null,
                peso_kg: 0,
                cantidad_lineas: 0,
                cantidad_cja: 0,
                cantidad_pqt: 0,
                cantidad_und: 0,
                materiales: new Set()
            };
        }

        const r = resumen[entrega];
        const unidad = limpiarTexto(f["Un.medida venta"]);
        const cantidad = numero(f["Cantidad entrega"]);

        r.peso_kg += numero(f["Peso total"]);
        r.cantidad_lineas += 1;
        if(f["Material"] !== null && f["Material"] !== undefined) r.materiales.add(textoCodigo(f["Material"]));

        if(unidad === "CJA") r.cantidad_cja += cantidad;
        if(unidad === "PQT") r.cantidad_pqt += cantidad;
        if(unidad === "UND") r.cantidad_und += cantidad;

    });

    return resumen;

}

// Arma las filas de md_entregas y md_viajes de los viajes nuevos.
function armarViajes(reglas){

    const entregasMonitor = entregasMonitorNuevas();
    const resumen = resumirVl06f(new Set(entregasMonitor.map(function(e){ return e.entrega; })));

    const entregas = entregasMonitor.map(function(e){

        const m = e.fila;
        const v = resumen[e.entrega];

        // El cliente sale del Monitor GRE (como en la plantilla); si el
        // archivo no trae esa columna, del destinatario del VL06F.
        const clienteMonitor = m["Nombre Cliente Destinatario"] || null;
        const destinatarioCodigo = textoCodigo(m["Código Cliente Destinatario"]) || (v && v.destinatario_codigo) || null;
        const g = calcularGestion(
            reglas,
            clienteMonitor || (v && v.destinatario_nombre),
            destinatarioCodigo,
            v ? v.lugar_destinatario : null,
            v ? v.organizacion_ventas : null
        );
        // Si el código está mapeado en Clientes, se muestra ese nombre
        // (ej. CD MASS CALLAO en vez de COMPAÑIA HARD DISCOUNT S.A.C.).
        const clienteNombre = g.nombre || clienteMonitor || (v && v.destinatario_nombre) || null;

        return Object.assign({
            entrega: e.entrega,
            fo: e.fo,

            serie_guia: textoCodigo(m["Serie"]) || null,
            correlativo_guia: textoCodigo(m["Número de Correlativo"]) || null,
            numero_transporte: textoCodigo(m["Nº de transporte"]) || null,
            placa: m["Placa"] || null,
            brevete_conductor: m["Brevete de Conductor"] || null,
            nombre_conductor: m["Nombre de Conductor"] || null,
            cliente_codigo: textoCodigo(m["Código Cliente Destinatario"]) || null,
            cliente_nombre: clienteNombre,

            gestion: g.gestion,
            accion: g.accion,

            transportista_codigo: textoCodigo(m["Codigo Transportista"]) || null,
            transportista_nombre: m["Nombre Transportista"] || null,

            tiene_vl06f: !!v
        }, {
            // Siempre las mismas columnas (null si la entrega no está en
            // el VL06F): un insert en lote exige las mismas en todas.
            documento_modelo: v ? v.documento_modelo : null,
            destinatario_codigo: v ? v.destinatario_codigo : null,
            destinatario_nombre: v ? v.destinatario_nombre : null,
            lugar_destinatario: v ? v.lugar_destinatario : null,
            solicitante: v ? v.solicitante : null,
            organizacion_ventas: v ? v.organizacion_ventas : null,
            ruta: v ? v.ruta : null,
            peso_kg: v ? redondear(v.peso_kg, 3) : null,
            cantidad_lineas: v ? v.cantidad_lineas : null,
            cantidad_cja: v ? v.cantidad_cja : null,
            cantidad_pqt: v ? v.cantidad_pqt : null,
            cantidad_und: v ? v.cantidad_und : null
        });

    });

    // Viaje = primera entrega con VL06F (gestión, acción, destino,
    // cliente) + suma de pesos, como AgruparFO en la plantilla.
    const porViaje = {};

    entregas.forEach(function(e){

        if(!porViaje[e.fo]){
            porViaje[e.fo] = {
                fo: e.fo,
                cargado_por: sesion ? sesion.nombre_completo : null,
                transportista_codigo: e.transportista_codigo,
                transportista_nombre: e.transportista_nombre,
                ruta: e.ruta || null,
                gestion: e.gestion,
                accion: e.accion,
                destino: e.lugar_destinatario || null,
                cliente: e.cliente_nombre,
                peso_kg: 0,
                cantidad_entregas: 0,
                entregas_sin_vl06f: 0,
                skus: new Set(),
                base_con_vl06f: e.tiene_vl06f,
                estado: "PROCESADO"
            };
        }

        const v = porViaje[e.fo];
        v.peso_kg += e.peso_kg || 0;
        v.cantidad_entregas += 1;
        if(!e.tiene_vl06f) v.entregas_sin_vl06f += 1;
        if(resumen[e.entrega]) resumen[e.entrega].materiales.forEach(function(m){ v.skus.add(m); });

        // Si la primera entrega no estaba en el VL06F (sin destino ni
        // organización, su gestión no vale), manda la primera que sí.
        if(!v.base_con_vl06f && e.tiene_vl06f){
            v.base_con_vl06f = true;
            v.gestion = e.gestion;
            v.accion = e.accion;
            v.destino = e.lugar_destinatario;
            v.cliente = e.cliente_nombre;
            v.ruta = e.ruta;
        }

    });

    const viajes = Object.keys(porViaje).map(function(fo){
        const v = porViaje[fo];
        v.peso_tn = redondear(v.peso_kg / 1000, 3);
        v.cantidad_skus = v.skus.size;
        // Con entregas sin VL06F el viaje queda PENDIENTE: vuelve a salir
        // como nuevo en el próximo cruce para completarlo.
        v.estado = v.entregas_sin_vl06f > 0 ? "PENDIENTE" : "PROCESADO";
        return v;
    });

    const conDatos = new Set(viajes.map(function(v){ return v.fo; }));
    const sinMonitor = cargaViaje.cruce.nuevos.filter(function(fo){ return !conDatos.has(fo); });

    return { viajes: viajes, entregas: entregas, sinMonitor: sinMonitor };

}

// Guarda en lotes para no mandar miles de filas en un solo pedido.
async function guardarEnLotes(tabla, conflicto, filas){

    const LOTE = 500;

    for(let i = 0; i < filas.length; i += LOTE){
        await supabaseFetch("/" + tabla + "?on_conflict=" + conflicto, {
            method: "POST",
            headers: { "Prefer": "resolution=merge-duplicates,return=minimal" },
            body: JSON.stringify(filas.slice(i, i + LOTE))
        });
    }

}

async function procesarViajesNuevos(){

    const boton = document.getElementById("cvBtnProcesarViajes");
    boton.disabled = true;
    boton.textContent = "⏳ Procesando...";

    try{

        const reglas = await supabaseFetch("/md_reglas_gestion?select=tipo_regla,cliente,destino,destinatario_codigo,nombre,gestion,accion");
        const resultado = armarViajes(reglas || []);

        // Retomar los sin subir o procesar dos veces puede
        // traer viajes que ya se subieron: no se vuelven a guardar, si no
        // pasarían a PROCESADO y saldrían de Status Pendiente.
        const yaSubidos = new Set(leerListaRpc(await supabaseFetch(
            "/rpc/md_viajes_existentes",
            { method: "POST", body: JSON.stringify({ p_viajes: resultado.viajes.map(function(v){ return v.fo; }) }) }
        )));

        resultado.yaSubidos = resultado.viajes
            .filter(function(v){ return yaSubidos.has(v.fo); })
            .map(function(v){ return v.fo; });
        resultado.viajes = resultado.viajes.filter(function(v){ return !yaSubidos.has(v.fo); });
        resultado.entregas = resultado.entregas.filter(function(e){ return !yaSubidos.has(e.fo); });

        if(resultado.viajes.length === 0 && resultado.yaSubidos.length){
            alert("Todos estos viajes ya están subidos en Status Pendiente: no hay nada que procesar.");
            return;
        }

        if(resultado.viajes.length === 0){
            alert("Ninguno de los viajes nuevos aparece en el Monitor GRE. Revisa que sea el Monitor de estos viajes.");
            return;
        }

        const ahora = new Date().toISOString();

        // md_viajes primero (md_entregas apunta a md_viajes).
        await guardarEnLotes("md_viajes", "fo", resultado.viajes.map(function(v){
            return {
                fo: v.fo,
                cargado_por: v.cargado_por,
                transportista_codigo: v.transportista_codigo,
                transportista_nombre: v.transportista_nombre,
                ruta: v.ruta,
                gestion: v.gestion,
                accion: v.accion,
                destino: v.destino,
                cliente: v.cliente,
                peso_tn: v.peso_tn,
                cantidad_entregas: v.cantidad_entregas,
                cantidad_skus: v.cantidad_skus,
                estado: v.estado,
                actualizado_en: ahora
            };
        }));

        await guardarEnLotes("md_entregas", "entrega", resultado.entregas.map(function(e){
            const fila = Object.assign({}, e, { actualizado_en: ahora });
            delete fila.transportista_codigo;
            delete fila.transportista_nombre;
            return fila;
        }));

        cargaViaje.resultado = resultado;
        pintarViajesProcesados(resultado);
        buscarSinSubir();

    }catch(error){

        console.error(error);
        alert("No se pudieron procesar los viajes: " + (error.message || error));

    }finally{

        boton.textContent = "⚙️ Procesar viajes";
        actualizarBotonProcesar();

    }

}

// ========================================
// TABLA DE VIAJES PROCESADOS (un bloque por gestión)
// ========================================

function escaparHtml(texto){
    return String(texto === null || texto === undefined ? "" : texto)
        .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// sinMover: true al repintar después de Subir viaje (no salta la pantalla).
function pintarViajesProcesados(resultado, sinMover){

    const contenedor = document.getElementById("cvViajesProcesados");
    const grupos = {};

    resultado.viajes.forEach(function(v){
        (grupos[v.gestion] = grupos[v.gestion] || []).push(v);
    });

    const nombres = Object.keys(grupos).sort(function(a, b){
        const ia = ORDEN_GESTIONES.indexOf(a), ib = ORDEN_GESTIONES.indexOf(b);
        return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib) || a.localeCompare(b);
    });

    const subidos = resultado.viajes.filter(function(v){ return v.estado === "SUBIDO"; }).length;
    const pesoTotal = resultado.viajes.reduce(function(s, v){ return s + v.peso_tn; }, 0);
    const sinVl06f = resultado.entregas.filter(function(e){ return !e.tiene_vl06f; }).length;

    let html =
        '<div class="cv-tabla-header">' +
            '<h2>Viajes nuevos procesados</h2>' +
            '<p>' + textoCantidadViajes(resultado.viajes.length) + ' · ' +
                resultado.entregas.length + ' entregas · ' + redondear(pesoTotal, 2) + ' TN. ' +
                'Ya quedaron guardados en la Base de Datos' +
                (subidos ? ' · ' + subidos + ' subidos a Status Pendiente' : '') + '.</p>' +
        '</div>';

    const avisos = [];

    if(resultado.sinMonitor.length){
        const uno = resultado.sinMonitor.length === 1;
        avisos.push("<b>" + textoCantidadViajes(resultado.sinMonitor.length) +
            (uno ? " nuevo no aparece" : " nuevos no aparecen") + " en el Monitor GRE</b> y " +
            (uno ? "no se guardó: " : "no se guardaron: ") +
            resultado.sinMonitor.map(escaparHtml).join(", ") + ".");
    }

    if(resultado.yaSubidos && resultado.yaSubidos.length){
        const uno = resultado.yaSubidos.length === 1;
        avisos.push("<b>" + textoCantidadViajes(resultado.yaSubidos.length) +
            (uno ? " ya estaba subido" : " ya estaban subidos") + "</b> a Status Pendiente y no se " +
            (uno ? "volvió" : "volvieron") + " a procesar: " +
            resultado.yaSubidos.map(escaparHtml).join(", ") + ".");
    }

    const pendientes = resultado.viajes.filter(function(v){ return v.estado === "PENDIENTE"; }).length;

    if(sinVl06f){
        avisos.push("<b>" + textoCantidadViajes(pendientes) + " en PENDIENTE</b>: " +
            sinVl06f + (sinVl06f === 1 ? " entrega no aparece" : " entregas no aparecen") +
            " en el VL06F (sin peso ni destino). En el próximo cruce " +
            (pendientes === 1 ? "vuelve" : "vuelven") +
            " a salir como " + (pendientes === 1 ? "nuevo" : "nuevos") +
            ": sube un VL06F que traiga esas entregas para " +
            (pendientes === 1 ? "completarlo." : "completarlos."));
    }

    if(avisos.length){
        html += '<div class="cv-aviso">' + avisos.join("<br>") + '</div>';
    }

    nombres.forEach(function(gestion){

        const viajes = grupos[gestion];
        const todosProcesar = viajes.every(function(v){ return v.accion === "PROCESAR"; });
        const faltanSubir = viajes.some(function(v){ return v.accion === "SUBIR" && v.estado !== "SUBIDO"; });
        const gestionJs = escaparHtml(JSON.stringify(gestion));

        html +=
            '<div class="cv-grupo">' +
                '<div class="cv-grupo-header">' +
                    '<h3>' + escaparHtml(gestion) + ' <span>' + textoCantidadViajes(viajes.length) + '</span></h3>' +
                    (todosProcesar
                        ? '<button class="cv-btn-procesar" onclick="procesarViajeCargarViaje(null, ' + gestionJs + ')">⚙️ Procesar masivo</button>'
                        : '<button class="cv-btn-drive" ' + (faltanSubir ? '' : 'disabled ') +
                            'onclick="subirAlDriveCargarViaje(null, ' + gestionJs + ')">' +
                            (faltanSubir ? '☁️ Subir masivo' : '✅ Todo subido') + '</button>') +
                '</div>' +
                '<div class="cv-tabla-contenedor">' +
                    '<table class="cv-tabla">' +
                        '<thead><tr>' +
                            '<th>Viaje</th><th>Destino</th><th>Cliente</th>' +
                            '<th>Peso (TNL)</th><th>Transporte</th><th>Estado</th><th></th>' +
                        '</tr></thead>' +
                        '<tbody>';

        // Un bloque por cliente, cada uno con su fila de encabezado (total
        // y botón). Los de acción PROCESAR (Canal Moderno) se procesan
        // juntos con el botón del cliente y van primero; los de SUBIR
        // tienen "Subir cliente" y además su botón por viaje.
        const porCliente = {};

        viajes.forEach(function(v){
            const c = v.cliente || "SIN CLIENTE";
            (porCliente[c] = porCliente[c] || []).push(v);
        });

        const esProcesar = function(c){
            return porCliente[c].every(function(v){ return v.accion === "PROCESAR"; });
        };

        Object.keys(porCliente).sort(function(a, b){
            return (esProcesar(b) - esProcesar(a)) || a.localeCompare(b);
        }).forEach(function(cliente){

            const delCliente = porCliente[cliente];
            const peso = delCliente.reduce(function(s, v){ return s + v.peso_tn; }, 0);
            const clienteJs = escaparHtml(JSON.stringify(cliente));
            const porSubir = delCliente.some(function(v){ return v.accion === "SUBIR" && v.estado !== "SUBIDO"; });

            html +=
                '<tr class="cv-fila-cliente">' +
                    '<td colspan="6">' + escaparHtml(cliente) +
                        ' <span>' + textoCantidadViajes(delCliente.length) + ' · ' + peso.toFixed(2) + ' TN</span></td>' +
                    '<td class="cv-celda-accion">' +
                        (esProcesar(cliente) && delCliente.every(function(v){ return v.estado === "SUBIDO"; })
                            ? '<button class="cv-btn-drive" disabled>✅ Subido</button>'
                        : esProcesar(cliente)
                            ? '<button class="cv-btn-procesar" onclick="procesarViajeCargarViaje(null, ' + gestionJs + ', ' + clienteJs + ')">⚙️ Procesar cliente</button>'
                            : '<button class="cv-btn-drive" ' + (porSubir ? '' : 'disabled ') +
                                'onclick="subirAlDriveCargarViaje(null, ' + gestionJs + ', ' + clienteJs + ')">' +
                                (porSubir ? '☁️ Subir cliente' : '✅ Subido') + '</button>') +
                    '</td>' +
                '</tr>';

            delCliente.forEach(function(v){ html += filaViajeProcesado(v); });

        });

        html += '</tbody></table></div></div>';

    });

    contenedor.innerHTML = html;

    if(!sinMover){
        contenedor.scrollIntoView({ behavior: "smooth", block: "start" });
    }

}

// Una fila de la tabla de viajes procesados. Los de acción PROCESAR no
// llevan botón propio: se procesan con el de su cliente.
function filaViajeProcesado(v){

    const foJs = escaparHtml(JSON.stringify(v.fo));
    const estado =
        v.estado === "SUBIDO"
            ? '<span class="cv-estado cv-estado-subido">SUBIDO</span>'
        : v.estado === "PENDIENTE"
            ? '<span class="cv-estado cv-estado-pendiente" title="' + v.entregas_sin_vl06f +
                ' de ' + v.cantidad_entregas + ' entregas sin VL06F">PENDIENTE · ' +
                v.entregas_sin_vl06f + ' sin VL06F</span>'
            : '<span class="cv-estado cv-estado-ok">PROCESADO</span>';

    return (
        '<tr class="cv-fila-de-cliente">' +
            '<td>' + escaparHtml(v.fo) + '</td>' +
            '<td>' + escaparHtml(v.destino) + '</td>' +
            '<td>' + escaparHtml(v.cliente) + '</td>' +
            '<td>' + v.peso_tn.toFixed(2) + '</td>' +
            '<td>' + escaparHtml(v.transportista_nombre) + '</td>' +
            '<td>' + estado + '</td>' +
            '<td class="cv-celda-accion">' +
                (v.accion === "PROCESAR"
                    ? ''
                : v.estado === "SUBIDO"
                    ? '<button class="cv-btn-drive-fila" disabled>✅ Subido</button>'
                    : '<button class="cv-btn-drive-fila" onclick="subirAlDriveCargarViaje(' + foJs + ')">☁️ Subir viaje</button>') +
            '</td>' +
        '</tr>'
    );

}

// "Procesar" (Canal Moderno) va por cliente: abre el panel Procesar
// cliente (procesar-cliente.js). "Procesar masivo" de la gestión pide
// hacerlo cliente por cliente, porque cada uno lleva sus propios datos.
function procesarViajeCargarViaje(viaje, gestion, cliente){

    if(cliente){
        abrirProcesarCliente(gestion, cliente);
        return;
    }

    alert("Procesa cliente por cliente con su botón ⚙️ Procesar cliente: cada uno lleva sus propios datos.");

}

// ========================================
// SUBIR VIAJE → data principal (Status Pendiente)
// ========================================
// Pasa el viaje a estado SUBIDO con los status iniciales de la hoja
// STATUS PENDIENTE (todos en rojo). Solo toca los que todavía no
// estaban subidos, así no se pisan status que ya se hayan avanzado.
// Sin viaje = "Subir masivo" de la gestión (solo los de acción SUBIR).

async function subirAlDriveCargarViaje(viaje, gestion, cliente){

    const resultado = cargaViaje.resultado;

    if(!resultado){
        return;
    }

    // Un viaje, todos los de un cliente ("Subir cliente") o toda la
    // gestión ("Subir masivo").
    const elegidos = resultado.viajes.filter(function(v){
        if(v.accion !== "SUBIR" || v.estado === "SUBIDO") return false;
        if(viaje) return v.fo === viaje;
        return v.gestion === gestion && (!cliente || (v.cliente || "SIN CLIENTE") === cliente);
    });

    if(elegidos.length === 0){
        alert("No hay viajes por subir.");
        return;
    }

    const pendientes = elegidos.filter(function(v){ return v.estado === "PENDIENTE"; });

    if(pendientes.length && !confirm(
        (pendientes.length === 1
            ? "El viaje " + pendientes[0].fo + " está PENDIENTE"
            : pendientes.length + " viajes están PENDIENTE") +
        " (le faltan entregas del VL06F: su peso está incompleto). ¿Subirlo igual a Status Pendiente?"
    )){
        return;
    }

    const lista = elegidos.map(function(v){ return '"' + v.fo + '"'; }).join(",");

    try{

        const subidos = await supabaseFetch(
            "/md_viajes?fo=in.(" + encodeURIComponent(lista) + ")&estado=neq.SUBIDO",
            {
                method: "PATCH",
                headers: { "Prefer": "return=representation" },
                body: JSON.stringify({
                    estado: "SUBIDO",
                    fecha_subida: new Date().toISOString(),
                    subido_por: sesion ? sesion.nombre_completo : null,
                    status: "POR LANZAR",
                    status_modulado: "PENDIENTE",
                    status_despacho: "PENDIENTE",
                    status_ut: "PENDIENTE",
                    actualizado_en: new Date().toISOString()
                })
            }
        );

        const confirmados = new Set((subidos || []).map(function(v){ return v.fo; }));

        resultado.viajes.forEach(function(v){
            if(confirmados.has(v.fo)) v.estado = "SUBIDO";
        });

        pintarViajesProcesados(resultado, true);
        buscarSinSubir();

        if(confirmados.size < elegidos.length){
            alert("Se subieron " + confirmados.size + " de " + elegidos.length +
                " viajes. Los demás ya estaban subidos o no se encontraron: actualiza Status Pendiente para revisarlos.");
        }

    }catch(error){

        console.error(error);
        alert("No se pudo subir: " + (error.message || error));

    }

}

buscarSinSubir();
actualizarBotonProcesar();

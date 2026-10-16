// ========================================
// FACTURACIÓN › CARGAR VIAJE
// ========================================
// 1. Cruce de Viajes: se pegan los FO copiados de SAP y se cruzan con
//    md_viajes (función md_viajes_existentes): quedan solo los nuevos.
//    Cada cruce se guarda en md_cruces ("Ver último cruce").
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
    cruce: null,     // { id, totalPegados, nuevos: [], existian: [] }
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

        const guardado = await supabaseFetch("/md_cruces", {
            method: "POST",
            headers: { "Prefer": "return=representation" },
            body: JSON.stringify({
                usuario: sesion ? sesion.nombre_completo : null,
                total_pegados: viajes.length,
                total_nuevos: nuevos.length,
                viajes_nuevos: nuevos
            })
        });

        cerrarPegarViajes();

        mostrarResultadoCruce({
            id: guardado && guardado[0] ? guardado[0].id : null,
            fecha: guardado && guardado[0] ? guardado[0].creado_en : new Date().toISOString(),
            totalPegados: viajes.length,
            nuevos: nuevos,
            existian: existian
        });

        abrirModalViajes("nuevos");

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
        "📋 " + textoCantidadViajes(cruce.totalPegados) + " pegados · " +
        fecha.toLocaleDateString() + " " +
        fecha.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

    document.getElementById("cvTotalPegados").textContent = cruce.totalPegados;
    document.getElementById("cvTotalExistian").textContent = cruce.totalPegados - cruce.nuevos.length;
    document.getElementById("cvTotalNuevos").textContent = cruce.nuevos.length;

    document.getElementById("cvBtnUltimoCruce").style.display = "none";

    // Si ya había archivos cargados, se vuelven a filtrar contra este cruce.
    describirArchivo("monitor");
    describirArchivo("vl06f");
    actualizarBotonProcesar();

}

// "Ver último cruce": el último guardado en md_cruces (por si se cerró
// la página o no se copiaron los viajes).
async function buscarUltimoCruce(){

    try{

        const filas = await supabaseFetch(
            "/md_cruces?select=id,creado_en,total_pegados,total_nuevos,viajes_nuevos" +
            "&order=creado_en.desc&limit=1"
        );

        const ultimo = filas && filas[0];
        const boton = document.getElementById("cvBtnUltimoCruce");

        if(!ultimo || cargaViaje.cruce){
            return;
        }

        const fecha = new Date(ultimo.creado_en);

        boton.textContent =
            "🕘 Ver último cruce (" + fecha.toLocaleDateString() + " " +
            fecha.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) +
            " · " + textoCantidadViajes(ultimo.total_nuevos) +
            (ultimo.total_nuevos === 1 ? " nuevo)" : " nuevos)");
        boton.style.display = "block";
        boton.onclick = function(){

            mostrarResultadoCruce({
                id: ultimo.id,
                fecha: ultimo.creado_en,
                totalPegados: ultimo.total_pegados,
                nuevos: ultimo.viajes_nuevos || [],
                // La lista de los que ya existían no se guarda, solo el total.
                existian: null
            });

            abrirModalViajes("nuevos");

        };

    }catch(error){
        console.error("No se pudo leer el último cruce:", error);
    }

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

    if(!viajes){
        alert("De este cruce solo se guardó el total de viajes que ya existían (" +
            (cruce.totalPegados - cruce.nuevos.length) + "), no la lista.");
        return;
    }

    document.getElementById("cvModalViajesTitulo").textContent =
        esNuevos ? "✅ Viajes nuevos" : "Viajes que ya existían";

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
// Misma prioridad que la plantilla: 1. cliente (por nombre, o por
// código de destinatario: plantas de Alicorp), 2. Lima - Lima/Callao
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

    const reglaCliente =
        reglas.find(function(r){
            return r.tipo_regla === "CLIENTE" && limpiarTexto(r.cliente) === cliente;
        }) ||
        reglas.find(function(r){
            return r.tipo_regla === "DESTINATARIO" && codigo !== "" && textoCodigo(r.destinatario_codigo) === codigo;
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
                cantidad_und: 0
            };
        }

        const r = resumen[entrega];
        const unidad = limpiarTexto(f["Un.medida venta"]);
        const cantidad = numero(f["Cantidad entrega"]);

        r.peso_kg += numero(f["Peso total"]);
        r.cantidad_lineas += 1;

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
        const clienteNombre = clienteMonitor || g.nombre || (v && v.destinatario_nombre) || null;

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
                cruce_id: cargaViaje.cruce.id,
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
                base_con_vl06f: e.tiene_vl06f,
                estado: "PROCESADO"
            };
        }

        const v = porViaje[e.fo];
        v.peso_kg += e.peso_kg || 0;
        v.cantidad_entregas += 1;
        if(!e.tiene_vl06f) v.entregas_sin_vl06f += 1;

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

        if(resultado.viajes.length === 0){
            alert("Ninguno de los viajes nuevos aparece en el Monitor GRE. Revisa que sea el Monitor de estos viajes.");
            return;
        }

        const ahora = new Date().toISOString();

        // md_viajes primero (md_entregas apunta a md_viajes).
        await guardarEnLotes("md_viajes", "fo", resultado.viajes.map(function(v){
            return {
                fo: v.fo,
                cruce_id: v.cruce_id,
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

        pintarViajesProcesados(resultado);

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

function pintarViajesProcesados(resultado){

    const contenedor = document.getElementById("cvViajesProcesados");
    const grupos = {};

    resultado.viajes.forEach(function(v){
        (grupos[v.gestion] = grupos[v.gestion] || []).push(v);
    });

    const nombres = Object.keys(grupos).sort(function(a, b){
        const ia = ORDEN_GESTIONES.indexOf(a), ib = ORDEN_GESTIONES.indexOf(b);
        return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib) || a.localeCompare(b);
    });

    const pesoTotal = resultado.viajes.reduce(function(s, v){ return s + v.peso_tn; }, 0);
    const sinVl06f = resultado.entregas.filter(function(e){ return !e.tiene_vl06f; }).length;

    let html =
        '<div class="cv-tabla-header">' +
            '<h2>Viajes nuevos procesados</h2>' +
            '<p>' + textoCantidadViajes(resultado.viajes.length) + ' · ' +
                resultado.entregas.length + ' entregas · ' + redondear(pesoTotal, 2) + ' TN. ' +
                'Ya quedaron guardados en la Base de Datos.</p>' +
        '</div>';

    const avisos = [];

    if(resultado.sinMonitor.length){
        const uno = resultado.sinMonitor.length === 1;
        avisos.push("<b>" + textoCantidadViajes(resultado.sinMonitor.length) +
            (uno ? " nuevo no aparece" : " nuevos no aparecen") + " en el Monitor GRE</b> y " +
            (uno ? "no se guardó: " : "no se guardaron: ") +
            resultado.sinMonitor.map(escaparHtml).join(", ") + ".");
    }

    if(sinVl06f){
        avisos.push("<b>" + sinVl06f + (sinVl06f === 1 ? " entrega no aparece" : " entregas no aparecen") +
            " en el VL06F</b>: se guardaron sin peso ni destino (marcadas con ⚠️).");
    }

    if(avisos.length){
        html += '<div class="cv-aviso">' + avisos.join("<br>") + '</div>';
    }

    nombres.forEach(function(gestion){

        const viajes = grupos[gestion];
        const todosProcesar = viajes.every(function(v){ return v.accion === "PROCESAR"; });
        const gestionJs = escaparHtml(JSON.stringify(gestion));

        html +=
            '<div class="cv-grupo">' +
                '<div class="cv-grupo-header">' +
                    '<h3>' + escaparHtml(gestion) + ' <span>' + textoCantidadViajes(viajes.length) + '</span></h3>' +
                    (todosProcesar
                        ? '<button class="cv-btn-procesar" onclick="procesarViajeCargarViaje(null, ' + gestionJs + ')">⚙️ Procesar masivo</button>'
                        : '<button class="cv-btn-drive" onclick="subirAlDriveCargarViaje(null, ' + gestionJs + ')">☁️ Subir masivo</button>') +
                '</div>' +
                '<div class="cv-tabla-contenedor">' +
                    '<table class="cv-tabla">' +
                        '<thead><tr>' +
                            '<th>Viaje</th><th>Destino</th><th>Cliente</th>' +
                            '<th>Peso (TNL)</th><th>Transporte</th><th></th>' +
                        '</tr></thead>' +
                        '<tbody>';

        viajes.forEach(function(v){

            const foJs = escaparHtml(JSON.stringify(v.fo));
            const alerta = v.entregas_sin_vl06f
                ? ' <span title="' + v.entregas_sin_vl06f + ' entrega(s) sin VL06F">⚠️</span>'
                : '';

            html +=
                '<tr>' +
                    '<td>' + escaparHtml(v.fo) + alerta + '</td>' +
                    '<td>' + escaparHtml(v.destino) + '</td>' +
                    '<td>' + escaparHtml(v.cliente) + '</td>' +
                    '<td>' + v.peso_tn.toFixed(2) + '</td>' +
                    '<td>' + escaparHtml(v.transportista_nombre) + '</td>' +
                    '<td class="cv-celda-accion">' +
                        (v.accion === "PROCESAR"
                            ? '<button class="cv-btn-procesar" onclick="procesarViajeCargarViaje(' + foJs + ')">⚙️ Procesar viaje</button>'
                            : '<button class="cv-btn-drive-fila" onclick="subirAlDriveCargarViaje(' + foJs + ')">☁️ Subir viaje</button>') +
                    '</td>' +
                '</tr>';

        });

        html += '</tbody></table></div></div>';

    });

    contenedor.innerHTML = html;
    contenedor.scrollIntoView({ behavior: "smooth", block: "start" });

}

// Todavía no definido qué hace cada uno (subir al Drive / procesar).
function procesarViajeCargarViaje(viaje, gestion){

    const destino = viaje ? "el viaje " + viaje : "todos los viajes de " + gestion;

    alert("Procesar " + destino + " todavía no está disponible.");

}

function subirAlDriveCargarViaje(viaje, gestion){

    const destino = viaje ? "el viaje " + viaje : "todos los viajes de " + gestion;

    alert("Subir al Drive " + destino + " todavía no está disponible.");

}

buscarUltimoCruce();
actualizarBotonProcesar();

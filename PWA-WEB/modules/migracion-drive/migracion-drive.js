// ========================================
// SESIÓN Y PERMISOS
// ========================================

// Mientras el proyecto está en armado, el módulo es solo para el
// Administrador (por eso no está en shared/modulos-app.js: así no se
// puede habilitar a otro rol desde Configuración por accidente).

const sesion = requerirSesion();

if(sesion && sesion.rol !== "Administrador"){
    window.location.href = "../inicio/home.html";
}

// ========================================
// NAVEGACIÓN ENTRE VISTAS
// ========================================
// Cada vista apunta al div que muestra. Las de Facturación cuelgan
// de un submenú desplegable (alternarSubmenu).

const VISTAS_MIGRACION_DRIVE = {
    "status-pendiente": "vistaStatusPendiente",
    "cargar-viaje": "vistaCargarViaje",
    "registro-ut": "vistaRegistroUt",
    "contabilizados": "vistaContabilizados",
    "control-activos": "vistaControlActivos",
    "monitor": "vistaMonitor",
    "despacho": "vistaDespacho",
    "base-datos": "vistaBaseDatos",
    "reportes": "vistaReportes"
};

function alternarSubmenu(idSubmenu, boton){

    const submenu = document.getElementById(idSubmenu);
    const abrir = submenu.style.display === "none";

    submenu.style.display = abrir ? "block" : "none";
    boton.classList.toggle("abierto", abrir);

}

function abrirVista(vista, boton){

    document.getElementById("inicio").style.display = "none";

    Object.keys(VISTAS_MIGRACION_DRIVE).forEach(function(key){
        document.getElementById(VISTAS_MIGRACION_DRIVE[key]).style.display = "none";
    });

    document.querySelectorAll(".menu button:not(.menu-grupo)").forEach(function(btn){
        btn.classList.remove("activo");
    });

    document.getElementById(VISTAS_MIGRACION_DRIVE[vista]).style.display = "flex";
    boton.classList.add("activo");

}

// ========================================
// CARGAR VIAJE (por ahora solo visual)
// ========================================

function mostrarArchivoCargarViaje(input, idEtiqueta){

    const archivo = input.files && input.files[0];

    document.getElementById(idEtiqueta).textContent =
        archivo ? "📄 " + archivo.name : "Ningún archivo seleccionado";

    actualizarBotonProcesar();

}

// "Procesar viajes" se activa recién cuando están los dos reportes.
function actualizarBotonProcesar(){

    const monitor = document.querySelector("input[onchange*='cvArchivoMonitor']").files.length > 0;
    const vl06f = document.querySelector("input[onchange*='cvArchivoVl06f']").files.length > 0;

    const faltan = [];
    if(!monitor) faltan.push("el Monitor de Guías");
    if(!vl06f) faltan.push("el VL06F");

    document.getElementById("cvBtnProcesarViajes").disabled = faltan.length > 0;

    document.getElementById("cvProcesarTexto").textContent = faltan.length > 0
        ? "Sube " + faltan.join(" y ") + " para procesar."
        : "Listo para procesar los viajes nuevos.";

}

// Por ahora solo visual: muestra la tabla de ejemplo de abajo.
function procesarViajesNuevos(){

    const tabla = document.getElementById("cvViajesProcesados");
    tabla.style.display = "block";
    tabla.scrollIntoView({ behavior: "smooth", block: "start" });

}

// Cruce de Viajes: se pegan solo los números de viaje copiados de SAP,
// uno por línea (en vez de exportar un Excel y subirlo). Se quitan
// líneas vacías y viajes repetidos.

function viajesPegados(){

    const viajes = document.getElementById("cvTextoPegado").value
        .split(/\r?\n/)
        .map(function(linea){ return linea.trim(); })
        .filter(function(linea){ return linea !== ""; });

    return { total: viajes.length, unicos: Array.from(new Set(viajes)) };

}

function textoCantidadViajes(cantidad){
    return cantidad + (cantidad === 1 ? " viaje" : " viajes");
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

function cruzarViajesPegados(){

    const viajes = viajesPegados().unicos;

    if(viajes.length === 0){
        alert("Pega primero los viajes copiados de SAP.");
        return;
    }

    // Por ahora solo visual: todavía no hay tabla de viajes contra la
    // cual cruzar, así que se SIMULA que 1 de cada 4 ya existía.
    const existian = viajes.filter(function(v, i){ return i % 4 === 3; });
    const nuevos = viajes.filter(function(v, i){ return i % 4 !== 3; });

    cerrarPegarViajes();
    mostrarResultadoCruce(viajes.length, nuevos, existian);
    guardarUltimoCruce(viajes.length, nuevos, existian);

    // Al terminar el cruce se abren directo los viajes nuevos.
    abrirModalViajes("nuevos");

}

// ========================================
// ÚLTIMO CRUCE (por si se cierra la página o no se copiaron los viajes)
// ========================================
// Se guarda en este navegador (localStorage). Cuando exista la base de
// datos, los viajes nuevos quedarán ahí como "pendientes" y esto ya no
// hará falta.

const CLAVE_ULTIMO_CRUCE = "migracion_drive_ultimo_cruce";

function guardarUltimoCruce(totalPegados, nuevos, existian){

    try{
        localStorage.setItem(CLAVE_ULTIMO_CRUCE, JSON.stringify({
            fecha: new Date().toISOString(),
            totalPegados: totalPegados,
            nuevos: nuevos,
            existian: existian
        }));
    }catch(e){ /* sin almacenamiento: solo no se recuerda */ }

    mostrarBotonUltimoCruce();

}

function leerUltimoCruce(){
    try{
        return JSON.parse(localStorage.getItem(CLAVE_ULTIMO_CRUCE));
    }catch(e){
        return null;
    }
}

function mostrarBotonUltimoCruce(){

    const cruce = leerUltimoCruce();
    const boton = document.getElementById("cvBtnUltimoCruce");

    if(!cruce){
        boton.style.display = "none";
        return;
    }

    const fecha = new Date(cruce.fecha);

    boton.textContent =
        "🕘 Ver último cruce (" + fecha.toLocaleDateString() + " " +
        fecha.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) +
        " · " + textoCantidadViajes(cruce.nuevos.length) + " nuevos)";
    boton.style.display = "block";

}

function verUltimoCruce(){

    const cruce = leerUltimoCruce();

    if(cruce){
        mostrarResultadoCruce(cruce.totalPegados, cruce.nuevos, cruce.existian);
        abrirModalViajes("nuevos");
    }

}

mostrarBotonUltimoCruce();

// Actualiza los contadores del paso 1 y guarda el resultado para la
// ventana de viajes (tarjetas Nuevos / Ya existían).
function mostrarResultadoCruce(totalPegados, nuevos, existian){

    document.getElementById("cvArchivoViajes").textContent =
        "📋 " + textoCantidadViajes(totalPegados) + " pegados";

    document.getElementById("cvTotalPegados").textContent = totalPegados;
    document.getElementById("cvTotalExistian").textContent = existian.length;
    document.getElementById("cvTotalNuevos").textContent = nuevos.length;

    window.resultadoCruce = { nuevos: nuevos, existian: existian };

}

// Ventana con los viajes uno debajo del otro, listos para copiar y
// pegar en SAP. tipo: "nuevos" o "existian".
function abrirModalViajes(tipo){

    const cruce = window.resultadoCruce;

    if(!cruce){
        alert("Todavía no hay un cruce de viajes. Pega los viajes y toca Cruzar viajes.");
        return;
    }

    const viajes = cruce[tipo];
    const esNuevos = tipo === "nuevos";

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

// Canal Moderno se procesa (viaje por viaje o toda la gestión);
// Reparto Local y Larga Distancia se suben al Drive igual, por viaje o
// toda la gestión con "Subir masivo" en el encabezado del grupo.
function procesarViajeCargarViaje(viaje, gestion){

    const destino = viaje ? "el viaje " + viaje : "todos los viajes de " + gestion;

    alert("Procesar " + destino + " todavía no está disponible: por ahora es solo la vista de ejemplo.");

}

function subirAlDriveCargarViaje(viaje, gestion){

    const destino = viaje ? "el viaje " + viaje : "todos los viajes de " + gestion;

    alert("Subir al Drive " + destino + " todavía no está disponible: por ahora es solo la vista de ejemplo.");

}

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

}

function mostrarResultadoCruce(totalPegados, nuevos, existian){

    document.getElementById("cvArchivoViajes").textContent =
        "📋 " + textoCantidadViajes(totalPegados) + " pegados";

    document.getElementById("cvTotalPegados").textContent = totalPegados;
    document.getElementById("cvTotalExistian").textContent = existian.length;
    document.getElementById("cvTotalNuevos").textContent = nuevos.length;

    document.getElementById("cvResultadoTexto").textContent =
        textoCantidadViajes(nuevos.length) + " nuevos de " + totalPegados + " pegados. " +
        "Cópialos para sacar de SAP el Monitor de Guías y el VL06F solo de estos viajes.";

    document.getElementById("cvResumenExistian").textContent =
        "Ver " + textoCantidadViajes(existian.length) + " que ya existían";

    pintarListaViajes("cvListaNuevos", nuevos);
    pintarListaViajes("cvListaExistian", existian);

    window.viajesNuevosCruce = nuevos;

    const resultado = document.getElementById("cvResultadoCruce");
    resultado.style.display = "block";
    resultado.scrollIntoView({ behavior: "smooth", block: "start" });

}

function pintarListaViajes(idContenedor, viajes){

    const contenedor = document.getElementById(idContenedor);
    contenedor.innerHTML = "";

    viajes.forEach(function(viaje){
        const chip = document.createElement("span");
        chip.textContent = viaje;
        contenedor.appendChild(chip);
    });

}

// Copia los viajes nuevos uno por línea, listos para pegar en SAP.
function copiarViajesNuevos(boton){

    const texto = (window.viajesNuevosCruce || []).join("\n");

    navigator.clipboard.writeText(texto).then(function(){
        boton.textContent = "✅ Copiados";
        setTimeout(function(){ boton.textContent = "📋 Copiar viajes nuevos"; }, 2000);
    }).catch(function(){
        alert("No se pudo copiar automáticamente. Selecciona los viajes de la lista y cópialos a mano.");
    });

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

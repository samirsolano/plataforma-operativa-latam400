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

// Cruce de Viajes: las líneas se copian de SAP y se pegan en una
// ventana (llegan separadas por tabulación, como desde Excel), en vez
// de exportar un Excel y subirlo.

function lineasPegadas(){
    return document.getElementById("cvTextoPegado").value
        .split(/\r?\n/)
        .filter(function(linea){ return linea.trim() !== ""; });
}

function abrirPegarViajes(){
    document.getElementById("cvModalPegar").style.display = "flex";
    document.getElementById("cvTextoPegado").focus();
}

function cerrarPegarViajes(){
    document.getElementById("cvModalPegar").style.display = "none";
}

function contarLineasPegadas(){
    const cantidad = lineasPegadas().length;
    document.getElementById("cvContadorLineas").textContent =
        cantidad + (cantidad === 1 ? " línea" : " líneas");
}

function cruzarViajesPegados(){

    const cantidad = lineasPegadas().length;

    if(cantidad === 0){
        alert("Pega primero las líneas copiadas de SAP.");
        return;
    }

    document.getElementById("cvArchivoViajes").textContent =
        "📋 " + cantidad + (cantidad === 1 ? " línea pegada" : " líneas pegadas");

    cerrarPegarViajes();

    // Por ahora solo visual: el cruce real con la base de datos se arma
    // cuando esté definida la tabla y las columnas que trae SAP.
    alert("Se pegaron " + cantidad + " líneas. El cruce con la base de datos todavía no está disponible: por ahora es solo la vista de ejemplo.");

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

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
    "despacho": "vistaDespacho"
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

// Sin viaje = "Subir masivo" (todos los viajes nuevos de la tabla).
function subirAlDriveCargarViaje(viaje){

    const destino = viaje ? "el viaje " + viaje : "todos los viajes nuevos";

    alert("Subir al Drive (" + destino + ") todavía no está disponible: por ahora es solo la vista de ejemplo.");

}

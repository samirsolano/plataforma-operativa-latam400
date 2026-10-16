// ========================================
// SESIÓN Y PERMISOS
// ========================================

const sesion = requerirSesion();

if(sesion && !tienePermiso(sesion, "migracion-drive")){
    window.location.href = "../inicio/home.html";
}

if(sesion){

    aplicarPermisosEnIds(sesion, {
        btnStatusPendiente: "migracion-drive.status-pendiente",
        btnFacturacion: "migracion-drive.facturacion",
        btnMonitor: "migracion-drive.monitor",
        btnDespacho: "migracion-drive.despacho"
    });

}

// ========================================
// NAVEGACIÓN ENTRE VISTAS
// ========================================
// Cada key es también el submodulo_key de permisos_rol (ver
// shared/modulos-app.js), y apunta al div de su vista.

const VISTAS_MIGRACION_DRIVE = {
    "status-pendiente": "vistaStatusPendiente",
    "facturacion": "vistaFacturacion",
    "monitor": "vistaMonitor",
    "despacho": "vistaDespacho"
};

function abrirVista(vista, boton){

    if(!tienePermiso(sesion, "migracion-drive", vista)){
        return;
    }

    document.getElementById("inicio").style.display = "none";

    Object.keys(VISTAS_MIGRACION_DRIVE).forEach(function(key){
        document.getElementById(VISTAS_MIGRACION_DRIVE[key]).style.display = "none";
    });

    document.querySelectorAll(".menu button").forEach(function(btn){
        btn.classList.remove("activo");
    });

    document.getElementById(VISTAS_MIGRACION_DRIVE[vista]).style.display = "flex";
    boton.classList.add("activo");

}

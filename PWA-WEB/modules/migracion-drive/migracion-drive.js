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
        btnCargarViaje: "migracion-drive.facturacion-cargar-viaje",
        btnRegistroUt: "migracion-drive.facturacion-registro-ut",
        btnContabilizados: "migracion-drive.facturacion-contabilizados",
        btnControlActivos: "migracion-drive.facturacion-control-activos",
        btnMonitor: "migracion-drive.monitor",
        btnDespacho: "migracion-drive.despacho"
    });

}

// ========================================
// NAVEGACIÓN ENTRE VISTAS
// ========================================
// Cada vista apunta a su div y al submodulo_key de permisos_rol que
// la controla (ver shared/modulos-app.js). Las de Facturación cuelgan
// de un submenú: además de su propio permiso necesitan el del grupo.

const VISTAS_MIGRACION_DRIVE = {
    "status-pendiente": { div: "vistaStatusPendiente", permiso: "status-pendiente" },
    "cargar-viaje": { div: "vistaCargarViaje", permiso: "facturacion-cargar-viaje", grupo: "facturacion" },
    "registro-ut": { div: "vistaRegistroUt", permiso: "facturacion-registro-ut", grupo: "facturacion" },
    "contabilizados": { div: "vistaContabilizados", permiso: "facturacion-contabilizados", grupo: "facturacion" },
    "control-activos": { div: "vistaControlActivos", permiso: "facturacion-control-activos", grupo: "facturacion" },
    "monitor": { div: "vistaMonitor", permiso: "monitor" },
    "despacho": { div: "vistaDespacho", permiso: "despacho" }
};

function alternarSubmenu(idSubmenu, boton){

    const submenu = document.getElementById(idSubmenu);
    const abrir = submenu.style.display === "none";

    submenu.style.display = abrir ? "block" : "none";
    boton.classList.toggle("abierto", abrir);

}

function abrirVista(vista, boton){

    const config = VISTAS_MIGRACION_DRIVE[vista];

    if(!tienePermiso(sesion, "migracion-drive", config.permiso) ||
        (config.grupo && !tienePermiso(sesion, "migracion-drive", config.grupo))){
        return;
    }

    document.getElementById("inicio").style.display = "none";

    Object.keys(VISTAS_MIGRACION_DRIVE).forEach(function(key){
        document.getElementById(VISTAS_MIGRACION_DRIVE[key].div).style.display = "none";
    });

    document.querySelectorAll(".menu button:not(.menu-grupo)").forEach(function(btn){
        btn.classList.remove("activo");
    });

    document.getElementById(config.div).style.display = "flex";
    boton.classList.add("activo");

}

console.log("Home cargado");

// Si no hay sesión activa, esto redirige automáticamente al login
const sesion = requerirSesion();

if(sesion){

    document.getElementById("nombreUsuario").textContent =
        sesion.nombre_completo;

    document.getElementById("rolUsuario").textContent =
        sesion.rol;

    // Cada tarjeta/link del Panel Principal se muestra u oculta según
    // el permiso del rol para ese módulo (ver shared/auth.js,
    // shared/modulos-app.js y modules/configuracion).
    aplicarPermisosEnIds(sesion, {

        linkChecklist5s: "checklist-5s",
        cardChecklist5s: "checklist-5s",

        linkChecklistHigieneNav: "checklist-higiene",
        cardChecklistHigiene: "checklist-higiene",

        linkChecklistEquiposNav: "checklist-equipos",
        cardChecklistEquipos: "checklist-equipos",

        linkAnomalias: "reporte-anomalias",
        cardAnomalias: "reporte-anomalias",

        linkPlanificacionAvance: "planificacion-avance",
        cardPlanificacionAvance: "planificacion-avance",

        linkReconocimiento: "reconocimiento",
        cardReconocimiento: "reconocimiento",

        linkSkillMatrix: "skill-matrix",
        cardSkillMatrix: "skill-matrix",

        linkUsuarios: "usuarios",
        cardUsuarios: "usuarios",

        linkUsuariosCentro: "usuarios-centro-proyectos",
        cardUsuariosCentro: "usuarios-centro-proyectos",

        linkTomaLote: "toma-lote-supermercados",
        cardTomaLote: "toma-lote-supermercados",

        linkTomaLoteFarmacia: "toma-lote-farmacia",
        cardTomaLoteFarmacia: "toma-lote-farmacia",

        linkInventarioPaletas: "inventario-paletas",
        cardInventarioPaletas: "inventario-paletas",

        linkInventarioPicking: "inventario-picking",
        cardInventarioPicking: "inventario-picking",

        linkConfiguracion: "configuracion",
        cardConfiguracion: "configuracion"

    });

}

const btnPerfil = document.getElementById("btnPerfil");
const menuUsuario = document.getElementById("menuUsuario");

btnPerfil.addEventListener("click", function(e){

    e.stopPropagation();

    if(menuUsuario.style.display === "block"){
        menuUsuario.style.display = "none";
    }else{
        menuUsuario.style.display = "block";
    }

});

document.addEventListener("click", function(){
    menuUsuario.style.display = "none";
});

document.getElementById("btnCerrarSesion").addEventListener("click", function(e){

    e.preventDefault();
    e.stopPropagation();
    cerrarSesion();

});

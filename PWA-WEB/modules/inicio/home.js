console.log("Home cargado");

// Si no hay sesión activa, esto redirige automáticamente al login
const sesion = requerirSesion();

if(sesion){

    document.getElementById("nombreUsuario").textContent =
        sesion.nombre_completo;

    document.getElementById("rolUsuario").textContent =
        sesion.rol;

    // El módulo de Usuarios solo es visible para el rol Administrador.
    if(sesion.rol !== "Administrador"){
        document.getElementById("linkUsuarios").style.display = "none";
        document.getElementById("cardUsuarios").style.display = "none";
        document.getElementById("linkUsuariosCentro").style.display = "none";
        document.getElementById("cardUsuariosCentro").style.display = "none";
    }

    // Carga Mensual, Colaboradores Activos y Fotos de Colaboradores solo
    // son visibles para Administrador y Supervisor.
    if(sesion.rol !== "Administrador" && sesion.rol !== "Supervisor"){
        document.getElementById("linkCargaMensual").style.display = "none";
        document.getElementById("cardCargaMensual").style.display = "none";
        document.getElementById("linkColaboradoresActivos").style.display = "none";
        document.getElementById("cardColaboradoresActivos").style.display = "none";
        document.getElementById("linkFotosColaboradores").style.display = "none";
        document.getElementById("cardFotosColaboradores").style.display = "none";
    }

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

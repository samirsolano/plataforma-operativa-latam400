const sesion = requerirSesion();

if(sesion){

    document.getElementById("nombreUsuario").textContent = sesion.nombre_completo;
    document.getElementById("rolUsuario").textContent = sesion.rol;

    if(sesion.rol !== "Administrador" && sesion.rol !== "Supervisor"){

        document.getElementById("cardCargaMensual").classList.add("oculto");
        document.getElementById("cardColaboradoresActivos").classList.add("oculto");
        document.getElementById("cardFotosColaboradores").classList.add("oculto");

    }

    if(sesion.rol !== "Administrador"){
        document.getElementById("linkUsuarios").style.display = "none";
        document.getElementById("linkUsuariosCentro").style.display = "none";
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

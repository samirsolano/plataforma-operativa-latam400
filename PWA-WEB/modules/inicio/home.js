console.log("Home cargado");

// Si no hay sesión activa, esto redirige automáticamente al login
const sesion = requerirSesion();

if(sesion){

    document.getElementById("nombreUsuario").textContent =
        sesion.nombre_completo;

    document.getElementById("rolUsuario").textContent =
        sesion.rol;

    // El módulo de Usuarios y Toma de Lote Supermercados solo son
    // visibles para el rol Administrador.
    if(sesion.rol !== "Administrador"){
        document.getElementById("linkUsuarios").style.display = "none";
        document.getElementById("cardUsuarios").style.display = "none";
        document.getElementById("linkUsuariosCentro").style.display = "none";
        document.getElementById("cardUsuariosCentro").style.display = "none";
        document.getElementById("linkTomaLote").style.display = "none";
        document.getElementById("cardTomaLote").style.display = "none";
        document.getElementById("linkTomaLoteFarmacia").style.display = "none";
        document.getElementById("cardTomaLoteFarmacia").style.display = "none";
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

const sesion = requerirSesion();

if(sesion && sesion.rol !== "Administrador" && sesion.rol !== "Supervisor"){

    document.getElementById("cardCargaMensual").classList.add("oculto");
    document.getElementById("cardColaboradoresActivos").classList.add("oculto");
    document.getElementById("cardFotosColaboradores").classList.add("oculto");

}

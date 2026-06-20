console.log(
    "Home cargado"
);

const btnPerfil =
    document.getElementById(
        "btnPerfil"
    );

const menuUsuario =
    document.getElementById(
        "menuUsuario"
    );

btnPerfil.addEventListener(
    "click",
    function(e){

        e.stopPropagation();

        if(
            menuUsuario.style.display ===
            "block"
        ){

            menuUsuario.style.display =
                "none";

        }else{

            menuUsuario.style.display =
                "block";

        }

    }
);

document.addEventListener(
    "click",
    function(){

        menuUsuario.style.display =
            "none";

    }
);
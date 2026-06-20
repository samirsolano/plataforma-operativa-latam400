function ingresar(){

    window.location.href =
        "../inicio/home.html";

}

document
.getElementById(
    "btnIngresar"
)
.addEventListener(
    "click",
    ingresar
);

document
.addEventListener(
    "keydown",
    function(e){

        if(
            e.key === "Enter"
        ){
            ingresar();
        }

    }
);
const inputUsuario = document.getElementById("usuario");
const inputPassword = document.getElementById("password");
const mensajeError = document.getElementById("mensajeError");
const btnIngresar = document.getElementById("btnIngresar");

async function ingresar(){

    const usuario = inputUsuario.value.trim();
    const password = inputPassword.value;

    mensajeError.textContent = "";

    if(!usuario || !password){
        mensajeError.textContent = "Ingrese usuario y contraseña.";
        return;
    }

    btnIngresar.disabled = true;
    btnIngresar.textContent = "INGRESANDO...";

    try{

        // Buscamos al usuario por su nombre de usuario.
        // La contraseña se compara en el siguiente paso,
        // no se filtra por ella en la consulta.
        const filas = await supabaseFetch(
            "/usuarios_app?usuario=eq." + encodeURIComponent(usuario) +
            "&select=id,usuario,password,nombre_completo,rol,activo"
        );

        const registro = filas[0];

        if(!registro){
            mensajeError.textContent = "Usuario o contraseña incorrectos.";
            return;
        }

        if(!registro.activo){
            mensajeError.textContent = "Este usuario está inactivo. Contacte a su administrador.";
            return;
        }

        if(registro.password !== password){
            mensajeError.textContent = "Usuario o contraseña incorrectos.";
            return;
        }

        // Login correcto: guardamos la sesión (sin la contraseña)
        guardarSesion({
            id: registro.id,
            usuario: registro.usuario,
            nombre_completo: registro.nombre_completo,
            rol: registro.rol
        });

        window.location.href = "../inicio/home.html";

    }catch(e){

        mensajeError.textContent = "No se pudo conectar. Intente nuevamente.";
        console.error(e);

    }finally{

        btnIngresar.disabled = false;
        btnIngresar.textContent = "INGRESAR";

    }

}

btnIngresar.addEventListener("click", ingresar);

document.addEventListener("keydown", function(e){

    if(e.key === "Enter"){
        ingresar();
    }

});

// Si ya hay una sesión activa, no tiene sentido mostrar el login
if(typeof obtenerSesion === "function" && obtenerSesion()){
    window.location.href = "../inicio/home.html";
}

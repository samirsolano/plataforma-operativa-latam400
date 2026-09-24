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

        // Permisos por módulo/submódulo de este rol (ver
        // shared/modulos-app.js y modules/configuracion). Se arma acá,
        // una sola vez, para que el resto de páginas lo lea de la
        // sesión en memoria en vez de pedirlo de nuevo a Supabase.
        // Administrador no tiene filas en permisos_rol a propósito
        // (tienePermiso() en shared/auth.js le da acceso a todo).
        const permisos = {};

        if(registro.rol !== "Administrador"){

            // Try/catch propio: si esto falla (tabla recién creada,
            // corte de red puntual), que el usuario pueda igual
            // entrar en vez de que se le caiga el login entero. En el
            // peor caso queda con permisos vacíos (no ve ningún
            // módulo restringido) hasta que recargue.
            try{

                const filasPermisos = await supabaseFetch(
                    "/permisos_rol?rol=eq." + encodeURIComponent(registro.rol) +
                    "&select=modulo_key,submodulo_key,habilitado"
                );

                (filasPermisos || []).forEach(function(p){
                    permisos[p.modulo_key + "." + (p.submodulo_key || "")] = !!p.habilitado;
                });

            }catch(e){
                console.error("No se pudieron cargar los permisos del rol:", e);
            }

        }

        // Login correcto: guardamos la sesión (sin la contraseña)
        guardarSesion({
            id: registro.id,
            usuario: registro.usuario,
            nombre_completo: registro.nombre_completo,
            rol: registro.rol,
            permisos: permisos
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

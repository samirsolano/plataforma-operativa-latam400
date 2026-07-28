// ========================================
// SESIÓN DE USUARIO (localStorage)
// ========================================
// Nota: todas las rutas de redirección son relativas a
// "../login/login.html" porque todos los módulos viven
// dentro de PWA-WEB/modules/<nombre>/, al mismo nivel.

const CLAVE_SESION = "latam400_sesion";

function guardarSesion(usuario){

    localStorage.setItem(
        CLAVE_SESION,
        JSON.stringify(usuario)
    );

}

function obtenerSesion(){

    const datos = localStorage.getItem(CLAVE_SESION);

    if(!datos){
        return null;
    }

    try{
        return JSON.parse(datos);
    }catch(e){
        return null;
    }

}

function cerrarSesion(){

    localStorage.removeItem(CLAVE_SESION);
    window.location.href = "../login/login.html";

}

// Llamar al inicio de cualquier página protegida.
// Si no hay sesión activa, redirige al login.
function requerirSesion(){

    const sesion = obtenerSesion();

    if(!sesion){
        window.location.href = "../login/login.html";
        return null;
    }

    return sesion;

}

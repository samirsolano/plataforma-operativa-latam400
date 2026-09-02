// ========================================
// SESIÓN DE USUARIO (sessionStorage)
// ========================================
// Nota: todas las rutas de redirección son relativas a
// "../login/login.html" porque todos los módulos viven
// dentro de PWA-WEB/modules/<nombre>/, al mismo nivel.
//
// Se usa sessionStorage (no localStorage) a propósito: así la
// sesión no sobrevive a cerrar la pestaña/navegador, y abrir el
// link directamente siempre pide usuario y contraseña de nuevo.

const CLAVE_SESION = "latam400_sesion";

function guardarSesion(usuario){

    sessionStorage.setItem(
        CLAVE_SESION,
        JSON.stringify(usuario)
    );

}

function obtenerSesion(){

    const datos = sessionStorage.getItem(CLAVE_SESION);

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

    sessionStorage.removeItem(CLAVE_SESION);
    window.location.href = "../login/login.html";

}

// Detecta si la página actual fue cargada por un refresh (F5, Ctrl+R)
// en lugar de una navegación normal (clic en un link, redirección JS).
function esRecarga(){

    const entradas = performance.getEntriesByType
        ? performance.getEntriesByType("navigation")
        : [];

    if(entradas.length){
        return entradas[0].type === "reload";
    }

    // Fallback para navegadores viejos.
    if(performance.navigation){
        return performance.navigation.type === performance.navigation.TYPE_RELOAD;
    }

    return false;

}

// Llamar al inicio de cualquier página protegida.
// Si no hay sesión activa, redirige al login.
// Si la página fue recargada (F5), cierra la sesión y redirige al login,
// aunque la sesión siga siendo válida.
function requerirSesion(){

    if(esRecarga()){
        cerrarSesion();
        return null;
    }

    const sesion = obtenerSesion();

    if(!sesion){
        window.location.href = "../login/login.html";
        return null;
    }

    return sesion;

}

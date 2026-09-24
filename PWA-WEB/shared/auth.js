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

// Cierre de sesión por inactividad: 5 minutos sin ningún movimiento
// de mouse/teclado/touch en la página.
const TIEMPO_INACTIVIDAD_MS = 5 * 60 * 1000;

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

// Reinicia el conteo de inactividad en cada interacción del usuario;
// si pasan TIEMPO_INACTIVIDAD_MS sin ninguna, cierra la sesión sola.
function iniciarControlInactividad(){

    let temporizador = null;

    function reiniciarTemporizador(){
        clearTimeout(temporizador);
        temporizador = setTimeout(cerrarSesion, TIEMPO_INACTIVIDAD_MS);
    }

    ["mousedown", "mousemove", "keydown", "scroll", "touchstart"].forEach(function(evento){
        document.addEventListener(evento, reiniciarTemporizador, { passive: true });
    });

    reiniciarTemporizador();

}

// ========================================
// PERMISOS POR ROL (módulos/submódulos)
// ========================================
// sesion.permisos se arma una sola vez en login.js (tabla
// permisos_rol) y viaja dentro de la sesión guardada en
// sessionStorage — así cada página lo consulta en memoria, sin
// pedirlo de nuevo a Supabase. Administrador siempre puede todo,
// resuelto acá y no en la tabla, para que un módulo nuevo sin fila
// sembrada nunca deje afuera al admin por error.
function tienePermiso(sesion, moduloKey, submoduloKey){

    if(!sesion){
        return false;
    }

    if(sesion.rol === "Administrador"){
        return true;
    }

    if(!sesion.permisos){
        return false;
    }

    const clave = moduloKey + "." + (submoduloKey || "");

    return !!sesion.permisos[clave];

}

// Oculta (display:none) cada elemento del DOM cuyo id esté en
// `mapaIdsAModulo` y el rol de la sesión no tenga permiso para ese
// módulo/submódulo. mapaIdsAModulo: { idDelElemento: "moduloKey" } o
// { idDelElemento: "moduloKey.submoduloKey" }.
function aplicarPermisosEnIds(sesion, mapaIdsAModulo){

    Object.keys(mapaIdsAModulo).forEach(function(id){

        const [moduloKey, submoduloKey] = mapaIdsAModulo[id].split(".");

        if(tienePermiso(sesion, moduloKey, submoduloKey)){
            return;
        }

        const el = document.getElementById(id);

        if(el){
            el.style.display = "none";
        }

    });

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

    iniciarControlInactividad();

    return sesion;

}

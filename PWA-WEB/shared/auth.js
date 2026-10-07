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

// Cierre de sesión por inactividad: 30 minutos sin ningún movimiento
// de mouse/teclado/touch en la página.
const TIEMPO_INACTIVIDAD_MS = 30 * 60 * 1000;

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

// ========================================
// CAMBIAR CONTRASEÑA (menú de usuario)
// ========================================
// Todas las páginas tienen en su menú de usuario un enlace
// "Cambiar Contraseña" sin id — se engancha acá por su texto, así
// funciona en todos los módulos sin tocar cada HTML. Pide la actual
// (se valida contra usuarios_app, igual que el login), la nueva y
// su confirmación.
function abrirCambioContrasena(){

    const sesion = obtenerSesion();

    if(!sesion){
        cerrarSesion();
        return;
    }

    if(!document.getElementById("estilosCambioContrasena")){

        const estilos = document.createElement("style");
        estilos.id = "estilosCambioContrasena";
        estilos.textContent = `
            .cambioPassOverlay{
                position:fixed; inset:0; background:rgba(17,24,39,.55);
                display:flex; align-items:center; justify-content:center;
                z-index:9999; padding:20px;
            }
            .cambioPassCaja{
                background:#fff; border-radius:16px; padding:22px;
                max-width:380px; width:100%;
                box-shadow:0 20px 50px rgba(0,0,0,.25);
                font-family:inherit; color:#111827;
            }
            .cambioPassCaja h3{ margin:0 0 4px; font-size:18px; }
            .cambioPassCaja p{ margin:0 0 16px; font-size:13px; color:#6b7280; }
            .cambioPassCaja label{ display:block; font-size:13px; font-weight:600; margin-bottom:4px; }
            .cambioPassCaja input{
                width:100%; padding:10px 12px; border:1.5px solid #d5dbe5;
                border-radius:10px; font-size:15px; margin-bottom:12px;
                box-sizing:border-box;
            }
            .cambioPassError{ color:#dc2626; font-size:13px; min-height:18px; margin-bottom:8px; }
            .cambioPassBotones{ display:flex; gap:10px; justify-content:flex-end; }
            .cambioPassBotones button{
                padding:10px 18px; border-radius:10px; font-size:14px;
                font-weight:700; border:none; cursor:pointer;
            }
            .cambioPassGuardar{ background:#FC000D; color:#fff; }
            .cambioPassGuardar:disabled{ opacity:.6; cursor:default; }
            .cambioPassCancelar{ background:#f3f4f6; color:#111827; }
        `;
        document.head.appendChild(estilos);

    }

    const overlay = document.createElement("div");
    overlay.className = "cambioPassOverlay";
    overlay.innerHTML = `
        <form class="cambioPassCaja" autocomplete="off">
            <h3>Cambiar Contraseña</h3>
            <p>Usuario: <b></b></p>
            <label>Contraseña actual</label>
            <input type="password" name="actual" autocomplete="current-password">
            <label>Nueva contraseña</label>
            <input type="password" name="nueva" autocomplete="new-password">
            <label>Confirmar nueva contraseña</label>
            <input type="password" name="confirmar" autocomplete="new-password">
            <div class="cambioPassError"></div>
            <div class="cambioPassBotones">
                <button type="button" class="cambioPassCancelar">Cancelar</button>
                <button type="submit" class="cambioPassGuardar">Guardar</button>
            </div>
        </form>
    `;

    overlay.querySelector("p b").textContent = sesion.usuario || "";
    document.body.appendChild(overlay);

    const form = overlay.querySelector("form");
    const errorEl = overlay.querySelector(".cambioPassError");
    const btnGuardar = overlay.querySelector(".cambioPassGuardar");

    function cerrar(){
        overlay.remove();
    }

    overlay.querySelector(".cambioPassCancelar").addEventListener("click", cerrar);
    overlay.addEventListener("click", function(e){
        if(e.target === overlay){ cerrar(); }
    });

    form.actual.focus();

    form.addEventListener("submit", async function(e){

        e.preventDefault();
        errorEl.textContent = "";

        const actual = form.actual.value;
        const nueva = form.nueva.value;
        const confirmar = form.confirmar.value;

        if(!actual || !nueva || !confirmar){
            errorEl.textContent = "Completa los tres campos.";
            return;
        }

        if(nueva.length < 4){
            errorEl.textContent = "La nueva contraseña debe tener al menos 4 caracteres.";
            return;
        }

        if(nueva !== confirmar){
            errorEl.textContent = "La confirmación no coincide con la nueva contraseña.";
            return;
        }

        if(nueva === actual){
            errorEl.textContent = "La nueva contraseña debe ser distinta a la actual.";
            return;
        }

        // Sesiones viejas pueden no traer id — se ubica por usuario.
        const filtro = sesion.id
            ? "id=eq." + encodeURIComponent(sesion.id)
            : "usuario=eq." + encodeURIComponent(sesion.usuario || "");

        btnGuardar.disabled = true;
        btnGuardar.textContent = "Guardando...";

        try{

            const filas = await supabaseFetch("/usuarios_app?" + filtro + "&select=id,password");
            const registro = filas && filas[0];

            if(!registro || registro.password !== actual){
                errorEl.textContent = "La contraseña actual no es correcta.";
                return;
            }

            await supabaseFetch("/usuarios_app?id=eq." + encodeURIComponent(registro.id), {
                method: "PATCH",
                body: JSON.stringify({ password: nueva })
            });

            cerrar();

            if(typeof mostrarAlerta === "function"){
                mostrarAlerta("Contraseña actualizada. Úsala la próxima vez que ingreses.");
            }else{
                alert("Contraseña actualizada. Úsala la próxima vez que ingreses.");
            }

        }catch(err){

            console.error(err);
            errorEl.textContent = "No se pudo guardar. Intenta nuevamente.";

        }finally{

            btnGuardar.disabled = false;
            btnGuardar.textContent = "Guardar";

        }

    });

}

document.addEventListener("click", function(e){

    const enlace = e.target.closest(".menu-usuario a");

    if(!enlace || enlace.textContent.trim() !== "Cambiar Contraseña"){
        return;
    }

    e.preventDefault();
    abrirCambioContrasena();

// En captura: el perfil de cada módulo hace stopPropagation() y el
// clic nunca llegaría a document en la fase normal.
}, true);

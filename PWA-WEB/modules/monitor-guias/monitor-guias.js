// ========================================
// MONITOR DE GUÍAS (SAP -> Supabase WMS Dashboard)
// ========================================
// La web solo pide la ejecución (sap_solicitar_comando). Quien entra
// a SAP es el puente tools/puente-sap/puente-sap.ps1, que corre en la
// PC con SAP abierto y deja el resultado en sap_guias. Tablas y
// funciones: monitor-guias.sql.

const SEGUNDOS_PUENTE_VIVO = 60;
const NOMBRE_COMANDO = { monitor_guias: "Monitor de guías", ping: "Prueba de conexión" };
const TEXTO_ESTADO = { pendiente: "En cola", en_proceso: "En SAP...", ok: "Listo", error: "Error" };

let modo = "fechas";
let guias = [];
let ultimoComandoCargado = null;
let temporizador = null;

// ========================================
// TOASTS
// ========================================

function mostrarToast(mensaje, tipo){

    tipo = tipo || "error";

    const contenedor = document.getElementById("toastContainer");

    const toast = document.createElement("div");
    toast.className = "toast toast-" + tipo;
    toast.textContent = mensaje;

    contenedor.appendChild(toast);

    requestAnimationFrame(function(){
        toast.classList.add("toast-visible");
    });

    setTimeout(function(){
        toast.classList.remove("toast-visible");
        setTimeout(function(){ toast.remove(); }, 250);
    }, 4500);

}

// ========================================
// SESIÓN
// ========================================

const sesion = requerirSesion();

if(sesion){

    if(!tienePermiso(sesion, "monitor-guias")){
        window.location.href = "../inicio/home.html";
    }

    document.getElementById("nombreUsuario").textContent = sesion.nombre_completo;
    document.getElementById("rolUsuario").textContent = sesion.rol;

}

const btnPerfil = document.getElementById("btnPerfil");
const menuUsuario = document.getElementById("menuUsuario");

btnPerfil.addEventListener("click", function(e){
    e.stopPropagation();
    menuUsuario.style.display = menuUsuario.style.display === "block" ? "none" : "block";
});

document.addEventListener("click", function(){
    menuUsuario.style.display = "none";
});

document.getElementById("btnCerrarSesion").addEventListener("click", function(e){
    e.preventDefault();
    e.stopPropagation();
    cerrarSesion();
});

// ========================================
// UTILIDADES
// ========================================

function escapar(texto){
    return String(texto == null ? "" : texto)
        .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function fechaISO(fecha){
    const d = new Date(fecha.getTime() - fecha.getTimezoneOffset() * 60000);
    return d.toISOString().slice(0, 10);
}

function horaCorta(iso){
    if(!iso){ return ""; }
    return new Date(iso).toLocaleString("es-PE", {
        day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit"
    });
}

// Supabase devuelve los errores de las funciones como JSON con "message".
function textoError(e){
    try{ return JSON.parse(e.message).message || e.message; }
    catch(_){ return e.message; }
}

function cambiarModo(nuevo){
    modo = nuevo;
    document.getElementById("tabFechas").classList.toggle("activa", modo === "fechas");
    document.getElementById("tabFos").classList.toggle("activa", modo === "fos");
    document.getElementById("modoFechas").classList.toggle("oculto", modo !== "fechas");
    document.getElementById("modoFos").classList.toggle("oculto", modo !== "fos");
}

// ========================================
// LANZAR
// ========================================

async function solicitar(comando, parametros){

    return checklistFetch("/rpc/sap_solicitar_comando", {
        method: "POST",
        body: JSON.stringify({
            p_comando: comando,
            p_parametros: parametros,
            p_solicitado_por: sesion ? sesion.nombre_completo : ""
        })
    });

}

async function lanzarMonitor(){

    let parametros;

    if(modo === "fechas"){
        const desde = document.getElementById("fechaDesde").value;
        const hasta = document.getElementById("fechaHasta").value;
        if(!desde || !hasta){
            mostrarToast("Elige las dos fechas.");
            return;
        }
        parametros = { fecha_desde: desde, fecha_hasta: hasta };
    }else{
        const fos = document.getElementById("listaFos").value
            .split(/[\s,;]+/).map(function(f){ return f.trim(); }).filter(Boolean);
        if(!fos.length){
            mostrarToast("Pega al menos una FO.");
            return;
        }
        parametros = { fos: Array.from(new Set(fos)) };
    }

    const boton = document.getElementById("btnLanzar");
    boton.disabled = true;

    try{
        const id = await solicitar("monitor_guias", parametros);
        mostrarToast("Enviado a SAP (ejecución #" + id + "). La tabla se actualiza sola al terminar.", "exito");
        await refrescar();
    }catch(e){
        mostrarToast(textoError(e));
    }finally{
        boton.disabled = false;
    }

}

async function probarPuente(){

    const boton = document.getElementById("btnPing");
    boton.disabled = true;

    try{
        const id = await solicitar("ping", {});
        mostrarToast("Prueba enviada (#" + id + "). Mira el resultado en Últimas ejecuciones.", "info");
        await refrescar();
    }catch(e){
        mostrarToast(textoError(e));
    }finally{
        boton.disabled = false;
    }

}

// ========================================
// ESTADO, EJECUCIONES Y GUÍAS
// ========================================

function pintarPuente(estados){

    const caja = document.getElementById("estadoPuente");
    const masReciente = (estados || []).reduce(function(max, e){
        return !max || e.ultimo_latido > max.ultimo_latido ? e : max;
    }, null);

    caja.classList.remove("conectado", "desconectado");

    if(!masReciente){
        caja.classList.add("desconectado");
        caja.innerHTML = '<span class="punto"></span> Puente SAP nunca conectado';
        return;
    }

    // "segundos" viene calculado por el servidor (sap_puente_estado_vista):
    // el reloj de la PC del usuario puede estar desfasado.
    if(masReciente.segundos <= SEGUNDOS_PUENTE_VIVO){
        caja.classList.add("conectado");
        caja.innerHTML = '<span class="punto"></span> Puente SAP conectado (' + escapar(masReciente.equipo) + ")";
    }else{
        caja.classList.add("desconectado");
        caja.innerHTML = '<span class="punto"></span> Puente SAP apagado desde ' + escapar(horaCorta(masReciente.ultimo_latido));
    }

}

function describirParametros(c){
    const p = c.parametros || {};
    if(p.fos){ return p.fos.length + " FO"; }
    if(p.fecha_desde){ return p.fecha_desde + " a " + p.fecha_hasta; }
    return "";
}

function pintarComandos(comandos){

    const lista = document.getElementById("listaComandos");

    if(!comandos.length){
        lista.innerHTML = '<p class="sin-datos">Todavía no se lanzó nada.</p>';
        return;
    }

    lista.innerHTML = comandos.map(function(c){

        const detalle = [
            describirParametros(c),
            horaCorta(c.creado_en),
            c.solicitado_por,
            c.estado === "ok" && c.comando === "monitor_guias" ? c.filas + " guías" : "",
            c.mensaje
        ].filter(Boolean).map(escapar).join(" · ");

        return '<div class="comando">' +
            '<div class="comando-cabecera">' +
                "<span>#" + c.id + " " + escapar(NOMBRE_COMANDO[c.comando] || c.comando) + "</span>" +
                '<span class="etiqueta ' + c.estado + '">' + TEXTO_ESTADO[c.estado] + "</span>" +
            "</div>" +
            '<div class="comando-detalle">' + detalle + "</div>" +
        "</div>";

    }).join("");

}

function formatoPeso(valor){
    if(valor == null || valor === ""){ return ""; }
    return Number(valor).toLocaleString("es-PE", { maximumFractionDigits: 3 });
}

function pintarGuias(){

    const cuerpo = document.getElementById("cuerpoGuias");
    const filtro = document.getElementById("filtroGuias").value.trim().toLowerCase();

    const visibles = !filtro ? guias : guias.filter(function(g){
        return [g.fo, g.entrega, g.serie, g.correlativo, g.transporte, g.placa,
                g.conductor, g.transportista, g.cliente, g.destino]
            .join(" ").toLowerCase().indexOf(filtro) >= 0;
    });

    if(!visibles.length){
        cuerpo.innerHTML = '<tr><td colspan="11" class="sin-datos">' +
            (guias.length ? "Nada coincide con la búsqueda." : "Sin datos todavía.") + "</td></tr>";
        return;
    }

    cuerpo.innerHTML = visibles.map(function(g){
        const guia = g.serie || g.correlativo ? (g.serie || "") + "-" + (g.correlativo || "") : "";
        return "<tr>" +
            "<td>" + escapar(g.fo) + "</td>" +
            "<td>" + escapar(g.entrega) + "</td>" +
            "<td>" + escapar(guia) + "</td>" +
            "<td>" + escapar(g.transporte) + "</td>" +
            "<td>" + escapar(g.placa) + "</td>" +
            "<td>" + escapar(g.conductor) + "</td>" +
            "<td>" + escapar(g.transportista) + "</td>" +
            "<td>" + escapar(g.cliente) + "</td>" +
            "<td>" + escapar(g.destino) + "</td>" +
            '<td class="num">' + escapar(formatoPeso(g.peso)) + "</td>" +
            "<td>" + escapar(g.org_ventas) + "</td>" +
        "</tr>";
    }).join("");

}

async function cargarGuias(comando){

    if(ultimoComandoCargado === comando.id){ return; }

    guias = await checklistFetch(
        "/sap_guias?comando_id=eq." + comando.id +
        "&select=fo,entrega,serie,correlativo,transporte,placa,conductor,transportista,cliente,destino,peso,org_ventas" +
        "&order=fo,entrega"
    ) || [];

    ultimoComandoCargado = comando.id;
    document.getElementById("subtituloGuias").textContent =
        "(#" + comando.id + " · " + describirParametros(comando) + " · " + guias.length + ")";
    pintarGuias();

}

async function refrescar(){

    clearTimeout(temporizador);
    let hayActivos = false;

    try{
        const [estados, comandos] = await Promise.all([
            checklistFetch("/sap_puente_estado_vista?select=equipo,ultimo_latido,segundos"),
            checklistFetch("/sap_comandos?select=*&order=id.desc&limit=10")
        ]);

        pintarPuente(estados);
        pintarComandos(comandos || []);

        hayActivos = (comandos || []).some(function(c){
            return c.estado === "pendiente" || c.estado === "en_proceso";
        });

        const ultimoOk = (comandos || []).find(function(c){
            return c.comando === "monitor_guias" && c.estado === "ok";
        });
        if(ultimoOk){ await cargarGuias(ultimoOk); }

    }catch(e){
        console.error(e);
    }

    // Rápido mientras SAP trabaja; lento solo para el latido del puente.
    temporizador = setTimeout(refrescar, hayActivos ? 4000 : 20000);

}

// ========================================
// INICIO
// ========================================

document.getElementById("tabFechas").addEventListener("click", function(){ cambiarModo("fechas"); });
document.getElementById("tabFos").addEventListener("click", function(){ cambiarModo("fos"); });
document.getElementById("btnLanzar").addEventListener("click", lanzarMonitor);
document.getElementById("btnPing").addEventListener("click", probarPuente);
document.getElementById("filtroGuias").addEventListener("input", pintarGuias);

(function iniciar(){

    const hoy = new Date();
    const ayer = new Date(hoy.getTime() - 86400000);

    document.getElementById("fechaDesde").value = fechaISO(ayer);
    document.getElementById("fechaHasta").value = fechaISO(hoy);

    refrescar();

})();

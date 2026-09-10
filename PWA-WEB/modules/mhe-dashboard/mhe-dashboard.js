// ========================================
// SESIÓN Y PERMISOS
// ========================================

const sesion = requerirSesion();

if(sesion && sesion.rol !== "Administrador" && sesion.rol !== "Supervisor"){
    window.location.href = "../inicio/home.html";
}

if(sesion){
    document.getElementById("nombreUsuario").textContent = sesion.nombre_completo;
    document.getElementById("rolUsuario").textContent = sesion.rol;
}

const btnPerfil = document.getElementById("btnPerfil");
const menuUsuario = document.getElementById("menuUsuario");

btnPerfil.addEventListener("click", function(e){

    e.stopPropagation();

    if(menuUsuario.style.display === "block"){
        menuUsuario.style.display = "none";
    }else{
        menuUsuario.style.display = "block";
    }

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
// CATÁLOGO DE PREGUNTAS (clave → título/sección, para el detalle de
// inoperatividad — mismo criterio que checklist-equipos.js/mhe-resumen.js)
// ========================================

let preguntasPorClave = {};

async function cargarCatalogoPreguntas(){

    try{

        const filas = await checklistFetch(
            "/mhe_preguntas?select=clave,titulo,seccion"
        );

        preguntasPorClave = {};

        (filas || []).forEach(function(p){
            preguntasPorClave[p.clave] = p;
        });

    }catch(e){
        console.error(e);
    }

}

const ETIQUETA_TURNO = { DIA: "Día", NOCHE: "Noche", INTERMEDIO: "Intermedio" };

const ICONO_VALOR = {
    OPERATIVO: "👍 Operativo",
    INOPERATIVO: "👎 Inoperativo",
    OBSERVADO: "👁 Observado",
    NO_APLICA: "🚫 No aplica"
};

function formatearFechaHora(iso){

    if(!iso){
        return "-";
    }

    return new Date(iso).toLocaleString("es-PE", {
        day: "2-digit", month: "2-digit", year: "numeric",
        hour: "2-digit", minute: "2-digit"
    });

}

// "3d 5h", "8h 20m" o "15m" según cuánto lleva bloqueado — entre más
// tiempo, más urgente para el supervisor.
function formatearTiempoBloqueado(iso){

    const diffMs = Math.max(0, Date.now() - new Date(iso).getTime());
    const horasTotales = Math.floor(diffMs / 3600000);
    const dias = Math.floor(horasTotales / 24);

    if(dias > 0){
        return dias + "d " + (horasTotales % 24) + "h";
    }

    if(horasTotales > 0){
        const minutos = Math.floor((diffMs % 3600000) / 60000);
        return horasTotales + "h " + minutos + "m";
    }

    return Math.max(1, Math.floor(diffMs / 60000)) + "m";

}

// ========================================
// KPIs + LISTA DE INOPERATIVOS
// ========================================

let equiposCargados = [];

async function cargarDashboard(){

    try{

        equiposCargados = await checklistFetch(
            "/mhe_equipos?select=id,tipo_equipo,serie,activo,bloqueado,motivo_bloqueo," +
            "bloqueado_checklist_id,bloqueado_por,bloqueado_el&activo=eq.true"
        ) || [];

        const pendientes = await checklistFetch(
            "/mhe_checklist_cabecera?select=id&aprobacion_estado=eq.PENDIENTE"
        ) || [];

        pintarKPIs(equiposCargados, pendientes.length);
        pintarPorTipo(equiposCargados);
        pintarInoperativos(equiposCargados);

    }catch(e){
        console.error(e);
    }

}

function pintarKPIs(equipos, totalPendientes){

    const total = equipos.length;
    const inoperativos = equipos.filter(function(e){ return e.bloqueado; }).length;

    document.getElementById("kpiTotal").textContent = total;
    document.getElementById("kpiOperativos").textContent = total - inoperativos;
    document.getElementById("kpiInoperativos").textContent = inoperativos;
    document.getElementById("kpiPendientes").textContent = totalPendientes;

}

const TIPOS_EQUIPO_MHE = ["Montacarga", "Apilador Eléctrico", "Transpaleta Eléctrica"];

function pintarPorTipo(equipos){

    const cont = document.getElementById("listaPorTipo");

    cont.innerHTML = TIPOS_EQUIPO_MHE.map(function(tipo){

        const delTipo = equipos.filter(function(e){ return e.tipo_equipo === tipo; });
        const total = delTipo.length;
        const inoperativos = delTipo.filter(function(e){ return e.bloqueado; }).length;
        const operativos = total - inoperativos;
        const porcentajeOperativo = total ? Math.round((operativos / total) * 100) : 0;

        return `
            <div class="filaTipoEquipo">
                <div class="filaTipoEquipoTop">
                    <div class="filaTipoEquipoNombre">${tipo}</div>
                    <div class="filaTipoEquipoStats">
                        <span>Total <b>${total}</b></span>
                        <span class="verde">Operativos <b>${operativos}</b></span>
                        <span class="rojo">Inoperativos <b>${inoperativos}</b></span>
                    </div>
                </div>
                <div class="barraTipoEquipo">
                    <div class="barraTipoEquipoOperativo" style="width:${porcentajeOperativo}%"></div>
                </div>
            </div>
        `;

    }).join("");

}

function pintarInoperativos(equipos){

    const lista = document.getElementById("listaInoperativos");
    const vacio = document.getElementById("mensajeSinInoperativos");

    const inoperativos = equipos
        .filter(function(e){ return e.bloqueado; })
        .sort(function(a, b){ return new Date(a.bloqueado_el) - new Date(b.bloqueado_el); });

    lista.innerHTML = "";

    if(!inoperativos.length){
        vacio.classList.remove("oculto");
        return;
    }

    vacio.classList.add("oculto");

    inoperativos.forEach(function(eq){

        const horas = (Date.now() - new Date(eq.bloqueado_el).getTime()) / 3600000;
        const clase = horas >= 24 ? "critico" : "reciente";

        const fila = document.createElement("div");
        fila.className = "filaInoperativo";
        fila.dataset.id = eq.id;

        fila.innerHTML = `
            <div class="filaInoperativoInfo">
                <div class="filaInoperativoTitulo">${eq.tipo_equipo} — Serie ${eq.serie}</div>
                <div class="filaInoperativoMotivo">${eq.motivo_bloqueo || "-"}</div>
            </div>
            <span class="badgeTiempoBloqueado ${clase}">${formatearTiempoBloqueado(eq.bloqueado_el)}</span>
        `;

        lista.appendChild(fila);

    });

}

// ========================================
// DETALLE DE INOPERATIVIDAD + LEVANTAR OBSERVACIÓN
// (mismo patrón que checklist-equipos.js de Lista de Equipos)
// ========================================

const modalOverlayBloqueo = document.getElementById("modalOverlayBloqueo");
const contenidoDetalleBloqueo = document.getElementById("contenidoDetalleBloqueo");

document.getElementById("listaInoperativos").addEventListener("click", async function(e){

    const fila = e.target.closest(".filaInoperativo");

    if(!fila){
        return;
    }

    const id = fila.dataset.id;
    const equipo = equiposCargados.find(eq => String(eq.id) === String(id));

    if(!equipo){
        return;
    }

    contenidoDetalleBloqueo.innerHTML = "<p>Cargando...</p>";
    modalOverlayBloqueo.classList.add("visible");

    try{

        let cabecera = null;
        let detalle = [];

        if(equipo.bloqueado_checklist_id){

            const filasCabecera = await checklistFetch(
                "/mhe_checklist_cabecera?select=*&id=eq." + encodeURIComponent(equipo.bloqueado_checklist_id)
            );

            cabecera = (filasCabecera && filasCabecera[0]) || null;

            detalle = await checklistFetch(
                "/mhe_checklist_detalle?select=seccion,clave,valor&cabecera_id=eq." + encodeURIComponent(equipo.bloqueado_checklist_id)
            ) || [];

        }

        pintarDetalleBloqueo(equipo, cabecera, detalle);

    }catch(error){

        console.error(error);
        contenidoDetalleBloqueo.innerHTML = "<p>No se pudo cargar el detalle.</p>";

    }

});

function tituloDeClave(clave){
    return (preguntasPorClave[clave] && preguntasPorClave[clave].titulo) || clave;
}

function pintarDetalleBloqueo(equipo, cabecera, detalle){

    function filaItem(d){
        const claseValor = String(d.valor || "").toLowerCase();
        return `
            <div class="detalleItem">
                <span>${tituloDeClave(d.clave)}</span>
                <span class="valorItem ${claseValor}">${ICONO_VALOR[d.valor] || d.valor}</span>
            </div>
        `;
    }

    const funciones = detalle.filter(function(d){
        return (preguntasPorClave[d.clave] && preguntasPorClave[d.clave].seccion === "FUNCIONES") || d.seccion === "FUNCIONES";
    });

    const visual = detalle.filter(function(d){
        return (preguntasPorClave[d.clave] && preguntasPorClave[d.clave].seccion === "VISUAL") || d.seccion === "VISUAL";
    });

    contenidoDetalleBloqueo.innerHTML = `

        <div class="avisoPendiente" style="background:#fee2e2;color:#b91c1c;">
            🚫 Bloqueado por ${equipo.bloqueado_por || "-"} el ${formatearFechaHora(equipo.bloqueado_el)}
        </div>

        <div class="detalleSeccion">
            <div class="detalleTitulo">Motivo</div>
            <div class="detalleCampo">${equipo.motivo_bloqueo || "-"}</div>
        </div>

        ${cabecera ? `
            <div class="detalleSeccion">
                <div class="detalleTitulo">Datos generales del checklist</div>
                <div class="detalleGrid">
                    <div class="detalleCampo"><b>Fecha</b>${cabecera.fecha}</div>
                    <div class="detalleCampo"><b>Turno</b>${ETIQUETA_TURNO[cabecera.turno] || cabecera.turno}</div>
                    <div class="detalleCampo"><b>Equipo</b>${cabecera.tipo_equipo}</div>
                    <div class="detalleCampo"><b>Serie</b>${cabecera.serie}</div>
                </div>
            </div>

            <div class="detalleSeccion">
                <div class="detalleTitulo">Inspección de Funciones</div>
                ${funciones.map(filaItem).join("") || "<p>Sin datos.</p>"}
            </div>

            <div class="detalleSeccion">
                <div class="detalleTitulo">Inspección Visual</div>
                ${visual.map(filaItem).join("") || "<p>Sin datos.</p>"}
            </div>
        ` : ""}

        <div class="detalleSeccion">
            <div class="detalleTitulo">Levantar Observación</div>
            <div class="grupo">
                <label>Comentario (obligatorio)</label>
                <textarea id="campoComentarioLevantamiento" rows="3" placeholder="Explica por qué se levanta la observación..."></textarea>
            </div>
            <p id="mensajeErrorLevantamiento" class="mensaje-error"></p>
            <button type="button" id="btnLevantarObservacion" class="btnAprobar">✅ Levantar Observación</button>
        </div>

    `;

    document.getElementById("btnLevantarObservacion").addEventListener("click", async function(){

        const boton = this;
        const comentario = document.getElementById("campoComentarioLevantamiento").value.trim();
        const mensajeError = document.getElementById("mensajeErrorLevantamiento");

        if(!comentario){
            mensajeError.textContent = "Escribe un comentario antes de continuar.";
            return;
        }

        mensajeError.textContent = "";
        boton.disabled = true;
        boton.textContent = "Guardando...";

        try{

            await checklistFetch(
                "/mhe_equipos?id=eq." + encodeURIComponent(equipo.id),
                {
                    method: "PATCH",
                    body: JSON.stringify({
                        bloqueado: false,
                        levantado_por: sesion ? sesion.nombre_completo : null,
                        levantado_el: new Date().toISOString(),
                        comentario_levantamiento: comentario
                    })
                }
            );

            modalOverlayBloqueo.classList.remove("visible");
            cargarDashboard();

        }catch(error){

            console.error(error);
            boton.disabled = false;
            boton.textContent = "✅ Levantar Observación";
            mensajeError.textContent = "No se pudo guardar. Intenta de nuevo.";

        }

    });

}

document.getElementById("btnCerrarDetalleBloqueo").addEventListener("click", function(){
    modalOverlayBloqueo.classList.remove("visible");
});

modalOverlayBloqueo.addEventListener("click", function(e){

    if(e.target === modalOverlayBloqueo){
        modalOverlayBloqueo.classList.remove("visible");
    }

});

// ========================================
// INICIO
// ========================================

if(sesion && (sesion.rol === "Administrador" || sesion.rol === "Supervisor")){
    cargarCatalogoPreguntas().then(cargarDashboard);
}

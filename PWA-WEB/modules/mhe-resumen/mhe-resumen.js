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
// CATÁLOGO DE PREGUNTAS (clave → título/sección, para el detalle)
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

// ========================================
// LISTAR CHECKLISTS
// ========================================

const ETIQUETA_TURNO = { DIA: "Día", NOCHE: "Noche", INTERMEDIO: "Intermedio" };
const ETIQUETA_ESTADO = { OPERATIVO: "Operativo", OBSERVADO: "Observado", INOPERATIVO: "Inoperativo" };

const tblResumen = document.getElementById("tblResumen");
const mensajeVacio = document.getElementById("mensajeVacio");
const buscador = document.getElementById("buscador");
const filtroFecha = document.getElementById("filtroFecha");
const filtroTurno = document.getElementById("filtroTurno");
const filtroTipoEquipo = document.getElementById("filtroTipoEquipo");
const filtroEstadoGeneral = document.getElementById("filtroEstadoGeneral");
const filtroAprobacion = document.getElementById("filtroAprobacion");

let checklistsCargados = [];

async function cargarChecklists(){

    tblResumen.innerHTML = "";
    mensajeVacio.style.display = "none";

    try{

        checklistsCargados = await checklistFetch(
            "/mhe_checklist_cabecera?select=id,fecha,turno,area,tipo_equipo,serie,estado_general,bateria_porcentaje,vb_operador,creado_por_nombre,created_at,aprobacion_estado,aprobado_por,aprobado_el" +
            "&order=fecha.desc,created_at.desc"
        );

        aplicarFiltros();

    }catch(e){

        console.error(e);
        mensajeVacio.textContent = "No se pudo cargar el historial de checklists.";
        mensajeVacio.style.display = "block";

    }

}

function formatearFechaHora(iso){

    if(!iso){
        return "-";
    }

    return new Date(iso).toLocaleString("es-PE", {
        day: "2-digit", month: "2-digit", year: "numeric",
        hour: "2-digit", minute: "2-digit"
    });

}

const APROBADOR_AUTOMATICO = "Sistema (automático)";

function pillAprobacionHTML(c){

    if(c.aprobacion_estado === "APROBADO"){

        if(c.aprobado_por === APROBADOR_AUTOMATICO){
            return `<span class="pill-aprobacion automatica" title="Salió todo Operativo — se aprobó solo el ${formatearFechaHora(c.aprobado_el)}">✅ Automático</span>`;
        }

        return `<span class="pill-aprobacion aprobado" title="Aprobado por ${c.aprobado_por || "-"} el ${formatearFechaHora(c.aprobado_el)}">✅ Aprobado</span>`;

    }

    return `<span class="pill-aprobacion pendiente btn-ver" data-id="${c.id}" title="Tiene un ítem Observado o Inoperativo — entra a revisar">👁 Pendiente</span>`;

}

function renderizarChecklists(lista){

    tblResumen.innerHTML = "";
    mensajeVacio.style.display = "none";

    if(!lista || !lista.length){
        mensajeVacio.textContent = "Ningún checklist coincide con el filtro.";
        mensajeVacio.style.display = "block";
        return;
    }

    lista.forEach(function(c){

        const estadoClase = String(c.estado_general || "").toLowerCase();

        const tr = document.createElement("tr");

        tr.innerHTML = `
            <td>${c.fecha}</td>
            <td>${ETIQUETA_TURNO[c.turno] || c.turno || "-"}</td>
            <td>${c.tipo_equipo}</td>
            <td>${c.serie}</td>
            <td><span class="estado-pill ${estadoClase}">${ETIQUETA_ESTADO[c.estado_general] || c.estado_general || "-"}</span></td>
            <td>${pillAprobacionHTML(c)}</td>
            <td>${c.bateria_porcentaje !== null && c.bateria_porcentaje !== undefined ? c.bateria_porcentaje + "%" : "-"}</td>
            <td>${c.creado_por_nombre || "-"}</td>
            <td>
                <button class="btn-ver" data-id="${c.id}">
                    Ver
                </button>
            </td>
        `;

        tblResumen.appendChild(tr);

    });

}

function aplicarFiltros(){

    const termino = buscador.value.trim().toLowerCase();
    const fecha = filtroFecha.value;
    const turno = filtroTurno.value;
    const tipoEquipo = filtroTipoEquipo.value;
    const estado = filtroEstadoGeneral.value;
    const aprobacion = filtroAprobacion.value;

    const filtrados = checklistsCargados.filter(function(c){

        const coincideTexto = !termino || String(c.serie).toLowerCase().includes(termino);
        const coincideFecha = !fecha || c.fecha === fecha;
        const coincideTurno = !turno || c.turno === turno;
        const coincideTipoEquipo = !tipoEquipo || c.tipo_equipo === tipoEquipo;
        const coincideEstado = !estado || c.estado_general === estado;
        const coincideAprobacion = !aprobacion || c.aprobacion_estado === aprobacion;

        return coincideTexto && coincideFecha && coincideTurno && coincideTipoEquipo && coincideEstado && coincideAprobacion;

    });

    renderizarChecklists(filtrados);

}

buscador.addEventListener("input", aplicarFiltros);
filtroFecha.addEventListener("change", aplicarFiltros);
filtroTurno.addEventListener("change", aplicarFiltros);
filtroTipoEquipo.addEventListener("change", aplicarFiltros);
filtroEstadoGeneral.addEventListener("change", aplicarFiltros);
filtroAprobacion.addEventListener("change", aplicarFiltros);

document.getElementById("btnLimpiarFiltros").addEventListener("click", function(){

    buscador.value = "";
    filtroFecha.value = "";
    filtroTurno.value = "";
    filtroTipoEquipo.value = "";
    filtroEstadoGeneral.value = "";
    filtroAprobacion.value = "";

    aplicarFiltros();

});

// ========================================
// VER DETALLE
// ========================================

const modalOverlay = document.getElementById("modalOverlay");
const contenidoDetalle = document.getElementById("contenidoDetalle");

const ICONO_VALOR = {
    OPERATIVO: "👍 Operativo",
    INOPERATIVO: "👎 Inoperativo",
    OBSERVADO: "👁 Observado",
    NO_APLICA: "🚫 No aplica"
};

let idDetalleAbierto = null;

tblResumen.addEventListener("click", async function(e){

    const boton = e.target.closest(".btn-ver");

    if(!boton){
        return;
    }

    const id = boton.dataset.id;
    const cabecera = checklistsCargados.find(c => String(c.id) === String(id));

    if(!cabecera){
        return;
    }

    idDetalleAbierto = id;
    contenidoDetalle.innerHTML = "<p>Cargando...</p>";
    modalOverlay.classList.add("visible");

    try{

        const cabeceraCompleta = await checklistFetch(
            "/mhe_checklist_cabecera?select=*&id=eq." + encodeURIComponent(id)
        );

        const detalle = await checklistFetch(
            "/mhe_checklist_detalle?select=seccion,clave,valor&cabecera_id=eq." + encodeURIComponent(id)
        );

        pintarDetalle(cabeceraCompleta[0], detalle || []);

    }catch(error){

        console.error(error);
        contenidoDetalle.innerHTML = "<p>No se pudo cargar el detalle.</p>";

    }

});

function tituloDeClave(clave){
    return (preguntasPorClave[clave] && preguntasPorClave[clave].titulo) || clave;
}

function pintarDetalle(c, detalle){

    const funciones = detalle.filter(function(d){
        return (preguntasPorClave[d.clave] && preguntasPorClave[d.clave].seccion === "FUNCIONES") || d.seccion === "FUNCIONES";
    });

    const visual = detalle.filter(function(d){
        return (preguntasPorClave[d.clave] && preguntasPorClave[d.clave].seccion === "VISUAL") || d.seccion === "VISUAL";
    });

    function filaItem(d){
        const claseValor = String(d.valor || "").toLowerCase();
        return `
            <div class="detalleItem">
                <span>${tituloDeClave(d.clave)}</span>
                <span class="valorItem ${claseValor}">${ICONO_VALOR[d.valor] || d.valor}</span>
            </div>
        `;
    }

    const bannerAprobacion = c.aprobacion_estado === "PENDIENTE"
        ? `<div class="avisoPendiente">⚠️ Tiene ítems Observados o Inoperativos — revisa el detalle y aprueba abajo.</div>`
        : (c.aprobado_por === APROBADOR_AUTOMATICO
            ? `<div class="avisoPendiente" style="background:#dbeafe;color:#1d4ed8;">✅ Aprobado automáticamente (salió todo Operativo) el ${formatearFechaHora(c.aprobado_el)}</div>`
            : `<div class="avisoPendiente" style="background:#dcfce7;color:#15803d;">✅ Aprobado por ${c.aprobado_por || "-"} el ${formatearFechaHora(c.aprobado_el)}</div>`);

    contenidoDetalle.innerHTML = `

        ${bannerAprobacion}

        <div class="detalleSeccion">
            <div class="detalleTitulo">Datos generales</div>
            <div class="detalleGrid">
                <div class="detalleCampo"><b>Fecha</b>${c.fecha}</div>
                <div class="detalleCampo"><b>Turno</b>${ETIQUETA_TURNO[c.turno] || c.turno}</div>
                <div class="detalleCampo"><b>Área</b>${c.area}</div>
                <div class="detalleCampo"><b>Local</b>${c.local}</div>
                <div class="detalleCampo"><b>Equipo</b>${c.tipo_equipo}</div>
                <div class="detalleCampo"><b>Serie</b>${c.serie}</div>
                <div class="detalleCampo"><b>Batería</b>${c.bateria_porcentaje ?? "-"}%</div>
                <div class="detalleCampo"><b>Horómetro inicio</b>${c.horometro_inicio ?? "-"}</div>
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

        <div class="detalleSeccion">
            <div class="detalleTitulo">Resumen</div>
            <div class="detalleGrid">
                <div class="detalleCampo"><b>Observaciones</b>${c.resumen_observaciones || "-"}</div>
                <div class="detalleCampo"><b>VB Operador</b>${ICONO_VALOR[c.vb_operador] || c.vb_operador || "-"}</div>
            </div>
        </div>

        <div class="detalleSeccion">
            <div class="detalleTitulo">Declaración de estado de salud</div>
            <div class="detalleGrid">
                <div class="detalleCampo"><b>¿Dormiste 6-8h?</b>${c.salud_dormiste ? "Sí" : "No"}</div>
                <div class="detalleCampo"><b>¿Concentración/energía?</b>${c.salud_concentracion ? "Sí" : "No"}</div>
                <div class="detalleCampo"><b>¿Bajo medicación?</b>${c.salud_bajo_medicacion ? "Sí" : "No"}</div>
                <div class="detalleCampo"><b>Medicamentos</b>${c.salud_medicamentos_detalle || "-"}</div>
            </div>
        </div>

        <div class="detalleSeccion">
            <div class="detalleTitulo">Registro</div>
            <div class="detalleGrid">
                <div class="detalleCampo"><b>Registrado por</b>${c.creado_por_nombre || "-"} (DNI ${c.creado_por_dni || "-"})</div>
                <div class="detalleCampo"><b>Registrado el</b>${formatearFechaHora(c.created_at)}</div>
            </div>
        </div>

        ${c.aprobacion_estado === "PENDIENTE" ? `<button type="button" id="btnAprobar" class="btnAprobar">✅ Aprobar checklist</button>` : ""}

    `;

    if(c.aprobacion_estado === "PENDIENTE"){

        document.getElementById("btnAprobar").addEventListener("click", async function(){

            const boton = this;
            boton.disabled = true;
            boton.textContent = "Aprobando...";

            try{

                await checklistFetch(
                    "/mhe_checklist_cabecera?id=eq." + encodeURIComponent(idDetalleAbierto),
                    {
                        method: "PATCH",
                        body: JSON.stringify({
                            aprobacion_estado: "APROBADO",
                            aprobado_por: sesion ? sesion.nombre_completo : null,
                            aprobado_el: new Date().toISOString()
                        })
                    }
                );

                modalOverlay.classList.remove("visible");
                cargarChecklists();

            }catch(error){

                console.error(error);
                boton.disabled = false;
                boton.textContent = "✅ Aprobar checklist";
                alert("No se pudo aprobar el checklist. Intenta de nuevo.");

            }

        });

    }

}

document.getElementById("btnCerrarDetalle").addEventListener("click", function(){
    modalOverlay.classList.remove("visible");
});

modalOverlay.addEventListener("click", function(e){

    if(e.target === modalOverlay){
        modalOverlay.classList.remove("visible");
    }

});

// ========================================
// INICIO
// ========================================

if(sesion && (sesion.rol === "Administrador" || sesion.rol === "Supervisor")){
    cargarCatalogoPreguntas().then(cargarChecklists);
}

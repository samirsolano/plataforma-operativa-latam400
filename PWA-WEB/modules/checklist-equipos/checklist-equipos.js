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
// STORAGE: foto del equipo
// ========================================
// Bucket "mhe" en el mismo proyecto Supabase donde vive la tabla
// mhe_equipos (SUPABASE_URL_CHECKLIST) — a diferencia de las fotos de
// colaboradores (que quedaron repartidas en dos proyectos por
// historia), acá todo queda junto. El bucket + su política de
// lectura/escritura para la publishable key se crean corriendo
// sql/mhe_checklist.sql (migración) en el SQL Editor de Supabase.

const STORAGE_URL_MHE = SUPABASE_URL_CHECKLIST.replace("/rest/v1", "/storage/v1");
const BUCKET_MHE = "mhe";

// Quita tildes carácter por carácter (en vez de un regex con rango
// Unicode) para no depender de escribir marcas diacríticas literales
// en el archivo fuente — mismo criterio que normalizarNombre en
// checklist-higiene.js del repo de Centro de Proyectos.
function slugEquipoMHE(tipoEquipo, serie){

    const descompuesto = (String(tipoEquipo) + "-" + String(serie)).toLowerCase().normalize("NFD");
    let sinTildes = "";

    for(let i = 0; i < descompuesto.length; i++){

        const codigo = descompuesto.charCodeAt(i);
        const esMarcaDiacritica = codigo >= 768 && codigo <= 879; // U+0300–U+036F

        if(!esMarcaDiacritica){
            sinTildes += descompuesto[i];
        }

    }

    return sinTildes
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");

}

async function subirFotoEquipoMHE(tipoEquipo, serie, archivo){

    const extension = archivo.name.split(".").pop().toLowerCase();
    const ruta = slugEquipoMHE(tipoEquipo, serie) + "." + extension;

    const respuesta = await fetch(
        STORAGE_URL_MHE + "/object/" + BUCKET_MHE + "/" + ruta,
        {
            method: "POST",
            headers: {
                apikey: SUPABASE_KEY_CHECKLIST,
                Authorization: "Bearer " + SUPABASE_KEY_CHECKLIST,
                "Content-Type": archivo.type,
                "x-upsert": "true"
            },
            body: archivo
        }
    );

    if(!respuesta.ok){
        const detalle = await respuesta.text();
        throw new Error(detalle || "No se pudo subir la foto");
    }

    return STORAGE_URL_MHE + "/object/public/" + BUCKET_MHE + "/" + ruta;

}

// ========================================
// CATÁLOGO DE PREGUNTAS (clave → título/sección, para el detalle de
// inoperatividad — mismo criterio que mhe-resumen.js)
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

// ========================================
// LISTAR
// ========================================

const tblEquipos = document.getElementById("tblEquipos");
const mensajeVacio = document.getElementById("mensajeVacio");
const buscador = document.getElementById("buscador");
const filtroEstado = document.getElementById("filtroEstado");
const filtroNombre = document.getElementById("filtroNombre");

let equiposCargados = [];

async function cargarEquipos(){

    tblEquipos.innerHTML = "";
    mensajeVacio.style.display = "none";

    try{

        equiposCargados = await checklistFetch(
            "/mhe_equipos?select=id,tipo_equipo,serie,local,foto_url,activo,updated_at,updated_by," +
            "bloqueado,motivo_bloqueo,bloqueado_checklist_id,bloqueado_por,bloqueado_el&order=id.asc"
        );

        llenarFiltroNombre(equiposCargados);
        aplicarFiltros();

    }catch(e){

        console.error(e);
        mensajeVacio.textContent = "No se pudo cargar la lista de equipos.";
        mensajeVacio.style.display = "block";

    }

}

function llenarFiltroNombre(lista){

    const seleccionActual = filtroNombre.value;

    const nombres = Array.from(new Set(
        lista.map(e => e.tipo_equipo).filter(Boolean)
    )).sort();

    filtroNombre.innerHTML = '<option value="">Nombre (todos)</option>';

    nombres.forEach(function(nombre){

        const opcion = document.createElement("option");
        opcion.value = nombre;
        opcion.textContent = nombre;

        filtroNombre.appendChild(opcion);

    });

    filtroNombre.value = seleccionActual;

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

function pillOperatividadHTML(eq){

    if(eq.bloqueado){
        return `<span class="pill-operatividad bloqueado pill-bloqueado" data-id="${eq.id}" title="Click para ver el detalle">🚫 Inoperativo</span>`;
    }

    return `<span class="pill-operatividad operativo">✅ Operativo</span>`;

}

function renderizarEquipos(lista){

    tblEquipos.innerHTML = "";
    mensajeVacio.style.display = "none";

    if(!lista || !lista.length){
        mensajeVacio.textContent = "No hay equipos registrados.";
        mensajeVacio.style.display = "block";
        return;
    }

    lista.forEach(function(eq){

        const tr = document.createElement("tr");

        const imagenFoto = eq.foto_url
            ? `<img class="foto-mini" src="${eq.foto_url}" alt="">`
            : `<div class="foto-mini"></div>`;

        tr.innerHTML = `
            <td>${eq.id}</td>
            <td><span class="estado-pill ${eq.activo ? "activo" : "inactivo"}">${eq.activo ? "Activo" : "Inactivo"}</span></td>
            <td>${pillOperatividadHTML(eq)}</td>
            <td>${eq.local || "-"}</td>
            <td>${eq.tipo_equipo}</td>
            <td>${eq.serie}</td>
            <td>${imagenFoto}</td>
            <td>${formatearFechaHora(eq.updated_at)}</td>
            <td>${eq.updated_by || "-"}</td>
            <td>
                <button class="btn-editar" data-id="${eq.id}">
                    Editar
                </button>
            </td>
        `;

        tblEquipos.appendChild(tr);

    });

}

function aplicarFiltros(){

    const termino = buscador.value.trim().toLowerCase();
    const estado = filtroEstado.value;
    const nombre = filtroNombre.value;

    const filtrados = equiposCargados.filter(function(eq){

        const coincideTexto = !termino ||
            String(eq.serie).toLowerCase().includes(termino);

        const coincideEstado = !estado ||
            (estado === "Activo" && eq.activo) ||
            (estado === "Inactivo" && !eq.activo);

        const coincideNombre = !nombre || eq.tipo_equipo === nombre;

        return coincideTexto && coincideEstado && coincideNombre;

    });

    if(!filtrados.length){
        tblEquipos.innerHTML = "";
        mensajeVacio.textContent = "Ningún equipo coincide con el filtro.";
        mensajeVacio.style.display = "block";
        return;
    }

    renderizarEquipos(filtrados);

}

buscador.addEventListener("input", aplicarFiltros);
filtroEstado.addEventListener("change", aplicarFiltros);
filtroNombre.addEventListener("change", aplicarFiltros);

// ========================================
// EDITAR (delegado)
// ========================================

tblEquipos.addEventListener("click", function(e){

    const botonEditar = e.target.closest(".btn-editar");

    if(!botonEditar){
        return;
    }

    const id = botonEditar.dataset.id;
    const equipo = equiposCargados.find(eq => String(eq.id) === String(id));

    if(equipo){
        abrirModalEditar(equipo);
    }

});

// ========================================
// DETALLE DE INOPERATIVIDAD + LEVANTAR OBSERVACIÓN
// ========================================

const modalOverlayBloqueo = document.getElementById("modalOverlayBloqueo");
const contenidoDetalleBloqueo = document.getElementById("contenidoDetalleBloqueo");

tblEquipos.addEventListener("click", async function(e){

    const pill = e.target.closest(".pill-bloqueado");

    if(!pill){
        return;
    }

    const id = pill.dataset.id;
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
            cargarEquipos();

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
// MODAL AGREGAR / EDITAR
// ========================================

const modalOverlay = document.getElementById("modalOverlay");
const tituloModal = document.getElementById("tituloModal");
const btnAgregar = document.getElementById("btnAgregar");
const btnCancelar = document.getElementById("btnCancelar");
const btnGuardar = document.getElementById("btnGuardar");
const mensajeErrorModal = document.getElementById("mensajeErrorModal");

const inputNuevoFoto = document.getElementById("nuevoFoto");
const previsualizacionFoto = document.getElementById("previsualizacionFoto");
const selectNuevoEstado = document.getElementById("nuevoEstado");
const selectNuevoNombre = document.getElementById("nuevoNombre");
const inputNuevaSerie = document.getElementById("nuevaSerie");
const inputNuevoLocal = document.getElementById("nuevoLocal");

let editandoId = null;
let fotoUrlActual = null;

function limpiarModal(){

    mensajeErrorModal.textContent = "";
    inputNuevoFoto.value = "";
    previsualizacionFoto.src = "";
    previsualizacionFoto.style.display = "none";
    selectNuevoEstado.value = "Activo";
    selectNuevoNombre.selectedIndex = 0;
    inputNuevaSerie.value = "";
    inputNuevoLocal.value = "LATAM";
    fotoUrlActual = null;

}

function abrirModalNuevo(){

    limpiarModal();
    editandoId = null;

    tituloModal.textContent = "Agregar MHE";
    modalOverlay.classList.add("visible");

}

function abrirModalEditar(equipo){

    limpiarModal();
    editandoId = equipo.id;

    tituloModal.textContent = "Editar MHE";

    selectNuevoEstado.value = equipo.activo ? "Activo" : "Inactivo";
    selectNuevoNombre.value = equipo.tipo_equipo;
    inputNuevaSerie.value = equipo.serie;
    inputNuevoLocal.value = equipo.local || "LATAM";
    fotoUrlActual = equipo.foto_url || null;

    if(fotoUrlActual){
        previsualizacionFoto.src = fotoUrlActual;
        previsualizacionFoto.style.display = "block";
    }

    modalOverlay.classList.add("visible");

}

function cerrarModal(){
    modalOverlay.classList.remove("visible");
}

btnAgregar.addEventListener("click", abrirModalNuevo);
btnCancelar.addEventListener("click", cerrarModal);

modalOverlay.addEventListener("click", function(e){

    if(e.target === modalOverlay){
        cerrarModal();
    }

});

inputNuevoFoto.addEventListener("change", function(){

    const archivo = inputNuevoFoto.files[0];

    if(!archivo){
        return;
    }

    const lector = new FileReader();

    lector.onload = function(e){
        previsualizacionFoto.src = e.target.result;
        previsualizacionFoto.style.display = "block";
    };

    lector.readAsDataURL(archivo);

});

btnGuardar.addEventListener("click", async function(){

    const estado = selectNuevoEstado.value;
    const nombre = selectNuevoNombre.value;
    const serie = inputNuevaSerie.value.trim();
    const local = inputNuevoLocal.value.trim() || "LATAM";
    const archivo = inputNuevoFoto.files[0];

    mensajeErrorModal.textContent = "";

    if(!nombre || !serie){
        mensajeErrorModal.textContent = "Complete el nombre y la serie del equipo.";
        return;
    }

    btnGuardar.disabled = true;
    btnGuardar.textContent = "GUARDANDO...";

    try{

        let fotoUrl = fotoUrlActual;

        if(archivo){
            fotoUrl = await subirFotoEquipoMHE(nombre, serie, archivo);
        }

        const datos = {
            tipo_equipo: nombre,
            serie: serie,
            local: local,
            activo: estado === "Activo",
            foto_url: fotoUrl,
            updated_at: new Date().toISOString(),
            updated_by: sesion ? sesion.nombre_completo : null
        };

        if(editandoId){

            await checklistFetch(
                "/mhe_equipos?id=eq." + encodeURIComponent(editandoId),
                {
                    method: "PATCH",
                    body: JSON.stringify(datos)
                }
            );

        }else{

            await checklistFetch(
                "/mhe_equipos",
                {
                    method: "POST",
                    body: JSON.stringify(datos)
                }
            );

        }

        cerrarModal();
        cargarEquipos();

    }catch(e){

        console.error(e);

        mensajeErrorModal.textContent = String(e.message || "").includes("duplicate")
            ? "Ya existe un equipo con ese nombre y serie."
            : "No se pudo guardar el equipo.";

    }finally{

        btnGuardar.disabled = false;
        btnGuardar.textContent = "Guardar";

    }

});

// ========================================
// INICIO
// ========================================

if(sesion && (sesion.rol === "Administrador" || sesion.rol === "Supervisor")){
    cargarCatalogoPreguntas().then(cargarEquipos);
}

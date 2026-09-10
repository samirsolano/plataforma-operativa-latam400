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
// LISTAR
// ========================================

const ETIQUETA_EQUIPO = {
    aplica_transpaleta: "Transpaleta Eléctrica",
    aplica_montacarga: "Montacarga",
    aplica_apilador: "Apilador Eléctrico"
};

const ETIQUETA_CRITERIO = {
    INOPERATIVO: "Operativo / Inoperativo",
    OBSERVADO: "+ Observado"
};

const tblPreguntas = document.getElementById("tblPreguntas");
const mensajeVacio = document.getElementById("mensajeVacio");
const buscador = document.getElementById("buscador");
const filtroSeccion = document.getElementById("filtroSeccion");
const filtroEquipo = document.getElementById("filtroEquipo");
const filtroEstado = document.getElementById("filtroEstado");

let preguntasCargadas = [];

async function cargarPreguntas(){

    tblPreguntas.innerHTML = "";
    mensajeVacio.style.display = "none";

    try{

        preguntasCargadas = await checklistFetch(
            "/mhe_preguntas?select=id,clave,titulo,seccion,aplica_transpaleta,aplica_montacarga,aplica_apilador,criterio,no_aplica,orden,activo&order=orden.asc"
        );

        aplicarFiltros();

    }catch(e){

        console.error(e);
        mensajeVacio.textContent = "No se pudo cargar la lista de preguntas.";
        mensajeVacio.style.display = "block";

    }

}

function equiposBadges(p){

    return Object.keys(ETIQUETA_EQUIPO)
        .filter(function(campo){ return p[campo]; })
        .map(function(campo){ return `<span class="badge-equipo">${ETIQUETA_EQUIPO[campo]}</span>`; })
        .join("");

}

function renderizarPreguntas(lista){

    tblPreguntas.innerHTML = "";
    mensajeVacio.style.display = "none";

    if(!lista || !lista.length){
        mensajeVacio.textContent = "No hay preguntas registradas.";
        mensajeVacio.style.display = "block";
        return;
    }

    lista.forEach(function(p){

        const tr = document.createElement("tr");

        tr.innerHTML = `
            <td>${p.orden}</td>
            <td>${p.titulo}</td>
            <td>${p.seccion === "FUNCIONES" ? "Funciones" : "Visual"}</td>
            <td>${equiposBadges(p)}</td>
            <td>${ETIQUETA_CRITERIO[p.criterio]}</td>
            <td>${p.no_aplica ? "Sí" : "No"}</td>
            <td><span class="estado-pill ${p.activo ? "activo" : "inactivo"}">${p.activo ? "Activo" : "Inactivo"}</span></td>
            <td>
                <button class="btn-editar" data-id="${p.id}">
                    Editar
                </button>
            </td>
        `;

        tblPreguntas.appendChild(tr);

    });

}

function aplicarFiltros(){

    const termino = buscador.value.trim().toLowerCase();
    const seccion = filtroSeccion.value;
    const equipo = filtroEquipo.value;
    const estado = filtroEstado.value;

    const campoEquipo = {
        transpaleta: "aplica_transpaleta",
        montacarga: "aplica_montacarga",
        apilador: "aplica_apilador"
    }[equipo];

    const filtrados = preguntasCargadas.filter(function(p){

        const coincideTexto = !termino || p.titulo.toLowerCase().includes(termino) || p.clave.toLowerCase().includes(termino);
        const coincideSeccion = !seccion || p.seccion === seccion;
        const coincideEquipo = !campoEquipo || p[campoEquipo];
        const coincideEstado = !estado || (estado === "Activo" && p.activo) || (estado === "Inactivo" && !p.activo);

        return coincideTexto && coincideSeccion && coincideEquipo && coincideEstado;

    });

    if(!filtrados.length){
        tblPreguntas.innerHTML = "";
        mensajeVacio.textContent = "Ninguna pregunta coincide con el filtro.";
        mensajeVacio.style.display = "block";
        return;
    }

    renderizarPreguntas(filtrados);

}

buscador.addEventListener("input", aplicarFiltros);
filtroSeccion.addEventListener("change", aplicarFiltros);
filtroEquipo.addEventListener("change", aplicarFiltros);
filtroEstado.addEventListener("change", aplicarFiltros);

// ========================================
// EDITAR (delegado)
// ========================================

tblPreguntas.addEventListener("click", function(e){

    const botonEditar = e.target.closest(".btn-editar");

    if(!botonEditar){
        return;
    }

    const id = botonEditar.dataset.id;
    const pregunta = preguntasCargadas.find(p => String(p.id) === String(id));

    if(pregunta){
        abrirModalEditar(pregunta);
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

const inputNuevoTitulo = document.getElementById("nuevoTitulo");
const inputNuevaClave = document.getElementById("nuevaClave");
const selectNuevaSeccion = document.getElementById("nuevaSeccion");
const checkTranspaleta = document.getElementById("nuevaAplicaTranspaleta");
const checkMontacarga = document.getElementById("nuevaAplicaMontacarga");
const checkApilador = document.getElementById("nuevaAplicaApilador");
const selectNuevoCriterio = document.getElementById("nuevoCriterio");
const checkNoAplica = document.getElementById("nuevoNoAplica");
const inputNuevoOrden = document.getElementById("nuevoOrden");
const selectNuevoEstado = document.getElementById("nuevoEstado");

let editandoId = null;

function limpiarModal(){

    mensajeErrorModal.textContent = "";
    inputNuevoTitulo.value = "";
    inputNuevaClave.value = "";
    inputNuevaClave.disabled = false;
    selectNuevaSeccion.value = "FUNCIONES";
    checkTranspaleta.checked = false;
    checkMontacarga.checked = false;
    checkApilador.checked = false;
    selectNuevoCriterio.value = "INOPERATIVO";
    checkNoAplica.checked = false;
    inputNuevoOrden.value = preguntasCargadas.length ? Math.max(...preguntasCargadas.map(p => p.orden || 0)) + 1 : 1;
    selectNuevoEstado.value = "Activo";

}

function abrirModalNuevo(){

    limpiarModal();
    editandoId = null;

    tituloModal.textContent = "Agregar Pregunta";
    modalOverlay.classList.add("visible");

}

function abrirModalEditar(p){

    limpiarModal();
    editandoId = p.id;

    tituloModal.textContent = "Editar Pregunta";

    inputNuevoTitulo.value = p.titulo;
    inputNuevaClave.value = p.clave;
    inputNuevaClave.disabled = true; // no tocar: es la misma clave que ya usan los checklists guardados
    selectNuevaSeccion.value = p.seccion;
    checkTranspaleta.checked = !!p.aplica_transpaleta;
    checkMontacarga.checked = !!p.aplica_montacarga;
    checkApilador.checked = !!p.aplica_apilador;
    selectNuevoCriterio.value = p.criterio;
    checkNoAplica.checked = !!p.no_aplica;
    inputNuevoOrden.value = p.orden;
    selectNuevoEstado.value = p.activo ? "Activo" : "Inactivo";

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

btnGuardar.addEventListener("click", async function(){

    const titulo = inputNuevoTitulo.value.trim();
    const clave = inputNuevaClave.value.trim();

    mensajeErrorModal.textContent = "";

    if(!titulo || !clave){
        mensajeErrorModal.textContent = "Complete el título y la clave.";
        return;
    }

    if(!checkTranspaleta.checked && !checkMontacarga.checked && !checkApilador.checked){
        mensajeErrorModal.textContent = "Selecciona al menos un equipo donde aplica.";
        return;
    }

    btnGuardar.disabled = true;
    btnGuardar.textContent = "GUARDANDO...";

    const datos = {
        titulo: titulo,
        seccion: selectNuevaSeccion.value,
        aplica_transpaleta: checkTranspaleta.checked,
        aplica_montacarga: checkMontacarga.checked,
        aplica_apilador: checkApilador.checked,
        criterio: selectNuevoCriterio.value,
        no_aplica: checkNoAplica.checked,
        orden: parseInt(inputNuevoOrden.value, 10) || 0,
        activo: selectNuevoEstado.value === "Activo",
        updated_at: new Date().toISOString(),
        updated_by: sesion ? sesion.nombre_completo : null
    };

    try{

        if(editandoId){

            await checklistFetch(
                "/mhe_preguntas?id=eq." + encodeURIComponent(editandoId),
                {
                    method: "PATCH",
                    body: JSON.stringify(datos)
                }
            );

        }else{

            await checklistFetch(
                "/mhe_preguntas",
                {
                    method: "POST",
                    body: JSON.stringify(Object.assign({ clave: clave }, datos))
                }
            );

        }

        cerrarModal();
        cargarPreguntas();

    }catch(e){

        console.error(e);

        mensajeErrorModal.textContent = String(e.message || "").includes("duplicate")
            ? "Ya existe una pregunta con esa clave."
            : "No se pudo guardar la pregunta.";

    }finally{

        btnGuardar.disabled = false;
        btnGuardar.textContent = "Guardar";

    }

});

// ========================================
// INICIO
// ========================================

if(sesion && (sesion.rol === "Administrador" || sesion.rol === "Supervisor")){
    cargarPreguntas();
}

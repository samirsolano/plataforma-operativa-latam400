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
// ZONAS (vienen del proyecto principal, tabla "zonas")
// ========================================

const selectFiltroZona = document.getElementById("filtroZona");
const selectNuevaZona = document.getElementById("nuevaZona");

let zonasDisponibles = [];

async function cargarZonas(){

    try{

        zonasDisponibles = await supabaseFetch(
            "/zonas?select=zona&order=orden.asc"
        );

        selectFiltroZona.innerHTML = '<option value="">Zona (todas)</option>';
        selectNuevaZona.innerHTML = "";

        zonasDisponibles.forEach(function(z){

            selectFiltroZona.innerHTML += `<option value="${z.zona}">${z.zona}</option>`;
            selectNuevaZona.innerHTML += `<option value="${z.zona}">${z.zona}</option>`;

        });

    }catch(e){

        console.error(e);

    }

}

// ========================================
// LISTAR
// ========================================

const tblPreguntas = document.getElementById("tblPreguntas");
const mensajeVacio = document.getElementById("mensajeVacio");
const buscador = document.getElementById("buscador");
const filtroS = document.getElementById("filtroS");

let preguntasCargadas = [];

async function cargarPreguntas(){

    tblPreguntas.innerHTML = "";
    mensajeVacio.style.display = "none";

    try{

        preguntasCargadas = await checklistFetch(
            "/preguntas_checklist?select=id,zona,s,orden,pregunta,respuesta_ok,foto_si_responde&order=zona.asc,s.asc,orden.asc"
        );

        aplicarFiltros();

    }catch(e){

        console.error(e);
        mensajeVacio.textContent = "No se pudo cargar la lista de preguntas.";
        mensajeVacio.style.display = "block";

    }

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
            <td>${p.zona}</td>
            <td>${p.s}</td>
            <td>${p.pregunta}</td>
            <td>${p.respuesta_ok}</td>
            <td>${p.foto_si_responde || "No pide"}</td>
            <td>
                <button class="btn-editar" data-id="${p.id}">
                    Editar
                </button>
                <button class="btn-eliminar" data-id="${p.id}">
                    Eliminar
                </button>
            </td>
        `;

        tblPreguntas.appendChild(tr);

    });

}

function aplicarFiltros(){

    const termino = buscador.value.trim().toLowerCase();
    const zona = selectFiltroZona.value;
    const s = filtroS.value;

    const filtrados = preguntasCargadas.filter(function(p){

        const coincideTexto = !termino ||
            p.pregunta.toLowerCase().includes(termino);

        const coincideZona = !zona || p.zona === zona;
        const coincideS = !s || p.s === s;

        return coincideTexto && coincideZona && coincideS;

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
selectFiltroZona.addEventListener("change", aplicarFiltros);
filtroS.addEventListener("change", aplicarFiltros);

// ========================================
// EDITAR / ELIMINAR
// ========================================

tblPreguntas.addEventListener("click", async function(e){

    const botonEditar = e.target.closest(".btn-editar");
    const botonEliminar = e.target.closest(".btn-eliminar");

    if(botonEditar){

        const id = botonEditar.dataset.id;
        const pregunta = preguntasCargadas.find(p => String(p.id) === String(id));

        if(pregunta){
            abrirModalEditar(pregunta);
        }

        return;
    }

    if(botonEliminar){

        const id = botonEliminar.dataset.id;

        const confirmado = confirm(
            "¿Eliminar esta pregunta? Esta acción no se puede deshacer."
        );

        if(!confirmado){
            return;
        }

        botonEliminar.disabled = true;
        botonEliminar.textContent = "Eliminando...";

        try{

            await checklistFetch(
                "/preguntas_checklist?id=eq." + encodeURIComponent(id),
                { method: "DELETE" }
            );

            cargarPreguntas();

        }catch(e){

            console.error(e);
            alert("No se pudo eliminar la pregunta.");
            botonEliminar.disabled = false;
            botonEliminar.textContent = "Eliminar";

        }

        return;
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

const inputNuevaS = document.getElementById("nuevaS");
const inputNuevaPregunta = document.getElementById("nuevaPregunta");
const inputNuevaRespuestaOk = document.getElementById("nuevaRespuestaOk");
const inputNuevaFoto = document.getElementById("nuevaFoto");

let editandoId = null;

function limpiarModal(){

    mensajeErrorModal.textContent = "";
    selectNuevaZona.selectedIndex = 0;
    inputNuevaS.value = "1S";
    inputNuevaPregunta.value = "";
    inputNuevaRespuestaOk.value = "Sí";
    inputNuevaFoto.value = "";

}

function abrirModalNuevo(){

    limpiarModal();
    editandoId = null;

    tituloModal.textContent = "Agregar Pregunta";
    modalOverlay.classList.add("visible");

}

function abrirModalEditar(pregunta){

    limpiarModal();
    editandoId = pregunta.id;

    tituloModal.textContent = "Editar Pregunta";

    selectNuevaZona.value = pregunta.zona;
    inputNuevaS.value = pregunta.s;
    inputNuevaPregunta.value = pregunta.pregunta;
    inputNuevaRespuestaOk.value = pregunta.respuesta_ok;
    inputNuevaFoto.value = pregunta.foto_si_responde || "";

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

    const zona = selectNuevaZona.value;
    const s = inputNuevaS.value;
    const pregunta = inputNuevaPregunta.value.trim();
    const respuestaOk = inputNuevaRespuestaOk.value;
    const foto = inputNuevaFoto.value;

    mensajeErrorModal.textContent = "";

    if(!zona || !pregunta){
        mensajeErrorModal.textContent = "Complete la zona y el texto de la pregunta.";
        return;
    }

    btnGuardar.disabled = true;
    btnGuardar.textContent = "GUARDANDO...";

    try{

        if(editandoId){

            await checklistFetch(
                "/preguntas_checklist?id=eq." + encodeURIComponent(editandoId),
                {
                    method: "PATCH",
                    body: JSON.stringify({
                        zona: zona,
                        s: s,
                        pregunta: pregunta,
                        respuesta_ok: respuestaOk,
                        foto_si_responde: foto || null,
                        updated_at: new Date().toISOString()
                    })
                }
            );

        }else{

            const existentes = preguntasCargadas.filter(
                p => p.zona === zona && p.s === s
            );

            const orden = existentes.length
                ? Math.max(...existentes.map(p => p.orden || 0)) + 1
                : 1;

            await checklistFetch(
                "/preguntas_checklist",
                {
                    method: "POST",
                    body: JSON.stringify({
                        zona: zona,
                        s: s,
                        orden: orden,
                        pregunta: pregunta,
                        respuesta_ok: respuestaOk,
                        foto_si_responde: foto || null
                    })
                }
            );

        }

        cerrarModal();
        cargarPreguntas();

    }catch(e){

        console.error(e);
        mensajeErrorModal.textContent = "No se pudo guardar la pregunta.";

    }finally{

        btnGuardar.disabled = false;
        btnGuardar.textContent = "Guardar";

    }

});

// ========================================
// INICIO
// ========================================

if(sesion && (sesion.rol === "Administrador" || sesion.rol === "Supervisor")){

    cargarZonas().then(cargarPreguntas);

}

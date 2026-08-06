// ========================================
// SESIÓN Y PERMISOS
// ========================================

const sesion = requerirSesion();

if(sesion && sesion.rol !== "Administrador" && sesion.rol !== "Supervisor"){
    window.location.href = "../inicio/home.html";
}

// ========================================
// LISTAR
// ========================================

const tblActivos = document.getElementById("tblActivos");
const mensajeVacio = document.getElementById("mensajeVacio");
const buscador = document.getElementById("buscador");

let activosCargados = [];

async function cargarActivos(){

    tblActivos.innerHTML = "";
    mensajeVacio.style.display = "none";

    try{

        activosCargados = await supabaseFetch(
            "/colaboradores_activos?select=id,dni,nombre,zona,pasillo,turno,supervisor,foto,activo&order=nombre.asc"
        );

        renderizarActivos(activosCargados);

    }catch(e){

        console.error(e);
        mensajeVacio.textContent = "No se pudo cargar la lista de colaboradores.";
        mensajeVacio.style.display = "block";

    }

}

function renderizarActivos(lista){

    tblActivos.innerHTML = "";
    mensajeVacio.style.display = "none";

    if(!lista || !lista.length){
        mensajeVacio.textContent = "No hay colaboradores activos registrados.";
        mensajeVacio.style.display = "block";
        return;
    }

    lista.forEach(function(c){

        const tr = document.createElement("tr");

        tr.innerHTML = `
            <td>
                <img class="foto-mini" src="${c.foto || ""}" alt="">
            </td>
            <td>${c.dni}</td>
            <td>${c.nombre}</td>
            <td>${c.zona || "-"}</td>
            <td>${c.pasillo || "-"}</td>
            <td>${c.turno || "-"}</td>
            <td>
                <span class="estado ${c.activo ? "activo" : "inactivo"}">
                    ${c.activo ? "Activo" : "Inactivo"}
                </span>
            </td>
            <td>
                <button class="btn-editar" data-id="${c.id}">
                    Editar
                </button>
                <button class="btn-eliminar" data-id="${c.id}" data-dni="${c.dni}">
                    Eliminar
                </button>
            </td>
        `;

        tblActivos.appendChild(tr);

    });

}

buscador.addEventListener("input", function(){

    const termino = buscador.value.trim().toLowerCase();

    if(!termino){
        renderizarActivos(activosCargados);
        return;
    }

    const filtrados = activosCargados.filter(function(c){

        return (
            c.dni.toLowerCase().includes(termino) ||
            c.nombre.toLowerCase().includes(termino)
        );

    });

    if(!filtrados.length){
        tblActivos.innerHTML = "";
        mensajeVacio.textContent = "Ningún colaborador coincide con la búsqueda.";
        mensajeVacio.style.display = "block";
        return;
    }

    renderizarActivos(filtrados);

});

// ========================================
// EDITAR / ELIMINAR
// ========================================

tblActivos.addEventListener("click", async function(e){

    const botonEditar = e.target.closest(".btn-editar");
    const botonEliminar = e.target.closest(".btn-eliminar");

    if(botonEditar){

        const id = botonEditar.dataset.id;
        const colaborador = activosCargados.find(c => String(c.id) === String(id));

        if(colaborador){
            abrirModalEditar(colaborador);
        }

        return;
    }

    if(botonEliminar){

        const id = botonEliminar.dataset.id;
        const dni = botonEliminar.dataset.dni;

        const confirmado = confirm(
            "¿Eliminar permanentemente al colaborador con DNI \"" + dni + "\"? Esta acción no se puede deshacer."
        );

        if(!confirmado){
            return;
        }

        botonEliminar.disabled = true;
        botonEliminar.textContent = "Eliminando...";

        try{

            await supabaseFetch(
                "/colaboradores_activos?id=eq." + encodeURIComponent(id),
                { method: "DELETE" }
            );

            cargarActivos();

        }catch(e){

            console.error(e);
            alert("No se pudo eliminar el colaborador.");
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
const fotoEncontradaMsg = document.getElementById("fotoEncontradaMsg");

const inputNuevoDni = document.getElementById("nuevoDni");
const inputNuevoNombre = document.getElementById("nuevoNombre");
const inputNuevoZona = document.getElementById("nuevoZona");
const inputNuevoPasillo = document.getElementById("nuevoPasillo");
const inputNuevoTurno = document.getElementById("nuevoTurno");
const inputNuevoSupervisor = document.getElementById("nuevoSupervisor");
const inputNuevoFoto = document.getElementById("nuevoFoto");
const previsualizacionFoto = document.getElementById("previsualizacionFoto");
const inputNuevoActivo = document.getElementById("nuevoActivo");

let editandoId = null;
let fotoBanco = null;

function limpiarModal(){

    mensajeErrorModal.textContent = "";
    fotoEncontradaMsg.textContent = "";
    inputNuevoDni.value = "";
    inputNuevoDni.disabled = false;
    inputNuevoNombre.value = "";
    inputNuevoZona.value = "";
    inputNuevoPasillo.value = "";
    inputNuevoTurno.value = "";
    inputNuevoSupervisor.value = "";
    inputNuevoFoto.value = "";
    inputNuevoActivo.checked = true;
    previsualizacionFoto.style.display = "none";
    previsualizacionFoto.src = "";
    fotoBanco = null;

}

function abrirModalNuevo(){

    limpiarModal();
    editandoId = null;

    tituloModal.textContent = "Agregar Colaborador";
    modalOverlay.classList.add("visible");
    inputNuevoDni.focus();

}

function abrirModalEditar(colaborador){

    limpiarModal();
    editandoId = colaborador.id;
    fotoBanco = colaborador.foto || null;

    tituloModal.textContent = "Editar Colaborador";

    inputNuevoDni.value = colaborador.dni;
    inputNuevoDni.disabled = true;
    inputNuevoNombre.value = colaborador.nombre;
    inputNuevoZona.value = colaborador.zona || "";
    inputNuevoPasillo.value = colaborador.pasillo || "";
    inputNuevoTurno.value = colaborador.turno || "";
    inputNuevoSupervisor.value = colaborador.supervisor || "";
    inputNuevoActivo.checked = !!colaborador.activo;

    if(colaborador.foto){
        previsualizacionFoto.src = colaborador.foto;
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

// Al escribir el DNI (solo cuando se está agregando), busca si ya
// existe una foto guardada para ese colaborador en el banco.
inputNuevoDni.addEventListener("blur", async function(){

    const dni = inputNuevoDni.value.trim();

    if(editandoId || dni.length !== 8){
        return;
    }

    try{

        const foto = await buscarFotoColaborador(dni);

        if(foto){
            fotoBanco = foto.foto;
            previsualizacionFoto.src = foto.foto;
            previsualizacionFoto.style.display = "block";
            fotoEncontradaMsg.textContent = "✓ Ya existe una foto guardada para este DNI.";

            if(foto.nombre && !inputNuevoNombre.value){
                inputNuevoNombre.value = foto.nombre;
            }

        }

    }catch(e){
        console.error(e);
    }

});

inputNuevoFoto.addEventListener("change", function(){

    const archivo = inputNuevoFoto.files[0];

    if(!archivo){
        return;
    }

    fotoEncontradaMsg.textContent = "";

    const lector = new FileReader();

    lector.onload = function(e){
        previsualizacionFoto.src = e.target.result;
        previsualizacionFoto.style.display = "block";
    };

    lector.readAsDataURL(archivo);

});

btnGuardar.addEventListener("click", async function(){

    const dni = inputNuevoDni.value.trim();
    const nombre = inputNuevoNombre.value.trim();
    const zona = inputNuevoZona.value;
    const pasillo = inputNuevoPasillo.value.trim();
    const turno = inputNuevoTurno.value;
    const supervisor = inputNuevoSupervisor.value.trim();
    const archivo = inputNuevoFoto.files[0];
    const activo = inputNuevoActivo.checked;

    mensajeErrorModal.textContent = "";

    if(!dni || !nombre){
        mensajeErrorModal.textContent = "Complete al menos el DNI y el nombre.";
        return;
    }

    if(dni.length !== 8){
        mensajeErrorModal.textContent = "El DNI debe tener 8 dígitos.";
        return;
    }

    btnGuardar.disabled = true;
    btnGuardar.textContent = "GUARDANDO...";

    try{

        let fotoUrl = fotoBanco;

        if(archivo){
            fotoUrl = await subirFotoColaborador(dni, archivo, nombre);
        }

        if(editandoId){

            await supabaseFetch(
                "/colaboradores_activos?id=eq." + encodeURIComponent(editandoId),
                {
                    method: "PATCH",
                    body: JSON.stringify({
                        nombre: nombre,
                        zona: zona,
                        pasillo: pasillo,
                        turno: turno,
                        supervisor: supervisor,
                        foto: fotoUrl,
                        activo: activo,
                        updated_at: new Date().toISOString()
                    })
                }
            );

        }else{

            await supabaseFetch(
                "/colaboradores_activos",
                {
                    method: "POST",
                    body: JSON.stringify({
                        dni: dni,
                        nombre: nombre,
                        zona: zona,
                        pasillo: pasillo,
                        turno: turno,
                        supervisor: supervisor,
                        foto: fotoUrl,
                        activo: activo
                    })
                }
            );

        }

        cerrarModal();
        cargarActivos();

    }catch(e){

        console.error(e);
        mensajeErrorModal.textContent = "No se pudo guardar. Verifique que el DNI no exista ya.";

    }finally{

        btnGuardar.disabled = false;
        btnGuardar.textContent = "Guardar";

    }

});

// ========================================
// INICIO
// ========================================

if(sesion && (sesion.rol === "Administrador" || sesion.rol === "Supervisor")){
    cargarActivos();
}

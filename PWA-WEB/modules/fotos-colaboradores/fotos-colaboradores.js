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
// La lista sale de colaboradores_activos (deduplicada por DNI, ya que
// una persona puede aparecer en varios pasillos), cruzada con
// fotos_colaboradores para saber si ya tiene foto guardada.

const tblFotos = document.getElementById("tblFotos");
const mensajeVacio = document.getElementById("mensajeVacio");
const buscador = document.getElementById("buscador");
const filtroFoto = document.getElementById("filtroFoto");
const filtroSupervisor = document.getElementById("filtroSupervisor");

let colaboradoresCargados = [];

async function cargarColaboradores(){

    tblFotos.innerHTML = "";
    mensajeVacio.style.display = "none";

    try{

        const [activos, fotos] = await Promise.all([
            checklistFetch("/colaboradores_activos?select=dni,nombre,supervisor,turno&order=nombre.asc"),
            checklistFetch("/fotos_colaboradores?select=dni,foto")
        ]);

        const fotosPorDni = {};

        fotos.forEach(function(f){
            fotosPorDni[f.dni] = f.foto;
        });

        const vistos = new Set();
        colaboradoresCargados = [];

        activos.forEach(function(c){

            if(vistos.has(c.dni)){
                return;
            }

            vistos.add(c.dni);

            colaboradoresCargados.push({
                dni: c.dni,
                nombre: c.nombre,
                supervisor: c.supervisor,
                turno: c.turno,
                foto: fotosPorDni[c.dni] || null
            });

        });

        llenarFiltroSupervisor(colaboradoresCargados);
        aplicarFiltros();

    }catch(e){

        console.error(e);
        mensajeVacio.textContent = "No se pudo cargar la lista de colaboradores.";
        mensajeVacio.style.display = "block";

    }

}

function llenarFiltroSupervisor(lista){

    const seleccionActual = filtroSupervisor.value;

    const supervisores = Array.from(new Set(
        lista.map(c => c.supervisor).filter(Boolean)
    )).sort();

    filtroSupervisor.innerHTML = '<option value="">Supervisor (todos)</option>';

    supervisores.forEach(function(nombre){

        const opcion = document.createElement("option");
        opcion.value = nombre;
        opcion.textContent = nombre;

        filtroSupervisor.appendChild(opcion);

    });

    filtroSupervisor.value = seleccionActual;

}

function renderizarColaboradores(lista){

    tblFotos.innerHTML = "";
    mensajeVacio.style.display = "none";

    if(!lista || !lista.length){
        mensajeVacio.textContent = "No hay colaboradores activos registrados.";
        mensajeVacio.style.display = "block";
        return;
    }

    lista.forEach(function(c){

        const tr = document.createElement("tr");

        const imagenFoto = c.foto
            ? `<img class="foto-mini" src="${c.foto}" alt="">`
            : `<div class="foto-mini"></div>`;

        const botonEliminar = c.foto
            ? `<button class="btn-eliminar" data-dni="${c.dni}">Quitar foto</button>`
            : "";

        tr.innerHTML = `
            <td>${imagenFoto}</td>
            <td>${c.nombre}</td>
            <td>${c.supervisor || "-"}</td>
            <td>${c.turno || "-"}</td>
            <td>
                <button class="btn-editar" data-dni="${c.dni}">
                    ${c.foto ? "Reemplazar foto" : "Subir foto"}
                </button>
                ${botonEliminar}
            </td>
        `;

        tblFotos.appendChild(tr);

    });

}

function aplicarFiltros(){

    const termino = buscador.value.trim().toLowerCase();
    const foto = filtroFoto.value;
    const supervisor = filtroSupervisor.value;

    const filtrados = colaboradoresCargados.filter(function(c){

        const coincideTexto = !termino ||
            c.dni.toLowerCase().includes(termino) ||
            c.nombre.toLowerCase().includes(termino);

        const coincideFoto = !foto ||
            (foto === "sin" && !c.foto) ||
            (foto === "con" && !!c.foto);

        const coincideSupervisor = !supervisor || c.supervisor === supervisor;

        return coincideTexto && coincideFoto && coincideSupervisor;

    });

    if(!filtrados.length){
        tblFotos.innerHTML = "";
        mensajeVacio.textContent = "Ningún colaborador coincide con el filtro.";
        mensajeVacio.style.display = "block";
        return;
    }

    renderizarColaboradores(filtrados);

}

buscador.addEventListener("input", aplicarFiltros);
filtroFoto.addEventListener("change", aplicarFiltros);
filtroSupervisor.addEventListener("change", aplicarFiltros);

// ========================================
// SUBIR / REEMPLAZAR / QUITAR FOTO
// ========================================

tblFotos.addEventListener("click", async function(e){

    const botonEditar = e.target.closest(".btn-editar");
    const botonEliminar = e.target.closest(".btn-eliminar");

    if(botonEditar){

        const dni = botonEditar.dataset.dni;
        const colaborador = colaboradoresCargados.find(c => c.dni === dni);

        if(colaborador){
            abrirModalFoto(colaborador);
        }

        return;
    }

    if(botonEliminar){

        const dni = botonEliminar.dataset.dni;

        const confirmado = confirm(
            "¿Quitar la foto de \"" + dni + "\"? Esta acción no se puede deshacer."
        );

        if(!confirmado){
            return;
        }

        botonEliminar.disabled = true;
        botonEliminar.textContent = "Quitando...";

        try{

            await checklistFetch(
                "/fotos_colaboradores?dni=eq." + encodeURIComponent(dni),
                { method: "DELETE" }
            );

            cargarColaboradores();

        }catch(e){

            console.error(e);
            alert("No se pudo quitar la foto.");
            botonEliminar.disabled = false;
            botonEliminar.textContent = "Quitar foto";

        }

        return;
    }

});

// ========================================
// MODAL SUBIR / REEMPLAZAR FOTO
// ========================================

const modalOverlay = document.getElementById("modalOverlay");
const tituloModal = document.getElementById("tituloModal");
const nombreModalInfo = document.getElementById("nombreModalInfo");
const btnCancelar = document.getElementById("btnCancelar");
const btnGuardar = document.getElementById("btnGuardar");
const mensajeErrorModal = document.getElementById("mensajeErrorModal");

const inputNuevoFoto = document.getElementById("nuevoFoto");
const previsualizacionFoto = document.getElementById("previsualizacionFoto");

let dniEnEdicion = null;
let nombreEnEdicion = null;

function abrirModalFoto(colaborador){

    mensajeErrorModal.textContent = "";
    inputNuevoFoto.value = "";

    dniEnEdicion = colaborador.dni;
    nombreEnEdicion = colaborador.nombre;

    tituloModal.textContent = colaborador.foto ? "Reemplazar foto" : "Subir foto";
    nombreModalInfo.textContent = colaborador.nombre + " · DNI " + colaborador.dni;

    if(colaborador.foto){
        previsualizacionFoto.src = colaborador.foto;
        previsualizacionFoto.style.display = "block";
    }else{
        previsualizacionFoto.src = "";
        previsualizacionFoto.style.display = "none";
    }

    modalOverlay.classList.add("visible");

}

function cerrarModal(){
    modalOverlay.classList.remove("visible");
}

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

    const archivo = inputNuevoFoto.files[0];

    mensajeErrorModal.textContent = "";

    if(!archivo){
        mensajeErrorModal.textContent = "Seleccione una foto.";
        return;
    }

    btnGuardar.disabled = true;
    btnGuardar.textContent = "GUARDANDO...";

    try{

        await subirFotoColaborador(dniEnEdicion, archivo, nombreEnEdicion);

        cerrarModal();
        cargarColaboradores();

    }catch(e){

        console.error(e);
        mensajeErrorModal.textContent = "No se pudo guardar la foto.";

    }finally{

        btnGuardar.disabled = false;
        btnGuardar.textContent = "Guardar";

    }

});

// ========================================
// INICIO
// ========================================

if(sesion && (sesion.rol === "Administrador" || sesion.rol === "Supervisor")){
    cargarColaboradores();
}

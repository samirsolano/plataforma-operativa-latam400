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

const tblActivos = document.getElementById("tblActivos");
const mensajeVacio = document.getElementById("mensajeVacio");
const buscador = document.getElementById("buscador");
const filtroTurno = document.getElementById("filtroTurno");
const filtroSupervisor = document.getElementById("filtroSupervisor");

let activosCargados = [];

async function cargarActivos(){

    tblActivos.innerHTML = "";
    mensajeVacio.style.display = "none";

    try{

        activosCargados = await checklistFetch(
            "/colaboradores_activos?select=id,dni,nombre,zona,pasillo,turno,supervisor,activo&order=turno.asc,zona.asc,pasillo.asc"
        );

        llenarFiltroSupervisor(activosCargados);
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
            <td>${c.zona || "-"}</td>
            <td>${c.pasillo || "-"}</td>
            <td>${c.dni}</td>
            <td>${c.nombre}</td>
            <td>${c.turno || "-"}</td>
            <td>
                <button class="btn-editar" data-id="${c.id}">
                    Editar
                </button>
            </td>
        `;

        tblActivos.appendChild(tr);

    });

}

// Lo que está filtrado/visible en la tabla ahora mismo — "Exportar a
// Excel" exporta esto, no siempre la lista completa.
let filtradosActuales = [];

function aplicarFiltros(){

    const termino = buscador.value.trim().toLowerCase();
    const turno = filtroTurno.value;
    const supervisor = filtroSupervisor.value;

    const filtrados = activosCargados.filter(function(c){

        const coincideTexto = !termino ||
            c.dni.toLowerCase().includes(termino) ||
            c.nombre.toLowerCase().includes(termino);

        const coincideTurno = !turno || c.turno === turno;
        const coincideSupervisor = !supervisor || c.supervisor === supervisor;

        return coincideTexto && coincideTurno && coincideSupervisor;

    });

    filtradosActuales = filtrados;

    if(!filtrados.length){
        tblActivos.innerHTML = "";
        mensajeVacio.textContent = "Ningún colaborador coincide con el filtro.";
        mensajeVacio.style.display = "block";
        return;
    }

    renderizarActivos(filtrados);

}

buscador.addEventListener("input", aplicarFiltros);
filtroTurno.addEventListener("change", aplicarFiltros);
filtroSupervisor.addEventListener("change", aplicarFiltros);

// ========================================
// EXPORTAR A EXCEL
// ========================================

document.getElementById("btnExportar").addEventListener("click", function(){

    if(!filtradosActuales.length){
        alert("No hay colaboradores para exportar.");
        return;
    }

    const encabezados = ["Zona", "Pasillo", "DNI", "Nombre", "Turno", "Supervisor"];

    const filas = filtradosActuales.map(function(c){
        return [c.zona || "", c.pasillo || "", c.dni, c.nombre, c.turno || "", c.supervisor || ""];
    });

    const hoja = XLSX.utils.aoa_to_sheet([encabezados].concat(filas));
    const libro = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(libro, hoja, "Colaboradores Activos");

    const hoy = new Date().toISOString().slice(0, 10);

    XLSX.writeFile(libro, "colaboradores-activos-" + hoy + ".xlsx");

});

// ========================================
// EDITAR
// ========================================

tblActivos.addEventListener("click", function(e){

    const botonEditar = e.target.closest(".btn-editar");

    if(!botonEditar){
        return;
    }

    const id = botonEditar.dataset.id;
    const colaborador = activosCargados.find(c => String(c.id) === String(id));

    if(colaborador){
        abrirModalEditar(colaborador);
    }

});

// ========================================
// MODAL AGREGAR / EDITAR
// ========================================

const modalOverlay = document.getElementById("modalOverlay");
const tituloModal = document.getElementById("tituloModal");
const btnCancelar = document.getElementById("btnCancelar");
const btnGuardar = document.getElementById("btnGuardar");
const mensajeErrorModal = document.getElementById("mensajeErrorModal");

const inputNuevoDni = document.getElementById("nuevoDni");
const inputNuevoNombre = document.getElementById("nuevoNombre");

let editandoId = null;

function limpiarModal(){

    mensajeErrorModal.textContent = "";
    inputNuevoDni.value = "";
    inputNuevoNombre.value = "";

}

// Solo DNI y Nombre se pueden corregir acá. Zona, Pasillo, Turno y
// Supervisor vienen de la carga oficial (Carga Mensual / Activar mes) y
// ya se ven en la tabla, así que no se repiten en este modal.
function abrirModalEditar(colaborador){

    limpiarModal();
    editandoId = colaborador.id;

    tituloModal.textContent = "Editar Colaborador";

    inputNuevoDni.value = colaborador.dni;
    inputNuevoNombre.value = colaborador.nombre;

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

btnGuardar.addEventListener("click", async function(){

    const dni = inputNuevoDni.value.trim();
    const nombre = inputNuevoNombre.value.trim();

    mensajeErrorModal.textContent = "";

    if(!dni || !nombre){
        mensajeErrorModal.textContent = "Complete el DNI y el nombre.";
        return;
    }

    if(dni.length !== 8){
        mensajeErrorModal.textContent = "El DNI debe tener 8 dígitos.";
        return;
    }

    btnGuardar.disabled = true;
    btnGuardar.textContent = "GUARDANDO...";

    try{

        await checklistFetch(
            "/colaboradores_activos?id=eq." + encodeURIComponent(editandoId),
            {
                method: "PATCH",
                body: JSON.stringify({
                    dni: dni,
                    nombre: nombre,
                    updated_at: new Date().toISOString()
                })
            }
        );

        cerrarModal();
        cargarActivos();

    }catch(e){

        console.error(e);
        mensajeErrorModal.textContent = "No se pudo guardar. Verifique que ese DNI no esté repetido en ese mismo pasillo y turno.";

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

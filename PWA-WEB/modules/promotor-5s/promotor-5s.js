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

document.getElementById("btnVerTablero").addEventListener("click", function(){
    window.location.href = "tablero.html";
});

document.getElementById("btnVerEquipoCompleto").addEventListener("click", function(){
    window.location.href = "tablero-equipo.html";
});

// ========================================
// ETIQUETAS DE TURNO
// ========================================

const ETIQUETAS_TURNO = {
    DIA: "DÍA (1er turno)",
    INTERMEDIO: "INTERMEDIO (2do turno)",
    NOCHE: "NOCHE (3er turno)"
};

// ========================================
// LISTAR
// ========================================

const tblPromotores = document.getElementById("tblPromotores");
const mensajeVacio = document.getElementById("mensajeVacio");
const buscador = document.getElementById("buscador");
const filtroZona = document.getElementById("filtroZona");
const filtroTurno = document.getElementById("filtroTurno");

let promotoresCargados = [];

async function cargarPromotores(){

    tblPromotores.innerHTML = "";
    mensajeVacio.style.display = "none";

    try{

        promotoresCargados = await checklistFetch(
            "/promotores_5s?select=id,dni,nombre,zona,pasillo,turno,activo&activo=eq.true&order=zona.asc,pasillo.asc,turno.asc"
        );

        llenarFiltroZona(promotoresCargados);
        aplicarFiltros();

    }catch(e){

        console.error(e);
        mensajeVacio.textContent = "No se pudo cargar la lista de promotores.";
        mensajeVacio.style.display = "block";

    }

}

function llenarFiltroZona(lista){

    const seleccionActual = filtroZona.value;

    const zonas = Array.from(new Set(
        lista.map(p => p.zona).filter(Boolean)
    )).sort();

    filtroZona.innerHTML = '<option value="">Zona (todas)</option>';

    zonas.forEach(function(zona){

        const opcion = document.createElement("option");
        opcion.value = zona;
        opcion.textContent = zona;

        filtroZona.appendChild(opcion);

    });

    filtroZona.value = seleccionActual;

}

function renderizarPromotores(lista){

    tblPromotores.innerHTML = "";
    mensajeVacio.style.display = "none";

    if(!lista || !lista.length){
        mensajeVacio.textContent = "No hay promotores 5S registrados.";
        mensajeVacio.style.display = "block";
        return;
    }

    lista.forEach(function(p){

        const tr = document.createElement("tr");

        tr.innerHTML = `
            <td>${p.zona || "-"}</td>
            <td>${p.pasillo || "-"}</td>
            <td>${p.dni}</td>
            <td>${p.nombre}</td>
            <td>${ETIQUETAS_TURNO[p.turno] || p.turno || "-"}</td>
            <td>
                <button class="btn-editar" data-id="${p.id}">
                    Editar
                </button>
            </td>
        `;

        tblPromotores.appendChild(tr);

    });

}

function aplicarFiltros(){

    const termino = buscador.value.trim().toLowerCase();
    const zona = filtroZona.value;
    const turno = filtroTurno.value;

    const filtrados = promotoresCargados.filter(function(p){

        const coincideTexto = !termino ||
            p.dni.toLowerCase().includes(termino) ||
            p.nombre.toLowerCase().includes(termino);

        const coincideZona = !zona || p.zona === zona;
        const coincideTurno = !turno || p.turno === turno;

        return coincideTexto && coincideZona && coincideTurno;

    });

    renderizarPromotores(filtrados);

}

buscador.addEventListener("input", aplicarFiltros);
filtroZona.addEventListener("change", aplicarFiltros);
filtroTurno.addEventListener("change", aplicarFiltros);

// ========================================
// CARGAR DESDE COLABORADORES ACTIVOS
// ========================================
// Copia zona/pasillo/turno/dni/nombre del roster activo hacia
// promotores_5s, para no partir de cero. "ignore-duplicates" hace
// que esto sea seguro de repetir: nunca pisa un promotor que ya
// fue asignado/editado a mano para ese zona+pasillo+turno.

document.getElementById("btnCargarDesdeActivos").addEventListener("click", async function(){

    const boton = this;
    boton.disabled = true;
    boton.textContent = "Cargando...";

    try{

        const activos = await checklistFetch(
            "/colaboradores_activos?select=dni,nombre,zona,pasillo,turno&activo=eq.true"
        );

        if(!activos || !activos.length){
            alert("No hay colaboradores activos para copiar.");
            return;
        }

        const filas = activos
            .filter(c => c.zona && c.pasillo && c.turno)
            .map(c => ({
                zona: c.zona,
                pasillo: c.pasillo,
                turno: c.turno,
                dni: c.dni,
                nombre: c.nombre,
                activo: true
            }));

        await checklistFetch(
            "/promotores_5s?on_conflict=zona,pasillo,turno",
            {
                method: "POST",
                headers: { Prefer: "resolution=ignore-duplicates" },
                body: JSON.stringify(filas)
            }
        );

        await cargarPromotores();

        alert("Listo. Se agregaron los que faltaban (los que ya tenías asignados no se tocaron).");

    }catch(e){

        console.error(e);
        alert("No se pudo copiar desde Colaboradores Activos.");

    }finally{

        boton.disabled = false;
        boton.textContent = "⬇️ Cargar desde Colaboradores Activos";

    }

});

// ========================================
// MODAL AGREGAR / EDITAR
// ========================================

const modalOverlay = document.getElementById("modalOverlay");
const tituloModal = document.getElementById("tituloModal");
const btnCancelar = document.getElementById("btnCancelar");
const btnGuardar = document.getElementById("btnGuardar");
const btnEliminar = document.getElementById("btnEliminar");
const mensajeErrorModal = document.getElementById("mensajeErrorModal");

const inputZona = document.getElementById("nuevaZona");
const inputPasillo = document.getElementById("nuevoPasillo");
const inputTurno = document.getElementById("nuevoTurno");
const inputDni = document.getElementById("nuevoDni");
const inputNombre = document.getElementById("nuevoNombre");
const previsualizacionFoto = document.getElementById("previsualizacionFoto");

let editandoId = null;

function limpiarModal(){

    mensajeErrorModal.textContent = "";
    inputZona.value = "";
    inputPasillo.value = "";
    inputTurno.value = "DIA";
    inputDni.value = "";
    inputNombre.value = "";
    previsualizacionFoto.style.display = "none";
    previsualizacionFoto.src = "";
    btnEliminar.classList.add("oculto");

}

document.getElementById("btnAgregar").addEventListener("click", function(){

    limpiarModal();
    editandoId = null;
    tituloModal.textContent = "Agregar Promotor 5S";
    modalOverlay.classList.add("visible");

});

function abrirModalEditar(promotor){

    limpiarModal();
    editandoId = promotor.id;

    tituloModal.textContent = "Editar Promotor 5S";

    inputZona.value = promotor.zona || "";
    inputPasillo.value = promotor.pasillo || "";
    inputTurno.value = promotor.turno || "DIA";
    inputDni.value = promotor.dni;
    inputNombre.value = promotor.nombre;

    btnEliminar.classList.remove("oculto");

    previsualizarFoto(promotor.dni);

    modalOverlay.classList.add("visible");

}

async function previsualizarFoto(dni){

    if(!dni){
        return;
    }

    try{

        const foto = await buscarFotoColaborador(dni);

        if(foto && foto.foto){
            previsualizacionFoto.src = foto.foto;
            previsualizacionFoto.style.display = "block";
        }

    }catch(e){
        console.error(e);
    }

}

inputDni.addEventListener("blur", function(){
    previsualizacionFoto.style.display = "none";
    previsualizarFoto(inputDni.value.trim());
});

function cerrarModal(){
    modalOverlay.classList.remove("visible");
}

btnCancelar.addEventListener("click", cerrarModal);

modalOverlay.addEventListener("click", function(e){

    if(e.target === modalOverlay){
        cerrarModal();
    }

});

tblPromotores.addEventListener("click", function(e){

    const botonEditar = e.target.closest(".btn-editar");

    if(!botonEditar){
        return;
    }

    const id = botonEditar.dataset.id;
    const promotor = promotoresCargados.find(p => String(p.id) === String(id));

    if(promotor){
        abrirModalEditar(promotor);
    }

});

btnGuardar.addEventListener("click", async function(){

    const zona = inputZona.value.trim();
    const pasillo = inputPasillo.value.trim();
    const turno = inputTurno.value;
    const dni = inputDni.value.trim();
    const nombre = inputNombre.value.trim();

    mensajeErrorModal.textContent = "";

    if(!zona || !pasillo || !dni || !nombre){
        mensajeErrorModal.textContent = "Complete zona, pasillo, DNI y nombre.";
        return;
    }

    if(dni.length !== 8){
        mensajeErrorModal.textContent = "El DNI debe tener 8 dígitos.";
        return;
    }

    btnGuardar.disabled = true;
    btnGuardar.textContent = "GUARDANDO...";

    try{

        if(editandoId){

            await checklistFetch(
                "/promotores_5s?id=eq." + encodeURIComponent(editandoId),
                {
                    method: "PATCH",
                    body: JSON.stringify({
                        zona: zona,
                        pasillo: pasillo,
                        turno: turno,
                        dni: dni,
                        nombre: nombre,
                        updated_at: new Date().toISOString()
                    })
                }
            );

        }else{

            await checklistFetch(
                "/promotores_5s",
                {
                    method: "POST",
                    body: JSON.stringify({
                        zona: zona,
                        pasillo: pasillo,
                        turno: turno,
                        dni: dni,
                        nombre: nombre
                    })
                }
            );

        }

        cerrarModal();
        cargarPromotores();

    }catch(e){

        console.error(e);
        mensajeErrorModal.textContent = "No se pudo guardar. Verifique que no exista ya un promotor para esa zona, pasillo y turno.";

    }finally{

        btnGuardar.disabled = false;
        btnGuardar.textContent = "Guardar";

    }

});

btnEliminar.addEventListener("click", async function(){

    if(!editandoId){
        return;
    }

    if(!confirm("¿Eliminar este Promotor 5S?")){
        return;
    }

    btnEliminar.disabled = true;

    try{

        await checklistFetch(
            "/promotores_5s?id=eq." + encodeURIComponent(editandoId),
            { method: "DELETE" }
        );

        cerrarModal();
        cargarPromotores();

    }catch(e){

        console.error(e);
        mensajeErrorModal.textContent = "No se pudo eliminar.";

    }finally{

        btnEliminar.disabled = false;

    }

});

// ========================================
// INICIO
// ========================================

if(sesion && (sesion.rol === "Administrador" || sesion.rol === "Supervisor")){
    cargarPromotores();
}

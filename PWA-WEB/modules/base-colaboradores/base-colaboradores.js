// ========================================
// BASE DE COLABORADORES
// ========================================
// Administra "matrix_colaboradores" (ver base-colaboradores.sql): el
// roster general por jefe directo del que el Checklist de Higiene
// (este repo y Centro de Proyectos) arma el equipo de cada
// supervisor. Aquí se agrega, edita, elimina o pone en vacaciones a
// cada persona — quien está en VACACIONES no entra al equipo de
// Higiene (ver obtenerEquipoPorSupervisor en
// shared/higiene-checklist-config.js).

// ========================================
// SESIÓN Y PERMISOS
// ========================================

const sesion = requerirSesion();

if(sesion && !tienePermiso(sesion, "base-colaboradores")){
    window.location.href = "../inicio/home.html";
}

// ========================================
// LISTAR
// ========================================

const tblColaboradores = document.getElementById("tblColaboradores");
const mensajeVacio = document.getElementById("mensajeVacio");
const buscador = document.getElementById("buscador");
const filtroSupervisor = document.getElementById("filtroSupervisor");
const filtroEstado = document.getElementById("filtroEstado");

let colaboradoresCargados = [];
let filtradosActuales = [];

async function cargarColaboradores(){

    try{

        // select=* (y no la lista de columnas) para que la tabla siga
        // cargando aunque todavía no se haya corrido la parte de
        // base-colaboradores.sql que agrega "estado" / "vacaciones_hasta".
        colaboradoresCargados = await checklistFetch(
            "/matrix_colaboradores?select=*&order=supervisor.asc,nombre_completo.asc"
        ) || [];

        llenarListas();
        aplicarFiltros();

    }catch(e){

        console.error(e);
        tblColaboradores.innerHTML = "";
        mensajeVacio.textContent = "No se pudo cargar la base de colaboradores.";
        mensajeVacio.style.display = "block";

    }

}

function estadoDe(c){
    return c.estado === "VACACIONES" ? "VACACIONES" : "ACTIVO";
}

function valoresUnicos(campo){

    return Array.from(new Set(
        colaboradoresCargados
            .map(c => String(c[campo] || "").trim())
            .filter(Boolean)
    )).sort();

}

function llenarListas(){

    const supervisores = valoresUnicos("supervisor");
    const seleccionActual = filtroSupervisor.value;

    filtroSupervisor.innerHTML = '<option value="">Jefe directo (todos)</option>';

    supervisores.forEach(function(nombre){

        const opcion = document.createElement("option");
        opcion.value = nombre;
        opcion.textContent = nombre;

        filtroSupervisor.appendChild(opcion);

    });

    filtroSupervisor.value = supervisores.includes(seleccionActual) ? seleccionActual : "";

    llenarDatalist("listaSupervisores", supervisores);
    llenarDatalist("listaPuestos", valoresUnicos("puesto"));

}

function llenarDatalist(id, valores){

    const lista = document.getElementById(id);
    lista.innerHTML = "";

    valores.forEach(function(valor){
        const opcion = document.createElement("option");
        opcion.value = valor;
        lista.appendChild(opcion);
    });

}

function escaparHTML(texto){

    return String(texto === undefined || texto === null ? "" : texto)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");

}

function formatearFecha(fechaISO){

    const partes = String(fechaISO || "").slice(0, 10).split("-");
    return partes.length === 3 ? partes[2] + "/" + partes[1] + "/" + partes[0] : "";

}

function hoyISO(){

    const ahora = new Date();
    return new Date(ahora.getTime() - ahora.getTimezoneOffset() * 60000).toISOString().slice(0, 10);

}

function dniValido(dni){
    return /^\d{8}$/.test(String(dni || "").trim());
}

function renderizarResumen(){

    const vacaciones = colaboradoresCargados.filter(c => estadoDe(c) === "VACACIONES").length;

    document.getElementById("lblTotal").textContent = colaboradoresCargados.length;
    document.getElementById("lblActivos").textContent = colaboradoresCargados.length - vacaciones;
    document.getElementById("lblVacaciones").textContent = vacaciones;

}

function htmlEstado(c){

    if(estadoDe(c) !== "VACACIONES"){
        return '<span class="badge badge-activo">ACTIVO</span>';
    }

    let retorno = "";

    if(c.vacaciones_hasta){

        const vencido = c.vacaciones_hasta < hoyISO();

        retorno = vencido
            ? `<span class="retorno vencido">Debía regresar el ${formatearFecha(c.vacaciones_hasta)}</span>`
            : `<span class="retorno">Regresa el ${formatearFecha(c.vacaciones_hasta)}</span>`;

    }

    return '<span class="badge badge-vacaciones">VACACIONES</span>' + retorno;

}

function renderizarColaboradores(lista){

    tblColaboradores.innerHTML = "";

    lista.forEach(function(c){

        const enVacaciones = estadoDe(c) === "VACACIONES";
        const tr = document.createElement("tr");

        if(enVacaciones){
            tr.className = "fila-vacaciones";
        }

        tr.innerHTML = `
            <td class="${dniValido(c.dni) ? "" : "dni-revisar"}" title="${dniValido(c.dni) ? "" : "El DNI no tiene 8 dígitos — revisar"}">${escaparHTML(c.dni)}</td>
            <td>${escaparHTML(c.nombre_completo)}</td>
            <td>${escaparHTML(c.puesto || "-")}</td>
            <td>${escaparHTML(c.grupo || "-")}</td>
            <td>${escaparHTML(c.supervisor || "-")}</td>
            <td>${htmlEstado(c)}</td>
            <td class="acciones">
                <button type="button" class="btn-accion btn-editar" data-accion="editar" data-id="${c.id}">Editar</button>
                ${enVacaciones
                    ? `<button type="button" class="btn-accion btn-reactivar" data-accion="reactivar" data-id="${c.id}">Reactivar</button>`
                    : `<button type="button" class="btn-accion btn-vacaciones" data-accion="vacaciones" data-id="${c.id}">Vacaciones</button>`}
                <button type="button" class="btn-accion btn-eliminar" data-accion="eliminar" data-id="${c.id}">Eliminar</button>
            </td>
        `;

        tblColaboradores.appendChild(tr);

    });

}

function aplicarFiltros(){

    const termino = buscador.value.trim().toLowerCase();
    const supervisor = filtroSupervisor.value;
    const estado = filtroEstado.value;

    filtradosActuales = colaboradoresCargados.filter(function(c){

        const coincideTexto = !termino ||
            String(c.dni || "").toLowerCase().includes(termino) ||
            String(c.nombre_completo || "").toLowerCase().includes(termino) ||
            String(c.puesto || "").toLowerCase().includes(termino);

        const coincideSupervisor = !supervisor || String(c.supervisor || "").trim() === supervisor;
        const coincideEstado = !estado || estadoDe(c) === estado;

        return coincideTexto && coincideSupervisor && coincideEstado;

    });

    renderizarResumen();
    renderizarColaboradores(filtradosActuales);

    if(!filtradosActuales.length){

        mensajeVacio.textContent = colaboradoresCargados.length
            ? "Ningún colaborador coincide con el filtro."
            : "Todavía no hay colaboradores registrados.";

        mensajeVacio.style.display = "block";

    }else{

        mensajeVacio.style.display = "none";

    }

}

buscador.addEventListener("input", aplicarFiltros);
filtroSupervisor.addEventListener("change", aplicarFiltros);
filtroEstado.addEventListener("change", aplicarFiltros);

tblColaboradores.addEventListener("click", function(e){

    const boton = e.target.closest(".btn-accion");

    if(!boton){
        return;
    }

    const colaborador = colaboradoresCargados.find(c => String(c.id) === String(boton.dataset.id));

    if(!colaborador){
        return;
    }

    const accion = boton.dataset.accion;

    if(accion === "editar"){
        abrirFormulario(colaborador);
    }else if(accion === "vacaciones"){
        abrirVacaciones(colaborador);
    }else if(accion === "reactivar"){
        reactivar(colaborador, boton);
    }else if(accion === "eliminar"){
        abrirEliminar(colaborador);
    }

});

// Supabase devuelve el error de Postgres como texto — se traduce a
// algo entendible.
function mensajeDeError(error, porDefecto){

    const texto = String((error && error.message) || "");

    if(texto.includes("duplicate key") || texto.includes("23505")){
        return "Ya existe un colaborador con ese DNI.";
    }

    if(texto.includes("estado") || texto.includes("vacaciones_hasta")){
        return "Falta activar las vacaciones en la base de datos: correr base-colaboradores.sql en Supabase.";
    }

    return porDefecto;

}

// ========================================
// EXPORTAR A EXCEL
// ========================================

document.getElementById("btnExportar").addEventListener("click", function(){

    if(!filtradosActuales.length){
        alert("No hay colaboradores para exportar.");
        return;
    }

    const encabezados = ["DNI", "Nombre Completo", "Blue/White", "Puesto", "Jefe Directo", "Estado", "Regresa el"];

    const filas = filtradosActuales.map(function(c){
        return [
            c.dni,
            c.nombre_completo,
            c.grupo || "",
            c.puesto || "",
            c.supervisor || "",
            estadoDe(c),
            estadoDe(c) === "VACACIONES" ? formatearFecha(c.vacaciones_hasta) : ""
        ];
    });

    const hoja = XLSX.utils.aoa_to_sheet([encabezados].concat(filas));
    const libro = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(libro, hoja, "Matrix");
    XLSX.writeFile(libro, "base-colaboradores-" + hoyISO() + ".xlsx");

});

// ========================================
// MODALES (helpers)
// ========================================

function abrirModal(id){
    document.getElementById(id).classList.add("visible");
}

function cerrarModal(id){
    document.getElementById(id).classList.remove("visible");
}

["modalFormulario", "modalVacaciones", "modalEliminar"].forEach(function(id){

    document.getElementById(id).addEventListener("click", function(e){
        if(e.target === this){
            cerrarModal(id);
        }
    });

});

// ========================================
// AGREGAR / EDITAR
// ========================================

const campoDni = document.getElementById("campoDni");
const campoNombre = document.getElementById("campoNombre");
const campoPuesto = document.getElementById("campoPuesto");
const campoSupervisor = document.getElementById("campoSupervisor");
const campoGrupo = document.getElementById("campoGrupo");
const mensajeErrorFormulario = document.getElementById("mensajeErrorFormulario");
const btnGuardarFormulario = document.getElementById("btnGuardarFormulario");

// null = agregando uno nuevo; si no, el id de la fila que se edita.
let editandoId = null;

function abrirFormulario(colaborador){

    editandoId = colaborador ? colaborador.id : null;

    document.getElementById("tituloFormulario").textContent =
        colaborador ? "Editar Colaborador" : "Agregar Colaborador";

    campoDni.value = colaborador ? (colaborador.dni || "") : "";
    campoNombre.value = colaborador ? (colaborador.nombre_completo || "") : "";
    campoPuesto.value = colaborador ? (colaborador.puesto || "") : "";

    // Al agregar, propone el jefe directo que esté filtrado en la
    // tabla (lo normal es agregar gente al equipo que se está mirando).
    campoSupervisor.value = colaborador ? (colaborador.supervisor || "") : filtroSupervisor.value;
    campoGrupo.value = (colaborador && colaborador.grupo) || "BLUE";

    mensajeErrorFormulario.textContent = "";
    abrirModal("modalFormulario");
    campoDni.focus();

}

document.getElementById("btnAgregar").addEventListener("click", function(){
    abrirFormulario(null);
});

document.getElementById("btnCancelarFormulario").addEventListener("click", function(){
    cerrarModal("modalFormulario");
});

function limpiarTexto(texto){
    return String(texto || "").trim().replace(/\s+/g, " ").toUpperCase();
}

function validarFormulario(datos){

    if(!dniValido(datos.dni)){
        return "El DNI debe tener 8 dígitos (incluye el 0 inicial si lo tiene).";
    }

    if(datos.nombre_completo.length < 5){
        return "Escribe los apellidos y nombres completos.";
    }

    if(!datos.supervisor){
        return "Indica el jefe directo.";
    }

    const repetido = colaboradoresCargados.some(function(c){
        return String(c.dni || "").trim() === datos.dni && c.id !== editandoId;
    });

    if(repetido){
        return "Ya existe un colaborador con ese DNI.";
    }

    return "";

}

btnGuardarFormulario.addEventListener("click", async function(){

    const datos = {
        dni: campoDni.value.trim(),
        nombre_completo: limpiarTexto(campoNombre.value),
        puesto: limpiarTexto(campoPuesto.value),
        supervisor: limpiarTexto(campoSupervisor.value),
        grupo: campoGrupo.value,
        updated_at: new Date().toISOString()
    };

    const error = validarFormulario(datos);

    if(error){
        mensajeErrorFormulario.textContent = error;
        return;
    }

    mensajeErrorFormulario.textContent = "";
    btnGuardarFormulario.disabled = true;
    btnGuardarFormulario.textContent = "GUARDANDO...";

    try{

        if(editandoId){

            await checklistFetch(
                "/matrix_colaboradores?id=eq." + encodeURIComponent(editandoId),
                { method: "PATCH", body: JSON.stringify(datos) }
            );

        }else{

            await checklistFetch(
                "/matrix_colaboradores",
                { method: "POST", body: JSON.stringify(datos) }
            );

        }

        cerrarModal("modalFormulario");
        await cargarColaboradores();

    }catch(e){

        console.error(e);
        mensajeErrorFormulario.textContent = mensajeDeError(e, "No se pudo guardar. Intenta de nuevo.");

    }finally{

        btnGuardarFormulario.disabled = false;
        btnGuardarFormulario.textContent = "Guardar";

    }

});

// ========================================
// VACACIONES
// ========================================

const campoVacacionesHasta = document.getElementById("campoVacacionesHasta");
const btnConfirmarVacaciones = document.getElementById("btnConfirmarVacaciones");
const mensajeErrorVacaciones = document.getElementById("mensajeErrorVacaciones");

let vacacionesId = null;

function abrirVacaciones(colaborador){

    vacacionesId = colaborador.id;

    document.getElementById("lblNombreVacaciones").textContent = colaborador.nombre_completo;
    campoVacacionesHasta.value = "";
    campoVacacionesHasta.min = hoyISO();
    mensajeErrorVacaciones.textContent = "";

    abrirModal("modalVacaciones");

}

document.getElementById("btnCancelarVacaciones").addEventListener("click", function(){
    cerrarModal("modalVacaciones");
});

function cambiarEstado(id, estado, vacacionesHasta){

    return checklistFetch(
        "/matrix_colaboradores?id=eq." + encodeURIComponent(id),
        {
            method: "PATCH",
            body: JSON.stringify({
                estado: estado,
                vacaciones_hasta: vacacionesHasta || null,
                updated_at: new Date().toISOString()
            })
        }
    );

}

btnConfirmarVacaciones.addEventListener("click", async function(){

    btnConfirmarVacaciones.disabled = true;
    mensajeErrorVacaciones.textContent = "";

    try{

        await cambiarEstado(vacacionesId, "VACACIONES", campoVacacionesHasta.value);

        cerrarModal("modalVacaciones");
        await cargarColaboradores();

    }catch(e){

        console.error(e);
        mensajeErrorVacaciones.textContent = mensajeDeError(e, "No se pudo guardar. Intenta de nuevo.");

    }finally{

        btnConfirmarVacaciones.disabled = false;

    }

});

async function reactivar(colaborador, boton){

    boton.disabled = true;

    try{

        await cambiarEstado(colaborador.id, "ACTIVO", null);
        await cargarColaboradores();

    }catch(e){

        console.error(e);
        boton.disabled = false;
        alert(mensajeDeError(e, "No se pudo reactivar. Intenta de nuevo."));

    }

}

// ========================================
// ELIMINAR
// ========================================

const btnConfirmarEliminar = document.getElementById("btnConfirmarEliminar");
const mensajeErrorEliminar = document.getElementById("mensajeErrorEliminar");

let eliminarId = null;

function abrirEliminar(colaborador){

    eliminarId = colaborador.id;

    document.getElementById("lblNombreEliminar").textContent =
        colaborador.nombre_completo + " (DNI " + colaborador.dni + ")";

    mensajeErrorEliminar.textContent = "";
    abrirModal("modalEliminar");

}

document.getElementById("btnCancelarEliminar").addEventListener("click", function(){
    cerrarModal("modalEliminar");
});

btnConfirmarEliminar.addEventListener("click", async function(){

    btnConfirmarEliminar.disabled = true;
    mensajeErrorEliminar.textContent = "";

    try{

        await checklistFetch(
            "/matrix_colaboradores?id=eq." + encodeURIComponent(eliminarId),
            { method: "DELETE" }
        );

        cerrarModal("modalEliminar");
        await cargarColaboradores();

    }catch(e){

        console.error(e);
        mensajeErrorEliminar.textContent = "No se pudo eliminar. Intenta de nuevo.";

    }finally{

        btnConfirmarEliminar.disabled = false;

    }

});

// ========================================
// INICIO
// ========================================

if(sesion && tienePermiso(sesion, "base-colaboradores")){
    cargarColaboradores();
}

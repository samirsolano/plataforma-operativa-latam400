const FUNCIONES_DISPONIBLES = ["PICKING","EXTRACCIÓN","ALMACENAMIENTO","MODULADO","DESPACHO","INGRESO","MONTACARGA"];

let recursosData = [];
let supervisorRecursos = "";
let listaSupervisoresGlobal = [];
let colaboradorApoyoSeleccionado = null;
let timerBusquedaApoyo = null;

// Evita que nombres/usuarios con comillas, & u otros caracteres
// rompan el HTML del atributo data-* y dejen el botón sin funcionar.
function escapeAttr(str){
    return String(str === null || str === undefined ? "" : str)
        .replace(/&/g, "&amp;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}

// ============================================
// DELEGACIÓN DE EVENTOS DE LA TABLA DE RECURSOS
// ============================================

(function inicializarDelegacionRecursos(){

    const tbody = document.getElementById("prTablaBody");
    if(!tbody || tbody.dataset.delegado === "1") return;
    tbody.dataset.delegado = "1";

    tbody.addEventListener("click", function(e){

        const btnEliminar = e.target.closest("[data-accion='eliminar-colaborador']");
        if(btnEliminar){
            const id = Number(btnEliminar.dataset.id);
            const item = recursosData.find(r => r.colaborador_id === id);
            eliminarColaborador(id, item ? item.nombre_completo : "este colaborador");
            return;
        }

        const btnQuitar = e.target.closest("[data-accion='quitar-usuario']");
        if(btnQuitar){
            const id = Number(btnQuitar.dataset.id);
            quitarUsuarioPendiente(id, btnQuitar.dataset.usuario);
            return;
        }

    });

})();

// ============================================
// PUNTO DE ENTRADA (llamado desde abrirModulo)
// ============================================

async function cargarRecursos(){

    const fecha = document.getElementById("fecha").value;
    const turno = turnoDB(document.getElementById("turno").value);

    try{

        const supervisores = await obtenerSupervisoresRecursos();

        listaSupervisoresGlobal = supervisores;

        const select = document.getElementById("prSupervisor");
        const actual = select.value;

        select.innerHTML = supervisores.map(s =>
            `<option value="${s}">${s}</option>`
        ).join("");

        // Si ya había uno elegido en esta misma sesión, respétalo;
        // si no, pregunta a Supabase si ya hay actividad guardada
        // para esta fecha/turno y usa ese supervisor.
        if(actual && supervisores.indexOf(actual) !== -1){

            select.value = actual;

        }else{

            try{

                const supervisorGuardado = await obtenerUltimoSupervisorTurno(fecha, turno);

                if(supervisorGuardado && supervisores.indexOf(supervisorGuardado) !== -1){
                    select.value = supervisorGuardado;
                }

            }catch(error){
                console.error(error);
            }

        }

        supervisorRecursos = select.value;

        cargarTablaRecursos();
        cargarNecesidadTurno();

    }catch(error){
        console.error(error);
        mostrarToast("❌ Error al cargar supervisores", true);
    }

}

// ============================================
// NECESIDAD DEL TURNO (pickers / apiladores)
// ============================================

async function cargarNecesidadTurno(){

    const fecha = document.getElementById("fecha").value;
    const turno = turnoDB(document.getElementById("turno").value);

    if(!fecha) return;

    try{

        const datos = await obtenerNecesidadTurno(fecha, turno);

        document.getElementById("prNecesidadPicking").textContent = datos.necesidadPicking;
        document.getElementById("prNecesidadApiladores").textContent = datos.necesidadApiladores;

    }catch(error){
        console.error(error);
    }

}

function turnoDB(t){
    return t === "DÍA" ? "DIA" : t;
}

function cambiarSupervisor(){

    supervisorRecursos = document.getElementById("prSupervisor").value;
    cargarTablaRecursos();

}

// ============================================
// CARGAR TABLA PRINCIPAL
// ============================================

async function cargarTablaRecursos(){

    const fecha = document.getElementById("fecha").value;
    const turno = document.getElementById("turno").value;

    if(!supervisorRecursos){
        return;
    }

    document.getElementById("prTablaBody").innerHTML =
        `<tr><td colspan="10" style="text-align:center;padding:30px;color:#777;">Cargando colaboradores...</td></tr>`;

    try{

        const datos = await obtenerRecursosTurno(fecha, turno, supervisorRecursos);

        recursosData = datos;
        renderTablaRecursos();

    }catch(error){

        console.error(error);

        document.getElementById("prTablaBody").innerHTML =
            `<tr><td colspan="10" style="text-align:center;padding:30px;color:#C62828;">Error al cargar datos.</td></tr>`;

        mostrarToast("❌ Error al cargar colaboradores", true);

    }

}

// ============================================
// RENDERIZAR TABLA + STATS
// ============================================

function opcionesFuncion(valorActual){

    let html = `<option value="">-</option>`;

    FUNCIONES_DISPONIBLES.forEach(f => {
        html += `<option value="${f}" ${valorActual === f ? "selected" : ""}>${f}</option>`;
    });

    return html;

}

function renderChipsUsuarios(item){

    const chips = (item.usuarios || []).map(u => `
        <span class="pr-chip-usuario">
            ${u}
            <button type="button" title="Quitar" data-accion="quitar-usuario" data-id="${item.colaborador_id}" data-usuario="${escapeAttr(u)}">✕</button>
        </span>
    `).join("");

    return `
        <div class="pr-usuarios-celda">
            ${chips}
            <div class="pr-usuario-add">
                <input type="text" id="inputUsuario_${item.colaborador_id}" placeholder="+ usuario"
                    onkeydown="if(event.key==='Enter'){agregarUsuarioPendiente(${item.colaborador_id})}">
                <button type="button" title="Agregar" onclick="agregarUsuarioPendiente(${item.colaborador_id})">+</button>
            </div>
        </div>
    `;

}

function poblarFiltrosPuestoFuncion(){

    const selectPuesto = document.getElementById("prFiltroPuesto");
    const selectFuncion = document.getElementById("prFiltroFuncion");

    const puestoActual = selectPuesto.value;
    const funcionActual = selectFuncion.value;

    const puestos = Array.from(new Set(recursosData.map(i => i.puesto).filter(p => p))).sort();
    const funciones = Array.from(new Set(recursosData.map(i => i.funcion).filter(f => f))).sort();

    selectPuesto.innerHTML = `<option value="">Puesto (todos)</option>` +
        puestos.map(p => `<option value="${p}">${p}</option>`).join("");

    selectFuncion.innerHTML = `<option value="">Función (todas)</option>` +
        funciones.map(f => `<option value="${f}">${f}</option>`).join("");

    if(puestos.indexOf(puestoActual) !== -1) selectPuesto.value = puestoActual;
    if(funciones.indexOf(funcionActual) !== -1) selectFuncion.value = funcionActual;

}

function renderTablaRecursos(){

    poblarFiltrosPuestoFuncion();

    const filtro = (document.getElementById("prBuscar").value || "").toUpperCase().trim();
    const filtroPuesto = document.getElementById("prFiltroPuesto").value;
    const filtroFuncion = document.getElementById("prFiltroFuncion").value;

    const filas = recursosData.filter(item =>
        (!filtro ||
            item.nombre_completo.toUpperCase().includes(filtro) ||
            String(item.dni).toUpperCase().includes(filtro)) &&
        (!filtroPuesto || item.puesto === filtroPuesto) &&
        (!filtroFuncion || item.funcion === filtroFuncion)
    );

    const tbody = document.getElementById("prTablaBody");

    if(filas.length === 0){
        tbody.innerHTML = `<tr><td colspan="10" style="text-align:center;padding:30px;color:#777;">Sin colaboradores para mostrar.</td></tr>`;
    } else {

        tbody.innerHTML = filas.map(item => {

            const esApoyo = item.tipo === "APOYO";

            return `
                <tr class="${item.activo ? "" : "pr-inactivo"} ${item._modificado ? "pr-fila-pendiente" : ""}">
                    <td style="text-align:center;">
                        <input type="checkbox" ${item.activo ? "checked" : ""}
                            onclick="toggleActivoPendiente(${item.colaborador_id}, this)">
                    </td>
                    <td>
                        <span class="pr-badge-tipo ${esApoyo ? "pr-badge-apoyo" : "pr-badge-normal"}">
                            ${esApoyo ? "Apoyo" : "Normal"}
                        </span>
                    </td>
                    <td>${item.dni}</td>
                    <td>${item.nombre_completo}</td>
                    <td>${item.puesto || "-"}</td>
                    <td>${esApoyo ? `${item.supervisor} <small style="color:#999;">(origen)</small>` : item.supervisor}</td>
                    <td>
                        <select class="pr-select-funcion" onchange="actualizarFuncionPendiente(${item.colaborador_id}, this.value)">
                            ${opcionesFuncion(item.funcion)}
                        </select>
                    </td>
                    <td>
                        <input type="text" class="pr-input-usuariofijo" value="${item.usuario_fijo || ""}"
                            placeholder="-"
                            onchange="actualizarUsuarioFijoPendiente(${item.colaborador_id}, this.value)">
                    </td>
                    <td>${renderChipsUsuarios(item)}</td>
                    <td style="text-align:center;">
                        <button class="pr-icon-btn pr-icon-btn-eliminar" title="Eliminar de la data principal"
                            data-accion="eliminar-colaborador" data-id="${item.colaborador_id}">🗑️</button>
                    </td>
                </tr>
            `;

        }).join("");

    }

    actualizarStatsRecursos();

}

function actualizarStatsRecursos(){

    const equipo = recursosData.filter(r => r.tipo === "NORMAL");
    const apoyos = recursosData.filter(r => r.tipo === "APOYO");

    const total = equipo.length;
    const activosEquipo = equipo.filter(r => r.activo).length;
    const inactivos = total - activosEquipo;

    const activosTotal = recursosData.filter(r => r.activo).length;
    const pendientes = recursosData.filter(r => r.activo && (!r.usuarios || r.usuarios.length === 0)).length;

    document.getElementById("prTotal").textContent = total;
    document.getElementById("prActivos").textContent = activosTotal;
    document.getElementById("prInactivos").textContent = inactivos;
    document.getElementById("prApoyos").textContent = apoyos.length;
    document.getElementById("prPendientes").textContent = pendientes;

    document.getElementById("rsTotal").textContent = total;
    document.getElementById("rsActivos").textContent = activosTotal;
    document.getElementById("rsInactivos").textContent = inactivos;
    document.getElementById("rsApoyos").textContent = apoyos.length;
    document.getElementById("rsPendientes").textContent = pendientes;

    renderResumenFunciones();

}

function renderResumenFunciones(){

    const contenedor = document.getElementById("prResumenFunciones");

    const conteo = {};
    FUNCIONES_DISPONIBLES.forEach(f => conteo[f] = 0);

    let sinFuncion = 0;

    recursosData.forEach(item => {

        if(!item.activo) return;

        if(item.funcion && conteo.hasOwnProperty(item.funcion)){
            conteo[item.funcion]++;
        } else {
            sinFuncion++;
        }

    });

    const totalAsignados = recursosData.filter(r => r.activo).length;

    let html = `<div class="pr-resumen-item"><span>👷 Total activos en el turno</span><b>${totalAsignados}</b></div>`;

    FUNCIONES_DISPONIBLES.forEach(f => {
        html += `<div class="pr-resumen-item"><span>${f}</span><b>${conteo[f]}</b></div>`;
    });

    html += `<div class="pr-resumen-item"><span>Sin función asignada</span><b>${sinFuncion}</b></div>`;

    contenedor.innerHTML = html;

}

// ============================================
// CAMBIOS PENDIENTES (en memoria, se guardan
// todos juntos con "Guardar Planificación")
// ============================================

function toggleActivoPendiente(colaboradorId, checkbox){

    const item = recursosData.find(r => r.colaborador_id === colaboradorId);
    if(!item) return;

    item.activo = checkbox.checked;
    item._modificado = true;

    renderTablaRecursos();

}

function activarTodosPendiente(){

    recursosData.forEach(item => {
        item.activo = true;
        item._modificado = true;
    });

    renderTablaRecursos();

}

function desactivarTodosPendiente(){

    recursosData.forEach(item => {
        item.activo = false;
        item._modificado = true;
    });

    renderTablaRecursos();

}

function toggleCheckTodos(checkbox){

    if(checkbox.checked){
        activarTodosPendiente();
    } else {
        desactivarTodosPendiente();
    }

}

function actualizarFuncionPendiente(colaboradorId, valor){

    const item = recursosData.find(r => r.colaborador_id === colaboradorId);
    if(!item) return;

    item.funcion = valor;
    item._modificado = true;

    actualizarStatsRecursos();

}

function actualizarUsuarioFijoPendiente(colaboradorId, valor){

    const item = recursosData.find(r => r.colaborador_id === colaboradorId);
    if(!item) return;

    item.usuario_fijo = valor.trim();
    item._modificado = true;

}

function agregarUsuarioPendiente(colaboradorId){

    const input = document.getElementById("inputUsuario_" + colaboradorId);
    const valor = input.value.trim();

    if(!valor) return;

    const item = recursosData.find(r => r.colaborador_id === colaboradorId);
    if(!item) return;

    if(!item.usuarios) item.usuarios = [];

    if(item.usuarios.map(u => u.toUpperCase()).indexOf(valor.toUpperCase()) !== -1){
        mostrarToast("❌ Ese usuario ya está agregado a esta persona.", true);
        return;
    }

    item.usuarios.push(valor);
    item._modificado = true;

    renderTablaRecursos();

}

function quitarUsuarioPendiente(colaboradorId, usuario){

    const item = recursosData.find(r => r.colaborador_id === colaboradorId);
    if(!item) return;

    item.usuarios = (item.usuarios || []).filter(u => u !== usuario);
    item._modificado = true;

    renderTablaRecursos();

}

// ============================================
// GUARDAR PLANIFICACIÓN (masivo)
// ============================================

async function guardarPlanificacionRecursos(forzar){

    const fecha = document.getElementById("fecha").value;
    const turno = document.getElementById("turno").value;

    const boton = document.getElementById("btnGuardarRecursos");

    boton.disabled = true;
    boton.innerHTML = "⏳ Guardando...";

    const cambios = recursosData.map(item => ({
        colaborador_id: item.colaborador_id,
        supervisor_efectivo: item.supervisor_efectivo,
        activo: item.activo,
        funcion: item.funcion,
        usuario_fijo: item.usuario_fijo,
        usuarios: item.usuarios || []
    }));

    try{

        const resultado = await guardarPlanificacionRecursosBatch(fecha, turno, supervisorRecursos, cambios, !!forzar);

        if(resultado.conflicto){

            boton.disabled = false;
            boton.innerHTML = "💾 Guardar Planificación";

            mostrarConfirmModal(
                resultado.mensajes.join("\n") + "\n\n¿Deseas guardar de todas formas?",
                function(){ guardarPlanificacionRecursos(true); }
            );

            return;

        }

        boton.disabled = false;
        boton.innerHTML = "💾 Guardar Planificación";

        if(resultado.erroresMaestra && resultado.erroresMaestra.length > 0){
            console.error("Errores al actualizar ficha maestra:", resultado.erroresMaestra);
            mostrarToast("⚠️ Turno guardado, pero " + resultado.erroresMaestra.length + " ficha(s) maestra no se actualizaron. Ver consola.", true);
        } else {
            mostrarToast("✅ Planificación guardada");
        }

        recursosData = resultado.datos;
        recursosData.forEach(item => { item._modificado = false; });

        renderTablaRecursos();

    }catch(error){

        console.error(error);

        boton.disabled = false;
        boton.innerHTML = "💾 Guardar Planificación";

        mostrarToast("❌ Error al guardar la planificación", true);

    }

}

// ============================================
// AGREGAR APOYO (modal)
// ============================================

function abrirAgregarApoyo(){

    colaboradorApoyoSeleccionado = null;

    document.getElementById("prApoyoContenido").innerHTML = `
        <input type="text" id="apBuscar" placeholder="🔍 Buscar colaborador por nombre o DNI..." oninput="buscarApoyo()">
        <div id="apResultados"></div>
        <div class="pr-panel-botones">
            <button class="pr-btn-cancelar" onclick="cerrarModalApoyo()" style="flex:1;">Cancelar</button>
        </div>
    `;

    document.getElementById("prModalApoyo").style.display = "flex";

    document.getElementById("apBuscar").focus();

}

function cerrarModalApoyo(){
    document.getElementById("prModalApoyo").style.display = "none";
}

function buscarApoyo(){

    clearTimeout(timerBusquedaApoyo);

    const texto = document.getElementById("apBuscar").value;

    timerBusquedaApoyo = setTimeout(async function(){

        if(texto.trim().length < 2){
            document.getElementById("apResultados").innerHTML = "";
            return;
        }

        try{

            const resultados = await buscarColaboradoresGlobal(texto);

            const contenedorRes = document.getElementById("apResultados");
            if(!contenedorRes) return;

            if(resultados.length === 0){
                contenedorRes.innerHTML = `<p class="pr-vacio">Sin resultados.</p>`;
                return;
            }

            window._resultadosApoyo = resultados;

            contenedorRes.innerHTML = resultados.map((c, indice) => `
                <div class="pr-resultado-busqueda" onclick='seleccionarApoyo(${indice})'>
                    <b>${c.nombre_completo}</b> — DNI ${c.dni}<br>
                    <small>${c.puesto || "-"} · Supervisor: ${c.supervisor || "-"}</small>
                </div>
            `).join("");

        }catch(error){
            console.error(error);
        }

    }, 350);

}

function seleccionarApoyo(indice){

    const colaborador = window._resultadosApoyo[indice];
    colaboradorApoyoSeleccionado = colaborador;

    document.getElementById("prApoyoContenido").innerHTML = `
        <div class="pr-tarjeta-seleccionado">
            <b>${colaborador.nombre_completo}</b>
            DNI ${colaborador.dni} · ${colaborador.puesto || "-"}<br>
            Supervisor origen: ${colaborador.supervisor || "-"}
        </div>

        <label>Función que realizará en este turno *</label>
        <select id="apFuncion">
            <option value="">-</option>
            ${FUNCIONES_DISPONIBLES.map(f => `<option value="${f}">${f}</option>`).join("")}
        </select>

        <label>Usuario que utilizará (opcional)</label>
        <input type="text" id="apUsuario" value="${colaborador.usuario_fijo || ""}">

        <label>Desde qué hora (opcional)</label>
        <input type="time" id="apDesdeHora">

        <div class="pr-panel-botones">
            <button class="pr-btn-cancelar" onclick="abrirAgregarApoyo()">Volver a buscar</button>
            <button class="pr-btn-agregar" onclick="confirmarAgregarApoyo()">Agregar apoyo</button>
        </div>
    `;

}

async function confirmarAgregarApoyo(forzar){

    if(!colaboradorApoyoSeleccionado){
        mostrarToast("❌ Selecciona un colaborador", true);
        return;
    }

    const funcion = document.getElementById("apFuncion").value;
    const usuario = document.getElementById("apUsuario").value.trim();
    const desdeHora = document.getElementById("apDesdeHora").value;

    if(!funcion){
        mostrarToast("❌ Indica la función que realizará", true);
        return;
    }

    const fecha = document.getElementById("fecha").value;
    const turno = document.getElementById("turno").value;

    if(!fecha || !turno){
        mostrarAlertaModal("Selecciona fecha y turno antes de agregar un apoyo.", "warning");
        return;
    }

    try{

        const resultado = await agregarApoyoRecursos(
            fecha, turno, colaboradorApoyoSeleccionado.id, supervisorRecursos,
            funcion, usuario, desdeHora, !!forzar
        );

        if(resultado.conflicto){

            mostrarConfirmModal(
                resultado.mensaje,
                function(){ confirmarAgregarApoyo(true); }
            );

            return;

        }

        recursosData = resultado.datos;
        renderTablaRecursos();

        mostrarToast("✅ Apoyo agregado");

        cerrarModalApoyo();

        colaboradorApoyoSeleccionado = null;

    }catch(error){
        console.error(error);
        mostrarToast("❌ Error al agregar apoyo", true);
    }

}

// ============================================
// REGISTRAR COLABORADOR NUEVO (modal)
// ============================================

function abrirModalRegistrar(){

    document.getElementById("regDni").value = "";
    document.getElementById("regNombre").value = "";
    document.getElementById("regCategoria").value = "BLUE";
    document.getElementById("regPuesto").value = "";
    document.getElementById("regUsuario").value = "";

    const selectSup = document.getElementById("regSupervisor");
    selectSup.innerHTML = `<option value="">-- Selecciona --</option>` +
        listaSupervisoresGlobal.map(s => `<option value="${s}">${s}</option>`).join("") +
        `<option value="__NUEVO__">+ Otro (escribir nuevo)</option>`;

    if(supervisorRecursos && listaSupervisoresGlobal.indexOf(supervisorRecursos) !== -1){
        selectSup.value = supervisorRecursos;
    }

    document.getElementById("regSupervisorNuevo").style.display = "none";
    document.getElementById("regSupervisorNuevo").value = "";

    const selectFuncion = document.getElementById("regFuncion");
    selectFuncion.innerHTML = `<option value="">-</option>` +
        FUNCIONES_DISPONIBLES.map(f => `<option value="${f}">${f}</option>`).join("");

    document.getElementById("prModalRegistrar").style.display = "flex";

}

function onCambioSupervisorModal(){

    const valor = document.getElementById("regSupervisor").value;
    const inputNuevo = document.getElementById("regSupervisorNuevo");

    inputNuevo.style.display = valor === "__NUEVO__" ? "block" : "none";

}

function cerrarModalRegistrar(){
    document.getElementById("prModalRegistrar").style.display = "none";
}

async function confirmarRegistrarColaborador(){

    const dni = document.getElementById("regDni").value.trim();
    const nombre = document.getElementById("regNombre").value.trim();
    const categoria = document.getElementById("regCategoria").value;
    const puesto = document.getElementById("regPuesto").value.trim();

    let supervisor = document.getElementById("regSupervisor").value;

    if(supervisor === "__NUEVO__"){
        supervisor = document.getElementById("regSupervisorNuevo").value.trim();
    }

    const funcion = document.getElementById("regFuncion").value;
    const usuario = document.getElementById("regUsuario").value.trim();

    if(!dni || !nombre){
        mostrarToast("❌ DNI y nombre son obligatorios", true);
        return;
    }

    if(!supervisor){
        mostrarToast("❌ Selecciona o escribe un supervisor", true);
        return;
    }

    try{

        await registrarColaboradorNuevo(dni, nombre, categoria, puesto, supervisor, funcion, usuario);

        mostrarToast("✅ Colaborador registrado");
        cerrarModalRegistrar();
        cargarRecursos();

    }catch(error){
        console.error(error);
        mostrarToast("❌ Error al registrar colaborador", true);
    }

}

// ============================================
// ELIMINAR COLABORADOR DE LA DATA PRINCIPAL
// ============================================

function eliminarColaborador(colaboradorId, nombre){

    nombre = nombre || "este colaborador";

    mostrarConfirmModal(
        "Esto eliminará a " + nombre + " de la data principal (ficha, turnos e historial). " +
        "Esta acción no se puede deshacer.\n\n¿Continuar?",
        async function(){

            try{

                await eliminarColaboradorRecursos(colaboradorId);

                mostrarToast("🗑️ Colaborador eliminado");

                recursosData = recursosData.filter(r => r.colaborador_id !== colaboradorId);
                renderTablaRecursos();

            }catch(error){
                console.error(error);
                mostrarToast("❌ Error al eliminar colaborador", true);
            }

        },
        null,
        { titulo: "Eliminar colaborador", textoAceptar: "Sí, eliminar", textoCancelar: "Cancelar" }
    );

}

// ============================================
// EXPORTAR A EXCEL (CSV)
// ============================================

function exportarExcel(){

    if(recursosData.length === 0){
        mostrarToast("❌ No hay datos para exportar", true);
        return;
    }

    const encabezados = [
        "Tipo","DNI","Nombre","Puesto","Supervisor",
        "Función","Usuario fijo","Usuarios por este turno","Activo"
    ];

    const filas = recursosData.map(item => [
        item.tipo === "APOYO" ? "Apoyo" : "Normal",
        item.dni,
        item.nombre_completo,
        item.puesto || "",
        item.supervisor || "",
        item.funcion || "",
        item.usuario_fijo || "",
        (item.usuarios || []).join(" / "),
        item.activo ? "SI" : "NO"
    ]);

    const escaparCelda = valor => {
        const texto = String(valor === null || valor === undefined ? "" : valor);
        return `"${texto.replace(/"/g,'""')}"`;
    };

    let csv = encabezados.map(escaparCelda).join(";") + "\r\n";

    filas.forEach(fila => {
        csv += fila.map(escaparCelda).join(";") + "\r\n";
    });

    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });

    const fecha = document.getElementById("fecha").value;
    const turno = document.getElementById("turno").value;

    const nombreArchivo =
        "planificacion_recursos_" + supervisorRecursos.replace(/\s+/g,"_") +
        "_" + fecha + "_" + turno + ".csv";

    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = nombreArchivo;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    mostrarToast("⬇️ Archivo descargado");

}

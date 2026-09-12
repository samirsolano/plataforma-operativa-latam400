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
    document.getElementById("campoResponsableVerificacion").value = sesion.nombre_completo || "";
}

const btnPerfil = document.getElementById("btnPerfil");
const menuUsuario = document.getElementById("menuUsuario");

btnPerfil.addEventListener("click", function(e){
    e.stopPropagation();
    menuUsuario.style.display = menuUsuario.style.display === "block" ? "none" : "block";
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
// ESTADO
// ========================================

// Cada persona: { dni, nombre, agregadoManual, observaciones,
// marcas: { uniforme_epp, manos_unas, cabello, rostro,
// objetos_no_autorizados, sintomas_enfermedad } }
let equipoActual = [];

// Si ya existe un checklist guardado para la fecha+turno+supervisor
// actuales, se sigue editando ese mismo registro (PATCH) en vez de
// crear uno nuevo — ver buscarChecklistHigieneExistente.
let cabeceraExistenteId = null;

// ========================================
// LEYENDA
// ========================================

function pintarLeyenda(){

    const cont = document.getElementById("contenidoLeyenda");

    cont.innerHTML = CRITERIOS_HIGIENE.map(function(c){
        return `<div class="itemLeyenda"><b>(${c.numero}) ${c.titulo}:</b> ${c.detalle}</div>`;
    }).join("");

}

pintarLeyenda();

// ========================================
// FECHA POR DEFECTO
// ========================================

function fechaHoyISO(){
    const ahora = new Date();
    const offset = ahora.getTimezoneOffset() * 60000;
    return new Date(ahora.getTime() - offset).toISOString().slice(0, 10);
}

document.getElementById("campoFecha").value = fechaHoyISO();

// ========================================
// SUPERVISORES
// ========================================

async function cargarSupervisores(){

    try{

        // El selector del formulario (para llenar un checklist nuevo)
        // y el filtro del historial (para ver los ya guardados) son
        // listas aparte: el formulario solo ofrece a los 3
        // supervisores de turno reales, pero el historial debe poder
        // filtrarse por cualquier supervisor que aparezca en los
        // registros guardados.
        const [supervisoresFormulario, supervisoresHistorial] = await Promise.all([
            obtenerSupervisoresHigiene(),
            obtenerTodosLosSupervisoresHigiene()
        ]);

        const selectFormulario = document.getElementById("campoSupervisor");
        const selectHistorial = document.getElementById("filtroHistorialSupervisor");

        supervisoresFormulario.forEach(function(nombre){
            const opcion = document.createElement("option");
            opcion.value = nombre;
            opcion.textContent = nombre;
            selectFormulario.appendChild(opcion);
        });

        supervisoresHistorial.forEach(function(nombre){
            const opcion = document.createElement("option");
            opcion.value = nombre;
            opcion.textContent = nombre;
            selectHistorial.appendChild(opcion);
        });

    }catch(error){

        console.error(error);
        alert("No se pudo cargar la lista de supervisores.");

    }

}

cargarSupervisores();

// ========================================
// CARGAR EQUIPO AL ELEGIR SUPERVISOR
// ========================================

async function cargarEquipoParaSupervisor(supervisorElegido){

    const mensaje = document.getElementById("mensajeEquipo");
    const contenedorTabla = document.getElementById("contenedorTablaEquipo");
    const btnAgregar = document.getElementById("btnAgregarPersona");
    const barraAcciones = document.getElementById("barraAccionesEquipo");
    const selectSupervisor = document.getElementById("campoSupervisor");

    const fecha = document.getElementById("campoFecha").value;
    const turno = document.getElementById("campoTurno").value;

    mensaje.textContent = "Cargando equipo...";
    mensaje.classList.remove("oculto");
    contenedorTabla.classList.add("oculto");

    try{

        // Solo hay UN checklist por fecha+turno (sin importar cuál
        // supervisor lo creó) — si ya existe, se carga con el
        // supervisor real, aunque sea distinto al que estaba elegido.
        const existente = (fecha && turno) ? await buscarChecklistHigieneExistente(fecha, turno) : null;

        cabeceraExistenteId = existente ? existente.id : null;

        const supervisor = existente ? existente.supervisor : supervisorElegido;

        if(existente && selectSupervisor.value !== existente.supervisor){
            selectSupervisor.value = existente.supervisor;
        }

        if(!supervisor){
            equipoActual = [];
            renderizarEquipo();
            mensaje.textContent = "Selecciona un supervisor para cargar a su equipo.";
            mensaje.classList.remove("oculto");
            contenedorTabla.classList.add("oculto");
            btnAgregar.classList.add("oculto");
            barraAcciones.classList.add("oculto");
            return;
        }

        if(existente){

            const detalle = await obtenerDetalleChecklist(existente.id);

            equipoActual = (detalle || []).map(function(d){
                return {
                    dni: d.dni,
                    nombre: d.nombre,
                    turno: d.turno || "",
                    agregadoManual: !!d.agregado_manual,
                    observaciones: d.observaciones || "",
                    marcas: {
                        uniforme_epp: d.uniforme_epp,
                        manos_unas: d.manos_unas,
                        cabello: d.cabello,
                        rostro: d.rostro,
                        objetos_no_autorizados: d.objetos_no_autorizados,
                        sintomas_enfermedad: d.sintomas_enfermedad
                    }
                };
            });

            document.getElementById("campoResponsableOperacion").value = existente.responsable_operacion_nombre || "";

        }else{

            const equipo = await obtenerEquipoPorSupervisor(supervisor);

            equipoActual = equipo.map(function(c){
                return {
                    dni: c.dni,
                    nombre: c.nombre,
                    turno: c.turno || "",
                    agregadoManual: false,
                    observaciones: "",
                    marcas: marcasTodoConforme()
                };
            });

        }

        terminoBusquedaEquipo = "";
        document.getElementById("buscadorEquipo").value = "";
        renderizarEquipo();

        if(equipoActual.length){

            if(existente){
                mensaje.textContent = "Ya existe un checklist guardado para esa fecha y turno — estás corrigiendo ese mismo.";
                mensaje.classList.remove("oculto");
            }else{
                mensaje.classList.add("oculto");
            }

            contenedorTabla.classList.remove("oculto");
            barraAcciones.classList.remove("oculto");

        }else{
            mensaje.textContent = "Este supervisor no tiene colaboradores activos registrados. Puedes agregar personas manualmente.";
        }

        btnAgregar.classList.remove("oculto");

    }catch(error){

        console.error(error);
        mensaje.textContent = "No se pudo cargar el equipo de este supervisor.";

    }

}

document.getElementById("campoSupervisor").addEventListener("change", function(){
    cargarEquipoParaSupervisor(this.value);
});

// Fecha y turno también forman parte de la clave que identifica un
// checklist único (fecha+turno, sin supervisor) — se revisa apenas
// cambian, incluso sin un supervisor elegido todavía: si ya existe
// uno para esa combinación hay que mostrarlo con su supervisor real.
document.getElementById("campoFecha").addEventListener("change", function(){
    cargarEquipoParaSupervisor(document.getElementById("campoSupervisor").value);
});

document.getElementById("campoTurno").addEventListener("change", function(){
    cargarEquipoParaSupervisor(document.getElementById("campoSupervisor").value);
});

// ========================================
// RENDER TABLA
// ========================================

const CLAVES_MARCA = ["C", "NC", "NA"];

let terminoBusquedaEquipo = "";

// Filtra por nombre o DNI sin perder el índice real en equipoActual
// (los data-indice de cada fila/botón siguen apuntando al array
// completo, aunque se muestren menos filas).
function personasFiltradas(){

    const termino = terminoBusquedaEquipo.trim().toLowerCase();

    const conIndice = equipoActual.map(function(persona, indice){
        return { persona: persona, indice: indice };
    });

    if(!termino){
        return conIndice;
    }

    return conIndice.filter(function(item){
        return String(item.persona.nombre || "").toLowerCase().includes(termino) ||
            String(item.persona.dni || "").includes(termino);
    });

}

document.getElementById("buscadorEquipo").addEventListener("input", function(){
    terminoBusquedaEquipo = this.value;
    renderizarEquipo();
});

function renderizarEquipo(){

    const cuerpo = document.getElementById("cuerpoTablaEquipo");
    const mensajeSinResultados = document.getElementById("mensajeSinResultadosEquipo");
    cuerpo.innerHTML = "";

    const filtradas = personasFiltradas();

    mensajeSinResultados.classList.toggle("oculto", !(equipoActual.length && !filtradas.length));

    filtradas.forEach(function(item){

        const persona = item.persona;
        const indice = item.indice;

        const tr = document.createElement("tr");

        if(persona.agregadoManual){
            tr.classList.add("filaManual");
        }

        // Solo se editan a mano el nombre/DNI cuando la persona se
        // agregó en blanco (sin buscar) — si vino de la búsqueda ya
        // sabemos quién es (dni y nombre reales), así que se muestra
        // como texto fijo igual que el resto del equipo.
        const datosCompletos = !!(persona.dni && persona.nombre);

        const celdaCodigo = datosCompletos
            ? (persona.dni || "-")
            : `<input type="text" class="inputDni" data-indice="${indice}" value="${persona.dni || ""}" placeholder="DNI">`;

        const celdaNombre = datosCompletos
            ? (persona.nombre || "-")
            : `<input type="text" class="inputNombre" data-indice="${indice}" value="${persona.nombre || ""}" placeholder="Nombre completo">`;

        let html = `
            <td class="colCodigo">${celdaCodigo}</td>
            <td class="colNombre">${celdaNombre}</td>
        `;

        CRITERIOS_HIGIENE.forEach(function(criterio){

            html += `<td><div class="grupoMarcas" data-indice="${indice}" data-criterio="${criterio.clave}">`;

            CLAVES_MARCA.forEach(function(valor){

                const activo = persona.marcas[criterio.clave] === valor ? " activo" : "";
                const clase = valor === "C" ? "marcaC" : (valor === "NC" ? "marcaNC" : "marcaNA");

                html += `<button type="button" class="btnMarca ${clase}${activo}" data-valor="${valor}">${valor}</button>`;

            });

            html += `</div></td>`;

        });

        html += `
            <td><input type="text" class="inputObservaciones" data-indice="${indice}" value="${persona.observaciones || ""}" placeholder="Observaciones"></td>
            <td><button type="button" class="btnQuitarFila" data-indice="${indice}" title="Quitar de este día">✕</button></td>
        `;

        tr.innerHTML = html;
        cuerpo.appendChild(tr);

    });

}

// Clicks dentro de la tabla (delegado, porque las filas se re-crean).
document.getElementById("cuerpoTablaEquipo").addEventListener("click", function(e){

    const botonMarca = e.target.closest(".btnMarca");

    if(botonMarca){

        const grupo = botonMarca.closest(".grupoMarcas");
        const indice = parseInt(grupo.dataset.indice, 10);
        const criterio = grupo.dataset.criterio;
        const valor = botonMarca.dataset.valor;

        equipoActual[indice].marcas[criterio] = valor;
        renderizarEquipo();

        return;

    }

    const botonQuitar = e.target.closest(".btnQuitarFila");

    if(botonQuitar){

        const indice = parseInt(botonQuitar.dataset.indice, 10);
        equipoActual.splice(indice, 1);
        renderizarEquipo();

        return;

    }

});

// Inputs de texto dentro de la tabla (delegado también).
document.getElementById("cuerpoTablaEquipo").addEventListener("input", function(e){

    const indice = parseInt(e.target.dataset.indice, 10);

    if(isNaN(indice)){
        return;
    }

    if(e.target.classList.contains("inputDni")){
        equipoActual[indice].dni = e.target.value.trim();
    }else if(e.target.classList.contains("inputNombre")){
        equipoActual[indice].nombre = e.target.value;
    }else if(e.target.classList.contains("inputObservaciones")){
        equipoActual[indice].observaciones = e.target.value;
    }

});

// ========================================
// AGREGAR PERSONA (buscando en colaboradores_activos, de
// cualquier supervisor/turno — para el caso de alguien de apoyo)
// ========================================

const panelAgregar = document.getElementById("panelAgregar");
const buscadorAgregar = document.getElementById("buscadorAgregar");
const resultadosAgregar = document.getElementById("resultadosAgregar");

function agregarPersonaAlEquipo(datos){

    const yaEsta = equipoActual.some(function(p){ return p.dni === datos.dni; });

    if(yaEsta){
        alert("Esa persona ya está en la lista de hoy.");
        return;
    }

    equipoActual.push({
        dni: datos.dni || "",
        nombre: datos.nombre || "",
        turno: datos.turno || "",
        agregadoManual: true,
        observaciones: "",
        marcas: marcasTodoConforme()
    });

    renderizarEquipo();

    document.getElementById("contenedorTablaEquipo").classList.remove("oculto");
    document.getElementById("barraAccionesEquipo").classList.remove("oculto");

    cerrarPanelAgregar();

}

function cerrarPanelAgregar(){
    panelAgregar.classList.add("oculto");
    buscadorAgregar.value = "";
    resultadosAgregar.innerHTML = "";
}

document.getElementById("btnAgregarPersona").addEventListener("click", function(){
    panelAgregar.classList.remove("oculto");
    buscadorAgregar.focus();
});

document.getElementById("btnCerrarPanelAgregar").addEventListener("click", cerrarPanelAgregar);

document.getElementById("btnAgregarSinBuscar").addEventListener("click", function(){
    agregarPersonaAlEquipo({ dni: "", nombre: "", turno: "" });
});

let temporizadorBusqueda = null;

buscadorAgregar.addEventListener("input", function(){

    const texto = this.value;

    clearTimeout(temporizadorBusqueda);

    if(texto.trim().length < 2){
        resultadosAgregar.innerHTML = "";
        return;
    }

    temporizadorBusqueda = setTimeout(async function(){

        try{

            const encontrados = await buscarColaboradorPorTexto(texto);

            if(!encontrados.length){
                resultadosAgregar.innerHTML = `<p class="resultadoAgregarVacio">Sin coincidencias.</p>`;
                return;
            }

            resultadosAgregar.innerHTML = encontrados.map(function(c){
                return `
                    <div class="resultadoAgregarItem" data-dni="${c.dni}" data-nombre="${c.nombre}" data-turno="${c.turno || ""}">
                        <div>
                            <div class="resultadoAgregarNombre">${c.nombre}</div>
                            <div class="resultadoAgregarDetalle">DNI ${c.dni} · Turno ${c.turno || "-"} · Supervisor ${c.supervisor || "-"}</div>
                        </div>
                        <div>+ Agregar</div>
                    </div>
                `;
            }).join("");

        }catch(error){

            console.error(error);
            resultadosAgregar.innerHTML = `<p class="resultadoAgregarVacio">No se pudo buscar. Intenta de nuevo.</p>`;

        }

    }, 300);

});

resultadosAgregar.addEventListener("click", function(e){

    const item = e.target.closest(".resultadoAgregarItem");

    if(!item){
        return;
    }

    agregarPersonaAlEquipo({
        dni: item.dataset.dni,
        nombre: item.dataset.nombre,
        turno: item.dataset.turno
    });

});

// ========================================
// MARCAR TODOS CONFORME
// ========================================
// Pone las 6 columnas en "C" para todo el equipo cargado, para que
// el supervisor solo tenga que entrar a corregir a quien tenga algo
// distinto — en vez de marcar los 6 criterios persona por persona.

document.getElementById("btnMarcarTodoConforme").addEventListener("click", function(){

    if(!equipoActual.length){
        return;
    }

    equipoActual.forEach(function(persona){

        CRITERIOS_HIGIENE.forEach(function(criterio){
            persona.marcas[criterio.clave] = "C";
        });

    });

    renderizarEquipo();

});

// ========================================
// ARMAR CABECERA / DETALLE
// ========================================

function armarCabecera(){

    return {
        fecha: document.getElementById("campoFecha").value,
        turno: document.getElementById("campoTurno").value,
        area: document.getElementById("campoArea").value.trim() || "Almacén",
        supervisor: document.getElementById("campoSupervisor").value,
        responsable_verificacion: document.getElementById("campoResponsableVerificacion").value.trim(),
        responsable_operacion_nombre: document.getElementById("campoResponsableOperacion").value.trim(),
        creado_por_dni: sesion ? sesion.usuario || "" : "",
        creado_por_nombre: sesion ? sesion.nombre_completo || "" : ""
    };

}

function armarDetalle(){

    return equipoActual.map(function(p){
        return {
            dni: p.dni,
            nombre: p.nombre,
            turno: p.turno || null,
            uniforme_epp: p.marcas.uniforme_epp || null,
            manos_unas: p.marcas.manos_unas || null,
            cabello: p.marcas.cabello || null,
            rostro: p.marcas.rostro || null,
            objetos_no_autorizados: p.marcas.objetos_no_autorizados || null,
            sintomas_enfermedad: p.marcas.sintomas_enfermedad || null,
            observaciones: p.observaciones || "",
            agregado_manual: !!p.agregadoManual
        };
    });

}

function validarFormulario(){

    const mensaje = document.getElementById("mensajeErrorFormulario");
    mensaje.textContent = "";

    const cabecera = armarCabecera();

    if(!cabecera.fecha || !cabecera.turno || !cabecera.supervisor){
        mensaje.textContent = "Completa fecha, turno y supervisor.";
        return false;
    }

    if(!equipoActual.length){
        mensaje.textContent = "Agrega al menos una persona antes de guardar.";
        return false;
    }

    for(let i = 0; i < equipoActual.length; i++){

        const p = equipoActual[i];

        if(!p.dni || !p.nombre){
            mensaje.textContent = "Hay una fila sin DNI o nombre completo.";
            return false;
        }

        const criteriosFaltantes = CRITERIOS_HIGIENE.some(function(c){
            return !p.marcas[c.clave];
        });

        if(criteriosFaltantes){
            mensaje.textContent = `Falta marcar algún criterio para ${p.nombre}.`;
            return false;
        }

    }

    return true;

}

// ========================================
// GUARDAR
// ========================================

document.getElementById("btnGuardar").addEventListener("click", async function(){

    if(!validarFormulario()){
        return;
    }

    const btn = this;
    btn.disabled = true;
    btn.textContent = "Guardando...";

    try{

        const cabecera = armarCabecera();
        const detalle = armarDetalle();

        if(cabeceraExistenteId){
            await actualizarChecklistHigiene(cabeceraExistenteId, cabecera, detalle);
        }else{
            cabeceraExistenteId = await guardarChecklistHigiene(cabecera, detalle);
        }

        alert("Checklist de higiene guardado correctamente.");

        cabeceraExistenteId = null;
        equipoActual = [];
        document.getElementById("campoSupervisor").value = "";
        document.getElementById("campoResponsableOperacion").value = "";
        renderizarEquipo();
        document.getElementById("contenedorTablaEquipo").classList.add("oculto");
        document.getElementById("btnAgregarPersona").classList.add("oculto");
        document.getElementById("mensajeEquipo").textContent = "Selecciona un supervisor para cargar a su equipo.";
        document.getElementById("mensajeEquipo").classList.remove("oculto");

    }catch(error){

        console.error(error);
        document.getElementById("mensajeErrorFormulario").textContent =
            "No se pudo guardar el checklist. Intenta de nuevo.";

    }finally{

        btn.disabled = false;
        btn.textContent = "Guardar Checklist";

    }

});

// ========================================
// DESCARGAR EXCEL (formulario actual)
// ========================================

document.getElementById("btnDescargarExcel").addEventListener("click", async function(){

    const cabecera = armarCabecera();

    if(!cabecera.fecha || !cabecera.turno || !cabecera.supervisor){
        document.getElementById("mensajeErrorFormulario").textContent =
            "Completa fecha, turno y supervisor antes de descargar la plantilla.";
        return;
    }

    const btn = this;
    btn.disabled = true;

    try{

        await exportarPlantillaHigieneExcel(cabecera, armarDetalle());

    }catch(error){

        console.error(error);
        alert("No se pudo generar el Excel. Revisa la consola para más detalle.");

    }finally{

        btn.disabled = false;

    }

});

// ========================================
// HISTORIAL
// ========================================

document.getElementById("btnVerHistorial").addEventListener("click", function(){

    const vistaFormulario = document.getElementById("vistaFormulario");
    const vistaHistorial = document.getElementById("vistaHistorial");

    const mostrandoHistorial = !vistaHistorial.classList.contains("oculto");

    if(mostrandoHistorial){

        vistaHistorial.classList.add("oculto");
        vistaFormulario.classList.remove("oculto");
        this.textContent = "📋 Ver Historial";

    }else{

        vistaFormulario.classList.add("oculto");
        vistaHistorial.classList.remove("oculto");
        this.textContent = "✏️ Volver al Formulario";
        cargarHistorial();

    }

});

async function cargarHistorial(){

    const tbody = document.getElementById("tblHistorial");
    const mensajeVacio = document.getElementById("mensajeVacioHistorial");

    tbody.innerHTML = "";
    mensajeVacio.classList.add("oculto");

    const filtros = {
        fecha: document.getElementById("filtroHistorialFecha").value || undefined,
        supervisor: document.getElementById("filtroHistorialSupervisor").value || undefined
    };

    try{

        const registros = await listarChecklistsHigiene(filtros);

        if(!registros || !registros.length){
            mensajeVacio.classList.remove("oculto");
            return;
        }

        registros.forEach(function(r){

            const tr = document.createElement("tr");

            const claseBadge = r.turno === "DIA" ? "badge-dia" : (r.turno === "NOCHE" ? "badge-noche" : "badge-intermedio");

            tr.innerHTML = `
                <td>${r.fecha}</td>
                <td><span class="badge ${claseBadge}">${r.turno}</span></td>
                <td>${r.area || "-"}</td>
                <td>${r.supervisor}</td>
                <td>${r.responsable_verificacion || "-"}</td>
                <td><button type="button" class="btn-secundario btnDescargarHistorial" data-id="${r.id}">⬇️ Excel</button></td>
            `;

            tbody.appendChild(tr);

        });

    }catch(error){

        console.error(error);
        mensajeVacio.textContent = "No se pudo cargar el historial.";
        mensajeVacio.classList.remove("oculto");

    }

}

document.getElementById("btnFiltrarHistorial").addEventListener("click", cargarHistorial);

document.getElementById("tblHistorial").addEventListener("click", async function(e){

    const boton = e.target.closest(".btnDescargarHistorial");

    if(!boton){
        return;
    }

    const id = boton.dataset.id;

    boton.disabled = true;
    boton.textContent = "Generando...";

    try{

        const registros = await listarChecklistsHigiene({});
        const cabecera = (registros || []).find(r => String(r.id) === String(id));
        const detalle = await obtenerDetalleChecklist(id);

        await exportarPlantillaHigieneExcel(cabecera, detalle || []);

    }catch(error){

        console.error(error);
        alert("No se pudo generar el Excel de este registro.");

    }finally{

        boton.disabled = false;
        boton.textContent = "⬇️ Excel";

    }

});

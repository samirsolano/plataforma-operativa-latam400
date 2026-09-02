// ============================================
// ACTUALIZAR DESDE DRIVE (Sheet STATUS PENDIENTE)
// ============================================

async function actualizarDrive(){

    const fecha = document.getElementById("fecha").value;
    const turno = document.getElementById("turno").value;

    if(!fecha){
        mostrarAlertaModal("Seleccione una fecha antes de sincronizar.", "warning");
        return;
    }

    if(bloquearSiNoEsTurnoActivo()){
        return;
    }

    const boton = document.getElementById("btnActualizar");

    boton.disabled = true;
    boton.innerHTML = "⏳ Sincronizando...";

    try{

        const datos = await sincronizarPlanificacionCliente(fecha, turno);
        cargarTabla(datos);

    }catch(error){

        console.error(error);
        mostrarAlertaModal("No se pudo sincronizar con Drive: " + (error.message || error), "error");

        boton.disabled = false;
        boton.innerHTML = "🔄 Actualizar Drive";

    }

}

// ============================================
// Cargar planificación desde Supabase
// ============================================

async function cargarPlanificacion(){

    const fecha = document.getElementById("fecha").value;
    const turno = document.getElementById("turno").value;

    try{

        const datos = await obtenerPlanificacionSupabase(fecha, turno);
        cargarTabla(datos);

    }catch(error){

        console.error(error);
        mostrarAlertaModal("Error al consultar la planificación. Intenta de nuevo.", "error");

    }

}

// ============================================
// Dibujar tabla
// ============================================

function cargarTabla(datos){

    const tbody = document.getElementById("tablaPlanificacion");

    tbody.innerHTML = "";

    if(!datos || datos.length === 0){

        document.getElementById("kpiViajes").textContent = "0";
        document.getElementById("kpiProceso").textContent = "0";
        document.getElementById("kpiLanzar").textContent = "0";
        document.getElementById("kpiPeso").textContent = "0 TN";
        document.getElementById("kpiSeleccionados").textContent = "0";
        document.getElementById("kpiPlanificado").textContent = "0.00 TN";

        tbody.innerHTML = `
            <tr>
                <td colspan="11" style="padding:30px;text-align:center;color:#666;">
                    No existe planificación para la fecha y turno seleccionados.
                </td>
            </tr>
        `;

        document.getElementById("checkTodos").checked = false;

        document.getElementById("btnActualizar").disabled = false;
        document.getElementById("btnActualizar").innerHTML = "🔄 Actualizar Drive";

        return;

    }

    let totalViajes = datos.length;
    let enProceso = 0;
    let porLanzar = 0;
    let pesoTotal = 0;

    let viajesSeleccionados = 0;
    let pesoSeleccionado = 0;

    let html = "";

    datos.forEach(function(item, index){

        if(item.status_drive === "EN PROCESO") enProceso++;
        if(item.status_drive === "POR LANZAR") porLanzar++;

        pesoTotal += Number(item.peso_tn) || 0;

        const checked =
            item.estado_planificacion === "PLANIFICADO" ||
            item.status_drive === "EN PROCESO";

        if(checked){
            viajesSeleccionados++;
            pesoSeleccionado += Number(item.peso_tn) || 0;
        }

        const hora =
            item.hora_cita &&
            item.hora_cita !== "-" &&
            item.hora_cita !== "00:00:00"
                ? item.hora_cita.substring(0, 5)
                : "";

        html += `

        <tr class="${checked ? "fila-seleccionada" : ""}" data-gestion="${item.gestion || ""}">

            <td style="text-align:center">
                <input
                    type="checkbox"
                    class="chkViaje"
                    id="chk_${index}"
                    data-fo="${item.fo_real}"
                    data-peso="${item.peso_tn}"
                    ${checked ? "checked" : ""}
                    onchange="actualizarSeleccion()"
                >
            </td>

            <td>${item.gestion || ""}</td>
            <td>${item.fecha_cita || ""}</td>
            <td>${hora}</td>
            <td>${item.fo_real || ""}</td>
            <td>${item.cliente || ""}</td>
            <td>${item.transportista || ""}</td>

            <td style="text-align:right;">
                ${Number(item.peso_tn || 0).toFixed(2)}
            </td>

            <td style="text-align:right;">
                ${Number(item.ctd_extraccion || 0)}
            </td>

            <td style="text-align:right;">
                ${Number(item.tnl_picking || 0).toFixed(2)}
            </td>

            <td style="text-align:center;">
                ${obtenerBadgeEstado(item.status_drive)}
            </td>

        </tr>

        `;

    });

    tbody.innerHTML = html;

    document.getElementById("kpiViajes").textContent = totalViajes;
    document.getElementById("kpiProceso").textContent = enProceso;
    document.getElementById("kpiLanzar").textContent = porLanzar;
    document.getElementById("kpiPeso").textContent = pesoTotal.toFixed(2) + " TN";

    document.getElementById("kpiSeleccionados").textContent = viajesSeleccionados;
    document.getElementById("kpiPlanificado").textContent = pesoSeleccionado.toFixed(2) + " TN";

    document.getElementById("checkTodos").checked = false;

    document.getElementById("btnActualizar").disabled = false;
    document.getElementById("btnActualizar").innerHTML = "🔄 Actualizar Drive";

    poblarFiltroGestionPlanificado(datos);
    aplicarFiltrosPlanificado();

}

// ============================================
// FILTROS (Gestión + buscador) — solo esconden/muestran filas ya
// pintadas por cargarTabla, no tocan los KPIs de arriba (que siguen
// reflejando el día completo) ni el estado de los checkboxes.
// ============================================

function poblarFiltroGestionPlanificado(datos){

    const select = document.getElementById("pdFiltroGestion");
    const seleccionActual = select.value;

    const gestiones = Array.from(new Set(
        (datos || []).map(function(d){ return d.gestion; }).filter(Boolean)
    )).sort();

    select.innerHTML = '<option value="">Gestión (todas)</option>' +
        gestiones.map(function(g){ return `<option value="${g}">${g}</option>`; }).join("");

    select.value = gestiones.includes(seleccionActual) ? seleccionActual : "";

}

function aplicarFiltrosPlanificado(){

    const gestion = document.getElementById("pdFiltroGestion").value;
    const termino = document.getElementById("pdBuscarViaje").value.trim().toLowerCase();

    document.querySelectorAll("#tablaPlanificacion tr").forEach(function(fila){

        if(!fila.dataset || fila.dataset.gestion === undefined){
            return; // fila de "sin datos" (colspan) — no filtrar
        }

        const coincideGestion = !gestion || fila.dataset.gestion === gestion;

        const coincideTexto = !termino ||
            fila.textContent.toLowerCase().includes(termino);

        fila.style.display = (coincideGestion && coincideTexto) ? "" : "none";

    });

}

// ============================================
// Seleccionar todos
// ============================================

function seleccionarTodos(){

    const estado = document.getElementById("checkTodos").checked;

    document.querySelectorAll(".chkViaje").forEach(function(chk){

        chk.checked = estado;

        const fila = chk.closest("tr");

        if(estado){
            fila.classList.add("fila-seleccionada");
        }else{
            fila.classList.remove("fila-seleccionada");
        }

    });

    actualizarSeleccion();

}

// ============================================
// Actualizar KPIs de selección
// ============================================

function actualizarSeleccion(){

    let viajes = 0;
    let tnl = 0;

    document.querySelectorAll(".chkViaje").forEach(function(chk){

        const fila = chk.closest("tr");

        if(chk.checked){

            viajes++;
            tnl += Number(chk.dataset.peso) || 0;

            fila.classList.add("fila-seleccionada");

        }else{

            fila.classList.remove("fila-seleccionada");

        }

    });

    document.getElementById("kpiSeleccionados").textContent = viajes;
    document.getElementById("kpiPlanificado").textContent = tnl.toFixed(2) + " TN";

}

// ============================================
// Obtener seleccionados
// ============================================

function obtenerSeleccionados(){

    const seleccionados = [];

    document.querySelectorAll(".chkViaje").forEach(function(chk){

        if(chk.checked){

            seleccionados.push({
                fo: chk.dataset.fo,
                peso: Number(chk.dataset.peso) || 0
            });

        }

    });

    return seleccionados;

}

// ============================================
// Badge del estado
// ============================================

function obtenerBadgeEstado(estado){

    switch((estado || "").toUpperCase()){

        case "POR LANZAR":
            return `<span class="badge-estado badge-lanzar">POR LANZAR</span>`;

        case "EN PROCESO":
            return `<span class="badge-estado badge-proceso">EN PROCESO</span>`;

        case "PREPARADO":
            return `<span class="badge-estado badge-preparado">PREPARADO</span>`;

        default:
            return `<span class="badge-estado">${estado || ""}</span>`;

    }

}

// ============================================
// Guardar planificación
// ============================================

async function guardarPlanificacionUI(){

    const fecha = document.getElementById("fecha").value;
    const turno = document.getElementById("turno").value;

    if(!fecha || !turno){
        mostrarAlertaModal("Selecciona fecha y turno antes de guardar.", "warning");
        return;
    }

    if(bloquearSiNoEsTurnoActivo()){
        return;
    }

    const seleccionados = obtenerSeleccionados();

    const boton = document.getElementById("btnGuardarPlanificacion");

    boton.disabled = true;
    boton.innerHTML = "⏳ Guardando...";

    try{

        const datos = await guardarEstadoPlanificacion(fecha, turno, seleccionados);

        boton.disabled = false;
        boton.innerHTML = "💾 Guardar Planificación";

        mostrarToast("✅ Guardado exitoso");

        cargarTabla(datos);

    }catch(error){

        console.error(error);

        boton.disabled = false;
        boton.innerHTML = "💾 Guardar Planificación";

        mostrarToast("❌ Error al guardar la planificación", true);

    }

}

// ============================================
// Mostrar ventana emergente (toast)
// ============================================

function mostrarToast(mensaje, esError){

    const toastAnterior = document.getElementById("pdToast");
    if(toastAnterior) toastAnterior.remove();

    const toast = document.createElement("div");

    toast.id = "pdToast";
    toast.className = "pd-toast" + (esError ? " pd-toast-error" : "");
    toast.textContent = mensaje;

    document.body.appendChild(toast);

    requestAnimationFrame(function(){
        toast.classList.add("pd-toast-visible");
    });

    setTimeout(function(){

        toast.classList.remove("pd-toast-visible");

        setTimeout(function(){
            toast.remove();
        }, 250);

    }, 2000);

}

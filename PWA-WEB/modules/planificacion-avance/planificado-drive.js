// ============================================
// Último set de datos cargado en la tabla (para el modal de Resumen)
// ============================================

let ultimoPlanificadoDatos = [];

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

    ultimoPlanificadoDatos = datos || [];

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

// ============================================
// RESUMEN PLANIFICADO (modal con gráficos)
// ============================================

const PD_RESUMEN_COLORES = ["#FC000D", "#1f6feb", "#1e8449", "#e67e22", "#6c3483", "#17a2b8", "#d4af37", "#c0392b"];
const PD_RESUMEN_CAPACIDAD_TURNO = 350;

function abrirResumenPlanificado(){

    if(!ultimoPlanificadoDatos || ultimoPlanificadoDatos.length === 0){
        mostrarAlertaModal("No hay planificación cargada para resumir. Actualiza el Drive primero.", "warning");
        return;
    }

    const fecha = document.getElementById("fecha").value;
    const turno = document.getElementById("turno").value;

    document.getElementById("pdResumenSubtitulo").textContent =
        (fecha || "—") + " · Turno " + (turno || "—");

    document.getElementById("pdResumenContenido").innerHTML =
        construirResumenPlanificado(ultimoPlanificadoDatos);

    document.getElementById("pdModalResumen").style.display = "flex";

}

function cerrarResumenPlanificado(){
    document.getElementById("pdModalResumen").style.display = "none";
}

function construirResumenPlanificado(datos){

    const porGestion = {};

    let totalFos = 0, totalPeso = 0, totalPal = 0, totalPicking = 0;
    let enProceso = 0, porLanzar = 0;

    datos.forEach(function(item){

        const gestion = item.gestion || "SIN GESTIÓN";

        if(!porGestion[gestion]){
            porGestion[gestion] = { fos: 0, peso: 0, pal: 0, picking: 0 };
        }

        const peso = Number(item.peso_tn) || 0;
        const pal = Number(item.ctd_extraccion) || 0;
        const picking = Number(item.tnl_picking) || 0;

        porGestion[gestion].fos++;
        porGestion[gestion].peso += peso;
        porGestion[gestion].pal += pal;
        porGestion[gestion].picking += picking;

        totalFos++;
        totalPeso += peso;
        totalPal += pal;
        totalPicking += picking;

        if(item.status_drive === "EN PROCESO") enProceso++;
        if(item.status_drive === "POR LANZAR") porLanzar++;

    });

    const gestiones = Object.keys(porGestion).sort(function(a, b){
        return porGestion[b].peso - porGestion[a].peso;
    });

    const pctCapacidad = totalPeso > 0 ? (totalPeso / PD_RESUMEN_CAPACIDAD_TURNO * 100) : 0;

    // ---- Donut: participación de TN por gestión ----

    const R = 70, C = 2 * Math.PI * R;
    let acumulado = 0;

    const segmentos = gestiones.map(function(gestion, i){

        const valor = porGestion[gestion].peso;
        const pct = totalPeso > 0 ? (valor / totalPeso) : 0;
        const largo = pct * C;
        const color = PD_RESUMEN_COLORES[i % PD_RESUMEN_COLORES.length];

        const arco = `
            <circle
                cx="85" cy="85" r="${R}"
                fill="none"
                stroke="${color}"
                stroke-width="20"
                stroke-dasharray="${largo.toFixed(2)} ${(C - largo).toFixed(2)}"
                stroke-dashoffset="${(-acumulado).toFixed(2)}"
                transform="rotate(-90 85 85)"
            ></circle>
        `;

        acumulado += largo;

        return { arco: arco, color: color, nombre: gestion, valor: valor, pct: pct };

    });

    const donutSvg = `
        <svg class="pd-resumen-donut-svg" viewBox="0 0 170 170">
            <circle cx="85" cy="85" r="${R}" fill="none" stroke="#eef1f4" stroke-width="20"></circle>
            ${segmentos.map(function(s){ return s.arco; }).join("")}
            <text x="85" y="80" text-anchor="middle" class="pd-resumen-donut-centro-valor">${totalPeso.toFixed(1)}</text>
            <text x="85" y="97" text-anchor="middle" class="pd-resumen-donut-centro-label">TN PLANIF.</text>
        </svg>
    `;

    const leyenda = segmentos.map(function(s){
        return `
            <div class="pd-resumen-leyenda-item">
                <span class="pd-resumen-leyenda-dot" style="background:${s.color};"></span>
                <span class="pd-resumen-leyenda-nombre">${s.nombre}</span>
                <span class="pd-resumen-leyenda-valor">${s.valor.toFixed(2)} TN</span>
                <span class="pd-resumen-leyenda-pct">${(s.pct * 100).toFixed(0)}%</span>
            </div>
        `;
    }).join("");

    // ---- Tabla por gestión ----

    const filasTabla = gestiones.map(function(gestion, i){

        const d = porGestion[gestion];
        const pct = totalPeso > 0 ? (d.peso / totalPeso * 100) : 0;
        const color = PD_RESUMEN_COLORES[i % PD_RESUMEN_COLORES.length];

        return `
            <tr>
                <td>
                    <span class="pd-resumen-leyenda-dot" style="background:${color};display:inline-block;margin-right:6px;vertical-align:-1px;"></span>
                    ${gestion}
                </td>
                <td class="pd-resumen-num">${d.fos}</td>
                <td class="pd-resumen-num">${d.peso.toFixed(2)}</td>
                <td class="pd-resumen-num">${d.pal}</td>
                <td class="pd-resumen-num">${d.picking.toFixed(2)}</td>
                <td class="pd-resumen-num">
                    ${pct.toFixed(0)}%
                    <span class="pd-resumen-barra-mini"><span style="width:${pct.toFixed(0)}%;background:${color};"></span></span>
                </td>
            </tr>
        `;

    }).join("");

    return `

        <div class="pd-resumen-kpis">

            <div class="pd-resumen-kpi">
                <span>FOs planificados</span>
                <h4>${totalFos}</h4>
            </div>

            <div class="pd-resumen-kpi">
                <span>TN Total</span>
                <h4>${totalPeso.toFixed(2)}</h4>
            </div>

            <div class="pd-resumen-kpi">
                <span>PAL Extracción</span>
                <h4>${totalPal}</h4>
            </div>

            <div class="pd-resumen-kpi">
                <span>TNL Picking</span>
                <h4>${totalPicking.toFixed(2)}</h4>
            </div>

            <div class="pd-resumen-kpi ${pctCapacidad > 100 ? "pd-resumen-kpi-alerta" : ""}">
                <span>Capacidad de turno usada</span>
                <h4>${pctCapacidad.toFixed(0)}%</h4>
            </div>

        </div>

        <div class="pd-resumen-body">

            <div class="pd-resumen-donut-card">
                <h4>TN por gestión</h4>
                <div class="pd-resumen-donut-wrap">
                    ${donutSvg}
                    <div class="pd-resumen-leyenda">${leyenda}</div>
                </div>
            </div>

            <div class="pd-resumen-tabla-card">
                <h4>Detalle por gestión</h4>
                <div class="pd-resumen-tabla-scroll">
                    <table class="pd-resumen-tabla">

                        <thead>
                            <tr>
                                <th>Gestión</th>
                                <th>FOs</th>
                                <th>TN</th>
                                <th>PAL</th>
                                <th>TNL Picking</th>
                                <th>% del total</th>
                            </tr>
                        </thead>

                        <tbody>

                            ${filasTabla}

                            <tr class="pd-resumen-fila-total">
                                <td>TOTAL</td>
                                <td class="pd-resumen-num">${totalFos}</td>
                                <td class="pd-resumen-num">${totalPeso.toFixed(2)}</td>
                                <td class="pd-resumen-num">${totalPal}</td>
                                <td class="pd-resumen-num">${totalPicking.toFixed(2)}</td>
                                <td class="pd-resumen-num">100%</td>
                            </tr>

                        </tbody>

                    </table>
                </div>
            </div>

        </div>

        <div class="pd-resumen-estado-row">

            <div class="pd-resumen-chip">
                <span class="pd-resumen-chip-dot" style="background:#A66A00;"></span>
                En Proceso: ${enProceso}
            </div>

            <div class="pd-resumen-chip">
                <span class="pd-resumen-chip-dot" style="background:#C62828;"></span>
                Por Lanzar: ${porLanzar}
            </div>

        </div>

    `;

}

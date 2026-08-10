// Reutiliza FUNCIONES_DISPONIBLES y opcionesFuncion ya declarados en recursos.js

let rpData = [];
let rpHistorial = [];
let rpIntervaloAuto = null;

//========================================
// HELPER: función "efectiva" de una fila
//========================================

function funcionEfectivaDe(item){
    return item.funcion_actual || item.funcion_inicio || "";
}

//========================================
// ENTRADA AL MÓDULO (llamado desde abrirModulo)
//========================================

function iniciarReplanificacion(){

    cargarReplanificacion(false);

    if(rpIntervaloAuto){
        clearInterval(rpIntervaloAuto);
    }

    rpIntervaloAuto = setInterval(function(){

        const moduloVisible = document.getElementById("modReplanificacion") &&
            document.getElementById("modReplanificacion").style.display !== "none";

        const hayPendientes = rpData.some(function(f){ return f._modificado; });

        if(moduloVisible && !hayPendientes){
            cargarReplanificacion(true);
        }

    }, 20000);

}

//========================================
// CARGAR DATOS DESDE SUPABASE
//========================================

async function cargarReplanificacion(silencioso){

    const scroll = document.querySelector(".rp-tabla-scroll");
    const scrollTopPrevio = scroll ? scroll.scrollTop : 0;

    if(!silencioso){
        document.getElementById("rpBody").innerHTML =
            `<tr><td colspan="7" style="text-align:center;padding:30px;color:#777;">Cargando...</td></tr>`;
    }

    try{

        const resultado = await obtenerReplanificacionTurno(fechaSeleccionada, turnoSeleccionado);

        rpData = resultado.filas.map(function(f){
            f._modificado = false;
            f._funcionActualOriginal = f.funcion_actual;
            return f;
        });

        rpHistorial = resultado.historial;

        document.getElementById("rpUltimaActualizacion").textContent =
            new Date().toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" });

        renderReplanificacion();

        const scrollNuevo = document.querySelector(".rp-tabla-scroll");
        if(scrollNuevo){
            scrollNuevo.scrollTop = scrollTopPrevio;
        }

    }catch(error){

        if(!silencioso){
            document.getElementById("rpBody").innerHTML =
                `<tr><td colspan="7" style="text-align:center;padding:30px;color:#C62828;">Error al cargar: ${error.message}</td></tr>`;
        }

    }

}

//========================================
// RENDER GENERAL
//========================================

function renderReplanificacion(){

    renderDistribucion();
    renderTablaPrincipal();

    const hayPendientes = rpData.some(function(f){ return f._modificado; });

    document.getElementById("rpBtnGuardarTodo").disabled = !hayPendientes;

    document.getElementById("rpTotalColaboradores").textContent = rpData.length;
    document.getElementById("rpTotalCambios").textContent =
        hayPendientes
            ? rpData.filter(function(f){ return f._modificado; }).length + " cambio(s) sin guardar"
            : "Sin cambios";

}

//========================================
// DISTRIBUCIÓN POR FUNCIÓN
//========================================

function renderDistribucion(){

    const SIN_FUNCION = "SIN FUNCIÓN";
    const funciones = FUNCIONES_DISPONIBLES.concat([SIN_FUNCION]);
    const contenedor = document.getElementById("rpChipsDistribucion");

    const conteoInicio = {};
    const conteoActual = {};

    rpData.forEach(function(item){

        const inicio = item.funcion_inicio || SIN_FUNCION;
        const actual = funcionEfectivaDe(item) || SIN_FUNCION;

        conteoInicio[inicio] = (conteoInicio[inicio] || 0) + 1;
        conteoActual[actual] = (conteoActual[actual] || 0) + 1;

    });

    let total = 0;

    contenedor.innerHTML = funciones.map(function(fn){

        const cantidad = conteoActual[fn] || 0;
        const antes = conteoInicio[fn] || 0;
        const delta = cantidad - antes;

        total += cantidad;

        const claseDelta = delta > 0 ? "rp-delta-pos" : (delta < 0 ? "rp-delta-neg" : "rp-delta-cero");
        const signo = delta > 0 ? "▲" + delta : (delta < 0 ? "▼" + Math.abs(delta) : "=");

        const esSinFuncion = fn === SIN_FUNCION;

        return `
            <div class="rp-chip-funcion ${esSinFuncion ? "rp-chip-sin-funcion" : ""}">
                <span class="rp-chip-nombre">${fn}</span>
                <span class="rp-chip-numero">${cantidad}</span><span class="rp-chip-delta ${claseDelta}">${signo}</span>
            </div>
        `;

    }).join("") + `
        <div class="rp-chip-funcion" style="background:#FDE6E6;border-color:#F4A9A9;">
            <span class="rp-chip-nombre">TOTAL</span>
            <span class="rp-chip-numero">${total}</span>
        </div>
    `;

}

//========================================
// TABLA PRINCIPAL
//========================================

function poblarFiltroFuncionInicio(){

    const select = document.getElementById("rpFiltroFuncionInicio");
    const valorActual = select.value;

    const funciones = Array.from(new Set(rpData.map(function(i){ return i.funcion_inicio; }).filter(function(f){ return f; }))).sort();

    select.innerHTML = `<option value="">Función inicio (todas)</option>` +
        funciones.map(function(f){ return `<option value="${f}">${f}</option>`; }).join("");

    if(funciones.indexOf(valorActual) !== -1) select.value = valorActual;

}

function renderTablaPrincipal(){

    poblarFiltroFuncionInicio();

    const tbody = document.getElementById("rpBody");

    if(rpData.length === 0){
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:30px;color:#777;">No hay colaboradores activos para este turno.</td></tr>`;
        return;
    }

    const filtroTexto = (document.getElementById("rpBuscar").value || "").toUpperCase().trim();
    const filtroFuncionInicio = document.getElementById("rpFiltroFuncionInicio").value;
    const filtroEstado = document.getElementById("rpFiltroEstado").value;

    const indices = rpData.map(function(_, i){ return i; }).filter(function(i){

        const item = rpData[i];
        const efectiva = funcionEfectivaDe(item);
        const replanificado = efectiva !== item.funcion_inicio;

        const pasaTexto = !filtroTexto ||
            item.nombre_completo.toUpperCase().includes(filtroTexto) ||
            String(item.dni).toUpperCase().includes(filtroTexto);

        const pasaFuncionInicio = !filtroFuncionInicio || item.funcion_inicio === filtroFuncionInicio;

        const pasaEstado = !filtroEstado ||
            (filtroEstado === "replanificado" && replanificado) ||
            (filtroEstado === "sin_cambios" && !replanificado);

        return pasaTexto && pasaFuncionInicio && pasaEstado;

    });

    if(indices.length === 0){
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:30px;color:#777;">Ningún colaborador coincide con el filtro.</td></tr>`;
        return;
    }

    tbody.innerHTML = indices.map(function(index){

        const item = rpData[index];
        const efectiva = funcionEfectivaDe(item);
        const replanificado = efectiva !== item.funcion_inicio;

        const estado = replanificado
            ? `<span class="rp-estado-replanificado">🟠 Replanificado</span>`
            : `<span class="rp-estado-sin-cambios">🟢 Sin cambios</span>`;

        const accion = item._modificado
            ? `<button class="rp-btn-guardar-fila" onclick="guardarReplanificacionUnaFila(${index})">💾 Guardar</button>`
            : `—`;

        return `
            <tr class="${replanificado ? "rp-fila-replanificada" : ""}">
                <td>${item.dni}</td>
                <td>${(item.nombre_completo || "").toUpperCase()}</td>
                <td>${item.funcion_inicio || "-"}</td>
                <td>
                    <select class="rp-select-funcion" onchange="cambiarFuncionActual(${index}, this.value)">
                        ${opcionesFuncion(item.funcion_actual)}
                    </select>
                </td>
                <td>${item.usuario || "-"}</td>
                <td>${estado}</td>
                <td>${accion}</td>
            </tr>
        `;

    }).join("");

}

function cambiarFuncionActual(index, nuevaFuncion){

    const item = rpData[index];

    item.funcion_actual = nuevaFuncion;
    item._modificado = nuevaFuncion !== (item._funcionActualOriginal || "");

    renderReplanificacion();

}

//========================================
// MODAL DE OBSERVACIÓN (reutilizable)
//========================================

let rpCallbackModalObservacion = null;

function abrirModalObservacion(titulo, subtitulo, callback){

    document.getElementById("rpModalTitulo").textContent = titulo;
    document.getElementById("rpModalSubtitulo").textContent = subtitulo || "";
    document.getElementById("rpModalTexto").value = "";
    document.getElementById("rpModalObservacion").style.display = "flex";

    rpCallbackModalObservacion = callback;

}

function cerrarModalObservacion(){
    document.getElementById("rpModalObservacion").style.display = "none";
    rpCallbackModalObservacion = null;
}

function confirmarModalObservacion(){

    const texto = document.getElementById("rpModalTexto").value.trim();
    const callback = rpCallbackModalObservacion;

    document.getElementById("rpModalObservacion").style.display = "none";
    rpCallbackModalObservacion = null;

    if(callback){
        callback(texto);
    }

}

//========================================
// GUARDAR - UNA FILA
//========================================

function guardarReplanificacionUnaFila(index){

    const item = rpData[index];

    abrirModalObservacion(
        "Observación del cambio",
        (item.nombre_completo || "").toUpperCase() + ": " + (item.funcion_inicio || "-") + " → " + item.funcion_actual,
        async function(observacion){

            try{

                await guardarReplanificacionFila(item.turno_colaborador_id, item.funcion_actual, observacion);
                item._modificado = false;
                cargarReplanificacion();

            }catch(error){
                mostrarAlertaModal("No se pudo guardar el cambio: " + error.message, "error");
            }

        }
    );

}

//========================================
// GUARDAR - TODOS LOS CAMBIOS PENDIENTES
//========================================

function guardarReplanificacionTodo(){

    const pendientes = rpData.filter(function(f){ return f._modificado; });

    if(pendientes.length === 0){
        return;
    }

    abrirModalObservacion(
        "Observación de la replanificación",
        pendientes.length + " cambio(s) pendientes por guardar (opcional, se aplica a todos).",
        async function(observacion){

            const cambios = pendientes.map(function(f){
                return {
                    turno_colaborador_id: f.turno_colaborador_id,
                    funcion_actual: f.funcion_actual,
                    observacion: observacion || null
                };
            });

            const boton = document.getElementById("rpBtnGuardarTodo");
            boton.disabled = true;
            boton.textContent = "Guardando...";

            try{

                const resultado = await guardarReplanificacionBatch(fechaSeleccionada, turnoSeleccionado, cambios);

                boton.textContent = "💾 Guardar replanificación";

                rpData = resultado.filas.map(function(f){
                    f._modificado = false;
                    f._funcionActualOriginal = f.funcion_actual;
                    return f;
                });

                rpHistorial = resultado.historial;

                renderReplanificacion();

            }catch(error){

                boton.disabled = false;
                boton.textContent = "💾 Guardar replanificación";
                mostrarAlertaModal("Error al guardar la replanificación: " + error.message, "error");

            }

        }
    );

}

//========================================
// HISTORIAL
//========================================

function renderHistorial(){

    const tbody = document.getElementById("rpHistorialBody");
    if(!tbody) return;

    if(!rpHistorial || rpHistorial.length === 0){
        tbody.innerHTML = `<tr><td colspan="6" class="rp-vacio">Aún no existen registros.</td></tr>`;
        return;
    }

    tbody.innerHTML = rpHistorial.map(function(h){
        return `
            <tr>
                <td>${h.hora}</td>
                <td>${(h.nombre_completo || "").toUpperCase()} (${h.dni})</td>
                <td>${h.funcion_antes || "-"}</td>
                <td>${h.funcion_despues || "-"}</td>
                <td>${h.supervisor || "-"}</td>
                <td>${h.observacion || "-"}</td>
            </tr>
        `;
    }).join("");

}

//========================================
// DESCARGAR CAMBIOS (CSV)
//========================================

function descargarCambiosReplanificacion(){

    let csv = "DNI,Colaborador,Funcion inicio,Funcion actual,Usuario,Estado\n";

    rpData.forEach(function(item){
        const estado = item.funcion_actual !== item.funcion_inicio ? "Replanificado" : "Sin cambios";
        csv += `${item.dni},"${(item.nombre_completo || "").toUpperCase()}",${item.funcion_inicio},${item.funcion_actual},${item.usuario},${estado}\n`;
    });

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const enlace = document.createElement("a");
    enlace.href = url;
    enlace.download = "replanificacion_" + fechaSeleccionada + "_" + turnoSeleccionado + ".csv";
    enlace.click();
    URL.revokeObjectURL(url);

}

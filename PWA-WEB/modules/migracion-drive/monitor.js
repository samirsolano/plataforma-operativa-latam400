// ========================================
// MONITOR
// ========================================
// Los viajes SUBIDO (los de Status Pendiente) con las columnas del
// Monitor de la hoja L400 del Drive. FASE, CANAL SISTEMA y CANAL FÍSICO
// se escriben directo en la tabla y el STATUS se elige de la lista;
// cada cambio se guarda solo en md_viajes al salir de la celda. La
// fecha y hora de cita solo se muestran (el Monitor no las cambia).
// Por ahora una fase por viaje.

const monitor = { viajes: [] };

// Los status de la lista del Drive, en el orden en que avanza el viaje
// (el primero lo pone "Subir viaje"). Colores en COLORES_STATUS.
const STATUS_MONITOR = ["POR LANZAR", "EN PROCESO", "CONFIRMADO", "CONTABILIZADO", "CERRADO", "AJUSTADO A 0"];

// Campos que se pueden editar y cómo se limpian antes de guardar.
const CAMPOS_MONITOR = {
    fase: function(v){ return v.trim() || null; },
    canal_sistema: function(v){ return limpiarTexto(v) || null; },
    canal_fisico: function(v){ return v.trim() || null; },
    status: function(v){ return v || null; }
};

// Se ven todos los viajes subidos, sin filtro de fecha. Por defecto los
// "Sin cerrar", así los CERRADO no se acumulan en la pantalla.
(function iniciarFiltrosMonitor(){
    document.getElementById("mnStatus").innerHTML =
        '<option value="SIN_CERRAR">Sin cerrar</option>' +
        '<option value="">Todos</option>' +
        STATUS_MONITOR.map(function(s){
            return '<option value="' + s + '">' + s + '</option>';
        }).join("");
})();

async function cargarMonitor(){

    const contenido = document.getElementById("mnContenido");
    const status = document.getElementById("mnStatus").value;

    contenido.className = "cv-vacio";
    contenido.textContent = "Cargando...";

    try{

        const viajes = await supabaseFetch(
            "/md_viajes?select=fo,gestion,fecha_subida,fecha_cita,hora_cita,destino,cliente," +
            "peso_tn,transportista_nombre,cantidad_skus,fase,canal_sistema,canal_fisico,status" +
            "&estado=eq.SUBIDO" +
            (status === "SIN_CERRAR" ? "&or=(status.is.null,status.neq.CERRADO)"
                : status ? "&status=eq." + encodeURIComponent(status) : "") +
            "&order=fecha_cita.asc.nullslast,hora_cita.asc.nullslast,fecha_subida.asc&limit=2000"
        );

        monitor.viajes = viajes || [];
        pintarMonitor();

    }catch(error){

        console.error(error);
        contenido.textContent = "No se pudo cargar el Monitor: " + (error.message || error);

    }

}

function viajesMonitorFiltrados(){

    const texto = limpiarTexto(document.getElementById("mnBuscar").value);

    return monitor.viajes.filter(function(v){

        if(!texto) return true;

        return [v.fo, v.cliente, v.transportista_nombre, v.gestion, v.destino, v.fase, v.canal_sistema]
            .some(function(c){ return limpiarTexto(c).indexOf(texto) !== -1; });

    });

}

function claseStatusMonitor(status){
    return "mn-status " + (COLORES_STATUS[status] || "");
}

function pintarMonitor(){

    const contenido = document.getElementById("mnContenido");
    const viajes = viajesMonitorFiltrados();

    if(viajes.length === 0){
        contenido.className = "cv-vacio";
        contenido.textContent = monitor.viajes.length
            ? "Ningún viaje coincide con los filtros."
            : "No hay viajes subidos con este status. Súbelos desde Facturación › Cargar Viaje.";
        return;
    }

    let html =
        '<div class="sp-resumen">' + textoCantidadViajes(viajes.length) +
            ' · los cambios se guardan solos al salir de la celda</div>' +
        '<div class="sp-contenedor"><table class="sp-tabla mn-tabla"><thead><tr>' +
            '<th>FECHA DE CITA</th><th>HORA DE CITA</th><th>GESTIÓN</th><th>VIAJE</th>' +
            '<th>DESTINO</th><th>CLIENTE</th><th>PESO TN</th><th>TRANSPORTISTA</th>' +
            '<th>CANTIDAD SKU\'S</th><th>FASE</th><th>CANAL SISTEMA</th><th>CANAL FÍSICO</th>' +
            '<th>STATUS</th>' +
        '</tr></thead><tbody>';

    viajes.forEach(function(v){

        const fo = escaparHtml(JSON.stringify(v.fo));

        function entrada(campo, tipo, valor, extra){
            return '<input type="' + tipo + '" class="mn-input" value="' + escaparHtml(valor || "") + '"' +
                (extra || "") + ' onchange="guardarCampoMonitor(this, ' + fo + ', \'' + campo + '\')">';
        }

        html +=
            '<tr>' +
                '<td>' + (v.fecha_cita ? fechaSp(v.fecha_cita) : "-") + '</td>' +
                '<td>' + (v.hora_cita ? escaparHtml(String(v.hora_cita).slice(0, 5)) : "-") + '</td>' +
                '<td class="sp-izq sp-gestion">' + escaparHtml(v.gestion || "-") + '</td>' +
                '<td>' + escaparHtml(v.fo) + '</td>' +
                '<td class="sp-izq">' + escaparHtml(v.destino || "-") + '</td>' +
                '<td class="sp-izq">' + escaparHtml(v.cliente || "-") + '</td>' +
                '<td class="sp-num">' + (Number(v.peso_tn) || 0).toFixed(3) + '</td>' +
                '<td class="sp-izq">' + escaparHtml(v.transportista_nombre || "-") + '</td>' +
                '<td class="sp-num">' + (v.cantidad_skus === null || v.cantidad_skus === undefined ? "-" : v.cantidad_skus) + '</td>' +
                '<td>' + entrada("fase", "text", v.fase, ' placeholder="Fase"') + '</td>' +
                '<td>' + entrada("canal_sistema", "text", v.canal_sistema, ' placeholder="CNL-OUT-"') + '</td>' +
                '<td>' + entrada("canal_fisico", "text", v.canal_fisico, ' placeholder="Ej. 36 - 37"') + '</td>' +
                '<td>' +
                    '<select class="' + claseStatusMonitor(v.status) + '" onchange="guardarCampoMonitor(this, ' + fo + ', \'status\')">' +
                        STATUS_MONITOR.map(function(s){
                            return '<option value="' + s + '"' + (s === v.status ? " selected" : "") + '>' + s + '</option>';
                        }).join("") +
                    '</select>' +
                '</td>' +
            '</tr>';

    });

    html += '</tbody></table></div>';

    contenido.className = "";
    contenido.innerHTML = html;

}

// Guarda un solo campo del viaje. Si falla, la celda vuelve a su valor.
async function guardarCampoMonitor(control, fo, campo){

    const viaje = monitor.viajes.find(function(v){ return v.fo === fo; });
    const anterior = viaje ? viaje[campo] : null;
    const valor = CAMPOS_MONITOR[campo](control.value);
    const ahora = new Date().toISOString();

    const cambios = {
        monitor_por: sesion ? sesion.nombre_completo : null,
        monitor_en: ahora,
        actualizado_en: ahora
    };
    cambios[campo] = valor;

    control.classList.remove("mn-guardado", "mn-error");
    control.classList.add("mn-guardando");

    try{

        await supabaseFetch("/md_viajes?fo=eq." + encodeURIComponent(fo), {
            method: "PATCH",
            headers: { "Prefer": "return=minimal" },
            body: JSON.stringify(cambios)
        });

        if(viaje) viaje[campo] = valor;

        // Se muestra como quedó guardado (ej. canal en mayúsculas).
        if(campo === "canal_sistema") control.value = valor || "";
        if(campo === "status") control.className = claseStatusMonitor(valor);

        control.classList.remove("mn-guardando");
        control.classList.add("mn-guardado");
        setTimeout(function(){ control.classList.remove("mn-guardado"); }, 1500);

    }catch(error){

        console.error(error);

        control.value = anterior || "";
        control.classList.remove("mn-guardando");
        control.classList.add("mn-error");

        alert("No se pudo guardar el cambio del viaje " + fo + ": " + (error.message || error));

    }

}

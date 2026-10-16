// ========================================
// STATUS PENDIENTE
// ========================================
// Los viajes que "Subir viaje" pasó a estado SUBIDO (md_viajes), con
// las columnas y colores de la hoja STATUS PENDIENTE del Drive: un
// bloque por gestión con su total y la suma total al final.
// Se filtra por fecha de subida (por defecto los últimos 7 días) para
// no traer toda la tabla a medida que crece.

const statusPendiente = { viajes: [] };

// Color de cada status, igual que en la hoja.
const COLORES_STATUS = {
    "PENDIENTE": "sp-rojo",
    "POR LANZAR": "sp-rojo",
    "EN PROCESO": "sp-amarillo",
    "CONFIRMADO": "sp-verde",
    "CERRADO": "sp-verde"
};

(function iniciarFiltroDesde(){
    const desde = new Date();
    desde.setDate(desde.getDate() - 7);
    document.getElementById("spDesde").value =
        desde.getFullYear() + "-" +
        String(desde.getMonth() + 1).padStart(2, "0") + "-" +
        String(desde.getDate()).padStart(2, "0");
})();

async function cargarStatusPendiente(){

    const contenido = document.getElementById("spContenido");
    const desde = document.getElementById("spDesde").value;

    contenido.className = "cv-vacio";
    contenido.textContent = "Cargando...";

    try{

        const viajes = await supabaseFetch(
            "/md_viajes?select=fo,gestion,fecha_subida,fecha_cita,hora_cita,fase,cliente," +
            "transportista_nombre,status,status_modulado,status_despacho,fecha_registro_ut," +
            "estadia_ut,status_ut,cantidad_skus,peso_tn" +
            "&estado=eq.SUBIDO" +
            (desde ? "&fecha_subida=gte." + encodeURIComponent(new Date(desde + "T00:00:00").toISOString()) : "") +
            "&order=fecha_subida.asc&limit=2000"
        );

        statusPendiente.viajes = viajes || [];
        pintarStatusPendiente();

    }catch(error){

        console.error(error);
        contenido.textContent = "No se pudo cargar Status Pendiente: " + (error.message || error);

    }

}

function celdaStatus(valor){

    if(!valor){
        return "-";
    }

    return '<span class="sp-status ' + (COLORES_STATUS[valor] || "") + '">' + escaparHtml(valor) + '</span>';

}

function fechaHoraSp(valor){

    if(!valor){
        return "-";
    }

    const d = new Date(valor);
    const dos = function(n){ return String(n).padStart(2, "0"); };

    return dos(d.getDate()) + "/" + dos(d.getMonth() + 1) + "/" + d.getFullYear() + " " +
        dos(d.getHours()) + ":" + dos(d.getMinutes()) + ":" + dos(d.getSeconds());

}

function fechaSp(valor){

    if(!valor){
        return "-";
    }

    const partes = String(valor).split("-");
    return partes[2] + "/" + partes[1] + "/" + partes[0];

}

function pintarStatusPendiente(){

    const contenido = document.getElementById("spContenido");
    const texto = limpiarTexto(document.getElementById("spBuscar").value);

    const viajes = statusPendiente.viajes.filter(function(v){
        if(!texto) return true;
        return [v.fo, v.cliente, v.transportista_nombre, v.gestion].some(function(c){
            return limpiarTexto(c).indexOf(texto) !== -1;
        });
    });

    if(viajes.length === 0){
        contenido.className = "cv-vacio";
        contenido.textContent = statusPendiente.viajes.length
            ? "Ningún viaje coincide con la búsqueda."
            : "No hay viajes subidos en estas fechas. Súbelos desde Facturación › Cargar Viaje.";
        return;
    }

    const grupos = {};

    viajes.forEach(function(v){
        const g = v.gestion || "SIN GESTIÓN";
        (grupos[g] = grupos[g] || []).push(v);
    });

    const nombres = Object.keys(grupos).sort(function(a, b){
        const ia = ORDEN_GESTIONES.indexOf(a), ib = ORDEN_GESTIONES.indexOf(b);
        return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib) || a.localeCompare(b);
    });

    let total = 0;

    let html =
        '<div class="sp-resumen">' + textoCantidadViajes(viajes.length) + ' subidos</div>' +
        '<div class="sp-contenedor"><table class="sp-tabla"><thead><tr>' +
            '<th>GESTIÓN</th><th>FECHA</th><th>FECHA DE CITA</th><th>HORA DE CITA</th>' +
            '<th>FO REAL</th><th>FASE</th><th>CLIENTE</th><th>TRANSPORTISTA</th>' +
            '<th>STATUS</th><th>ESTATUS DE MODULADO</th><th>STATUS DE DESPACHO</th>' +
            '<th>FECHA Y HORA DE REGISTRO UT</th><th>ESTADÍA UT</th><th>STATUS UT</th>' +
            '<th>CANTIDAD SKU\'S</th><th>PESO TN</th>' +
        '</tr></thead><tbody>';

    nombres.forEach(function(gestion){

        let subtotal = 0;

        grupos[gestion].forEach(function(v, i){

            const peso = Number(v.peso_tn) || 0;
            subtotal += peso;

            html +=
                '<tr>' +
                    '<td class="sp-izq sp-gestion">' + (i === 0 ? escaparHtml(gestion) : "") + '</td>' +
                    '<td>' + fechaHoraSp(v.fecha_subida) + '</td>' +
                    '<td>' + fechaSp(v.fecha_cita) + '</td>' +
                    '<td>' + (v.hora_cita ? escaparHtml(String(v.hora_cita).slice(0, 5)) : "-") + '</td>' +
                    '<td>' + escaparHtml(v.fo) + '</td>' +
                    '<td>' + (v.fase ? escaparHtml(v.fase) : "-") + '</td>' +
                    '<td class="sp-izq">' + escaparHtml(v.cliente) + '</td>' +
                    '<td class="sp-izq">' + escaparHtml(v.transportista_nombre) + '</td>' +
                    '<td>' + celdaStatus(v.status) + '</td>' +
                    '<td>' + celdaStatus(v.status_modulado) + '</td>' +
                    '<td>' + celdaStatus(v.status_despacho) + '</td>' +
                    '<td>' + fechaHoraSp(v.fecha_registro_ut) + '</td>' +
                    '<td>' + (v.estadia_ut ? escaparHtml(v.estadia_ut) : "-") + '</td>' +
                    '<td>' + celdaStatus(v.status_ut) + '</td>' +
                    '<td class="sp-num">' + (v.cantidad_skus === null || v.cantidad_skus === undefined ? "-" : v.cantidad_skus) + '</td>' +
                    '<td class="sp-num">' + peso.toFixed(3) + '</td>' +
                '</tr>';

        });

        total += subtotal;

        html +=
            '<tr class="sp-total">' +
                '<td class="sp-izq" colspan="15">Total ' + escaparHtml(gestion) + '</td>' +
                '<td class="sp-num">' + subtotal.toFixed(3) + '</td>' +
            '</tr>';

    });

    html +=
        '<tr class="sp-suma">' +
            '<td class="sp-izq" colspan="15">Suma total</td>' +
            '<td class="sp-num">' + total.toFixed(3) + '</td>' +
        '</tr>' +
        '</tbody></table></div>';

    contenido.className = "";
    contenido.innerHTML = html;

}

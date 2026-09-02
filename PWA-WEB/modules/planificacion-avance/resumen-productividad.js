// =========================================================
// RESUMEN DE PRODUCTIVIDAD - UI
// =========================================================

let prodDatosActual = null; // último resultado de obtenerResumenProductividad, para no re-pedir al cambiar la función

function abrirResumenProductividad(){

    document.getElementById("modProductividad").style.display = "flex";

    const desdeInput = document.getElementById("prodDesde");
    const hastaInput = document.getElementById("prodHasta");

    if(!desdeInput.value){
        desdeInput.value = DD_HISTORICO_DESDE; // mismo arranque que Diálogo Diario (agosto 2026)
    }

    if(!hastaInput.value){
        const hoy = new Date();
        hastaInput.value = hoy.getFullYear() + "-" +
            String(hoy.getMonth() + 1).padStart(2, "0") + "-" +
            String(hoy.getDate()).padStart(2, "0");
    }

    cargarResumenProductividad();

}

function prodFilaTop(f, i){
    return "<tr>" +
        "<td class=\"prod-pos\">" + (i + 1) + "</td>" +
        "<td>" + (f.auxiliar || "").toUpperCase() + "</td>" +
        "<td class=\"prod-tn\">" + f.dias + "</td>" +
        "<td class=\"prod-tn\">" + f.tnTotal.toFixed(2) + " TN</td>" +
        "<td class=\"prod-tn prod-promedio\">" + f.promedio.toFixed(2) + " TN/día</td>" +
        "</tr>";
}

function renderizarTablaProductividad(){

    const tbody = document.getElementById("prodTabla");

    if(!prodDatosActual){
        return;
    }

    const funcion = document.getElementById("prodFuncion").value;
    const top = prodTopPorFuncion(prodDatosActual, funcion);

    tbody.innerHTML = top.length
        ? top.map(prodFilaTop).join("")
        : '<tr><td colspan="5" class="dd-tabla-vacio">Sin datos de ' + funcion + ' en ese rango.</td></tr>';

}

async function cargarResumenProductividad(){

    const desde = document.getElementById("prodDesde").value;
    const hasta = document.getElementById("prodHasta").value;

    const aviso = document.getElementById("prodAviso");
    const tbody = document.getElementById("prodTabla");

    aviso.style.display = "none";
    aviso.textContent = "";

    if(!desde || !hasta){
        aviso.textContent = "Selecciona la fecha de inicio y de fin.";
        aviso.style.display = "block";
        return;
    }

    if(desde > hasta){
        aviso.textContent = "La fecha de inicio no puede ser posterior a la de fin.";
        aviso.style.display = "block";
        return;
    }

    tbody.innerHTML = '<tr><td colspan="5" class="dd-tabla-vacio">Cargando...</td></tr>';

    try{

        prodDatosActual = await obtenerResumenProductividad(desde, hasta);
        renderizarTablaProductividad();

    }catch(e){

        console.error("Resumen de Productividad — error:", e);

        aviso.textContent = "No se pudo cargar el resumen de productividad.";
        aviso.style.display = "block";

        prodDatosActual = null;
        tbody.innerHTML = '<tr><td colspan="5" class="dd-tabla-vacio">—</td></tr>';

    }

}

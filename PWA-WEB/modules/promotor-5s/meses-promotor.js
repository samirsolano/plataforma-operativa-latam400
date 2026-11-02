// ========================================
// MES DE LOS PROMOTORES 5S
// Los promotores salen de la carga mensual ("colaboradores_mensual"),
// no de una lista fija: así, apenas se sube el Excel de un mes nuevo
// en "Carga Mensual", ya aparece acá. El mes elegido viaja en la URL
// (?mes=Noviembre 2026) para que los tableros muestren el mismo mes.
// ========================================

const NOMBRES_MES_PROMOTOR = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
];

// "Noviembre 2026" -> 202610, para ordenar los meses cronológicamente.
function claveOrdenMes(mes){

    const partes = String(mes || "").trim().split(/\s+/);
    const indice = NOMBRES_MES_PROMOTOR.findIndex(
        n => n.toLowerCase() === (partes[0] || "").toLowerCase()
    );
    const anio = parseInt(partes[1], 10) || 0;

    return anio * 100 + (indice < 0 ? 0 : indice);

}

function nombreMesHoy(){

    const hoy = new Date();
    return NOMBRES_MES_PROMOTOR[hoy.getMonth()] + " " + hoy.getFullYear();

}

// Meses que tienen carga en la base, del más reciente al más antiguo.
async function obtenerMesesCargados(){

    const filas = await checklistFetch("/colaboradores_mensual?select=mes");

    const meses = Array.from(new Set(
        (filas || []).map(f => f.mes).filter(Boolean)
    ));

    return meses.sort((a, b) => claveOrdenMes(b) - claveOrdenMes(a));

}

function mesDeLaUrl(){
    return new URLSearchParams(window.location.search).get("mes") || "";
}

// Prioridad: el de la URL, luego el mes en curso, luego el último cargado.
function elegirMesInicial(meses){

    const deUrl = mesDeLaUrl();

    if(deUrl && meses.includes(deUrl)){
        return deUrl;
    }

    const hoy = nombreMesHoy();

    if(meses.includes(hoy)){
        return hoy;
    }

    return meses[0] || "";

}

// Llena el <select>, deja elegido el mes inicial y llama a alCambiar
// cada vez que cambia (también la primera vez). Devuelve el mes inicial.
async function iniciarSelectorMes(selector, alCambiar){

    const meses = await obtenerMesesCargados();

    selector.innerHTML = "";

    if(!meses.length){
        selector.innerHTML = '<option value="">Sin meses cargados</option>';
        selector.disabled = true;
        alCambiar("");
        return "";
    }

    meses.forEach(function(mes){

        const opcion = document.createElement("option");
        opcion.value = mes;
        opcion.textContent = mes;

        selector.appendChild(opcion);

    });

    selector.value = elegirMesInicial(meses);

    selector.addEventListener("change", function(){

        const url = new URL(window.location.href);
        url.searchParams.set("mes", selector.value);
        window.history.replaceState(null, "", url);

        alCambiar(selector.value);

    });

    alCambiar(selector.value);

    return selector.value;

}

// Promotores del mes: un registro por zona + pasillo + turno.
async function obtenerPromotoresDelMes(mes, orden){

    if(!mes){
        return [];
    }

    return await checklistFetch(
        "/colaboradores_mensual?select=id,zona,pasillo,turno,dni,nombre,supervisor&mes=eq." +
        encodeURIComponent(mes) +
        "&order=" + orden
    ) || [];

}

// Lleva el mes elegido a otra página del módulo (tableros / volver).
function urlConMes(pagina, mes){
    return mes ? pagina + "?mes=" + encodeURIComponent(mes) : pagina;
}

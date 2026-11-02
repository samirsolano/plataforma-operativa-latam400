// ========================================
// SESIÓN Y PERMISOS
// ========================================

const sesion = requerirSesion();

if(sesion && !tienePermiso(sesion, "checklist-5s", "promotor-5s")){
    window.location.href = "../inicio/home.html";
}

if(sesion){
    document.getElementById("nombreUsuario").textContent = sesion.nombre_completo;
    document.getElementById("rolUsuario").textContent = sesion.rol;
}

const btnPerfil = document.getElementById("btnPerfil");
const menuUsuario = document.getElementById("menuUsuario");

btnPerfil.addEventListener("click", function(e){

    e.stopPropagation();

    if(menuUsuario.style.display === "block"){
        menuUsuario.style.display = "none";
    }else{
        menuUsuario.style.display = "block";
    }

});

document.addEventListener("click", function(){
    menuUsuario.style.display = "none";
});

document.getElementById("btnCerrarSesion").addEventListener("click", function(e){

    e.preventDefault();
    e.stopPropagation();
    cerrarSesion();

});

document.getElementById("btnVerTablero").addEventListener("click", function(){
    window.location.href = urlConMes("tablero.html", selectorMes.value);
});

document.getElementById("btnVerEquipoCompleto").addEventListener("click", function(){
    window.location.href = urlConMes("tablero-equipo.html", selectorMes.value);
});

// ========================================
// ETIQUETAS DE TURNO
// ========================================

const ETIQUETAS_TURNO = {
    DIA: "DÍA (1er turno)",
    INTERMEDIO: "INTERMEDIO (2do turno)",
    NOCHE: "NOCHE (3er turno)"
};

// ========================================
// LISTAR (según el mes elegido arriba)
// ========================================

const selectorMes = document.getElementById("selectorMes");
const resumenMes = document.getElementById("resumenMes");
const tblPromotores = document.getElementById("tblPromotores");
const mensajeVacio = document.getElementById("mensajeVacio");
const buscador = document.getElementById("buscador");
const filtroZona = document.getElementById("filtroZona");
const filtroTurno = document.getElementById("filtroTurno");

let promotoresCargados = [];

async function cargarPromotores(mes){

    tblPromotores.innerHTML = "";
    resumenMes.textContent = "";
    mensajeVacio.textContent = "Cargando promotores...";
    mensajeVacio.style.display = "block";

    if(!mes){
        promotoresCargados = [];
        mensajeVacio.textContent = "Todavía no hay meses cargados. Sube el Excel del mes en \"Carga Mensual\".";
        return;
    }

    try{

        promotoresCargados = await obtenerPromotoresDelMes(
            mes, "zona.asc,pasillo.asc,turno.asc"
        );

        resumenMes.textContent = promotoresCargados.length + " promotores en " + mes;

        llenarFiltroZona(promotoresCargados);
        aplicarFiltros();

    }catch(e){

        console.error(e);
        mensajeVacio.textContent = "No se pudo cargar la lista de promotores.";
        mensajeVacio.style.display = "block";

    }

}

function llenarFiltroZona(lista){

    const seleccionActual = filtroZona.value;

    const zonas = Array.from(new Set(
        lista.map(p => p.zona).filter(Boolean)
    )).sort();

    filtroZona.innerHTML = '<option value="">Zona (todas)</option>';

    zonas.forEach(function(zona){

        const opcion = document.createElement("option");
        opcion.value = zona;
        opcion.textContent = zona;

        filtroZona.appendChild(opcion);

    });

    filtroZona.value = zonas.includes(seleccionActual) ? seleccionActual : "";

}

function renderizarPromotores(lista){

    tblPromotores.innerHTML = "";
    mensajeVacio.style.display = "none";

    if(!lista || !lista.length){
        mensajeVacio.textContent = "No hay promotores 5S para este mes.";
        mensajeVacio.style.display = "block";
        return;
    }

    lista.forEach(function(p){

        const tr = document.createElement("tr");

        tr.innerHTML = `
            <td>${p.zona || "-"}</td>
            <td>${p.pasillo || "-"}</td>
            <td>${p.dni}</td>
            <td>${p.nombre}</td>
            <td>${ETIQUETAS_TURNO[p.turno] || p.turno || "-"}</td>
            <td>${p.supervisor || "-"}</td>
        `;

        tblPromotores.appendChild(tr);

    });

}

function aplicarFiltros(){

    const termino = buscador.value.trim().toLowerCase();
    const zona = filtroZona.value;
    const turno = filtroTurno.value;

    const filtrados = promotoresCargados.filter(function(p){

        const coincideTexto = !termino ||
            p.dni.toLowerCase().includes(termino) ||
            p.nombre.toLowerCase().includes(termino);

        const coincideZona = !zona || p.zona === zona;
        const coincideTurno = !turno || p.turno === turno;

        return coincideTexto && coincideZona && coincideTurno;

    });

    renderizarPromotores(filtrados);

}

buscador.addEventListener("input", aplicarFiltros);
filtroZona.addEventListener("change", aplicarFiltros);
filtroTurno.addEventListener("change", aplicarFiltros);

// ========================================
// INICIO
// ========================================

if(sesion && tienePermiso(sesion, "checklist-5s", "promotor-5s")){

    iniciarSelectorMes(selectorMes, cargarPromotores).catch(function(e){

        console.error(e);
        mensajeVacio.textContent = "No se pudo cargar la lista de meses.";
        mensajeVacio.style.display = "block";

    });

}

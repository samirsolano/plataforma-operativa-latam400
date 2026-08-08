// ========================================
// SESIÓN
// ========================================

const sesion = requerirSesion();

if(sesion){

    document.getElementById("nombreUsuario").textContent = sesion.nombre_completo;
    document.getElementById("rolUsuario").textContent = sesion.rol;

    if(sesion.rol !== "Administrador" && sesion.rol !== "Supervisor"){
        document.getElementById("linkCargaMensual").style.display = "none";
        document.getElementById("linkColaboradoresActivos").style.display = "none";
        document.getElementById("linkFotosColaboradores").style.display = "none";
        document.getElementById("linkPreguntasChecklist").style.display = "none";
    }

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
// ZONAS CONOCIDAS
// ========================================

const ZONAS_5S = ["Zona 1", "Zona 2", "Zona 3", "Zona 4", "Zona 5", "Zona 6"];

const NOMBRES_5S = {
    "1S": "Seiri (Clasificar)",
    "2S": "Seiton (Ordenar)",
    "3S": "Seiso (Limpiar)",
    "4S": "Seiketsu (Estandarizar)",
    "5S": "Shitsuke (Disciplina)"
};

// ========================================
// FILTROS
// ========================================

const inputFecha = document.getElementById("selectFecha");
const selectTurno = document.getElementById("selectTurno");
const btnActualizar = document.getElementById("btnActualizar");
const mensajeCarga = document.getElementById("mensajeCarga");
const contenidoDashboard = document.getElementById("contenidoDashboard");

function fechaHoyISO(){

    const ahora = new Date();
    const offset = ahora.getTimezoneOffset() * 60000;

    return new Date(ahora.getTime() - offset).toISOString().slice(0, 10);

}

// Turno real "ahora mismo", según el rol semanal de 3 turnos
// (mismo cálculo que usa Centro de Proyectos LATAM en auditoria.js,
// portado del Apps Script obtenerTurnoBD). No siempre es un simple
// corte de hora: por ejemplo el turno Intermedio cubre viernes de
// día, sábado de día, domingo de noche y lunes de noche.
function calcularTurnoActual(){

    const ahora = new Date();
    const dia = ahora.getDay();
    const hora = ahora.getHours();
    const esDia = hora >= 7 && hora < 19;

    if(dia === 0) return esDia ? "" : "INTERMEDIO";     // Domingo
    if(dia === 1) return esDia ? "DIA" : "INTERMEDIO";  // Lunes
    if(dia === 2) return esDia ? "DIA" : "NOCHE";        // Martes
    if(dia === 3) return esDia ? "DIA" : "NOCHE";        // Miércoles
    if(dia === 4) return esDia ? "DIA" : "NOCHE";        // Jueves
    if(dia === 5) return esDia ? "INTERMEDIO" : "NOCHE"; // Viernes
    if(dia === 6) return esDia ? "INTERMEDIO" : "";      // Sábado

    return "";

}

inputFecha.value = fechaHoyISO();

const turnoActualReal = calcularTurnoActual();

if(turnoActualReal){
    selectTurno.value = turnoActualReal;
}

btnActualizar.addEventListener("click", cargarDashboard);
inputFecha.addEventListener("change", cargarDashboard);
selectTurno.addEventListener("change", cargarDashboard);

// Estado de las listas "ver más" (se resetea en cada carga).
let mostrarTodasAuditorias = false;
let mostrarTodosHallazgos = false;
let mostrarTodasEvidencias = false;

document.getElementById("btnVerAuditorias").addEventListener("click", function(){
    mostrarTodasAuditorias = !mostrarTodasAuditorias;
    pintarUltimasAuditorias(ultimaCabeceraDia);
});

document.getElementById("btnVerHallazgos").addEventListener("click", function(){
    mostrarTodosHallazgos = !mostrarTodosHallazgos;
    pintarTopHallazgos(ultimoDetalleDia);
});

document.getElementById("btnVerEvidencias").addEventListener("click", function(){
    mostrarTodasEvidencias = !mostrarTodasEvidencias;
    pintarEvidencias(ultimoDetalleDia, ultimaCabeceraDia);
});

let ultimaCabeceraDia = [];
let ultimoDetalleDia = [];

// ========================================
// CARGA PRINCIPAL
// ========================================

async function cargarDashboard(){

    mensajeCarga.style.display = "block";
    mensajeCarga.textContent = "Cargando datos del Sheet...";
    contenidoDashboard.classList.add("oculto");

    try{

        const [cabecera, detalle, colaboradores] = await Promise.all([
            leerHojaCSV("CABECERA_AUDITORIA"),
            leerHojaCSV("DETALLE_AUDITORIA"),
            leerHojaCSV("COLABORADORES")
        ]);

        const fechaSeleccionada = inputFecha.value;
        const turnoSeleccionado = selectTurno.value;

        const cabeceraDia = cabecera.filter(function(r){

            return fechaSheetAISO(r.FECHA) === fechaSeleccionada &&
                normalizarTurno5S(r.TURNO) === turnoSeleccionado;

        });

        const idsDia = new Set(cabeceraDia.map(r => r.ID_AUDITORIA));

        const detalleDia = detalle.filter(r => idsDia.has(r.ID_AUDITORIA));

        const colaboradoresTurno = colaboradores.filter(
            r => normalizarTurno5S(r.TURNO) === turnoSeleccionado
        );

        ultimaCabeceraDia = cabeceraDia;
        ultimoDetalleDia = detalleDia;
        mostrarTodasAuditorias = false;
        mostrarTodosHallazgos = false;
        mostrarTodasEvidencias = false;

        pintarKPIs(cabeceraDia, colaboradoresTurno);
        pintarAvancePorZona(cabeceraDia, colaboradoresTurno);
        pintarUltimasAuditorias(cabeceraDia);
        pintarPendientes(cabeceraDia, colaboradoresTurno);
        pintarTopHallazgos(detalleDia);
        pintarResultado5S(detalleDia);
        pintarEvidencias(detalleDia, cabeceraDia);
        pintarFooter(cabeceraDia, colaboradoresTurno);

        document.getElementById("lblUltimaActualizacion").textContent =
            new Date().toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" });

        mensajeCarga.style.display = "none";
        contenidoDashboard.classList.remove("oculto");

    }catch(error){

        console.error(error);

        mensajeCarga.textContent =
            "No se pudo cargar el Sheet. Verifique que siga público y vuelva a intentar.";

    }

}

// ========================================
// PASILLOS DISTINTOS AUDITADOS
// ========================================
// Un mismo pasillo puede tener varios registros (reintentos).
// Para "cuántos checklist están hechos" contamos pasillos
// distintos, no filas crudas de CABECERA_AUDITORIA.

function clavePasillo(r){
    return normalizarZona5S(r.ZONA) + "||" + String(r.PASILLO || "").trim();
}

function pasillosDistintos(filas){
    return new Set(filas.map(clavePasillo));
}

// ========================================
// KPIs
// ========================================

function pintarKPIs(cabeceraDia, colaboradoresTurno){

    const programados = colaboradoresTurno.length;
    const ejecutados = pasillosDistintos(cabeceraDia).size;
    const pendientes = Math.max(programados - ejecutados, 0);
    const avanceGeneral = programados ? Math.round((ejecutados / programados) * 100) : 0;

    const terminadosAntes10 = pasillosDistintos(
        cabeceraDia.filter(r => horaAntesDe10AM(r.HORA_FIN))
    ).size;
    const pendientesA10 = Math.max(programados - terminadosAntes10, 0);
    const cumplimiento10 = programados ? Math.round((terminadosAntes10 / programados) * 100) : 0;

    document.getElementById("lblProgramados").textContent = programados;
    document.getElementById("lblEjecutados").textContent = ejecutados;
    document.getElementById("lblEjecutadosPct").textContent =
        (programados ? Math.round((ejecutados / programados) * 100) : 0) + "% del total";

    document.getElementById("lblPendientes").textContent = pendientes;
    document.getElementById("lblPendientesPct").textContent =
        (programados ? Math.round((pendientes / programados) * 100) : 0) + "% del total";

    document.getElementById("lblCumplimientoPct").textContent = cumplimiento10 + "%";
    document.getElementById("lblTerminadosAntes").textContent = terminadosAntes10;
    document.getElementById("lblPendientesA10").textContent = pendientesA10;
    document.getElementById("lblMetaCumplimiento").textContent = programados;

    pintarAnilloDonut("donutCumplimiento", cumplimiento10, "#f59e0b");

    document.getElementById("lblAvanceGeneralPct").textContent = avanceGeneral + "%";
    document.getElementById("lblAvanceTerminados").textContent = ejecutados;
    document.getElementById("lblAvancePendientes").textContent = pendientes;

    pintarAnilloDonut("donutAvance", avanceGeneral, colorPorPorcentaje(avanceGeneral));

}

// Anillo SVG: circunferencia = 2 * PI * r (r=42 en el viewBox 0 0 100 100).
const CIRCUNFERENCIA_DONUT = 2 * Math.PI * 42;

function pintarAnilloDonut(id, porcentaje, color){

    const circulo = document.getElementById(id);
    const avance = Math.max(0, Math.min(100, porcentaje));
    const offset = CIRCUNFERENCIA_DONUT * (1 - avance / 100);

    circulo.style.setProperty("--color", color);
    circulo.style.strokeDasharray = CIRCUNFERENCIA_DONUT;
    circulo.style.strokeDashoffset = offset;

}

function colorPorPorcentaje(pct){

    if(pct >= 80) return "#16a34a";
    if(pct >= 60) return "#f59e0b";
    return "#dc2626";

}

// ========================================
// AVANCE POR ZONA
// ========================================

function pintarAvancePorZona(cabeceraDia, colaboradoresTurno){

    const tbody = document.getElementById("tblAvanceZona");
    tbody.innerHTML = "";

    const filas = ZONAS_5S.map(function(zona){

        const totalZona = colaboradoresTurno.filter(
            r => normalizarZona5S(r.ZONA) === zona
        ).length;

        const auditadosZona = pasillosDistintos(
            cabeceraDia.filter(r => normalizarZona5S(r.ZONA) === zona)
        ).size;

        const pendientesZona = Math.max(totalZona - auditadosZona, 0);
        const avanceZona = totalZona ? Math.round((auditadosZona / totalZona) * 100) : 0;

        return { zona, totalZona, auditadosZona, pendientesZona, avanceZona };

    }).filter(z => z.totalZona > 0);

    if(!filas.length){
        tbody.innerHTML = `<tr><td colspan="4" class="sin-datos">Sin colaboradores para este turno.</td></tr>`;
        return;
    }

    filas.forEach(function(f){

        const tr = document.createElement("tr");

        tr.innerHTML = `
            <td>${f.zona}</td>
            <td>${f.auditadosZona} / ${f.totalZona}</td>
            <td>${f.pendientesZona}</td>
            <td>
                <div class="barra-avance">
                    <div class="barra-avance-relleno" style="width:${f.avanceZona}%; background:${colorPorPorcentaje(f.avanceZona)};"></div>
                </div>
            </td>
        `;

        tbody.appendChild(tr);

    });

    const totalAuditados = filas.reduce((acc, f) => acc + f.auditadosZona, 0);
    const totalZonas = filas.reduce((acc, f) => acc + f.totalZona, 0);
    const totalPendientesZ = filas.reduce((acc, f) => acc + f.pendientesZona, 0);
    const totalAvance = totalZonas ? Math.round((totalAuditados / totalZonas) * 100) : 0;

    document.getElementById("lblTotalAuditados").textContent = totalAuditados + " / " + totalZonas;
    document.getElementById("lblTotalPendientesZona").textContent = totalPendientesZ;
    document.getElementById("lblTotalAvance").textContent = totalAvance + "%";

}

// ========================================
// ÚLTIMAS AUDITORÍAS
// ========================================

function pintarUltimasAuditorias(cabeceraDia){

    const tbody = document.getElementById("tblUltimasAuditorias");
    const btnVer = document.getElementById("btnVerAuditorias");
    tbody.innerHTML = "";

    if(!cabeceraDia.length){
        tbody.innerHTML = `<tr><td colspan="5" class="sin-datos">No hay auditorías registradas para este filtro.</td></tr>`;
        btnVer.style.display = "none";
        return;
    }

    const todasOrdenadas = [...cabeceraDia].sort(
        (a, b) => (b.ID_AUDITORIA || "").localeCompare(a.ID_AUDITORIA || "")
    );

    const ordenadas = mostrarTodasAuditorias ? todasOrdenadas : todasOrdenadas.slice(0, 8);

    btnVer.style.display = todasOrdenadas.length > 8 ? "block" : "none";
    btnVer.textContent = mostrarTodasAuditorias
        ? "Ver menos ↑"
        : "Ver todas las auditorías (" + todasOrdenadas.length + ") →";

    ordenadas.forEach(function(r){

        const tr = document.createElement("tr");
        const aprobado = String(r.RESULTADO || "").trim().toUpperCase() === "APROBADO";

        tr.innerHTML = `
            <td>${r.HORA_FIN || "-"}</td>
            <td>${normalizarZona5S(r.ZONA)}</td>
            <td>${r.PASILLO || "-"}</td>
            <td>${r.NOMBRE || "-"}</td>
            <td>
                <span class="badge ${aprobado ? "aprobado" : "no-aprobado"}">
                    ${r.PORCENTAJE || 0}% <span class="icono ${aprobado ? "icono-check-green" : "icono-alert-amber"}"></span>
                </span>
            </td>
        `;

        tbody.appendChild(tr);

    });

}

// ========================================
// CHECKLIST PENDIENTES
// ========================================

function pintarPendientes(cabeceraDia, colaboradoresTurno){

    const cont = document.getElementById("contPendientes");
    cont.innerHTML = "";

    let totalPendientes = 0;

    ZONAS_5S.forEach(function(zona){

        const colabsZona = colaboradoresTurno.filter(
            r => normalizarZona5S(r.ZONA) === zona
        );

        if(!colabsZona.length){
            return;
        }

        const pasillosAuditados = new Set(
            cabeceraDia
                .filter(r => normalizarZona5S(r.ZONA) === zona)
                .map(r => String(r.PASILLO || "").trim())
        );

        const pendientesZona = colabsZona.filter(
            r => !pasillosAuditados.has(String(r.PASILLO || "").trim())
        );

        if(!pendientesZona.length){
            return;
        }

        totalPendientes += pendientesZona.length;

        const bloque = document.createElement("div");
        bloque.className = "zona-pendiente";

        let html = `
            <div class="zona-pendiente-titulo">
                <span>${zona}</span>
                <span class="cantidad">${pendientesZona.length}</span>
            </div>
        `;

        pendientesZona.slice(0, 5).forEach(function(p){
            html += `<div class="item-pendiente">${p.PASILLO || "-"} — ${p.NOMBRE || "-"}</div>`;
        });

        if(pendientesZona.length > 5){
            html += `<div class="item-pendiente">+ ${pendientesZona.length - 5} más...</div>`;
        }

        bloque.innerHTML = html;
        cont.appendChild(bloque);

    });

    if(!totalPendientes){
        cont.innerHTML = `<p class="sin-datos"><span class="icono icono-check-green"></span> Todos los checklist del turno fueron completados.</p>`;
    }

    document.getElementById("lblTotalPendientes").textContent = totalPendientes;

}

// ========================================
// TOP HALLAZGOS
// ========================================

function pintarTopHallazgos(detalleDia){

    const tbody = document.getElementById("tblTopHallazgos");
    const btnVer = document.getElementById("btnVerHallazgos");
    tbody.innerHTML = "";

    const conteo = {};

    detalleDia.forEach(function(r){

        if(String(r.CUMPLE || "").trim().toUpperCase() === "NO"){

            const pregunta = String(r.PREGUNTA || "").trim();
            conteo[pregunta] = (conteo[pregunta] || 0) + 1;

        }

    });

    const todosOrdenados = Object.entries(conteo).sort((a, b) => b[1] - a[1]);

    if(!todosOrdenados.length){
        tbody.innerHTML = `<tr><td colspan="3" class="sin-datos">Sin hallazgos registrados.</td></tr>`;
        btnVer.style.display = "none";
        return;
    }

    const top = mostrarTodosHallazgos ? todosOrdenados : todosOrdenados.slice(0, 5);

    btnVer.style.display = todosOrdenados.length > 5 ? "block" : "none";
    btnVer.textContent = mostrarTodosHallazgos
        ? "Ver menos ↑"
        : "Ver todos los hallazgos (" + todosOrdenados.length + ") →";

    top.forEach(function([pregunta, cantidad], index){

        const tr = document.createElement("tr");

        tr.innerHTML = `
            <td>${index + 1}</td>
            <td>${pregunta}</td>
            <td>${cantidad}</td>
        `;

        tbody.appendChild(tr);

    });

}

// ========================================
// RESULTADO POR 5S
// ========================================

function pintarResultado5S(detalleDia){

    const cont = document.getElementById("cont5S");
    cont.innerHTML = "";

    Object.keys(NOMBRES_5S).forEach(function(s){

        const filas = detalleDia.filter(r => String(r.S || "").trim() === s);

        const cumpleSi = filas.filter(
            r => String(r.CUMPLE || "").trim().toUpperCase() === "SI"
        ).length;

        const pct = filas.length ? Math.round((cumpleSi / filas.length) * 100) : 0;

        const fila = document.createElement("div");
        fila.className = "fila-5s";

        const claseIcono = pct >= 80 ? "icono-check-green" : pct >= 60 ? "icono-alert-amber" : "icono-alert-red";

        fila.innerHTML = `
            <div class="etiqueta-5s"><span class="icono ${claseIcono}"></span> ${NOMBRES_5S[s]}</div>
            <div class="barra-5s">
                <div class="relleno-5s" style="width:${pct}%; background:${colorPorPorcentaje(pct)};"></div>
            </div>
            <div class="valor-5s">${pct}%</div>
        `;

        cont.appendChild(fila);

    });

}

// ========================================
// EVIDENCIAS
// ========================================

function idDriveDesdeLink(link){

    const match = String(link || "").match(/[-\w]{25,}/);
    return match ? match[0] : null;

}

function pintarEvidencias(detalleDia, cabeceraDia){

    const cont = document.getElementById("contEvidencias");
    const btnVer = document.getElementById("btnVerEvidencias");
    cont.innerHTML = "";

    const cabeceraPorId = {};
    cabeceraDia.forEach(r => cabeceraPorId[r.ID_AUDITORIA] = r);

    const todasConFoto = detalleDia.filter(
        r => r.LINK_FOTO && String(r.LINK_FOTO).trim() !== ""
    );

    const conFoto = mostrarTodasEvidencias ? todasConFoto : todasConFoto.slice(0, 4);

    if(!todasConFoto.length){
        cont.innerHTML = `<p class="sin-datos">Sin evidencias fotográficas registradas.</p>`;
        btnVer.style.display = "none";
        return;
    }

    btnVer.style.display = todasConFoto.length > 4 ? "block" : "none";
    btnVer.textContent = mostrarTodasEvidencias
        ? "Ver menos ↑"
        : "Ver todas las evidencias (" + todasConFoto.length + ") →";

    conFoto.forEach(function(r){

        const idDrive = idDriveDesdeLink(r.LINK_FOTO);

        if(!idDrive){
            return;
        }

        const cab = cabeceraPorId[r.ID_AUDITORIA] || {};
        const url = "https://drive.google.com/thumbnail?id=" + idDrive + "&sz=w400";

        const div = document.createElement("div");
        div.className = "evidencia";

        div.innerHTML = `
            <img src="${url}" alt="Evidencia ${r.S || ""}" loading="lazy">
            <div class="evidencia-etiqueta">
                ${normalizarZona5S(cab.ZONA)} · ${cab.PASILLO || ""} · ${r.S || ""}
            </div>
        `;

        cont.appendChild(div);

    });

    if(!cont.children.length){
        cont.innerHTML = `<p class="sin-datos">Sin evidencias fotográficas registradas.</p>`;
    }

}

// ========================================
// FOOTER RESUMEN
// ========================================

function pintarFooter(cabeceraDia, colaboradoresTurno){

    const programados = colaboradoresTurno.length;
    const ejecutados = pasillosDistintos(cabeceraDia).size;
    const pendientes = Math.max(programados - ejecutados, 0);
    const avanceGeneral = programados ? Math.round((ejecutados / programados) * 100) : 0;

    const terminadosAntes10 = pasillosDistintos(
        cabeceraDia.filter(r => horaAntesDe10AM(r.HORA_FIN))
    ).size;
    const cumplimiento10 = programados ? Math.round((terminadosAntes10 / programados) * 100) : 0;

    document.getElementById("footMeta").textContent = programados;
    document.getElementById("footEjecutados").textContent = ejecutados;
    document.getElementById("footPendientes").textContent = pendientes;
    document.getElementById("footCumplimiento").textContent = cumplimiento10 + "%";
    document.getElementById("footAvance").textContent = avanceGeneral + "%";

    const barra = document.getElementById("footBarraRelleno");
    barra.style.width = avanceGeneral + "%";
    barra.style.background = colorPorPorcentaje(avanceGeneral);

}

// ========================================
// INICIO
// ========================================

if(sesion){
    cargarDashboard();
}

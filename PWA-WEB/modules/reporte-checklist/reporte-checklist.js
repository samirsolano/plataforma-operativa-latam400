// ========================================
// SESIÓN
// ========================================

const sesion = requerirSesion();

if(sesion && sesion.rol !== "Administrador" && sesion.rol !== "Supervisor"){
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
// ZONAS / CUADRILLAS CONOCIDAS
// ========================================

const ZONAS_5S = ["Zona 1", "Zona 2", "Zona 3", "Zona 4", "Zona 5", "Zona 6"];
const CUADRILLAS = ["DIA", "NOCHE", "INTERMEDIO"];

const NOMBRE_CUADRILLA = {
    DIA: "Equipo Día",
    NOCHE: "Equipo Noche",
    INTERMEDIO: "Equipo Intermedio"
};

function normalizarNombre(n){
    return String(n || "").trim().toUpperCase();
}

function construirMapaSupervisores(colaboradoresSupabase){

    const mapa = {};

    (colaboradoresSupabase || []).forEach(function(c){
        if(c.nombre){
            mapa[normalizarNombre(c.nombre)] = c.supervisor || "Sin asignar";
        }
    });

    return mapa;

}

// Anillo SVG: circunferencia = 2 * PI * r (r=42 en el viewBox 0 0 100 100).
const CIRCUNFERENCIA_DONUT = 2 * Math.PI * 42;

function pintarAnilloDonut(id, porcentaje, color){

    const circulo = document.getElementById(id);
    if(!circulo){ return; }

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
// CUADRILLA REAL POR FECHA (rol de 3 turnos, igual que Check List
// Diario — auditoria.js en Centro de Proyectos y checklist-diario.js
// acá mismo, portado del Apps Script obtenerTurnoBD).
// ========================================

function diaSemanaDesdeFechaISO(fechaISO){
    const partes = fechaISO.split("-").map(Number);
    return new Date(partes[0], partes[1] - 1, partes[2]).getDay();
}

function calcularCuadrillaReal(fechaISO, esDia){

    const dia = diaSemanaDesdeFechaISO(fechaISO);

    if(dia === 0) return esDia ? "" : "INTERMEDIO";
    if(dia === 1) return esDia ? "DIA" : "INTERMEDIO";
    if(dia === 2) return esDia ? "DIA" : "NOCHE";
    if(dia === 3) return esDia ? "DIA" : "NOCHE";
    if(dia === 4) return esDia ? "DIA" : "NOCHE";
    if(dia === 5) return esDia ? "INTERMEDIO" : "NOCHE";
    if(dia === 6) return esDia ? "INTERMEDIO" : "";

    return "";

}

// Un mismo pasillo puede tener varios registros (reintentos) — para
// "cuántos están hechos" se cuentan pasillos distintos, no filas.
function clavePasillo(r){
    return normalizarZona5S(r.ZONA) + "||" + normalizarPasillo5S(r.PASILLO);
}

function pasillosDistintos(filas){
    return new Set(filas.map(clavePasillo));
}

// ========================================
// PERIODO: SEMANA / MES
// ========================================

let modoPeriodo = "semana";

function fechaHoyISO(){
    const ahora = new Date();
    const offset = ahora.getTimezoneOffset() * 60000;
    return new Date(ahora.getTime() - offset).toISOString().slice(0, 10);
}

const inputFechaSemana = document.getElementById("selectFechaSemana");
const inputMes = document.getElementById("selectMes");
const filtroMesDiv = document.getElementById("filtroMes");
const btnPeriodoSemana = document.getElementById("btnPeriodoSemana");
const btnPeriodoMes = document.getElementById("btnPeriodoMes");
const vistaSemana = document.getElementById("vistaSemana");
const vistaMes = document.getElementById("vistaMes");

inputFechaSemana.value = fechaHoyISO();
inputMes.value = fechaHoyISO().slice(0, 7);

btnPeriodoSemana.addEventListener("click", function(){

    modoPeriodo = "semana";
    btnPeriodoSemana.classList.add("activo");
    btnPeriodoMes.classList.remove("activo");
    inputFechaSemana.closest(".filtro").classList.remove("oculto");
    filtroMesDiv.classList.add("oculto");
    vistaSemana.classList.remove("oculto");
    vistaMes.classList.add("oculto");
    cargarReporte();

});

btnPeriodoMes.addEventListener("click", function(){

    modoPeriodo = "mes";
    btnPeriodoMes.classList.add("activo");
    btnPeriodoSemana.classList.remove("activo");
    inputFechaSemana.closest(".filtro").classList.add("oculto");
    filtroMesDiv.classList.remove("oculto");
    vistaMes.classList.remove("oculto");
    vistaSemana.classList.add("oculto");
    cargarReporte();

});

inputFechaSemana.addEventListener("change", cargarReporte);
inputMes.addEventListener("change", cargarReporte);
document.getElementById("btnActualizar").addEventListener("click", cargarReporte);

function aISO(d){
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}

function aDDMM(d){
    return String(d.getDate()).padStart(2, "0") + "/" + String(d.getMonth() + 1).padStart(2, "0");
}

function calcularRango(){

    if(modoPeriodo === "mes"){

        const valor = inputMes.value || fechaHoyISO().slice(0, 7);
        const [y, m] = valor.split("-").map(Number);

        const desde = y + "-" + String(m).padStart(2, "0") + "-01";
        const ultimoDia = new Date(y, m, 0).getDate();
        const hasta = y + "-" + String(m).padStart(2, "0") + "-" + String(ultimoDia).padStart(2, "0");

        const nombreMes = new Date(y, m - 1, 1).toLocaleDateString("es-PE", { month: "long", year: "numeric" });

        return { desde: desde, hasta: hasta, titulo: "Mes de " + nombreMes };

    }

    const fechaBase = inputFechaSemana.value || fechaHoyISO();
    const [y, m, d] = fechaBase.split("-").map(Number);
    const fecha = new Date(y, m - 1, d);

    const diaSemana = fecha.getDay();
    const offsetLunes = diaSemana === 0 ? -6 : 1 - diaSemana;

    const lunes = new Date(fecha);
    lunes.setDate(fecha.getDate() + offsetLunes);

    const domingo = new Date(lunes);
    domingo.setDate(lunes.getDate() + 6);

    return {
        desde: aISO(lunes),
        hasta: aISO(domingo),
        titulo: "Semana del " + aDDMM(lunes) + " al " + aDDMM(domingo)
    };

}

// ========================================
// CARGA PRINCIPAL
// ========================================

const mensajeCarga = document.getElementById("mensajeCarga");
const contenidoReporte = document.getElementById("contenidoReporte");

let mostrarTodasPreguntas = false;
let ultimoConteoPreguntas = [];

document.getElementById("btnVerPreguntas").addEventListener("click", function(){
    mostrarTodasPreguntas = !mostrarTodasPreguntas;
    pintarPreguntasFallas(ultimoConteoPreguntas);
});

async function cargarReporte(){

    mensajeCarga.style.display = "block";
    mensajeCarga.textContent = "Cargando datos del Sheet...";
    contenidoReporte.classList.add("oculto");

    try{

        const rango = calcularRango();

        const [cabecera, detalle, colaboradores, colaboradoresSupabase] = await Promise.all([
            leerHojaCSV("CABECERA_AUDITORIA"),
            leerHojaCSV("DETALLE_AUDITORIA"),
            leerHojaCSV("COLABORADORES"),
            checklistFetch("/colaboradores_activos?select=nombre,supervisor").catch(function(e){
                console.error(e);
                return [];
            })
        ]);

        const cabeceraPeriodo = cabecera.filter(function(r){
            const fecha = fechaSheetAISO(r.FECHA);
            return fecha && fecha >= rango.desde && fecha <= rango.hasta;
        });

        const idsPeriodo = new Set(cabeceraPeriodo.map(r => r.ID_AUDITORIA));
        const detallePeriodo = detalle.filter(r => idsPeriodo.has(r.ID_AUDITORIA));

        document.getElementById("lblRangoTexto").textContent =
            rango.titulo + " · " + cabeceraPeriodo.length + " auditoría(s) registradas";

        mostrarTodasPreguntas = false;

        if(modoPeriodo === "semana"){

            pintarKPIsSemana(cabeceraPeriodo, colaboradores);
            pintarEquipos(cabeceraPeriodo, colaboradores, rango);
            pintarTendencia(cabeceraPeriodo, rango);
            pintarZonasCobertura(cabeceraPeriodo, colaboradores);
            pintarResumenSemanal(cabeceraPeriodo, colaboradores);

        }else{

            pintarKPIsMes(cabeceraPeriodo, colaboradoresSupabase);
            pintarZonasPromedio(cabeceraPeriodo);
            pintarSupervisores(cabeceraPeriodo, colaboradoresSupabase);

        }

        pintarPreguntasFallasDesde(detallePeriodo);

        mensajeCarga.style.display = "none";
        contenidoReporte.classList.remove("oculto");

    }catch(error){

        console.error(error);

        mensajeCarga.textContent =
            "No se pudo cargar el Sheet. Verifique que siga público y vuelva a intentar.";

    }

}

function promedioPorcentaje(filas){
    if(!filas.length){ return 0; }
    const suma = filas.reduce((acc, r) => acc + (Number(r.PORCENTAJE) || 0), 0);
    return Math.round(suma / filas.length);
}

// ========================================
// VISTA SEMANA — KPIs (cobertura de pasillos)
// ========================================

function pintarKPIsSemana(cabeceraPeriodo, colaboradores){

    const meta = colaboradores.length;
    const auditados = pasillosDistintos(cabeceraPeriodo).size;
    const pendientes = Math.max(meta - auditados, 0);
    const promedio = meta > 0 ? Math.round((auditados / meta) * 100) : 0;

    document.getElementById("lblPasillosTotales").textContent = meta;
    document.getElementById("lblPromedioSemanal").textContent = promedio + "%";
    document.getElementById("lblAuditadosSemana").textContent = auditados;
    document.getElementById("lblPendientesSemana").textContent = pendientes;

}

// ========================================
// VISTA SEMANA — CUMPLIMIENTO POR EQUIPO
// ========================================
// Cada cuadrilla (DÍA/NOCHE/INTERMEDIO) tiene su propio roster fijo
// (colaboradoresTurno) y trabaja varios "turnos" (día-slot / noche-
// slot) a lo largo de la semana, según el rol de 3 turnos. La meta de
// cada equipo en la semana es su roster × cuántos turnos trabajó; lo
// auditado se cuenta por pasillo distinto Y POR DÍA (si el mismo
// pasillo se audita en 2 turnos distintos de la semana, cuenta 2 veces
// — cada turno debe dejarlo hecho de nuevo).

function calcularDatosEquipos(cabeceraPeriodo, colaboradores, rango){

    const rosterPorCuadrilla = {};

    CUADRILLAS.forEach(function(c){
        rosterPorCuadrilla[c] = colaboradores.filter(
            r => normalizarTurno5S(r.TURNO) === c
        ).length;
    });

    const turnosPorCuadrilla = { DIA: 0, NOCHE: 0, INTERMEDIO: 0 };

    let cursor = new Date(rango.desde + "T00:00:00");
    const fin = new Date(rango.hasta + "T00:00:00");

    while(cursor <= fin){

        const iso = aISO(cursor);
        const cDia = calcularCuadrillaReal(iso, true);
        const cNoche = calcularCuadrillaReal(iso, false);

        if(cDia && turnosPorCuadrilla[cDia] !== undefined){ turnosPorCuadrilla[cDia]++; }
        if(cNoche && turnosPorCuadrilla[cNoche] !== undefined){ turnosPorCuadrilla[cNoche]++; }

        cursor.setDate(cursor.getDate() + 1);

    }

    const auditadoPorCuadrillaFecha = {};

    cabeceraPeriodo.forEach(function(r){

        const fecha = fechaSheetAISO(r.FECHA);
        if(!fecha){ return; }

        const esDia = normalizarTurno5S(r.TURNO) === "DIA";
        const cuadrilla = calcularCuadrillaReal(fecha, esDia);
        if(!cuadrilla){ return; }

        const clave = cuadrilla + "|" + fecha;

        if(!auditadoPorCuadrillaFecha[clave]){
            auditadoPorCuadrillaFecha[clave] = new Set();
        }

        auditadoPorCuadrillaFecha[clave].add(clavePasillo(r));

    });

    return CUADRILLAS.map(function(c){

        const meta = rosterPorCuadrilla[c] * turnosPorCuadrilla[c];

        let auditado = 0;

        Object.keys(auditadoPorCuadrillaFecha).forEach(function(clave){
            if(clave.indexOf(c + "|") === 0){
                auditado += auditadoPorCuadrillaFecha[clave].size;
            }
        });

        auditado = Math.min(auditado, meta);

        const pct = meta > 0 ? Math.round((auditado / meta) * 100) : 0;

        return {
            cuadrilla: c,
            nombre: NOMBRE_CUADRILLA[c],
            meta: meta,
            auditado: auditado,
            pendientes: Math.max(meta - auditado, 0),
            pct: pct
        };

    });

}

function pintarEquipos(cabeceraPeriodo, colaboradores, rango){

    const datos = calcularDatosEquipos(cabeceraPeriodo, colaboradores, rango);
    const cont = document.getElementById("contEquipos");
    cont.innerHTML = "";

    datos.forEach(function(eq){

        const idDonut = "donutEquipo" + eq.cuadrilla;

        const div = document.createElement("div");
        div.className = "tarjeta-equipo";

        div.innerHTML = `
            <div class="tarjeta-equipo-nombre">${eq.nombre}</div>
            <div class="tarjeta-equipo-horario">${eq.meta ? "" : "Sin turnos esta semana"}</div>
            <div class="donut">
                <svg class="donut-svg" viewBox="0 0 100 100">
                    <circle class="donut-track" cx="50" cy="50" r="42"></circle>
                    <circle class="donut-progreso" id="${idDonut}" cx="50" cy="50" r="42"></circle>
                </svg>
                <div class="donut-centro">
                    <span class="donut-porcentaje">${eq.pct}%</span>
                </div>
            </div>
            <div class="tarjeta-equipo-fraccion">${eq.auditado} / ${eq.meta} pasillos</div>
        `;

        cont.appendChild(div);

        pintarAnilloDonut(idDonut, eq.pct, colorPorPorcentaje(eq.pct));

    });

    // KPI "Mejor Equipo"
    const conDatos = datos.filter(e => e.meta > 0);

    if(conDatos.length){

        const mejor = [...conDatos].sort((a, b) => b.pct - a.pct)[0];
        document.getElementById("lblMejorEquipo").textContent = mejor.nombre;
        document.getElementById("lblMejorEquipoPct").textContent = mejor.pct + "%";

    }else{

        document.getElementById("lblMejorEquipo").textContent = "-";
        document.getElementById("lblMejorEquipoPct").textContent = "Sin datos";

    }

    // RANKING
    const contRanking = document.getElementById("contRankingEquipos");
    contRanking.innerHTML = "";

    const rankeados = [...conDatos].sort((a, b) => b.pct - a.pct);

    if(!rankeados.length){
        contRanking.innerHTML = `<p class="sin-datos">Sin datos en el periodo.</p>`;
    }else{

        const clasesPuesto = ["oro", "plata", "bronce"];

        rankeados.forEach(function(eq, i){

            const div = document.createElement("div");
            div.className = "ranking-item";

            div.innerHTML = `
                <span class="ranking-puesto ${clasesPuesto[i] || ""}">${i + 1}</span>
                <span class="ranking-nombre">${eq.nombre}</span>
                <span class="ranking-pct">${eq.pct}%</span>
            `;

            contRanking.appendChild(div);

        });

    }

    // PENDIENTES POR EQUIPO
    const tbody = document.getElementById("tblPendientesEquipo");
    tbody.innerHTML = "";

    if(!datos.some(e => e.meta > 0)){
        tbody.innerHTML = `<tr><td colspan="2" class="sin-datos">Sin datos en el periodo.</td></tr>`;
        return;
    }

    datos.filter(e => e.meta > 0).forEach(function(eq){

        const tr = document.createElement("tr");

        tr.innerHTML = `
            <td>${eq.nombre}</td>
            <td>${eq.pendientes}</td>
        `;

        tbody.appendChild(tr);

    });

}

// ========================================
// VISTA SEMANA — TENDENCIA POR DÍA (cobertura diaria)
// ========================================

const ALTO_MAX_BARRA = 80;

function pintarTendencia(cabeceraPeriodo, rango){

    const cont = document.getElementById("contTendencia");
    cont.innerHTML = "";

    const dias = [];
    const cursor = new Date(rango.desde + "T00:00:00");
    const fin = new Date(rango.hasta + "T00:00:00");

    while(cursor <= fin){
        dias.push(aISO(cursor));
        cursor.setDate(cursor.getDate() + 1);
    }

    if(dias.length > 31){
        cont.innerHTML = `<p class="tendencia-vacio">El rango es muy amplio para mostrar día por día.</p>`;
        return;
    }

    const porDia = {};

    cabeceraPeriodo.forEach(function(r){
        const f = fechaSheetAISO(r.FECHA);
        if(!f){ return; }
        if(!porDia[f]){ porDia[f] = []; }
        porDia[f].push(r);
    });

    dias.forEach(function(iso){

        const filas = porDia[iso] || [];
        const promedio = promedioPorcentaje(filas);
        const partes = iso.split("-");

        const div = document.createElement("div");
        div.className = "barra-tendencia";

        div.innerHTML = `
            <div class="barra-tendencia-valor">${filas.length ? promedio + "%" : "-"}</div>
            <div class="barra-tendencia-relleno" style="height:${filas.length ? Math.max(2, Math.round(promedio / 100 * ALTO_MAX_BARRA)) : 2}px; background:${filas.length ? colorPorPorcentaje(promedio) : "#e5e7eb"};"></div>
            <div class="barra-tendencia-fecha">${partes[2]}/${partes[1]}</div>
        `;

        cont.appendChild(div);

    });

}

// ========================================
// VISTA SEMANA — % CUMPLIMIENTO POR ZONA (cobertura)
// ========================================

function pintarZonasCobertura(cabeceraPeriodo, colaboradores){

    const cont = document.getElementById("contZonas");
    cont.innerHTML = "";

    const zonas = ZONAS_5S.map(function(zona){

        const totalZona = colaboradores.filter(r => normalizarZona5S(r.ZONA) === zona).length;

        const auditadosZona = pasillosDistintos(
            cabeceraPeriodo.filter(r => normalizarZona5S(r.ZONA) === zona)
        ).size;

        const avanceZona = totalZona ? Math.round((Math.min(auditadosZona, totalZona) / totalZona) * 100) : 0;

        return { zona: zona, totalZona: totalZona, auditadosZona: Math.min(auditadosZona, totalZona), avanceZona: avanceZona };

    }).filter(z => z.totalZona > 0);

    if(!zonas.length){
        cont.innerHTML = `<p class="sin-datos">Sin colaboradores registrados.</p>`;
        return;
    }

    zonas.forEach(function(z){

        const fila = document.createElement("div");
        fila.className = "fila-zona";

        fila.innerHTML = `
            <div class="etiqueta-zona">${z.zona}<small>${z.auditadosZona}/${z.totalZona}</small></div>
            <div class="barra-zona">
                <div class="relleno-zona" style="width:${z.avanceZona}%; background:${colorPorPorcentaje(z.avanceZona)};"></div>
            </div>
            <div class="valor-zona">${z.avanceZona}%</div>
        `;

        cont.appendChild(fila);

    });

}

// ========================================
// VISTA SEMANA — RESUMEN SEMANAL
// ========================================

function pintarResumenSemanal(cabeceraPeriodo, colaboradores){

    const meta = colaboradores.length;
    const auditados = pasillosDistintos(cabeceraPeriodo).size;
    const pendientes = Math.max(meta - auditados, 0);
    const promedio = meta > 0 ? Math.round((auditados / meta) * 100) : 0;

    const cont = document.getElementById("contResumenSemanal");

    cont.innerHTML = `
        <div class="resumen-semanal-item"><span><span class="icono icono-clipboard-blue"></span> Auditados</span> <b>${auditados}</b></div>
        <div class="resumen-semanal-item"><span><span class="icono icono-warn-amber"></span> Pendientes</span> <b>${pendientes}</b></div>
        <div class="resumen-semanal-item"><span><span class="icono icono-check-green"></span> Promedio de cumplimiento</span> <b>${promedio}%</b></div>
    `;

}

// ========================================
// VISTA MES — KPIs (promedio de puntaje)
// ========================================

function pintarKPIsMes(cabeceraPeriodo, colaboradoresSupabase){

    document.getElementById("lblTotalAuditorias").textContent = cabeceraPeriodo.length;

    const promedioGeneral = promedioPorcentaje(cabeceraPeriodo);
    document.getElementById("lblPromedioPct").textContent = promedioGeneral + "%";
    pintarAnilloDonut("donutPromedio", promedioGeneral, colorPorPorcentaje(promedioGeneral));

    const porZona = {};

    cabeceraPeriodo.forEach(function(r){
        const z = normalizarZona5S(r.ZONA);
        if(!porZona[z]){ porZona[z] = []; }
        porZona[z].push(r);
    });

    const zonasConDatos = Object.keys(porZona).map(function(z){
        return { zona: z, promedio: promedioPorcentaje(porZona[z]) };
    }).sort((a, b) => b.promedio - a.promedio);

    if(zonasConDatos.length){

        const mejor = zonasConDatos[0];
        const peor = zonasConDatos[zonasConDatos.length - 1];

        document.getElementById("lblMejorZona").textContent = mejor.zona;
        document.getElementById("lblMejorZonaPct").textContent = mejor.promedio + "% de cumplimiento";
        document.getElementById("lblPeorZona").textContent = peor.zona;
        document.getElementById("lblPeorZonaPct").textContent = peor.promedio + "% de cumplimiento";

    }else{

        document.getElementById("lblMejorZona").textContent = "-";
        document.getElementById("lblMejorZonaPct").textContent = "Sin datos en el periodo";
        document.getElementById("lblPeorZona").textContent = "-";
        document.getElementById("lblPeorZonaPct").textContent = "Sin datos en el periodo";

    }

    const supervisorPorNombre = construirMapaSupervisores(colaboradoresSupabase);

    const supervisoresDistintos = new Set(
        cabeceraPeriodo.map(r => supervisorPorNombre[normalizarNombre(r.NOMBRE)] || "Sin asignar")
    );

    document.getElementById("lblTotalSupervisores").textContent = supervisoresDistintos.size;

}

// ========================================
// VISTA MES — % CUMPLIMIENTO POR ZONA (promedio de puntaje)
// ========================================

function pintarZonasPromedio(cabeceraPeriodo){

    const cont = document.getElementById("contZonasMes");
    cont.innerHTML = "";

    const porZona = {};

    cabeceraPeriodo.forEach(function(r){
        const z = normalizarZona5S(r.ZONA);
        if(!porZona[z]){ porZona[z] = []; }
        porZona[z].push(r);
    });

    const zonas = ZONAS_5S
        .map(function(z){ return { zona: z, filas: porZona[z] || [] }; })
        .filter(z => z.filas.length > 0)
        .map(function(z){ return { zona: z.zona, cantidad: z.filas.length, promedio: promedioPorcentaje(z.filas) }; })
        .sort((a, b) => b.promedio - a.promedio);

    if(!zonas.length){
        cont.innerHTML = `<p class="sin-datos">Sin auditorías en el periodo.</p>`;
        return;
    }

    zonas.forEach(function(z){

        const fila = document.createElement("div");
        fila.className = "fila-zona";

        fila.innerHTML = `
            <div class="etiqueta-zona">${z.zona}<small>${z.cantidad} auditoría(s)</small></div>
            <div class="barra-zona">
                <div class="relleno-zona" style="width:${z.promedio}%; background:${colorPorPorcentaje(z.promedio)};"></div>
            </div>
            <div class="valor-zona">${z.promedio}%</div>
        `;

        cont.appendChild(fila);

    });

}

// ========================================
// VISTA MES — CUMPLIMIENTO POR SUPERVISOR
// ========================================

function pintarSupervisores(cabeceraPeriodo, colaboradoresSupabase){

    const tbody = document.getElementById("tblSupervisores");
    tbody.innerHTML = "";

    const supervisorPorNombre = construirMapaSupervisores(colaboradoresSupabase);
    const porSupervisor = {};

    cabeceraPeriodo.forEach(function(r){

        const supervisor = supervisorPorNombre[normalizarNombre(r.NOMBRE)] || "Sin asignar";

        if(!porSupervisor[supervisor]){
            porSupervisor[supervisor] = [];
        }

        porSupervisor[supervisor].push(r);

    });

    const filas = Object.keys(porSupervisor)
        .map(function(s){
            return { supervisor: s, cantidad: porSupervisor[s].length, promedio: promedioPorcentaje(porSupervisor[s]) };
        })
        .sort((a, b) => b.promedio - a.promedio);

    if(!filas.length){
        tbody.innerHTML = `<tr><td colspan="3" class="sin-datos">Sin auditorías en el periodo.</td></tr>`;
        return;
    }

    filas.forEach(function(f){

        const tr = document.createElement("tr");

        tr.innerHTML = `
            <td>${f.supervisor}</td>
            <td>${f.cantidad}</td>
            <td><span class="badge ${f.promedio >= 80 ? "aprobado" : "no-aprobado"}">${f.promedio}%</span></td>
        `;

        tbody.appendChild(tr);

    });

}

// ========================================
// COMPARTIDO — PREGUNTAS CON MÁS FALLAS
// ========================================

function pintarPreguntasFallasDesde(detallePeriodo){

    const conteoNo = {};
    const conteoTotal = {};

    detallePeriodo.forEach(function(r){

        const pregunta = String(r.PREGUNTA || "").trim();
        if(!pregunta){ return; }

        conteoTotal[pregunta] = (conteoTotal[pregunta] || 0) + 1;

        if(String(r.CUMPLE || "").trim().toUpperCase() === "NO"){
            conteoNo[pregunta] = (conteoNo[pregunta] || 0) + 1;
        }

    });

    ultimoConteoPreguntas = Object.keys(conteoNo)
        .map(function(p){
            return { pregunta: p, fallas: conteoNo[p], total: conteoTotal[p] };
        })
        .sort((a, b) => b.fallas - a.fallas);

    pintarPreguntasFallas(ultimoConteoPreguntas);

}

function pintarPreguntasFallas(lista){

    const tbody = document.getElementById("tblPreguntasFallas");
    const btnVer = document.getElementById("btnVerPreguntas");
    tbody.innerHTML = "";

    if(!lista.length){
        tbody.innerHTML = `<tr><td colspan="3" class="sin-datos">Sin fallas registradas en el periodo.</td></tr>`;
        btnVer.style.display = "none";
        return;
    }

    const visibles = mostrarTodasPreguntas ? lista : lista.slice(0, 6);

    btnVer.style.display = lista.length > 6 ? "block" : "none";
    btnVer.textContent = mostrarTodasPreguntas
        ? "Ver menos ↑"
        : "Ver todas (" + lista.length + ") →";

    visibles.forEach(function(f, index){

        const tr = document.createElement("tr");

        tr.innerHTML = `
            <td>${index + 1}</td>
            <td>${f.pregunta}</td>
            <td>${f.fallas}</td>
        `;

        tbody.appendChild(tr);

    });

}

// ========================================
// INICIO
// ========================================

if(sesion){
    cargarReporte();
}

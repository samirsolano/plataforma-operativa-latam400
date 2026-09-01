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

// Nombres visibles igual al modelo ("Equipo 1/2/3"); internamente
// siguen siendo las cuadrillas reales DÍA/NOCHE/INTERMEDIO.
const NOMBRE_CUADRILLA = {
    DIA: "Equipo 1",
    NOCHE: "Equipo 2",
    INTERMEDIO: "Equipo 3"
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

function aDDMMYYYY(d){
    return String(d.getDate()).padStart(2, "0") + "/" + String(d.getMonth() + 1).padStart(2, "0") + "/" + d.getFullYear();
}

// Número de semana ISO 8601 (semana que contiene el jueves de esa fecha).
function numeroSemanaISO(d){
    const copia = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const diaISO = copia.getUTCDay() || 7;
    copia.setUTCDate(copia.getUTCDate() + 4 - diaISO);
    const inicioAno = new Date(Date.UTC(copia.getUTCFullYear(), 0, 1));
    return Math.ceil((((copia - inicioAno) / 86400000) + 1) / 7);
}

function calcularRango(){

    if(modoPeriodo === "mes"){

        const valor = inputMes.value || fechaHoyISO().slice(0, 7);
        const [y, m] = valor.split("-").map(Number);

        const desde = y + "-" + String(m).padStart(2, "0") + "-01";
        const ultimoDia = new Date(y, m, 0).getDate();
        const hasta = y + "-" + String(m).padStart(2, "0") + "-" + String(ultimoDia).padStart(2, "0");

        const nombreMes = new Date(y, m - 1, 1).toLocaleDateString("es-PE", { month: "long", year: "numeric" });

        return {
            desde: desde,
            hasta: hasta,
            titulo: "Mes de " + nombreMes,
            textoHeader: "Mes: " + nombreMes
        };

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
        titulo: "Semana del " + aDDMM(lunes) + " al " + aDDMM(domingo),
        numeroSemana: numeroSemanaISO(lunes),
        textoHeader: "Semana: " + numeroSemanaISO(lunes) + " (" + aDDMMYYYY(lunes) + " - " + aDDMMYYYY(domingo) + ")"
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
            obtenerRosterActivo(),
            // Sin filtrar por activo=true: el auditor de una fecha pasada
            // puede ya no estar activo hoy, pero su supervisor histórico
            // igual debe resolverse en la vista Mes.
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

        document.getElementById("lblRangoTexto").textContent = rango.textoHeader;

        if(modoPeriodo === "semana"){
            document.getElementById("lblTituloReporte").textContent = "DASHBOARD SEMANAL – SEGUIMIENTO";
            document.getElementById("lblObjetivoReporte").textContent = "Objetivo: Ver el cumplimiento de auditorías durante la semana";
        }else{
            document.getElementById("lblTituloReporte").textContent = "DASHBOARD MENSUAL – SEGUIMIENTO";
            document.getElementById("lblObjetivoReporte").textContent = "Objetivo: Ver el cumplimiento de auditorías durante el mes";
        }

        mostrarTodasPreguntas = false;

        if(modoPeriodo === "semana"){

            pintarKPIsSemana(cabeceraPeriodo, colaboradores);
            pintarEquipos(cabeceraPeriodo, colaboradores);
            pintarTendencia(cabeceraPeriodo, rango);
            pintarZonasCobertura(cabeceraPeriodo, colaboradores);
            pintarResumenSemanal(cabeceraPeriodo, colaboradores);
            pintarFooterMotivacional(cabeceraPeriodo, colaboradores);

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
// Cada pasillo físico tiene 3 responsables fijos en el roster —uno
// por cuadrilla (DÍA/NOCHE/INTERMEDIO)—, así que la meta de un equipo
// en la semana es simplemente el tamaño de su roster (33 y 33 y 33 =
// 99 pasillos totales, ver lblPasillosTotales). Lo auditado por
// equipo se calcula asignando cada auditoría registrada a la
// cuadrilla que realmente tocaba ese día (calcularCuadrillaReal, con
// la fecha propia de la fila y si su TURNO literal fue DÍA o NOCHE),
// y contando pasillos DISTINTOS una sola vez en toda la semana — si
// el mismo pasillo se vuelve a auditar otro día bajo la misma
// cuadrilla no debe sumar de nuevo.

const HORARIO_CUADRILLA = {
    DIA: "Lunes a Jueves",
    NOCHE: "Mar-Mié-Jue-Vie (noche)",
    INTERMEDIO: "Vie-Sáb (día)"
};

// Colores fijos por identidad de equipo (no por umbral de %), igual
// que el modelo: Equipo 1 verde, Equipo 2 ámbar, Equipo 3 azul.
const COLOR_CUADRILLA = {
    DIA: "#16a34a",
    NOCHE: "#f59e0b",
    INTERMEDIO: "#2563eb"
};

function calcularDatosEquipos(cabeceraPeriodo, colaboradores){

    const auditadoPorCuadrilla = { DIA: new Set(), NOCHE: new Set(), INTERMEDIO: new Set() };

    cabeceraPeriodo.forEach(function(r){

        const fecha = fechaSheetAISO(r.FECHA);
        if(!fecha){ return; }

        const esDia = normalizarTurno5S(r.TURNO) === "DIA";
        const cuadrilla = calcularCuadrillaReal(fecha, esDia);
        if(!cuadrilla || !auditadoPorCuadrilla[cuadrilla]){ return; }

        auditadoPorCuadrilla[cuadrilla].add(clavePasillo(r));

    });

    return CUADRILLAS.map(function(c){

        const rosterTeam = colaboradores.filter(r => normalizarTurno5S(r.TURNO) === c);
        const clavesRoster = rosterTeam.map(clavePasillo);

        const pendientesClaves = clavesRoster.filter(k => !auditadoPorCuadrilla[c].has(k));

        const meta = clavesRoster.length;
        const auditado = meta - pendientesClaves.length;
        const pct = meta > 0 ? Math.round((auditado / meta) * 100) : 0;

        return {
            cuadrilla: c,
            nombre: NOMBRE_CUADRILLA[c],
            horario: HORARIO_CUADRILLA[c],
            color: COLOR_CUADRILLA[c],
            meta: meta,
            auditado: auditado,
            pendientes: pendientesClaves.length,
            pendientesLista: pendientesClaves.map(k => k.split("||").join(" - ")).sort(),
            pct: pct
        };

    });

}

function pintarEquipos(cabeceraPeriodo, colaboradores){

    const datos = calcularDatosEquipos(cabeceraPeriodo, colaboradores);
    const cont = document.getElementById("contEquipos");
    cont.innerHTML = "";

    datos.forEach(function(eq){

        const idDonut = "donutEquipo" + eq.cuadrilla;

        const div = document.createElement("div");
        div.className = "tarjeta-equipo";

        div.innerHTML = `
            <div class="tarjeta-equipo-nombre">${eq.nombre}</div>
            <div class="tarjeta-equipo-horario">${eq.horario}</div>
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

        pintarAnilloDonut(idDonut, eq.pct, eq.color);

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
        tbody.innerHTML = `<tr><td colspan="3" class="sin-datos">Sin datos en el periodo.</td></tr>`;
        return;
    }

    datos.filter(e => e.meta > 0).forEach(function(eq, indice){

        const idDetalle = "detallePendientes" + indice;

        const tr = document.createElement("tr");

        tr.innerHTML = `
            <td>${eq.nombre}</td>
            <td>${eq.pendientes}</td>
            <td>
                ${eq.pendientes
                    ? `<button type="button" class="btn-ver-pendientes" data-objetivo="${idDetalle}">Ver</button>`
                    : `<span class="sin-datos">—</span>`}
            </td>
        `;

        tbody.appendChild(tr);

        if(eq.pendientes){

            const trDetalle = document.createElement("tr");
            trDetalle.className = "fila-detalle-pendientes oculto";
            trDetalle.id = idDetalle;

            trDetalle.innerHTML = `
                <td colspan="3">
                    <div class="detalle-pendientes">${eq.pendientesLista.join(" · ")}</div>
                </td>
            `;

            tbody.appendChild(trDetalle);

        }

    });

}

document.getElementById("tblPendientesEquipo").addEventListener("click", function(e){

    const boton = e.target.closest(".btn-ver-pendientes");
    if(!boton){ return; }

    const detalle = document.getElementById(boton.dataset.objetivo);
    if(!detalle){ return; }

    const visible = detalle.classList.toggle("oculto") === false;
    boton.textContent = visible ? "Ocultar" : "Ver";

});

// ========================================
// VISTA SEMANA — TENDENCIA POR DÍA (cobertura diaria)
// ========================================

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

    const puntos = dias.map(function(iso){
        const filas = porDia[iso] || [];
        const partes = iso.split("-");
        return {
            promedio: filas.length ? promedioPorcentaje(filas) : null,
            etiquetaFecha: partes[2] + "/" + partes[1]
        };
    });

    const ancho = 500;
    const alto = 150;
    const margenIzq = 26;
    const margenDer = 10;
    const margenSup = 18;
    const margenInf = 22;
    const areaAncho = ancho - margenIzq - margenDer;
    const areaAlto = alto - margenSup - margenInf;
    const pasoX = puntos.length > 1 ? areaAncho / (puntos.length - 1) : 0;

    function xDe(i){ return margenIzq + pasoX * i; }
    function yDe(pct){ return margenSup + areaAlto * (1 - pct / 100); }

    let svg = `<svg class="tendencia-svg" viewBox="0 0 ${ancho} ${alto}">`;

    [0, 25, 50, 75, 100].forEach(function(marca){
        const y = yDe(marca);
        svg += `<line class="tendencia-grilla" x1="${margenIzq}" y1="${y}" x2="${ancho - margenDer}" y2="${y}"></line>`;
        svg += `<text class="tendencia-eje-texto" x="${margenIzq - 4}" y="${y + 2}" text-anchor="end">${marca}%</text>`;
    });

    const conDatos = puntos
        .map(function(p, i){ return { p: p, i: i }; })
        .filter(o => o.p.promedio !== null);

    if(conDatos.length){

        const polylinePuntos = conDatos.map(o => xDe(o.i) + "," + yDe(o.p.promedio)).join(" ");
        svg += `<polyline class="tendencia-linea" points="${polylinePuntos}"></polyline>`;

        conDatos.forEach(function(o){
            const x = xDe(o.i);
            const y = yDe(o.p.promedio);
            svg += `<circle class="tendencia-punto" cx="${x}" cy="${y}" r="3.5" fill="${colorPorPorcentaje(o.p.promedio)}"></circle>`;
            svg += `<text class="tendencia-valor-texto" x="${x}" y="${y - 8}">${o.p.promedio}%</text>`;
        });

    }

    puntos.forEach(function(p, i){
        svg += `<text class="tendencia-fecha-texto" x="${xDe(i)}" y="${alto - 4}">${p.etiquetaFecha}</text>`;
    });

    svg += `</svg>`;

    cont.innerHTML = svg;

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
            <div class="etiqueta-zona">${z.zona}</div>
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
// VISTA SEMANA — MENSAJE MOTIVACIONAL
// ========================================

function pintarFooterMotivacional(cabeceraPeriodo, colaboradores){

    const meta = colaboradores.length;
    const auditados = pasillosDistintos(cabeceraPeriodo).size;
    const promedio = meta > 0 ? Math.round((auditados / meta) * 100) : 0;
    const animo = promedio >= 70 ? "¡Sigamos así!" : "¡Vamos por más!";

    document.getElementById("lblFooterMotivacional").textContent =
        "ℹ️ Esta semana llevan un avance del " + promedio + "%. " + animo;

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

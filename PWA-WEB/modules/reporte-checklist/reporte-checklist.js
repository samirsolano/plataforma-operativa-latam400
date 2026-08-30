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
// ZONAS CONOCIDAS
// ========================================

const ZONAS_5S = ["Zona 1", "Zona 2", "Zona 3", "Zona 4", "Zona 5", "Zona 6"];

function normalizarNombre(n){
    return String(n || "").trim().toUpperCase();
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

function construirMapaSupervisores(colaboradoresSupabase){

    const mapa = {};

    (colaboradoresSupabase || []).forEach(function(c){
        if(c.nombre){
            mapa[normalizarNombre(c.nombre)] = c.supervisor || "Sin asignar";
        }
    });

    return mapa;

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

inputFechaSemana.value = fechaHoyISO();
inputMes.value = fechaHoyISO().slice(0, 7);

btnPeriodoSemana.addEventListener("click", function(){

    modoPeriodo = "semana";
    btnPeriodoSemana.classList.add("activo");
    btnPeriodoMes.classList.remove("activo");
    inputFechaSemana.closest(".filtro").classList.remove("oculto");
    filtroMesDiv.classList.add("oculto");
    cargarReporte();

});

btnPeriodoMes.addEventListener("click", function(){

    modoPeriodo = "mes";
    btnPeriodoMes.classList.add("activo");
    btnPeriodoSemana.classList.remove("activo");
    inputFechaSemana.closest(".filtro").classList.add("oculto");
    filtroMesDiv.classList.remove("oculto");
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

        const [cabecera, detalle, colaboradoresSupabase] = await Promise.all([
            leerHojaCSV("CABECERA_AUDITORIA"),
            leerHojaCSV("DETALLE_AUDITORIA"),
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

        pintarKPIs(cabeceraPeriodo, colaboradoresSupabase);
        pintarTendencia(cabeceraPeriodo, rango);
        pintarZonas(cabeceraPeriodo);
        pintarSupervisores(cabeceraPeriodo, colaboradoresSupabase);
        pintarPreguntasFallasDesde(detallePeriodo);

        mensajeCarga.style.display = "none";
        contenidoReporte.classList.remove("oculto");

    }catch(error){

        console.error(error);

        mensajeCarga.textContent =
            "No se pudo cargar el Sheet. Verifique que siga público y vuelva a intentar.";

    }

}

// ========================================
// KPIs
// ========================================

function promedioPorcentaje(filas){
    if(!filas.length){ return 0; }
    const suma = filas.reduce((acc, r) => acc + (Number(r.PORCENTAJE) || 0), 0);
    return Math.round(suma / filas.length);
}

function pintarKPIs(cabeceraPeriodo, colaboradoresSupabase){

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
// TENDENCIA DIARIA
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
// % CUMPLIMIENTO POR ZONA
// ========================================

function pintarZonas(cabeceraPeriodo){

    const cont = document.getElementById("contZonas");
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
// CUMPLIMIENTO POR SUPERVISOR
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
// PREGUNTAS CON MÁS FALLAS
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

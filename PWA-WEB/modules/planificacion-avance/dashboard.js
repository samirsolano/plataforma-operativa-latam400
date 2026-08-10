// =========================================================
// DASHBOARD (PLANIFICACIÓN Y AVANCE DIARIO) - UI
// Portado 1:1 desde jsDashboard.html del proyecto original,
// reemplazando google.script.run por llamadas async directas.
// =========================================================

let dashDataActual = null;
let dashRelojIntervalo = null;

function dashAutor(){
  const sesion = JSON.parse(localStorage.getItem("latam400_sesion") || "{}");
  return sesion.nombre || sesion.usuario || "Usuario";
}

// =====================================================================
// APERTURA / CARGA
// =====================================================================

function abrirDashboard(){

  document.getElementById("modDashboard").style.display = "block";

  // Precarga con la fecha/turno ya seleccionados en el sidebar,
  // pero quedan editables independientemente desde aquí.
  const campoFecha = document.getElementById("dashFecha");
  const campoTurno = document.getElementById("dashTurno");

  if(!campoFecha.value){
    campoFecha.value = fechaSeleccionada;
  }

  if(turnoSeleccionado){
    campoTurno.value = turnoSeleccionado;
  }

  dashActualizarReloj();
  if(dashRelojIntervalo) clearInterval(dashRelojIntervalo);
  dashRelojIntervalo = setInterval(dashActualizarReloj, 30000);

  cargarDashboard();

}

function dashActualizarReloj(){
  const ahora = new Date();
  const horas = String(ahora.getHours()).padStart(2, "0");
  const minutos = String(ahora.getMinutes()).padStart(2, "0");
  const el = document.getElementById("dashHoraActual");
  if(el) el.textContent = horas + ":" + minutos;
}

function dashFechaTurnoActual(){
  return {
    fecha: document.getElementById("dashFecha").value || fechaSeleccionada,
    turno: document.getElementById("dashTurno").value || turnoSeleccionado
  };
}

async function cargarDashboard(){

  const ft = dashFechaTurnoActual();

  try{
    const data = await obtenerDashboard(ft.fecha, ft.turno);
    renderDashboard(data);
  }catch(err){
    mostrarAlertaModal("No se pudo cargar el Dashboard: " + (err.message || err), "error");
  }

}


// =====================================================================
// RENDER PRINCIPAL
// =====================================================================

function renderDashboard(data){

  dashDataActual = data;

  document.getElementById("dashUltimaActualizacion").textContent =
    String(new Date().getHours()).padStart(2, "0") + ":" + String(new Date().getMinutes()).padStart(2, "0");

  // ---- Planificación por canal ----
  const contPlan = document.getElementById("dashPlanCanales");
  contPlan.innerHTML = data.planificacion.canales.map(function(c){
    return (
      '<div class="dash-plan-canal">' +
        '<div class="dash-plan-canal-fila">' +
          '<span class="dash-plan-canal-nombre">' + c.nombre + '</span>' +
          '<span class="dash-plan-canal-valor">' + dashFmt(c.tn) + ' TN &nbsp; ' + c.pct + '%</span>' +
        '</div>' +
        '<div class="dash-plan-barra-fondo"><div class="dash-plan-barra-relleno" style="width:' + c.pct + '%"></div></div>' +
      '</div>'
    );
  }).join("") || '<div class="dash-comentarios-vacio">Sin viajes planificados para esta fecha/turno.</div>';

  document.getElementById("dashPlanTotal").textContent = dashFmt(data.planificacion.totalPlanificado) + " TN";

  // ---- KPIs ----
  document.getElementById("dashKpiEjecutado").textContent = dashFmt(data.kpis.tnEjecutado);
  document.getElementById("dashKpiEjecutadoPct").textContent = data.kpis.pctEjecutado + "% del objetivo";

  document.getElementById("dashKpiRestante").textContent = dashFmt(data.kpis.tnRestante);
  document.getElementById("dashKpiRestantePct").textContent = (100 - data.kpis.pctEjecutado > 0 ? Math.round((100 - data.kpis.pctEjecutado) * 10) / 10 : 0) + "% por ejecutar";

  document.getElementById("dashKpiProyeccion").textContent = dashFmt(data.kpis.proyeccionCierre);
  document.getElementById("dashKpiProyeccionPct").textContent = data.kpis.pctProyeccion + "% del objetivo";
  document.getElementById("dashKpiProyeccionFlecha").textContent = data.kpis.pctProyeccion >= 100 ? "↑" : "↓";

  document.getElementById("dashKpiPersonas").textContent = data.kpis.personasActivas;
  document.getElementById("dashKpiPersonasSub").textContent = "de " + data.kpis.personasPlanificadas + " planificadas";

  document.getElementById("dashTargetPersonaPicking").textContent = DASH_METAS_FRONT.TARGET_TN_POR_PERSONA_HORA;
  document.getElementById("dashTargetPersonaExtraccion").textContent = DASH_METAS_FRONT.TARGET_PALETAS_POR_PERSONA_HORA;

  // ---- Sparklines ----
  // "Ejecutado" y "Restante" combinan Picking + Extracción: ambos deben ir en TN
  // (Picking ya está en TN; de Extracción se usa realTNAcumulada, no el paletas).
  document.getElementById("dashSparkEjecutado").innerHTML = dashSparklineSvg(dashRealTNCombinado(data), "#1e8449");
  document.getElementById("dashSparkRestante").innerHTML = dashSparklineSvg(dashRestanteSerie(data), "#e67e22");
  // "Proyección" muestra el ritmo ideal hacia el total planificado (TN), a paso parejo
  // por hora — ya no se puede sumar la meta de Picking (TN) con la de Extracción
  // (ahora en PALETAS) porque quedarían unidades mezcladas.
  document.getElementById("dashSparkProyeccion").innerHTML = dashSparklineSvg(dashMetaPaceSerie(data), "#6c3483");
  document.getElementById("dashSparkPersonas").innerHTML = dashSparklineSvg(dashPersonasCombinadas(data), "#1f6feb");

  // ---- Gráficos Picking / Extracción (con la fila de BL adentro, alineada) ----
  document.getElementById("dashGraficoPicking").innerHTML =
    dashGraficoSvg("PICKING", data.picking, data.horas, data.indiceHoraActual, data.comentarios, "TN", data.picking.backlogAcumulada, data.esHoy);

  document.getElementById("dashGraficoExtraccion").innerHTML =
    dashGraficoSvg("EXTRACCION", data.extraccion, data.horas, data.indiceHoraActual, data.comentarios, "PALETAS", data.extraccion.backlogAcumulada, data.esHoy);

  // ---- Comentarios ----
  renderComentariosDash(data);

  // ---- Combo "Hora" del modal ----
  const selHora = document.getElementById("dashComHora");
  selHora.innerHTML = data.horas.map(function(h){
    return '<option value="' + h + '">' + String(h).padStart(2, "0") + ':00</option>';
  }).join("");

}

const DASH_METAS_FRONT = {
  TARGET_TN_POR_PERSONA_HORA: 0.9,       // debe reflejar DASH_METAS.TARGET_TN_POR_PERSONA_HORA del backend (Picking)
  TARGET_PALETAS_POR_PERSONA_HORA: 16    // debe reflejar DASH_METAS.TARGET_PALETAS_POR_PERSONA_HORA del backend (Extracción)
};


// =====================================================================
// HELPERS DE FORMATO / SERIES
// =====================================================================

function dashFmt(n){
  if(n === null || n === undefined) return "—";
  return Number(n).toFixed(1);
}

// Igual que dashFmt, pero entero cuando la unidad es PALETAS (no tiene sentido
// mostrar decimales en un conteo de paletas/líneas).
function dashFmtUnidad(n, unidad){
  if(n === null || n === undefined) return "—";
  return unidad === "PALETAS" ? String(Math.round(n)) : Number(n).toFixed(1);
}

function dashRealTNCombinado(data){
  // Picking.realAcumulada ya está en TN; Extracción usa realTNAcumulada
  // (el TN real detrás de las paletas), no su serie "real" (que está en PALETAS).
  return data.horas.map(function(h, i){
    const p = data.picking.realAcumulada[i];
    const e = data.extraccion.realTNAcumulada[i];
    return (p === null && e === null) ? null : ((p || 0) + (e || 0));
  });
}

function dashRestanteSerie(data){
  const total = data.planificacion.totalPlanificado;
  return dashRealTNCombinado(data).map(function(v){
    return v === null ? null : Math.max(total - v, 0);
  });
}

function dashMetaPaceSerie(data){
  // Ritmo ideal parejo hacia el total planificado (TN), hora a hora.
  // Reemplaza a la suma de metas de Picking (TN) + Extracción (ahora en PALETAS),
  // que ya no se pueden combinar directamente por tener unidades distintas.
  const total = data.planificacion.totalPlanificado;
  return data.horas.map(function(h, i){
    return Math.round(total * ((i + 1) / data.horas.length) * 100) / 100;
  });
}

function dashPersonasCombinadas(data){
  return data.horas.map(function(h, i){
    return (data.picking.personas[i] || 0) + (data.extraccion.personas[i] || 0);
  });
}


// =====================================================================
// TABLA META / REAL ACUMULADA (fila de la tabla resumen)
// =====================================================================

function dashPintarFila(idCelda, valores, unidad){

  // La primera vez se ubica por el <td id="..."> original; como reconstruir
  // la fila destruye ese id, la marcamos con data-fila-id para encontrarla
  // directamente en las siguientes veces (si no, getElementById(idCelda)
  // devolvería null después del primer render).
  let fila = document.querySelector('tr[data-fila-id="' + idCelda + '"]');

  if(!fila){
    fila = document.getElementById(idCelda).parentElement;
    fila.setAttribute("data-fila-id", idCelda);
  }

  const label = fila.querySelector(".dash-tabla-label").outerHTML;
  const celdas = valores.map(function(v){
    return '<td>' + (v === null || v === undefined ? "—" : dashFmtUnidad(v, unidad)) + '</td>';
  }).join("");

  fila.innerHTML = label + celdas;

}


// =====================================================================
// SPARKLINE SVG (mini gráfico de línea, sin librerías)
// =====================================================================

function dashSparklineSvg(valores, color){

  const limpios = valores.filter(function(v){ return v !== null && v !== undefined; });
  if(limpios.length < 2) return "";

  const max = Math.max.apply(null, limpios);
  const min = Math.min.apply(null, limpios);
  const rango = (max - min) || 1;

  const ancho = 200, alto = 60, pad = 4;
  const paso = (ancho - pad * 2) / (limpios.length - 1);

  const puntos = limpios.map(function(v, i){
    const x = pad + i * paso;
    const y = alto - pad - ((v - min) / rango) * (alto - pad * 2);
    return x.toFixed(1) + "," + y.toFixed(1);
  });

  const area = "M" + puntos[0] + " L" + puntos.join(" L") + " L" + (ancho - pad) + "," + alto + " L" + pad + "," + alto + " Z";

  return (
    '<polyline points="' + puntos.join(" ") + '" fill="none" stroke="' + color + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>' +
    '<path d="' + area + '" fill="' + color + '" opacity="0.12"/>'
  );

}


// =====================================================================
// GRÁFICO DE BARRAS POR HORA (Picking / Extracción)
// =====================================================================

function dashGraficoSvg(proceso, serie, horas, indiceActual, comentarios, unidad, backlogPorHora, esHoy){

  const ancho = 1000;
  const altoBase = 190;                        // alto del gráfico + fila de hora (igual que antes)
  const altoBL = backlogPorHora ? 20 : 0;       // fila extra para "BL", alineada por columna con el resto
  const altoTotal = altoBase + altoBL;

  const margenIzq = 26;
  const topOffset = 18;   // fila de "personas asignadas"
  const margenAbajo = 42; // fila de ícono de estado + etiqueta hora actual + fila de hora
  const areaAlto = altoBase - topOffset - margenAbajo;
  const anchoCol = (ancho - margenIzq - 10) / horas.length;
  const baseY = topOffset + areaAlto;

  // Backlog que carga cada hora (el de la hora ANTERIOR, ya que se suma
  // como tramo extra arriba del target de esta hora — "lo que quedó
  // pendiente ayer/antes se agrega a lo que toca ahora")
  const backlogPrevioPorHora = horas.map(function(h, i){
    if(i === 0 || !backlogPorHora) return 0;
    const v = backlogPorHora[i - 1];
    return (v === null || v === undefined) ? 0 : v;
  });

  const targetConBacklog = serie.target.map(function(t, i){
    return (t || 0) + backlogPrevioPorHora[i];
  });

  const max = Math.max(
    Math.max.apply(null, targetConBacklog),
    Math.max.apply(null, serie.real),
    1
  ) * 1.15;

  function y(v){ return topOffset + areaAlto - (v / max) * areaAlto; }

  let svg =
    '<svg class="dash-grafico-svg" viewBox="0 0 ' + ancho + ' ' + altoTotal + '" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">' +
    '<defs><pattern id="dashPatronProyeccion" width="6" height="6" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">' +
    '<rect width="6" height="6" fill="#ded4f0"/><line x1="0" y1="0" x2="0" y2="6" stroke="#a78bd6" stroke-width="2"/>' +
    '</pattern></defs>';

  horas.forEach(function(h, i){

    const cx = margenIzq + i * anchoCol + anchoCol / 2;
    const esFutura = indiceActual < 0 ? true : i > indiceActual;
    const esActual = esHoy && i === indiceActual;

    const targetVal = serie.target[i] || 0;
    const realVal = serie.real[i] || 0;
    const personasVal = serie.personas[i] || 0;
    const backlogPrevio = backlogPrevioPorHora[i];
    const totalConBacklog = targetVal + backlogPrevio;

    if(esActual){
      svg += '<line class="dash-barra-hora-actual-linea" x1="' + cx + '" y1="' + topOffset + '" x2="' + cx + '" y2="' + (baseY + 9) + '"/>';
      svg += '<text class="dash-hora-actual-tag" x="' + cx + '" y="' + (baseY + 23) + '">HORA ACTUAL</text>';
    }

    // Personas asignadas (arriba)
    svg += '<text class="dash-persona-label" x="' + cx + '" y="9">👤 ' + personasVal + '</text>';

    svg += '<g class="dash-col-hora" style="cursor:pointer" onclick="dashClickHora(\'' + proceso + '\',' + h + ')">';

    if(esFutura){

      // Proyección (barra rayada) = target normal...
      const bw = anchoCol * 0.5;
      const bx = cx - bw / 2;
      const by = y(targetVal);
      svg += '<rect class="dash-barra-proy" x="' + bx + '" y="' + by + '" width="' + bw + '" height="' + (baseY - by) + '" rx="3"/>';

      // ...+ tramo extra arriba, en azul intenso, con el BL que arrastra
      if(backlogPrevio > 0){
        const byTotal = y(totalConBacklog);
        svg += '<rect class="dash-barra-backlog-extra" x="' + bx + '" y="' + byTotal + '" width="' + bw + '" height="' + (by - byTotal) + '" rx="3"/>';
      }

      svg += '<text class="dash-valor-label" x="' + cx + '" y="' + (y(totalConBacklog) - 3) + '">' + dashFmtUnidad(totalConBacklog, unidad) + '</text>';

    } else {

      // Target (azul) + tramo extra de BL arrastrado (azul intenso) + Real (verde/rojo)
      const bw = anchoCol * 0.32;
      const bxT = cx - bw - 2;
      const bxR = cx + 2;

      const byT = y(targetVal);
      svg += '<rect class="dash-barra-target" x="' + bxT + '" y="' + byT + '" width="' + bw + '" height="' + (baseY - byT) + '" rx="3"/>';

      if(backlogPrevio > 0){
        const byTotal = y(totalConBacklog);
        svg += '<rect class="dash-barra-backlog-extra" x="' + bxT + '" y="' + byTotal + '" width="' + bw + '" height="' + (byT - byTotal) + '" rx="3"/>';
      }

      svg += '<text class="dash-valor-label" x="' + (bxT + bw/2) + '" y="' + (y(totalConBacklog) - 3) + '">' + dashFmtUnidad(totalConBacklog, unidad) + '</text>';

      const pct = targetVal > 0 ? (realVal / targetVal) * 100 : 100;
      const claseReal = pct >= 100 ? "dash-barra-real-ok" : "dash-barra-real-mal";

      const byR = y(realVal);
      svg += '<rect class="' + claseReal + '" x="' + bxR + '" y="' + byR + '" width="' + bw + '" height="' + (baseY - byR) + '" rx="3"/>';
      svg += '<text class="dash-valor-label" x="' + (bxR + bw/2) + '" y="' + (byR - 3) + '">' + dashFmtUnidad(realVal, unidad) + '</text>';

      const icono = pct >= 100 ? "✅" : "❌";
      svg += '<text x="' + cx + '" y="' + (baseY + 13) + '" text-anchor="middle" font-size="10">' + icono + '</text>';

    }

    // Ícono de comentario si existe alguno para esta hora/proceso
    const tieneComentario = (comentarios || []).some(function(c){
      return c.proceso === proceso && Number(c.hora) === h;
    });
    if(tieneComentario){
      svg += '<text x="' + (cx + anchoCol*0.32) + '" y="15" font-size="10">💬</text>';
    }

    svg += '</g>';

    // Etiqueta de hora
    svg += '<text class="dash-hora-label" x="' + cx + '" y="' + (altoBase - 5) + '">' + String(h).padStart(2,"0") + ':00</text>';

  });

  // Fila de BL (backlog acumulado), alineada con las mismas columnas
  // que las barras de arriba — por eso va dentro del mismo SVG y no
  // en una tabla HTML aparte (esa se desalineaba).
  if(backlogPorHora){

    svg += '<line class="dash-bl-separador" x1="0" y1="' + altoBase + '" x2="' + ancho + '" y2="' + altoBase + '"/>';
    svg += '<text class="dash-bl-etiqueta" x="4" y="' + (altoBase + 14) + '">BL</text>';

    horas.forEach(function(h, i){

      const cx = margenIzq + i * anchoCol + anchoCol / 2;
      const v = backlogPorHora[i];
      const texto = (v === null || v === undefined) ? "—" : dashFmtUnidad(v, unidad);

      svg += '<text class="dash-bl-valor" x="' + cx + '" y="' + (altoBase + 14) + '">' + texto + '</text>';

    });

  }

  svg += '</svg>';

  return svg;

}


// =====================================================================
// COMENTARIOS
// =====================================================================

function dashColorComentario(data, c){

  const serie = c.proceso === "EXTRACCION" ? data.extraccion : data.picking;
  const idx = data.horas.indexOf(Number(c.hora));

  if(idx === -1) return "rojo";

  const target = serie.target[idx] || 0;
  const real = serie.real[idx];

  if(real === null || real === undefined) return "rojo"; // hora sin ejecutar aún: se marca como pendiente/crítica

  const pct = target > 0 ? (real / target) * 100 : 100;

  if(pct >= 100) return "verde";
  return "rojo";

}

function renderComentariosDash(data){

  const comentarios = data.comentarios || [];

  document.getElementById("dashComentariosBadge").textContent = comentarios.length;

  const cont = document.getElementById("dashComentariosLista");

  if(comentarios.length === 0){
    cont.innerHTML = '<div class="dash-comentarios-vacio">Sin comentarios registrados.</div>';
    return;
  }

  cont.innerHTML = comentarios.map(function(c){

    const fecha = new Date(c.created_at);
    const hora = String(fecha.getHours()).padStart(2,"0") + ":" + String(fecha.getMinutes()).padStart(2,"0");

    const color = dashColorComentario(data, c);
    const claseCard = color === "amarillo" ? " dash-com-amarillo" : (color === "verde" ? " dash-com-verde" : "");

    return (
      '<div class="dash-comentario-card' + claseCard + '">' +
        '<button class="dash-comentario-editar" title="Editar (próximamente)" onclick="dashEditarComentarioProximamente(event)">✏️</button>' +
        '<div class="dash-comentario-hora"><span class="dash-comentario-dot dash-comentario-dot-' + color + '"></span>' + String(c.hora).padStart(2,"0") + ':00 &nbsp; ' + c.proceso + '</div>' +
        '<div class="dash-comentario-texto">' + dashEscapar(c.comentario) + '</div>' +
        '<div class="dash-comentario-autor">• ' + dashEscapar(c.autor) + ' &nbsp; ' + hora + '</div>' +
      '</div>'
    );

  }).join("");

}

function dashEditarComentarioProximamente(evento){
  evento.stopPropagation();
  mostrarAlertaModal("La edición de comentarios estará disponible próximamente.", "info");
}

function dashEscapar(texto){
  const div = document.createElement("div");
  div.textContent = texto || "";
  return div.innerHTML;
}

function dashClickHora(proceso, hora){
  abrirModalComentarioDash();
  document.getElementById("dashComProceso").value = proceso;
  document.getElementById("dashComHora").value = hora;
}

function abrirModalComentarioDash(){
  document.getElementById("dashModalComentario").style.display = "flex";
  document.getElementById("dashComTexto").value = "";
}

function cerrarModalComentarioDash(){
  document.getElementById("dashModalComentario").style.display = "none";
}

async function guardarComentarioDash(){

  const texto = document.getElementById("dashComTexto").value.trim();

  if(texto === ""){
    mostrarAlertaModal("Escribe un comentario antes de guardar.", "warning");
    return;
  }

  const ft = dashFechaTurnoActual();

  const registro = {
    fecha: ft.fecha,
    turno: ft.turno,
    proceso: document.getElementById("dashComProceso").value,
    hora: Number(document.getElementById("dashComHora").value),
    autor: dashAutor(),
    comentario: texto
  };

  try{

    await guardarComentarioDashboard(registro);
    cerrarModalComentarioDash();
    cargarDashboard();

  }catch(err){
    mostrarAlertaModal("No se pudo guardar el comentario: " + (err.message || err), "error");
  }

}

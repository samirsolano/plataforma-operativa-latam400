// Metas de referencia (ajusta estos valores a los reales del negocio)
// NOTA: PICKING, EXTRACCION y TURNO_TN ya NO se usan — esas metas ahora
// se calculan en vivo desde lo planificado (obtenerMetasPlanificadasHxh).
// Solo quedan fijas: REPO y ALMACENAMIENTO (no hay campo planificado para ellas).
const HXH_METAS = {
  PICKING: 70,
  EXTRACCION: 350,
  REPO: 40,
  ALMACENAMIENTO: 500,
  TURNO_TN: 360
};

const HXH_NOMBRES = {
  PICKING: "PICKING",
  EXTRACCION: "EXTRACCIÓN",
  REPO: "REPOSICIÓN",
  ALMACENAMIENTO: "ALMACENAMIENTO"
};

function abrirHoraXHora(){
  document.getElementById("modHoraHora").style.display = "block";

  // Usar la fecha y turno ya seleccionados en el sidebar (los mismos
  // que se usan en Planificado Drive / Planificación Recursos)
  if (fechaSeleccionada){
    document.getElementById("hxhFecha").value = fechaSeleccionada;
  } else if (!document.getElementById("hxhFecha").value){
    const hoy = new Date().toISOString().split("T")[0];
    document.getElementById("hxhFecha").value = hoy;
  }

  if (turnoSeleccionado){
    document.getElementById("hxhTurno").value = turnoSeleccionado;
  }

  cargarSupervisoresHxh();
  cargarHoraXHora();
}

// Lista de supervisores: solo para mostrar en el encabezado como
// referencia (usa el mismo origen que "Planificación Recursos").
// No filtra la tabla porque el RPC obtener_hora_x_hora no recibe
// ese parámetro. Se preselecciona el supervisor activo en
// Planificación Recursos (variable global supervisorRecursos).
async function cargarSupervisoresHxh(){
  const select = document.getElementById("hxhSupervisorSelect");
  if (!select) return;

  if (select.dataset.cargado){
    if (typeof supervisorRecursos !== "undefined" && supervisorRecursos){
      select.value = supervisorRecursos;
    }
    return;
  }

  try{

    const lista = await obtenerSupervisoresRecursos();

    (lista || []).forEach(function(nombre){
      const opt = document.createElement("option");
      opt.value = nombre;
      opt.textContent = "Supervisor: " + nombre;
      select.appendChild(opt);
    });

    select.dataset.cargado = "1";

    if (typeof supervisorRecursos !== "undefined" && supervisorRecursos){
      select.value = supervisorRecursos;
    }

  }catch(e){ /* silencioso: es solo referencia */ }

}

// El subtítulo con Supervisor/Fecha/Turno se quitó del encabezado
// (quedaba duplicado: esa misma info ya está en los filtros de al
// lado). Se deja esta función vacía en vez de borrarla, porque el
// <select id="hxhSupervisorSelect"> todavía la llama en su onchange.
function actualizarSubtituloHxh(){}

async function cargarHoraXHora(){

  const fecha = document.getElementById("hxhFecha").value;
  const turno = document.getElementById("hxhTurno").value;

  if (!fecha){
    mostrarAlertaModal("Selecciona una fecha", "warning");
    return;
  }

  try{

    const data = await obtenerHoraXHora(fecha, turno);

    try{
      window.hxhMetasPlanificadas = await obtenerMetasPlanificadasHxh(fecha, turno);
    }catch(e){
      window.hxhMetasPlanificadas = {};
    }

    try{
      window.hxhComentarios = await obtenerComentariosHxh(fecha, turno);
    }catch(e){
      window.hxhComentarios = {};
    }

    renderHoraXHora(data, fecha, turno);

    const ahora = new Date();
    document.getElementById("hxhUltimaActualizacion").textContent =
      ahora.toLocaleString("es-PE", { day:"2-digit", month:"2-digit", year:"numeric", hour:"2-digit", minute:"2-digit" });

  }catch(err){
    mostrarAlertaModal("Error: " + err.message, "error");
  }

}

// Tasa por persona por hora, usada como target de cada celda individual
// (mismo criterio que DASH_METAS en el Dashboard: Picking 1.2 TN/persona/hora,
// Extracción 16 PAL/persona/hora). REPO y ALMACENAMIENTO quedan en null hasta
// definir su tasa — mientras tanto esas celdas no se colorean. Target fijo,
// sin escalones ni ajuste por minutos efectivos.
const HXH_TARGET_POR_PERSONA_HORA = {
  PICKING: 1.2,
  EXTRACCION: 16,
  REPO: null,            // TODO: definir TN/persona/hora
  ALMACENAMIENTO: 16     // PAL/persona/hora, misma tasa que Extracción
};

function hxhTargetCelda(proceso){
  const targetHora = HXH_TARGET_POR_PERSONA_HORA[proceso];
  return (targetHora === null || targetHora === undefined) ? null : targetHora;
}

// Target de la fila TOTAL para una hora: suma del target fijo por
// cada auxiliar que sí trabajó esa hora. Quien no tuvo valor esa
// hora no aporta target (no se le puede exigir nada de algo que no hizo).
function hxhTargetTotalHora(tabla, proceso, hora){

  const target = hxhTargetCelda(proceso);
  if (target === null) return null;

  let personas = 0;

  tabla.filas.forEach(function(f){
    if (f.valores[hora] > 0) personas++;
  });

  return personas > 0 ? target * personas : null;

}

function hxhColorTotalHora(valorTotal, targetTotal){
  if (!valorTotal || valorTotal <= 0) return "";
  if (targetTotal === null || targetTotal === undefined) return "";
  return valorTotal >= targetTotal
    ? "background:#39ff14; color:#000;"
    : "background:#ff0033; color:#fff;";
}

// Igual que hxhEsCeldaRoja pero para la celda de la fila TOTAL —
// se usa para saber si esa hora, en conjunto, es comentable.
function hxhEsTotalRoja(valorTotal, targetTotal){
  if (!valorTotal || valorTotal <= 0) return false;
  if (targetTotal === null || targetTotal === undefined) return false;
  return valorTotal < targetTotal;
}

// Target fijo, sin escalones ni ajuste por minutos efectivos: se
// compara directo contra HXH_TARGET_POR_PERSONA_HORA[proceso].
// Devuelve true (verde), false (rojo) o null (sin target / sin
// valor: la celda no se colorea).
function hxhEsVerdeCelda(valor, proceso){

  if (!valor || valor <= 0) return null;

  const target = hxhTargetCelda(proceso);
  if (target === null) return null;
  return valor >= target;

}

function hxhColorCelda(valor, proceso){
  const verde = hxhEsVerdeCelda(valor, proceso);
  if (verde === null) return ""; // sin target definido o sin valor: celda sin colorear
  return verde
    ? "background:#39ff14; color:#000;"   // verde neón: cumple el target de la hora
    : "background:#ff0033; color:#fff;";  // rojo neón: por debajo del target de la hora
}

// Solo las celdas en rojo son comentables; no tiene sentido justificar
// una hora que ya cumplió el target.
function hxhEsCeldaRoja(valor, proceso){
  return hxhEsVerdeCelda(valor, proceso) === false;
}

function hxhFormato(n, unidad){
  const decimales = unidad === "PAL" ? 0 : 2;
  return Number(n || 0).toLocaleString("es-PE", { maximumFractionDigits: decimales, minimumFractionDigits: decimales });
}

function hxhNombreCorto(nombre){
  if (!nombre) return "";
  const primera = nombre.trim().split(/\s+/)[0];
  return primera.replace(/[,;.]+$/, "").toUpperCase();
}

function hxhTablaHtml(tabla, unidad, proceso, comentarios, limite){

  let html = '<table class="hxh-t"><tr><th>Auxiliar</th>';
  tabla.horas.forEach(function(h){
    html += "<th>" + String(h).padStart(2, "0") + "</th>";
  });
  html += "<th>Total</th></tr>";

  // Si se pasa un límite, solo se muestran los primeros N auxiliares
  // (la tabla ya viene ordenada de mayor a menor por total). La fila
  // TOTAL siempre suma a TODOS los auxiliares, no solo a los mostrados.
  const filasAMostrar = limite ? tabla.filas.slice(0, limite) : tabla.filas;

  filasAMostrar.forEach(function(f){
    html += '<tr><td title="' + (f.auxiliar || "").toUpperCase() + '">' + hxhNombreCorto(f.auxiliar) + "</td>";
    tabla.horas.forEach(function(h){

      const v = f.valores[h];
      const style = hxhColorCelda(v, proceso);

      // Las celdas individuales (por persona) ya no son comentables —
      // el comentario solo se puede dejar en la fila TOTAL.
      html += '<td style="' + style + '">' + (v > 0 ? hxhFormato(v, unidad) : "-") + "</td>";

    });
    html += "<td><b>" + hxhFormato(f.total, unidad) + "</b></td></tr>";
  });

  html += '<tr class="hxh-total"><td>TOTAL</td>';
  tabla.horas.forEach(function(h){

    const valorHora = tabla.totales.valores[h];
    const targetHora = hxhTargetTotalHora(tabla, proceso, h);
    const styleTotal = hxhColorTotalHora(valorHora, targetHora);

    // Mismo mecanismo de comentarios que las celdas individuales,
    // pero con "TOTAL" como auxiliar — así se puede justificar por
    // qué salió roja la hora completa, no solo una persona.
    const claveTotal = proceso + "|TOTAL|" + h;
    const comentarioTotal = comentarios ? comentarios[claveTotal] : null;

    const attrsTotal = hxhEsTotalRoja(valorHora, targetHora)
      ? ' class="hxh-celda-com" data-proceso="' + proceso + '" data-auxiliar="TOTAL" data-hora="' + h + '"'
      : "";

    const badgeTotal = comentarioTotal
      ? '<span class="hxh-com-badge" title="' + comentarioTotal.replace(/"/g, "&quot;") + '">💬</span>'
      : "";

    html += '<td style="' + styleTotal + '"' + attrsTotal + '>' + hxhFormato(valorHora, unidad) + badgeTotal + "</td>";

  });
  html += "<td>" + hxhFormato(tabla.totales.total, unidad) + "</td></tr>";

  // Fila compacta: cuánto subió/bajó el total real vs la suma de
  // targets individuales de esa hora (mismo criterio de la fila
  // TOTAL). Sin gráfico, solo el número — hora sin nadie trabajando
  // se marca con "-", no como "bajó a 0".
  html += '<tr class="hxh-variacion"><td>Backlog</td>';
  tabla.horas.forEach(function(h){

    const valorHora = tabla.totales.valores[h];
    const targetHora = hxhTargetTotalHora(tabla, proceso, h);

    if (targetHora === null){
      html += "<td>-</td>";
      return;
    }

    const delta = valorHora - targetHora;
    const color = delta >= 0 ? "#1e8449" : "#c0392b";
    const texto = (delta >= 0 ? "+" : "") + hxhFormato(delta, unidad);

    html += '<td style="color:' + color + ';font-weight:800;">' + texto + "</td>";

  });
  html += "<td>" + (function(){
    const totalTarget = tabla.horas.reduce(function(s, h){
      const t = hxhTargetTotalHora(tabla, proceso, h);
      return s + (t === null ? 0 : t);
    }, 0);
    if (totalTarget === 0) return "-";
    const deltaTotal = tabla.totales.total - totalTarget;
    const color = deltaTotal >= 0 ? "#1e8449" : "#c0392b";
    return '<b style="color:' + color + ';">' + (deltaTotal >= 0 ? "+" : "") + hxhFormato(deltaTotal, unidad) + "</b>";
  })() + "</td></tr>";

  html += "</table>";

  return html;

}

function hxhTablaSimpleHtml(tabla){

  let html = '<table class="hxh-t"><tr><th>Auxiliar</th><th>Total</th></tr>';

  tabla.filas.forEach(function(f){
    html += '<tr><td title="' + (f.auxiliar || "").toUpperCase() + '">' + hxhNombreCorto(f.auxiliar) + "</td><td><b>" + hxhFormato(f.total) + "</b></td></tr>";
  });

  html += '<tr class="hxh-total"><td>TOTAL</td><td>' + hxhFormato(tabla.totales.total) + "</td></tr>";
  html += "</table>";

  return html;

}

function hxhGaugeSvg(valor, meta){

  const pct = meta > 0 ? Math.min(1, valor / meta) : 0;
  const angulo = pct * 180;
  const grandes = angulo > 180 ? 1 : 0;
  const rad = (Math.PI / 180) * angulo;
  const x = 100 - 80 * Math.cos(rad);
  const y = 100 - 80 * Math.sin(rad);

  return '<svg width="200" height="110" viewBox="0 0 200 110">' +
    '<path d="M20,100 A80,80 0 0 1 180,100" fill="none" stroke="#eef1f4" stroke-width="14"/>' +
    '<path d="M20,100 A80,80 0 ' + grandes + ' 1 ' + x.toFixed(1) + ',' + y.toFixed(1) + '" fill="none" stroke="#0d2b4e" stroke-width="14"/>' +
    "</svg>";

}

function renderHoraXHora(data, fecha, turno){

  document.getElementById("hxhTablaPicking").innerHTML =
    hxhTablaHtml(data.PICKING, "TN", "PICKING", window.hxhComentarios);

  document.getElementById("hxhTablaExtraccion").innerHTML =
    hxhTablaHtml(data.EXTRACCION, "PAL", "EXTRACCION", window.hxhComentarios);
  document.getElementById("hxhTablaRepo").innerHTML =
    hxhTablaHtml(data.REPO.tablaPal, "PAL", "REPO", window.hxhComentarios);
  document.getElementById("hxhTablaAlmacenamiento").innerHTML =
    hxhTablaHtml(data.ALMACENAMIENTO, "PAL", "ALMACENAMIENTO", window.hxhComentarios);

  const top3 = data.PICKING.filas.slice(0, 3);
  let htmlTop3 = "";
  top3.forEach(function(f, i){
    htmlTop3 += '<div class="hxh-top3-fila">' +
      '<span class="hxh-top3-pos">' + (i + 1) + '</span>' +
      '<span class="hxh-top3-nombre">' + (f.auxiliar || "").toUpperCase() + '</span>' +
      '<span class="hxh-top3-valor">' + hxhFormato(f.total) + ' TN</span>' +
      '</div>';
  });
  document.getElementById("hxhTop3").innerHTML = htmlTop3 || "<div style='padding:10px;font-size:12px;'>Sin datos</div>";

  function setTop(id, fila, unidad){
    const el = document.getElementById(id);
    el.querySelector(".hxh-top-nombre").textContent = fila ? String(fila.auxiliar).toUpperCase() : "—";
    el.querySelector(".hxh-top-valor").textContent = fila ? hxhFormato(fila.total, unidad) + " " + unidad : "—";
  }
  setTop("hxhTopPicking", data.PICKING.filas[0], "TN");
  setTop("hxhTopExtraccion", data.EXTRACCION.filas[0], "PAL");
  setTop("hxhTopAlmacenamiento", data.ALMACENAMIENTO.filas[0], "PAL");

  const HXH_ICO_PICKING = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1f6feb" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>';
  const HXH_ICO_EXTRACCION = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1e8449" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.3"/><circle cx="18.5" cy="18.5" r="2.3"/></svg>';
  const HXH_ICO_ALMACENAMIENTO = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6c3483" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21V9l9-6 9 6v12"/><path d="M9 21v-8h6v8"/></svg>';
  const HXH_ICO_NARANJA = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#e67e22" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 8l-9-5-9 5 9 5 9-5z"/><path d="M3 8v8l9 5 9-5V8"/><path d="M12 13v8"/></svg>';

  const kpis = [
    { proceso: "PICKING", unidad: "TN", color: "#0d2b4e", clase: "azul", icono: HXH_ICO_PICKING },
    { proceso: "EXTRACCION", unidad: "PAL", color: "#1e8449", clase: "verde", icono: HXH_ICO_EXTRACCION },
    { proceso: "ALMACENAMIENTO", unidad: "PAL", color: "#6c3483", clase: "morado", icono: HXH_ICO_ALMACENAMIENTO }
  ];

  const metasPlan = window.hxhMetasPlanificadas || {};

  const metasPorProceso = {
    PICKING: metasPlan.metaPicking || 0,
    EXTRACCION: metasPlan.metaExtraccionPal || 0,
    ALMACENAMIENTO: HXH_METAS.ALMACENAMIENTO
  };

  let htmlKpis = "";
  kpis.forEach(function(k){
    const total = data[k.proceso].totales.total;
    const meta = metasPorProceso[k.proceso];
    const pct = meta > 0 ? Math.min(100, Math.round((total / meta) * 100)) : 0;

    htmlKpis += '<div class="hxh-kpi">' +
      '<div class="hxh-kpi-label">' + HXH_NOMBRES[k.proceso] + ' (' + k.unidad + ')</div>' +
      '<div class="hxh-kpi-fila">' +
        '<div class="hxh-kpi-valor" style="color:' + k.color + '">' + hxhFormato(total, k.unidad) + '</div>' +
        '<div class="hxh-kpi-meta">META: ' + meta + ' ' + k.unidad + '</div>' +
      '</div>' +
      '<div class="hxh-barra"><div class="hxh-barra-fill" style="width:' + pct + '%;background:' + k.color + ';"></div></div>' +
      '</div>';
  });
  document.getElementById("hxhKpis").innerHTML = htmlKpis;

  let htmlLateral = "";
  kpis.forEach(function(k){
    const total = data[k.proceso].totales.total;
    const meta = metasPorProceso[k.proceso];
    const pct = meta > 0 ? Math.round((total / meta) * 100) : 0;
    htmlLateral += '<div class="hxh-lateral-item">' +
      '<div class="hxh-ico hxh-ico-' + k.clase + '">' + k.icono + '</div>' +
      '<div>' +
        '<div class="hxh-lateral-label">AVANCE ' + HXH_NOMBRES[k.proceso] + '</div>' +
        '<div class="hxh-lateral-valor">' + pct + '%</div>' +
      '</div>' +
      '</div>';
  });

  const tnAlmacenamiento = data.ALMACENAMIENTO.totalTN || 0;
  htmlLateral += '<div class="hxh-lateral-item">' +
    '<div class="hxh-ico hxh-ico-naranja">' + HXH_ICO_NARANJA + '</div>' +
    '<div>' +
      '<div class="hxh-lateral-label">TN ALMACENAMIENTO</div>' +
      '<div class="hxh-lateral-valor" style="color:#e67e22">' + hxhFormato(tnAlmacenamiento) + '</div>' +
    '</div>' +
    '</div>';

  document.getElementById("hxhLateral").innerHTML = htmlLateral;

  // Gauge TN total turno: avance real = Picking (TN) + Extracción (TN real,
  // no el conteo en PAL) vs. la meta = TNL Planificado (Picking + Extracción planificados)
  const tnPickingReal = data.PICKING.totales.total;
  const tnExtraccionReal = data.EXTRACCION.totalTN || 0;
  const tnTurno = tnPickingReal + tnExtraccionReal;
  const metaTurno = metasPlan.metaTotalTN || 0;
  const cumplimiento = metaTurno > 0
    ? Math.round((tnTurno / metaTurno) * 1000) / 10
    : 0;

  document.getElementById("hxhGauge").innerHTML =
    hxhGaugeSvg(tnTurno, metaTurno) +
    '<div class="hxh-gauge-valor">' + hxhFormato(tnTurno) + ' TN</div>' +
    '<div class="hxh-gauge-label">de ' + hxhFormato(metaTurno) + ' TN</div>' +
    '<div class="hxh-gauge-cumpl">CUMPLIMIENTO ' + cumplimiento + '%</div>';

  actualizarSubtituloHxh();

}

// =====================================================================
// COMENTARIOS POR CELDA
// =====================================================================

document.addEventListener("click", function(e){

  const celda = e.target.closest(".hxh-celda-com");
  if(!celda) return;

  abrirModalComentario(
    celda.dataset.proceso,
    celda.dataset.auxiliar,
    Number(celda.dataset.hora)
  );

});

let _hxhComentarioActual = null;

function abrirModalComentario(proceso, auxiliar, hora){

  const fecha = document.getElementById("hxhFecha").value;
  const turno = document.getElementById("hxhTurno").value;

  _hxhComentarioActual = {
    fecha: fecha,
    turno: turno,
    proceso: proceso,
    auxiliar: auxiliar,
    hora: hora
  };

  const clave = proceso + "|" + auxiliar + "|" + hora;
  const existente = (window.hxhComentarios && window.hxhComentarios[clave]) || "";

  document.getElementById("hxhComTitulo").textContent =
    auxiliar + " · " + String(hora).padStart(2, "0") + ":00 · " + HXH_NOMBRES[proceso];

  document.getElementById("hxhComTexto").value = existente;

  document.getElementById("hxhModalComentario").style.display = "flex";

}

function cerrarModalComentario(){

  document.getElementById("hxhModalComentario").style.display = "none";
  _hxhComentarioActual = null;

}

async function guardarModalComentario(){

  if(!_hxhComentarioActual) return;

  const texto = document.getElementById("hxhComTexto").value.trim();

  if(!texto){
    mostrarAlertaModal("Escribe un comentario antes de guardar.", "warning");
    return;
  }

  const registro = Object.assign({}, _hxhComentarioActual, { comentario: texto });

  try{

    await guardarComentarioHxh(registro);
    cerrarModalComentario();
    cargarHoraXHora();

  }catch(err){
    mostrarAlertaModal("Error al guardar: " + err.message, "error");
  }

}

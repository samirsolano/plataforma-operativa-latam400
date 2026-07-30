// =======================================
// DASHBOARD (PLANIFICACIÓN Y AVANCE DIARIO) - UI
// =======================================

let dashDatos = null;
let dashIntervaloReloj = null;
let dashComentarioSeleccionado = null;

function formatoTN(valor){
  return (Number(valor) || 0).toLocaleString("es-PE", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + " TN";
}

function formatoPal(valor){
  return Math.round(Number(valor) || 0) + " PAL";
}

function formatoHora(h){
  return String(h).padStart(2, "0") + ":00";
}

async function cargarDashboard(){

  const fecha = document.getElementById("fecha").value;
  const turno = document.getElementById("turno").value;

  if(!fecha || !turno){
    return;
  }

  document.getElementById("dashMensajeCarga").classList.remove("oculto");
  document.getElementById("dashContenido").classList.add("oculto");

  try{

    const [datos, comentarios] = await Promise.all([
      construirDashboard(fecha, normalizarTurnoPlanif(turno)),
      obtenerComentariosDashboard(fecha, normalizarTurnoPlanif(turno))
    ]);

    dashDatos = datos;
    dashDatos.comentarios = comentarios;

    pintarDashboard();

    document.getElementById("dashMensajeCarga").classList.add("oculto");
    document.getElementById("dashContenido").classList.remove("oculto");

    document.getElementById("dashUltimaActualizacion").textContent =
      new Date().toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" });

    iniciarRelojDashboard();

  }catch(e){

    document.getElementById("dashMensajeCarga").textContent =
      "Error al cargar el dashboard: " + e.message;

  }

}

function iniciarRelojDashboard(){

  if(dashIntervaloReloj){
    clearInterval(dashIntervaloReloj);
  }

  function actualizarReloj(){
    const el = document.getElementById("dashHoraActual");
    if(el){
      el.textContent = new Date().toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" });
    }
  }

  actualizarReloj();
  dashIntervaloReloj = setInterval(actualizarReloj, 30000);

}

function pintarDashboard(){

  pintarCanales();
  pintarKPIsDashboard();
  pintarSeccion("PICKING", dashDatos.picking, "dashChartPicking", "dashResumenPicking", formatoTN, "TN");
  pintarSeccion("EXTRACCION", dashDatos.extraccion, "dashChartExtraccion", "dashResumenExtraccion", formatoPal, "PAL");
  pintarComentariosDashboard();

}

function pintarCanales(){

  const cont = document.getElementById("dashCanales");
  cont.innerHTML = "";

  dashDatos.canales.forEach(function(c){

    const fila = document.createElement("div");
    fila.className = "dash-canal-fila";

    fila.innerHTML =
      '<span class="dash-canal-nombre">' + c.nombre + '</span>' +
      '<span class="dash-canal-tn">' + formatoTN(c.tn) + '</span>' +
      '<span class="dash-canal-pct">' + c.pct.toFixed(0) + '%</span>' +
      '<div class="dash-canal-barra"><div class="dash-canal-barra-relleno" style="width:' + c.pct.toFixed(1) + '%"></div></div>';

    cont.appendChild(fila);

  });

  if(dashDatos.canales.length === 0){
    cont.innerHTML = '<div class="dash-lista-vacia">Sin planificación registrada.</div>';
  }

  document.getElementById("dashTotalPlanificado").textContent = formatoTN(dashDatos.tnPlanificado);

}

function pintarKPIsDashboard(){

  const d = dashDatos;

  document.getElementById("dashTnEjecutado").textContent = formatoTN(d.tnEjecutado);
  document.getElementById("dashTnEjecutadoPct").textContent =
    d.tnPlanificado > 0 ? ((d.tnEjecutado / d.tnPlanificado) * 100).toFixed(1) + "% del objetivo" : "-";

  document.getElementById("dashTnRestante").textContent = formatoTN(d.tnRestante);
  document.getElementById("dashTnRestantePct").textContent =
    d.tnPlanificado > 0 ? ((d.tnRestante / d.tnPlanificado) * 100).toFixed(1) + "% por ejecutar" : "-";

  document.getElementById("dashProyeccion").textContent = formatoTN(d.proyeccionCierre);
  document.getElementById("dashProyeccionPct").textContent =
    d.tnPlanificado > 0 ? ((d.proyeccionCierre / d.tnPlanificado) * 100).toFixed(1) + "% del objetivo" : "-";

  document.getElementById("dashPersonas").textContent =
    d.personasActivas.activos + " de " + d.personasActivas.total;

}

function iconoEstado(estado){
  if(estado === "cumplida") return "✅";
  if(estado === "riesgo") return "🟠";
  if(estado === "no_cumplida") return "❌";
  return "";
}

function pintarSeccion(proceso, serie, idChart, idResumen, formateador, unidad){

  const chart = document.getElementById(idChart);
  chart.innerHTML = "";

  const maxValor = serie.filas.reduce(function(m, f){
    return Math.max(m, f.meta || 0, f.real || 0, f.proyeccion || 0);
  }, 1) * 1.15;

  const ALTO_PX = 120;

  serie.filas.forEach(function(f){

    const col = document.createElement("div");
    col.className = "dash-hora-col" + (f.esHoraActual ? " dash-hora-actual" : "");
    col.onclick = function(){ abrirModalComentario(proceso, f); };

    const altoTarget = Math.max((f.meta / maxValor) * ALTO_PX, f.meta > 0 ? 2 : 0);
    const altoReal = f.real !== null ? Math.max((f.real / maxValor) * ALTO_PX, f.real > 0 ? 2 : 0) : 0;
    const altoProy = f.proyeccion !== null ? Math.max((f.proyeccion / maxValor) * ALTO_PX, 2) : 0;

    let barras = '<div class="dash-barra dash-barra-target" style="height:' + altoTarget + 'px"></div>';

    if(f.esFuturo){
      barras += '<div class="dash-barra dash-barra-proyeccion" style="height:' + altoProy + 'px"></div>';
    }else{
      barras += '<div class="dash-barra dash-barra-real' + (f.estado ? ' dash-real-' + f.estado : '') + '" style="height:' + altoReal + 'px"></div>';
    }

    const tieneComentario = (dashDatos.comentarios || []).some(function(c){
      return c.proceso === proceso && c.hora === f.hora;
    });

    col.innerHTML =
      '<div class="dash-hora-personas">👤 ' + f.personas + '</div>' +
      '<div class="dash-hora-barras">' + barras + '</div>' +
      '<div class="dash-hora-label">' + formatoHora(f.hora) + '</div>' +
      '<div class="dash-hora-estado">' + iconoEstado(f.estado) + '</div>' +
      (tieneComentario ? '<div class="dash-hora-comentario">💬</div>' : '');

    chart.appendChild(col);

  });

  const resumen = document.getElementById(idResumen);

  function filaResumen(etiqueta, valores){
    const valoresHtml = valores.map(function(v){
      return '<div class="dash-resumen-valor">' + (v === null ? "-" : formateador(v).replace(" " + unidad, "")) + '</div>';
    }).join("");
    return '<div class="dash-resumen-fila"><span>' + etiqueta + ' (' + unidad + ')</span><div class="dash-resumen-valores">' + valoresHtml + '</div></div>';
  }

  resumen.innerHTML =
    filaResumen("Meta Acumulada", serie.filas.map(function(f){ return f.esFuturo ? null : f.metaAcumulada; })) +
    filaResumen("Real Acumulado", serie.filas.map(function(f){ return f.esFuturo ? null : f.realAcumulado; }));

}

function pintarComentariosDashboard(){

  const cont = document.getElementById("dashListaComentarios");
  const lista = dashDatos.comentarios || [];

  if(lista.length === 0){
    cont.innerHTML = '<div class="dash-lista-vacia">Sin comentarios registrados.</div>';
    return;
  }

  cont.innerHTML = lista.map(function(c){

    const sevClase = c.severidad === "critico" ? " dash-sev-critico" : (c.severidad === "riesgo" ? " dash-sev-riesgo" : "");
    const fechaHora = c.created_at ? new Date(c.created_at).toLocaleString("es-PE", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" }) : "";

    return (
      '<div class="dash-comentario-item' + sevClase + '">' +
      '<div class="dash-comentario-meta">' + c.proceso + ' · ' + formatoHora(c.hora) + ' · ' + (c.autor || "Usuario") + ' · ' + fechaHora + '</div>' +
      '<div class="dash-comentario-texto">' + c.comentario + '</div>' +
      '</div>'
    );

  }).join("");

}

// ---------------------------------------------------------
// MODAL "AGREGAR COMENTARIO"
// ---------------------------------------------------------

function abrirModalComentario(proceso, fila){

  dashComentarioSeleccionado = { proceso: proceso, hora: fila.hora, meta: fila.meta, real: fila.real };

  document.getElementById("dashComArea").value = proceso === "PICKING" ? "PICKING" : "EXTRACCIÓN";
  document.getElementById("dashComHora").value = formatoHora(fila.hora);
  document.getElementById("dashComMeta").value = fila.meta !== null ? fila.meta.toFixed(2) : "-";
  document.getElementById("dashComReal").value = fila.real !== null ? fila.real.toFixed(2) : "-";
  document.getElementById("dashComTexto").value = "";

  document.getElementById("dashModalComentario").classList.remove("oculto");

}

function cerrarModalComentario(){
  document.getElementById("dashModalComentario").classList.add("oculto");
  dashComentarioSeleccionado = null;
}

async function guardarComentarioDashboardUI(){

  const texto = document.getElementById("dashComTexto").value.trim();

  if(!texto){
    mostrarAlertaModal("Escribe un comentario antes de guardar.", "warning");
    return;
  }

  if(!dashComentarioSeleccionado){
    return;
  }

  const sesion = JSON.parse(localStorage.getItem("latam400_sesion") || "{}");

  try{

    await guardarComentarioDashboard({
      fecha: dashDatos.fecha,
      turno: dashDatos.turno,
      proceso: dashComentarioSeleccionado.proceso,
      hora: dashComentarioSeleccionado.hora,
      meta: dashComentarioSeleccionado.meta,
      real: dashComentarioSeleccionado.real,
      comentario: texto,
      autor: sesion.nombre || sesion.usuario || "Usuario"
    });

    cerrarModalComentario();

    dashDatos.comentarios = await obtenerComentariosDashboard(dashDatos.fecha, dashDatos.turno);
    pintarComentariosDashboard();
    pintarSeccion("PICKING", dashDatos.picking, "dashChartPicking", "dashResumenPicking", formatoTN, "TN");
    pintarSeccion("EXTRACCION", dashDatos.extraccion, "dashChartExtraccion", "dashResumenExtraccion", formatoPal, "PAL");

  }catch(e){
    mostrarAlertaModal("Error al guardar el comentario: " + e.message, "error");
  }

}

document.addEventListener("DOMContentLoaded", function(){

  const btnRefrescar = document.getElementById("btnDashRefrescar");
  if(btnRefrescar) btnRefrescar.onclick = cargarDashboard;

  const btnNuevo = document.getElementById("btnDashNuevoComentario");
  if(btnNuevo) btnNuevo.onclick = function(){
    abrirModalComentario("PICKING", { hora: new Date().getHours(), meta: null, real: null });
  };

  const btnCancelar = document.getElementById("btnDashCancelarComentario");
  if(btnCancelar) btnCancelar.onclick = cerrarModalComentario;

  const btnGuardar = document.getElementById("btnDashGuardarComentario");
  if(btnGuardar) btnGuardar.onclick = guardarComentarioDashboardUI;

});

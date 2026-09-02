// =========================================================
// DIÁLOGO DIARIO - UI
// Muestra, para la fecha elegida en el sidebar, Despacho
// Extracción/Picking (TON, con desglose día/noche) y Tiempo de
// estadía promedio por transportista. Ver dialogo-diario-logica.js
// para de dónde sale cada dato.
// =========================================================

function abrirDialogoDiario(){

  document.getElementById("modDialogoDiario").style.display = "block";

  cargarDialogoDiario(fechaSeleccionada);
  cargarHistoricoDialogoDiario();

}

function ddFormatoTn(valor){
  return (valor === null || valor === undefined) ? "—" : valor.toFixed(2);
}

function ddFormatoHoras(valor){
  return (valor === null || valor === undefined) ? "—" : valor.toFixed(2) + " h";
}

function ddPoner(id, texto){
  const el = document.getElementById(id);
  if(el) el.textContent = texto;
}

async function cargarDialogoDiario(fecha){

  const aviso = document.getElementById("ddAviso");
  aviso.style.display = "none";
  aviso.textContent = "";

  if(!fecha){
    aviso.textContent = "Selecciona una fecha en el panel de la izquierda.";
    aviso.style.display = "block";
    return;
  }

  document.getElementById("ddFechaTitulo").textContent = fecha;

  [
    "ddDespachoExtraccion", "ddDespachoPicking",
    "ddExtraccionDia", "ddExtraccionNoche",
    "ddPickingDia", "ddPickingNoche",
    "ddEstadiaDespacho", "ddEstadiaRL", "ddEstadiaCM",
    "ddEstadiaNsChico", "ddEstadiaLD", "ddEstadiaTraslado"
  ].forEach(function(id){ ddPoner(id, "…"); });

  const resultado = await obtenerDialogoDiario(fecha);

  // ---- SAP: Despacho Extracción/Picking ----

  if(resultado.sap){

    const s = resultado.sap;

    ddPoner("ddDespachoExtraccion", ddFormatoTn(s.extraccion.total));
    ddPoner("ddDespachoPicking", ddFormatoTn(s.picking.total));
    ddPoner("ddExtraccionDia", ddFormatoTn(s.extraccion.dia));
    ddPoner("ddExtraccionNoche", ddFormatoTn(s.extraccion.noche));
    ddPoner("ddPickingDia", ddFormatoTn(s.picking.dia));
    ddPoner("ddPickingNoche", ddFormatoTn(s.picking.noche));

  }else{

    ["ddDespachoExtraccion", "ddDespachoPicking", "ddExtraccionDia", "ddExtraccionNoche", "ddPickingDia", "ddPickingNoche"]
      .forEach(function(id){ ddPoner(id, "—"); });

    console.error("Diálogo Diario — error SAP:", resultado.sapError);
    mostrarSeccionError(aviso, "No se pudo leer la data SAP para esta fecha.");

  }

  // ---- L400: Tiempo de estadía ----

  if(resultado.estadia){

    const e = resultado.estadia;

    ddPoner("ddEstadiaDespacho", ddFormatoHoras(e.despacho.promedio));
    ddPoner("ddEstadiaRL", ddFormatoHoras(e.RL.promedio));
    ddPoner("ddEstadiaCM", ddFormatoHoras(e.CM.promedio));
    ddPoner("ddEstadiaNsChico", ddFormatoHoras(e.nsChico.promedio));
    ddPoner("ddEstadiaLD", ddFormatoHoras(e.LD.promedio));
    ddPoner("ddEstadiaTraslado", ddFormatoHoras(e.traslado.promedio));

  }else{

    ["ddEstadiaDespacho", "ddEstadiaRL", "ddEstadiaCM", "ddEstadiaNsChico", "ddEstadiaLD", "ddEstadiaTraslado"]
      .forEach(function(id){ ddPoner(id, "—"); });

    console.error("Diálogo Diario — error L400:", resultado.estadiaError);
    mostrarSeccionError(aviso, "No se pudo leer el Sheet L400 (Tiempo de estadía) para esta fecha.");

  }

}

function mostrarSeccionError(elAviso, mensaje){

  elAviso.style.display = "block";
  elAviso.textContent = elAviso.textContent
    ? (elAviso.textContent + " " + mensaje)
    : mensaje;

}

// =========================================================
// HISTÓRICO — una fila por día, desde DD_HISTORICO_DESDE hasta hoy.
// Sin gráfico: tabla simple (pedido explícito del usuario).
// =========================================================

function ddFormatoFechaLarga(fechaISO){
  const partes = fechaISO.split("-");
  return partes[2] + "/" + partes[1] + "/" + partes[0];
}

async function cargarHistoricoDialogoDiario(){

  const aviso = document.getElementById("ddHistoricoAviso");
  const tbody = document.getElementById("ddTablaHistorico");

  aviso.style.display = "none";
  aviso.textContent = "";

  const resultado = await obtenerHistoricoDialogoDiario();

  if(!resultado.sap){
    console.error("Diálogo Diario — error histórico SAP:", resultado.sapError);
    mostrarSeccionError(aviso, "No se pudo cargar el histórico de Extracción/Picking.");
  }

  if(!resultado.estadia){
    console.error("Diálogo Diario — error histórico L400:", resultado.estadiaError);
    mostrarSeccionError(aviso, "No se pudo cargar el histórico de Tiempo de estadía.");
  }

  // Une ambas fuentes por fecha (una puede tener días que la otra no).
  const porFecha = {};

  (resultado.sap || []).forEach(function(d){
    porFecha[d.fecha] = Object.assign({ fecha: d.fecha }, porFecha[d.fecha], {
      extraccion: d.extraccion,
      picking: d.picking
    });
  });

  (resultado.estadia || []).forEach(function(d){
    porFecha[d.fecha] = Object.assign({ fecha: d.fecha }, porFecha[d.fecha], {
      estadia: d.promedio
    });
  });

  const fechas = Object.keys(porFecha).sort().reverse(); // más reciente primero

  if(!fechas.length){
    tbody.innerHTML = '<tr><td colspan="4" class="dd-tabla-vacio">Sin datos desde el ' + ddFormatoFechaLarga(DD_HISTORICO_DESDE) + '.</td></tr>';
    return;
  }

  tbody.innerHTML = fechas.map(function(fecha){

    const d = porFecha[fecha];

    return "<tr>" +
      "<td>" + ddFormatoFechaLarga(fecha) + "</td>" +
      "<td>" + ddFormatoTn(d.extraccion) + "</td>" +
      "<td>" + ddFormatoTn(d.picking) + "</td>" +
      "<td>" + ddFormatoHoras(d.estadia) + "</td>" +
      "</tr>";

  }).join("");

}

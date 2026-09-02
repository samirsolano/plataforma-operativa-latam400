// =========================================================
// DIÁLOGO DIARIO - UI
// Tabla histórica (una fila por día, desde DD_HISTORICO_DESDE hasta
// hoy) con Despacho Extracción/Picking (TON) y Tiempo de estadía
// despacho (horas). Ver dialogo-diario-logica.js para de dónde sale
// cada dato.
// =========================================================

function abrirDialogoDiario(){

  // "flex", no "block": #modDialogoDiario es un contenedor flex-column
  // (ver dialogo-diario.css) para que la tabla ocupe el alto
  // disponible en vez de quedar con un espacio vacío abajo. Un
  // style.display inline en "block" pisaría ese layout.
  document.getElementById("modDialogoDiario").style.display = "flex";

  cargarHistoricoDialogoDiario();

}

function ddFormatoTn(valor){
  return (valor === null || valor === undefined) ? "—" : valor.toFixed(2);
}

function ddFormatoHoras(valor){
  return (valor === null || valor === undefined) ? "—" : valor.toFixed(2) + " h";
}

function ddFormatoFechaLarga(fechaISO){
  const partes = fechaISO.split("-");
  return partes[2] + "/" + partes[1] + "/" + partes[0];
}

function mostrarSeccionError(elAviso, mensaje){

  elAviso.style.display = "block";
  elAviso.textContent = elAviso.textContent
    ? (elAviso.textContent + " " + mensaje)
    : mensaje;

}

// Guarda la última tabla armada (fechas ya ordenadas, más reciente
// primero) para que "Exportar a Excel" no tenga que volver a pedir
// todo — exporta exactamente lo que se está viendo en pantalla.
let ddFilasHistoricoActual = [];

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
    porFecha[d.fecha] = Object.assign({ fecha: d.fecha }, porFecha[d.fecha], d);
  });

  (resultado.estadia || []).forEach(function(d){
    porFecha[d.fecha] = Object.assign({ fecha: d.fecha }, porFecha[d.fecha], d);
  });

  const fechas = Object.keys(porFecha).sort().reverse(); // más reciente primero

  ddFilasHistoricoActual = fechas.map(function(fecha){ return porFecha[fecha]; });

  if(!fechas.length){
    tbody.innerHTML = '<tr><td colspan="13" class="dd-tabla-vacio">Sin datos desde el ' + ddFormatoFechaLarga(DD_HISTORICO_DESDE) + '.</td></tr>';
    return;
  }

  tbody.innerHTML = fechas.map(function(fecha){

    const d = porFecha[fecha];

    return "<tr>" +
      "<td>" + ddFormatoFechaLarga(fecha) + "</td>" +
      "<td>" + ddFormatoTn(d.extraccionTotal) + "</td>" +
      "<td>" + ddFormatoTn(d.pickingTotal) + "</td>" +
      "<td>" + ddFormatoTn(d.extraccionDia) + "</td>" +
      "<td>" + ddFormatoTn(d.extraccionNoche) + "</td>" +
      "<td>" + ddFormatoTn(d.pickingDia) + "</td>" +
      "<td>" + ddFormatoTn(d.pickingNoche) + "</td>" +
      "<td>" + ddFormatoHoras(d.despacho) + "</td>" +
      "<td>" + ddFormatoHoras(d.RL) + "</td>" +
      "<td>" + ddFormatoHoras(d.CM) + "</td>" +
      "<td>" + ddFormatoHoras(d.nsChico) + "</td>" +
      "<td>" + ddFormatoHoras(d.LD) + "</td>" +
      "<td>" + ddFormatoHoras(d.traslado) + "</td>" +
      "</tr>";

  }).join("");

}

// =========================================================
// EXPORTAR A EXCEL — mismas columnas que la tabla en pantalla,
// vía SheetJS (ya cargado en esta página para "Cargar Data SAP").
// =========================================================

function exportarHistoricoDialogoDiario(){

  if(!ddFilasHistoricoActual.length){
    mostrarAlertaModal("Todavía no hay datos cargados para exportar.", "warning");
    return;
  }

  const encabezados = [
    "Fecha",
    "Despacho Extracción (TON)", "Despacho Picking (TON)",
    "Extracción turno día", "Extracción turno noche",
    "Picking turno día", "Picking turno noche",
    "Tiempo de estadía despacho (h)", "Tiempo de estadía RL (h)",
    "Tiempo de estadía CM (h)", "Tiempo de estadía NS Chico (h)",
    "Tiempo de estadía LD (h)", "Tiempo de estadía Traslado (h)"
  ];

  const filas = ddFilasHistoricoActual.map(function(d){
    return [
      ddFormatoFechaLarga(d.fecha),
      d.extraccionTotal ?? "", d.pickingTotal ?? "",
      d.extraccionDia ?? "", d.extraccionNoche ?? "",
      d.pickingDia ?? "", d.pickingNoche ?? "",
      d.despacho ?? "", d.RL ?? "",
      d.CM ?? "", d.nsChico ?? "",
      d.LD ?? "", d.traslado ?? ""
    ];
  });

  const hoja = XLSX.utils.aoa_to_sheet([encabezados].concat(filas));
  const libro = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(libro, hoja, "Dialogo Diario");

  const hoy = new Date().toISOString().slice(0, 10);

  XLSX.writeFile(libro, "dialogo-diario-" + hoy + ".xlsx");

}

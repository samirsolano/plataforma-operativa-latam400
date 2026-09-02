// =========================================================
// DIÁLOGO DIARIO - UI
// Tabla histórica (una fila por día, desde DD_HISTORICO_DESDE hasta
// hoy) con Despacho Extracción/Picking (TON) y Tiempo de estadía
// despacho (horas). Ver dialogo-diario-logica.js para de dónde sale
// cada dato.
// =========================================================

function abrirDialogoDiario(){

  document.getElementById("modDialogoDiario").style.display = "block";

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

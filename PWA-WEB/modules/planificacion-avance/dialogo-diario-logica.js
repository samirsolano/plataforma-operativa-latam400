// =========================================================
// DIÁLOGO DIARIO - Lógica
// Tabla histórica (una fila por día, desde DD_HISTORICO_DESDE hasta
// hoy) que junta dos fuentes ya conectadas en este proyecto:
//   - Supabase "tareas_almacen_sap" (cargada por "Cargar Data SAP"),
//     vía la función resumen_diario_sap (ver resumen-diario-sap.sql)
//     -> Despacho Extracción/Picking (TON), por turno y total, por día.
//   - Google Sheet "L400" (mismo SHEET_ID_PLANIF que usa
//     obtenerTnlDespachadasL400) -> Tiempo de estadía promedio por
//     transportista (columna GESTIÓN), por día.
// =========================================================

function ddRedondear(n){
  return Math.round((Number(n) || 0) * 100) / 100;
}

function ddPromedio(valores){

  if(!valores.length){
    return null;
  }

  const suma = valores.reduce(function(s, v){ return s + v; }, 0);

  return ddRedondear(suma / valores.length);

}

// Pedido explícito: arranca en agosto (la data SAP en sí empieza el
// 27/07/2026, pero julio queda fuera a propósito).
const DD_HISTORICO_DESDE = "2026-08-01";

// ---------------------------------------------------------
// FUENTE 1: SAP — Extracción / Picking, TON, por turno y por día.
// Usa la función resumen_diario_sap (ver resumen-diario-sap.sql) en
// vez de traer las filas crudas: un mes de tareas_almacen_sap son
// ~120,000 filas, inviable para el navegador. La función ya suma
// del lado del servidor y devuelve una fila por día+turno+proceso.
// ---------------------------------------------------------
async function ddObtenerHistoricoSap(desde){

  const filas = await planifFetch(
    "/rpc/resumen_diario_sap?p_desde=" + encodeURIComponent(desde)
  ) || [];

  const porDia = {}; // fecha -> { extraccion:{dia,noche}, picking:{dia,noche} }

  filas.forEach(function(f){

    const fecha = f.fecha;
    const proceso = (f.proceso || "").toUpperCase();

    if(proceso !== "EXTRACCION" && proceso !== "PICKING"){
      return;
    }

    const turno = (f.turno || "").toUpperCase() === "NOCHE" ? "noche" : "dia";
    const tn = Number(f.tn) || 0;

    if(!porDia[fecha]){
      porDia[fecha] = {
        extraccion: { dia: 0, noche: 0 },
        picking: { dia: 0, noche: 0 }
      };
    }

    porDia[fecha][proceso === "EXTRACCION" ? "extraccion" : "picking"][turno] += tn;

  });

  return Object.keys(porDia).sort().map(function(fecha){

    const d = porDia[fecha];

    return {
      fecha: fecha,
      extraccionDia: ddRedondear(d.extraccion.dia),
      extraccionNoche: ddRedondear(d.extraccion.noche),
      extraccionTotal: ddRedondear(d.extraccion.dia + d.extraccion.noche),
      pickingDia: ddRedondear(d.picking.dia),
      pickingNoche: ddRedondear(d.picking.noche),
      pickingTotal: ddRedondear(d.picking.dia + d.picking.noche)
    };

  });

}

// ---------------------------------------------------------
// FUENTE 2: Sheet L400 — Tiempo de estadía, por transportista y por
// día. D = GESTIÓN, AM = FECHA REPORTE, AO = ESTADIA UT. Filtrado en
// el servidor de Google (rango completo en una sola consulta, no
// hace falta pedir día por día).
// ---------------------------------------------------------

// Mapeo GESTIÓN (texto real del Sheet) -> categoría mostrada.
// Validado contra los valores reales de la columna D: "RL AS" y
// "RL CMP" son las dos variantes de RL; el resto matchea 1:1.
// DEX / TG / CLIENTE RECOGE no tienen columna propia, pero sí entran
// en el promedio general "despacho".
function ddCategoriaGestion(gestion){

  const g = String(gestion || "").trim().toUpperCase();

  if(g.indexOf("RL") === 0) return "RL";
  if(g === "CANAL MODERNO") return "CM";
  if(g === "N/S CHICO") return "nsChico";
  if(g === "LARGA DISTANCIA") return "LD";
  if(g === "TRASLADO") return "traslado";

  return null;

}

async function ddObtenerHistoricoEstadiaL400(desde){

  const consulta = "select D, AM, AO where AM >= date '" + desde + "'";

  const url =
    "https://docs.google.com/spreadsheets/d/" + SHEET_ID_PLANIF +
    "/gviz/tq?tqx=out:csv&sheet=" + encodeURIComponent(SHEET_NOMBRE_L400) +
    "&tq=" + encodeURIComponent(consulta);

  const respuesta = await fetch(url);

  if(!respuesta.ok){
    throw new Error("No se pudo leer el histórico de Tiempo de estadía (Sheet L400)");
  }

  const texto = await respuesta.text();
  const filas = parsearCSVFilas(texto);

  // fecha -> { despacho:[...], RL:[...], CM:[...], nsChico:[...], LD:[...], traslado:[...] }
  const porDia = {};

  filas.forEach(function(fila){

    const gestion = fila[0];

    // gviz devuelve la fecha como texto "DD/MM/YYYY" (verificado con
    // una consulta real) — se convierte a "YYYY-MM-DD" con el mismo
    // helper que ya usa el resto de Planificación y Avance, para que
    // ordene bien y calce con las fechas que vienen de Supabase (SAP).
    const fechaISO = convertirFechaPlanif(fila[1]);
    const estadia = Number(String(fila[2] || "").replace(/,/g, ""));

    if(!gestion || !fechaISO || isNaN(estadia)){
      return;
    }

    if(!porDia[fechaISO]){
      porDia[fechaISO] = { despacho: [], RL: [], CM: [], nsChico: [], LD: [], traslado: [] };
    }

    porDia[fechaISO].despacho.push(estadia);

    const categoria = ddCategoriaGestion(gestion);

    if(categoria){
      porDia[fechaISO][categoria].push(estadia);
    }

  });

  return Object.keys(porDia).sort().map(function(fecha){

    const d = porDia[fecha];

    return {
      fecha: fecha,
      despacho: ddPromedio(d.despacho),
      RL: ddPromedio(d.RL),
      CM: ddPromedio(d.CM),
      nsChico: ddPromedio(d.nsChico),
      LD: ddPromedio(d.LD),
      traslado: ddPromedio(d.traslado)
    };

  });

}

// ---------------------------------------------------------
// FUNCIÓN PRINCIPAL: junta ambas fuentes, una fila por día
// ---------------------------------------------------------
async function obtenerHistoricoDialogoDiario(){

  const [sap, estadia] = await Promise.allSettled([
    ddObtenerHistoricoSap(DD_HISTORICO_DESDE),
    ddObtenerHistoricoEstadiaL400(DD_HISTORICO_DESDE)
  ]);

  return {
    desde: DD_HISTORICO_DESDE,
    sap: sap.status === "fulfilled" ? sap.value : null,
    sapError: sap.status === "rejected" ? sap.reason : null,
    estadia: estadia.status === "fulfilled" ? estadia.value : null,
    estadiaError: estadia.status === "rejected" ? estadia.reason : null
  };

}

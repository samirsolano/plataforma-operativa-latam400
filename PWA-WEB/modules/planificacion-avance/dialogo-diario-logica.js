// =========================================================
// DIÁLOGO DIARIO - Lógica
// Junta dos fuentes ya conectadas en este proyecto:
//   - Supabase "tareas_almacen_sap" (cargada por "Cargar Data SAP")
//     -> Despacho Extracción/Picking (TON), por turno y total del día.
//   - Google Sheet "L400" (mismo SHEET_ID_PLANIF que usa
//     obtenerTnlDespachadasL400) -> Tiempo de estadía promedio por
//     transportista (columna GESTIÓN), para el día completo.
// =========================================================

// ---------------------------------------------------------
// FUENTE 1: SAP (Extracción / Picking, TON)
// ---------------------------------------------------------

// tareas_almacen_sap puede traer varios miles de filas por día — se
// pagina igual que el resto del proyecto (ver skillFetchTodo /
// supabaseFetchTodo en otros módulos), pidiendo solo las 3 columnas
// que hacen falta para sumar.
async function ddObtenerFilasSap(fecha){

  const TAMANO_PAGINA = 1000;
  let desde = 0;
  let todas = [];

  while(true){

    // Sin "order=" explícito a propósito: esta tabla no tiene índice
    // que soporte ordenar por id junto con el filtro de fecha, y
    // agregarlo hace que la consulta exceda el timeout de Postgres.
    // Los totales de un día pueden variar un poco entre dos lecturas
    // (la tabla recibe inserts en vivo mientras se confirman tareas en
    // SAP) — es esperado, igual que el resto del dashboard trata la
    // data del turno en curso como "viva".
    const pagina = await planifFetch(
      "/tareas_almacen_sap?select=proceso,turno,tn&fecha=eq." + encodeURIComponent(fecha),
      { headers: { Range: desde + "-" + (desde + TAMANO_PAGINA - 1) } }
    );

    if(!pagina || !pagina.length){
      break;
    }

    todas = todas.concat(pagina);

    if(pagina.length < TAMANO_PAGINA){
      break;
    }

    desde += TAMANO_PAGINA;

  }

  return todas;

}

function ddRedondear(n){
  return Math.round((Number(n) || 0) * 100) / 100;
}

async function obtenerResumenSapDialogo(fecha){

  const filas = await ddObtenerFilasSap(fecha);

  const totales = {
    extraccion: { dia: 0, noche: 0 },
    picking: { dia: 0, noche: 0 }
  };

  filas.forEach(function(f){

    const proceso = (f.proceso || "").toUpperCase();
    const turno = (f.turno || "").toUpperCase() === "NOCHE" ? "noche" : "dia";
    const tn = Number(f.tn) || 0;

    if(proceso === "EXTRACCION"){
      totales.extraccion[turno] += tn;
    }else if(proceso === "PICKING"){
      totales.picking[turno] += tn;
    }

  });

  return {

    extraccion: {
      dia: ddRedondear(totales.extraccion.dia),
      noche: ddRedondear(totales.extraccion.noche),
      total: ddRedondear(totales.extraccion.dia + totales.extraccion.noche)
    },

    picking: {
      dia: ddRedondear(totales.picking.dia),
      noche: ddRedondear(totales.picking.noche),
      total: ddRedondear(totales.picking.dia + totales.picking.noche)
    },

    filasLeidas: filas.length

  };

}

// ---------------------------------------------------------
// FUENTE 2: Sheet L400 (Tiempo de estadía por transportista)
// D = GESTIÓN, AM = FECHA REPORTE, AO = ESTADIA UT.
// Filtrado en el servidor de Google (igual que
// obtenerTnlDespachadasL400), no se baja el Sheet completo.
// ---------------------------------------------------------

// Mapeo GESTIÓN (texto real del Sheet) -> categoría mostrada.
// Validado contra los valores reales de la columna D: "RL AS" y
// "RL CMP" son las dos variantes de RL; el resto matchea 1:1.
// DEX / TG / CLIENTE RECOGE no tienen tarjeta propia, pero sí entran
// en el promedio general "despacho".
function ddCategoriaGestion(gestion){

  const g = String(gestion || "").trim().toUpperCase();

  if(g.indexOf("RL") === 0) return "RL";
  if(g === "CANAL MODERNO") return "CM";
  if(g === "N/S CHICO") return "nsChico";
  if(g === "LARGA DISTANCIA") return "LD";
  if(g === "TRASLADO") return "traslado";

  return null; // sigue contando para "despacho", pero sin tarjeta propia

}

async function ddObtenerFilasEstadiaL400(fecha){

  const consulta = "select D, AO where AM = date '" + fecha + "'";

  const url =
    "https://docs.google.com/spreadsheets/d/" + SHEET_ID_PLANIF +
    "/gviz/tq?tqx=out:csv&sheet=" + encodeURIComponent(SHEET_NOMBRE_L400) +
    "&tq=" + encodeURIComponent(consulta);

  const respuesta = await fetch(url);

  if(!respuesta.ok){
    throw new Error("No se pudo leer el Sheet L400 (Tiempo de estadía)");
  }

  const texto = await respuesta.text();

  return parsearCSVFilas(texto);

}

function ddPromedio(valores){

  if(!valores.length){
    return null;
  }

  const suma = valores.reduce(function(s, v){ return s + v; }, 0);

  return ddRedondear(suma / valores.length);

}

async function obtenerResumenEstadiaDialogo(fecha){

  const filas = await ddObtenerFilasEstadiaL400(fecha);

  const grupos = {
    despacho: [],
    RL: [],
    CM: [],
    nsChico: [],
    LD: [],
    traslado: []
  };

  filas.forEach(function(fila){

    const gestion = fila[0];
    const estadia = Number(String(fila[1] || "").replace(/,/g, ""));

    if(!gestion || isNaN(estadia)){
      return;
    }

    grupos.despacho.push(estadia);

    const categoria = ddCategoriaGestion(gestion);

    if(categoria){
      grupos[categoria].push(estadia);
    }

  });

  return {
    despacho: { promedio: ddPromedio(grupos.despacho), cantidad: grupos.despacho.length },
    RL: { promedio: ddPromedio(grupos.RL), cantidad: grupos.RL.length },
    CM: { promedio: ddPromedio(grupos.CM), cantidad: grupos.CM.length },
    nsChico: { promedio: ddPromedio(grupos.nsChico), cantidad: grupos.nsChico.length },
    LD: { promedio: ddPromedio(grupos.LD), cantidad: grupos.LD.length },
    traslado: { promedio: ddPromedio(grupos.traslado), cantidad: grupos.traslado.length }
  };

}

// ---------------------------------------------------------
// FUNCIÓN PRINCIPAL: junta ambas fuentes para una fecha
// ---------------------------------------------------------
async function obtenerDialogoDiario(fecha){

  const [sap, estadia] = await Promise.allSettled([
    obtenerResumenSapDialogo(fecha),
    obtenerResumenEstadiaDialogo(fecha)
  ]);

  return {
    fecha: fecha,
    sap: sap.status === "fulfilled" ? sap.value : null,
    sapError: sap.status === "rejected" ? sap.reason : null,
    estadia: estadia.status === "fulfilled" ? estadia.value : null,
    estadiaError: estadia.status === "rejected" ? estadia.reason : null
  };

}

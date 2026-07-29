// =======================================
// CARGAR DATA SAP - Lógica
// Equivalente a SAP.js (Apps Script). La lectura del Excel usa
// SheetJS (biblioteca "xlsx", cargada por CDN) en vez de
// DriveApp/SpreadsheetApp, que solo existen en Apps Script.
// =======================================

// =======================================
// CONTAR FILAS EN LA TABLA (diagnóstico)
// =======================================

async function contarFilasSAP(){

  const respuesta = await fetch(
    SUPABASE_URL_PLANIF + "/tareas_almacen_sap?select=id",
    {
      headers: {
        apikey: SUPABASE_KEY_PLANIF,
        Authorization: "Bearer " + SUPABASE_KEY_PLANIF,
        Prefer: "count=exact",
        Range: "0-0"
      }
    }
  );

  const contentRange = respuesta.headers.get("Content-Range");
  return contentRange ? contentRange.split("/")[1] : "desconocido";

}

// =======================================
// PROCESAR ARCHIVO SAP (Excel, vía SheetJS)
// =======================================

async function procesarArchivoSAP(archivo){

  const buffer = await archivo.arrayBuffer();

  // cellDates:true → las celdas de fecha/hora llegan como objetos Date,
  // igual que SpreadsheetApp.getValues() en Apps Script.
  const libro = XLSX.read(buffer, { type: "array", cellDates: true });

  const hoja = libro.Sheets[libro.SheetNames[0]];

  const datos = XLSX.utils.sheet_to_json(hoja, {
    header: 1,
    raw: true,
    defval: ""
  });

  const registros = [];

  for(let i = 1; i < datos.length; i++){

    const fila = datos[i];

    if(!fila || fila.length === 0){
      continue;
    }

    registros.push({

      id_registro:
        String(fila[0]) + "_" +
        String(fila[3]) + "_" +
        String(fila[26]) + "_" +
        String(fila[13]) + "_" +
        String(fila[20]),

      tarea_almacen: convertirNumeroSAP(fila[0]),
      orden_almacen: fila[1],
      status_tarea: fila[2],
      producto: fila[3],
      descripcion_producto: fila[4],
      tipo_stock: fila[5],
      cantidad_uma: convertirNumeroSAP(fila[6]),
      ubic_procedencia: fila[7],
      ubic_destino: fila[8],
      unidad_medida_alternativa: fila[9],
      clase_proceso_almacen: fila[10],
      ubic_dest_original: fila[11],
      unidad_manipulacion_origen: fila[12],
      ump_destino: fila[13],

      fecha_inicio: convertirFechaSAP(fila[14]),
      hora_inicio: convertirHoraSAP(fila[15]),

      confirmado_por: fila[16],
      fecha_confirmacion: convertirFechaSAP(fila[17]),
      hora_confirmacion: convertirHoraSAP(fila[18]),
      fase: fila[19],
      peso_carga: convertirNumeroSAP(fila[20]),
      unidad_peso: fila[21],
      recurso_origen: fila[22],
      cola: fila[23],
      tipo_proceso_almacen: fila[24],
      denominacion_tipo_proceso: fila[25],
      cantidad_umb: convertirNumeroSAP(fila[26]),
      unidad_medida_base: fila[27],
      tipo_almacen_destino: fila[28]

    });

  }

  await insertarSupabaseLoteSAP(registros);

  return {
    filas: datos.length - 1,
    columnas: (datos[0] || []).length,
    cargados: registros.length
  };

}

// =======================================
// INSERTAR EN SUPABASE (LOTE)
// =======================================

async function insertarSupabaseLoteSAP(registros){

  const TAMANO_LOTE = 500;

  let procesados = 0;

  for(let i = 0; i < registros.length; i += TAMANO_LOTE){

    const lote = registros.slice(i, i + TAMANO_LOTE);

    const respuesta = await fetch(
      SUPABASE_URL_PLANIF + "/tareas_almacen_sap?on_conflict=id_registro",
      {
        method: "POST",
        headers: {
          apikey: SUPABASE_KEY_PLANIF,
          Authorization: "Bearer " + SUPABASE_KEY_PLANIF,
          "Content-Type": "application/json",
          Prefer: "resolution=ignore-duplicates"
        },
        body: JSON.stringify(lote)
      }
    );

    if(!respuesta.ok){
      const detalle = await respuesta.text();
      throw new Error(
        "Fallo en lote " + (i / TAMANO_LOTE + 1) + ": " + detalle
      );
    }

    procesados += lote.length;

  }

  return procesados;

}

// =======================================
// HELPER NUMÉRICO
// =======================================

function convertirNumeroSAP(valor){

  if(valor === "" || valor === null || valor === undefined) return null;

  const numero = Number(valor);

  return isNaN(numero) ? null : numero;

}

// =======================================
// HELPERS DE FECHA / HORA
// =======================================

function pad2(n){
  return String(n).padStart(2, "0");
}

function convertirFechaSAP(valor){

  if(!valor) return null;

  if(valor instanceof Date && !isNaN(valor.getTime())){
    return valor.getFullYear() + "-" + pad2(valor.getMonth() + 1) + "-" + pad2(valor.getDate());
  }

  return null;

}

function convertirHoraSAP(valor){

  if(!valor) return null;

  if(valor instanceof Date && !isNaN(valor.getTime())){
    return pad2(valor.getHours()) + ":" + pad2(valor.getMinutes()) + ":" + pad2(valor.getSeconds());
  }

  const texto = String(valor).trim();

  if(texto === "" || texto === "-") return null;

  const fecha = new Date(
    "2000-01-01 " +
    texto.replace("a.m.", "AM").replace("p.m.", "PM")
  );

  if(isNaN(fecha.getTime())) return null;

  return pad2(fecha.getHours()) + ":" + pad2(fecha.getMinutes()) + ":" + pad2(fecha.getSeconds());

}

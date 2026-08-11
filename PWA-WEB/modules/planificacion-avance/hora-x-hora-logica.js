// =======================================
// HORA X HORA: traer y pivotar datos
// Equivalente a HoraXHora.js (Apps Script), vía RPC de Supabase.
// =======================================

// Minutos "de más" por tarea que no quedan capturados entre
// hora_inicio y hora_confirmacion (caminar hasta la ubicación,
// escanear, etc.) — se suman a la duración real de cada tarea.
const HXH_MINUTOS_OVERHEAD_POR_TAREA = 1.5;

// Convierte "HH:MM:SS" a segundos desde medianoche.
function hxhHoraASegundos(texto){

  const partes = String(texto || "").split(":").map(Number);
  if(partes.length < 2 || partes.some(isNaN)) return null;

  return (partes[0] || 0) * 3600 + (partes[1] || 0) * 60 + (partes[2] || 0);

}

// Tiempo efectivo real (minutos) por auxiliar+proceso+hora, a partir
// de las tareas crudas de SAP: por cada tarea, (confirmación - inicio)
// + el overhead fijo. Se usa para "achicar" el target de la celda
// cuando la persona no estuvo la hora completa en ese proceso (recién
// entró, o cambió de función a mitad de hora).
async function obtenerTiempoEfectivoHxh(fecha, turno){

  const filas = await planifFetch(
    "/tareas_almacen_sap?select=auxiliar,proceso,hora,hora_inicio,hora_confirmacion" +
    "&fecha=eq." + encodeURIComponent(fecha) +
    "&turno=eq." + encodeURIComponent(turno) +
    "&proceso=in.(PICKING,EXTRACCION,REPO,ALMACENAMIENTO)"
  ) || [];

  const mapa = {}; // mapa[proceso][auxiliar][hora] = minutos

  filas.forEach(function(f){

    const inicio = hxhHoraASegundos(f.hora_inicio);
    const fin = hxhHoraASegundos(f.hora_confirmacion);

    if(inicio === null || fin === null) return;

    let duracionSeg = fin - inicio;
    if(duracionSeg < 0) duracionSeg += 24 * 3600; // cruce de medianoche

    const minutosTarea = (duracionSeg / 60) + HXH_MINUTOS_OVERHEAD_POR_TAREA;

    mapa[f.proceso] = mapa[f.proceso] || {};
    mapa[f.proceso][f.auxiliar] = mapa[f.proceso][f.auxiliar] || {};
    mapa[f.proceso][f.auxiliar][f.hora] =
      (mapa[f.proceso][f.auxiliar][f.hora] || 0) + minutosTarea;

  });

  return mapa;

}

async function obtenerHoraXHora(fecha, turno){

  const filas = await planifFetch(
    "/rpc/obtener_hora_x_hora",
    {
      method: "POST",
      body: JSON.stringify({ p_fecha: fecha, p_turno: turno })
    }
  ) || [];

  const tiempoEfectivo = await obtenerTiempoEfectivoHxh(fecha, turno);

  const horas = (turno === "NOCHE")
    ? [19, 20, 21, 22, 23, 0, 1, 2, 3, 4, 5, 6]
    : [7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18];

  const procesos = ["PICKING", "EXTRACCION", "REPO", "ALMACENAMIENTO"];

  const resultado = {};

  procesos.forEach(function(proceso){

    const filasProceso = filas.filter(function(f){
      return f.proceso === proceso;
    });

    const auxiliares = [...new Set(filasProceso.map(function(f){
      return f.auxiliar;
    }))];

    const tabla = auxiliares.map(function(aux){

      const fila = { auxiliar: aux, valores: {}, minutos: {}, total: 0 };

      horas.forEach(function(h){

        const match = filasProceso.find(function(f){
          return f.auxiliar === aux && f.hora === h;
        });

        const valor = match
          ? (proceso === "PICKING" || proceso === "REPO"
              ? match.tn
              : match.cantidad)
          : 0;

        fila.valores[h] = valor;

        // Minutos reales trabajados esa hora en este proceso (tope 60,
        // no puede "valer más" que una hora completa). Si no hay dato
        // de tareas (tabla vieja, u otra fuente), se asume hora
        // completa para no castigar sin motivo.
        const minutosCelda = tiempoEfectivo[proceso] &&
          tiempoEfectivo[proceso][aux] &&
          tiempoEfectivo[proceso][aux][h];

        fila.minutos[h] = (minutosCelda === undefined)
          ? 60
          : Math.min(60, minutosCelda);

        fila.total += valor;

      });

      return fila;

    });

    tabla.sort(function(a, b){ return b.total - a.total; });

    const totales = { auxiliar: "TOTAL", valores: {}, total: 0 };

    horas.forEach(function(h){
      totales.valores[h] = tabla.reduce(function(s, f){
        return s + f.valores[h];
      }, 0);
      totales.total += totales.valores[h];
    });

    let totalTNAlmacenamiento = 0;
    if (proceso === "ALMACENAMIENTO"){
      filasProceso.forEach(function(f){
        totalTNAlmacenamiento += Number(f.tn || 0);
      });
    }

    let tablaPal = null;
    if (proceso === "REPO"){

      const tablaP = auxiliares.map(function(aux){

        const fila = { auxiliar: aux, valores: {}, total: 0 };

        horas.forEach(function(h){
          const match = filasProceso.find(function(f){
            return f.auxiliar === aux && f.hora === h;
          });
          const valor = match ? Number(match.cantidad || 0) : 0;
          fila.valores[h] = valor;
          fila.total += valor;
        });

        return fila;

      });

      tablaP.sort(function(a, b){ return b.total - a.total; });

      const totalesP = { auxiliar: "TOTAL", valores: {}, total: 0 };

      horas.forEach(function(h){
        totalesP.valores[h] = tablaP.reduce(function(s, f){
          return s + f.valores[h];
        }, 0);
        totalesP.total += totalesP.valores[h];
      });

      tablaPal = { horas: horas, filas: tablaP, totales: totalesP };

    }

    resultado[proceso] = {
      horas: horas,
      filas: tabla,
      totales: totales,
      totalTN: proceso === "ALMACENAMIENTO" ? totalTNAlmacenamiento : null,
      tablaPal: tablaPal
    };

  });

  return resultado;

}

// =======================================
// COMENTARIOS HORA X HORA
// =======================================

async function obtenerComentariosHxh(fecha, turno){

  const filas = await planifFetch(
    "/comentarios_hxh" +
    "?select=proceso,auxiliar,hora,comentario" +
    "&fecha=eq." + encodeURIComponent(fecha) +
    "&turno=eq." + encodeURIComponent(turno)
  ) || [];

  const mapa = {};

  filas.forEach(function(f){
    const clave = f.proceso + "|" + f.auxiliar + "|" + f.hora;
    mapa[clave] = f.comentario;
  });

  return mapa;

}

// =======================================
// METAS PLANIFICADAS (Picking / Extracción / Total TN)
// =======================================
//
// En vez de metas fijas hardcodeadas, se calculan sobre lo realmente
// planificado (estado_planificacion = PLANIFICADO) en planificacion_diaria
// para esa fecha/turno:
//  - metaPicking:      suma de tnl_picking (TN)
//  - metaExtraccionPal: suma de ctd_extraccion (paletas)
//  - metaExtraccionTN: paletas convertidas a TN (480 kg c/u)
//  - metaTotalTN:      metaPicking + metaExtraccionTN

async function obtenerMetasPlanificadasHxh(fecha, turno){

  turno = normalizarTurnoPlanif(turno);

  const filas = await planifFetch(
    "/planificacion_diaria?select=tnl_picking,ctd_extraccion,peso_tn" +
    "&fecha=eq." + encodeURIComponent(fecha) +
    "&turno=eq." + encodeURIComponent(turno) +
    "&estado_planificacion=eq.PLANIFICADO"
  ) || [];

  let metaPicking = 0;
  let metaExtraccionPal = 0;
  let metaTotalTN = 0; // = TNL Planificado, el mismo criterio que el KPI de Planificado Drive

  filas.forEach(function(f){
    metaPicking += Number(f.tnl_picking || 0);
    metaExtraccionPal += Number(f.ctd_extraccion || 0);
    metaTotalTN += Number(f.peso_tn || 0);
  });

  const metaExtraccionTN = Math.round(metaExtraccionPal * 0.48 * 100) / 100;

  return {
    metaPicking: Math.round(metaPicking * 100) / 100,
    metaExtraccionPal: metaExtraccionPal,
    metaExtraccionTN: metaExtraccionTN,
    metaTotalTN: Math.round(metaTotalTN * 100) / 100 // TNL Planificado exacto (suma de peso_tn)
  };

}

async function guardarComentarioHxh(registro){

  return await planifFetch(
    "/comentarios_hxh?on_conflict=fecha,turno,proceso,auxiliar,hora",
    {
      method: "POST",
      headers: { "Prefer": "resolution=merge-duplicates,return=representation" },
      body: JSON.stringify({

        fecha: registro.fecha,
        turno: registro.turno,
        proceso: registro.proceso,
        auxiliar: registro.auxiliar,
        hora: registro.hora,
        comentario: registro.comentario,
        updated_at: new Date().toISOString()

      })
    }
  );

}

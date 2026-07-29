// =======================================
// HORA X HORA: traer y pivotar datos
// Equivalente a HoraXHora.js (Apps Script), vía RPC de Supabase.
// =======================================

async function obtenerHoraXHora(fecha, turno){

  const filas = await planifFetch(
    "/rpc/obtener_hora_x_hora",
    {
      method: "POST",
      body: JSON.stringify({ p_fecha: fecha, p_turno: turno })
    }
  ) || [];

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

      const fila = { auxiliar: aux, valores: {}, total: 0 };

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

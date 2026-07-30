// =======================================
// DASHBOARD (PLANIFICACIÓN Y AVANCE DIARIO) - Lógica
// Combina planificacion_diaria (metas por canal), turno_colaboradores
// (personas asignadas) y tareas_almacen_sap vía obtener_hora_x_hora
// (productividad real) para armar el dashboard hora a hora.
// =======================================

const DASH_TARGET_PICKING_TN_PERSONA = 1.2;
const DASH_TARGET_EXTRACCION_PAL_PERSONA = 16;

function horasTurnoDashboard(turno){
  return (turno === "NOCHE")
    ? [19, 20, 21, 22, 23, 0, 1, 2, 3, 4, 5, 6]
    : [7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18];
}

// ---------------------------------------------------------
// PLANIFICACIÓN DEL DÍA POR CANAL (gestión) - TNL
// ---------------------------------------------------------

async function obtenerPlanificacionPorCanal(fecha, turno){

  turno = normalizarTurnoPlanif(turno);

  const filas = await planifFetch(
    "/planificacion_diaria?select=gestion,peso_tn" +
    "&fecha=eq." + encodeURIComponent(fecha) +
    "&turno=eq." + encodeURIComponent(turno)
  ) || [];

  const mapa = {};
  let total = 0;

  filas.forEach(function(f){
    const nombre = f.gestion || "SIN CANAL";
    const tn = Number(f.peso_tn || 0);
    mapa[nombre] = (mapa[nombre] || 0) + tn;
    total += tn;
  });

  const canales = Object.keys(mapa).map(function(nombre){
    return {
      nombre: nombre,
      tn: mapa[nombre],
      pct: total > 0 ? (mapa[nombre] / total * 100) : 0
    };
  }).sort(function(a, b){ return b.tn - a.tn; });

  return { canales: canales, totalTN: total };

}

// ---------------------------------------------------------
// PERSONAS ASIGNADAS POR HORA (acumulado según desde_hora)
// ---------------------------------------------------------

async function obtenerHeadcountPorHora(fecha, turno, funcion, horas){

  const filas = await planifFetch(
    "/turno_colaboradores?select=desde_hora,funcion,activo,colaboradores(funcion)" +
    "&fecha=eq." + encodeURIComponent(fecha) +
    "&turno=eq." + encodeURIComponent(turno) +
    "&activo=eq.true"
  ) || [];

  const relevantes = filas.filter(function(f){
    const fn = f.funcion || (f.colaboradores && f.colaboradores.funcion) || "";
    return fn === funcion;
  });

  const posicion = {};
  horas.forEach(function(h, i){ posicion[h] = i; });

  function posicionInicio(desdeHora){
    if(!desdeHora) return 0;
    const h = parseInt(String(desdeHora).split(":")[0], 10);
    return posicion.hasOwnProperty(h) ? posicion[h] : 0;
  }

  const porHora = {};

  horas.forEach(function(h){

    const posH = posicion[h];

    porHora[h] = relevantes.filter(function(f){
      return posicionInicio(f.desde_hora) <= posH;
    }).length;

  });

  return { porHora: porHora, total: relevantes.length };

}

async function obtenerResumenPersonasActivas(fecha, turno){

  const filas = await planifFetch(
    "/turno_colaboradores?select=activo" +
    "&fecha=eq." + encodeURIComponent(fecha) +
    "&turno=eq." + encodeURIComponent(turno)
  ) || [];

  return {
    activos: filas.filter(function(f){ return f.activo; }).length,
    total: filas.length
  };

}

// ---------------------------------------------------------
// TN REAL POR HORA (Picking + Extracción combinados, en TN)
// ---------------------------------------------------------

async function obtenerTNPorHoraProceso(fecha, turno, procesos){

  const filas = await planifFetch(
    "/rpc/obtener_hora_x_hora",
    {
      method: "POST",
      body: JSON.stringify({ p_fecha: fecha, p_turno: turno })
    }
  ) || [];

  const mapa = {};

  filas.forEach(function(f){
    if(procesos.indexOf(f.proceso) === -1) return;
    mapa[f.hora] = (mapa[f.hora] || 0) + Number(f.tn || 0);
  });

  return mapa;

}

// ---------------------------------------------------------
// ARMAR EL DASHBOARD COMPLETO
// ---------------------------------------------------------

async function construirDashboard(fecha, turno){

  turno = normalizarTurnoPlanif(turno);
  const horas = horasTurnoDashboard(turno);

  const [canalData, personasPicking, personasExtraccion, hxh, tnPorHora, personasResumen] = await Promise.all([
    obtenerPlanificacionPorCanal(fecha, turno),
    obtenerHeadcountPorHora(fecha, turno, "PICKING", horas),
    obtenerHeadcountPorHora(fecha, turno, "EXTRACCIÓN", horas),
    obtenerHoraXHora(fecha, turno),
    obtenerTNPorHoraProceso(fecha, turno, ["PICKING", "EXTRACCION"]),
    obtenerResumenPersonasActivas(fecha, turno)
  ]);

  const horaActualReal = new Date().getHours();
  let posActual = horas.indexOf(horaActualReal);
  if(posActual === -1){
    posActual = horas.length - 1;
  }

  function construirSerie(targetPorPersona, personasPorHora, realPorHoraFn){

    let metaAcum = 0;
    let realAcum = 0;

    const filas = horas.map(function(h, i){

      const personas = personasPorHora.porHora[h] || 0;
      const meta = personas * targetPorPersona;
      const esFuturo = i > posActual;
      const real = esFuturo ? null : realPorHoraFn(h);

      let estado = null;

      if(!esFuturo){

        metaAcum += meta;
        realAcum += real;

        if(meta > 0){
          const pct = real / meta;
          estado = pct >= 1 ? "cumplida" : (pct >= 0.9 ? "riesgo" : "no_cumplida");
        }

      }

      return {
        hora: h,
        personas: personas,
        meta: meta,
        real: real,
        proyeccion: esFuturo ? meta : null,
        metaAcumulada: esFuturo ? null : metaAcum,
        realAcumulado: esFuturo ? null : realAcum,
        estado: estado,
        esHoraActual: h === horaActualReal,
        esFuturo: esFuturo
      };

    });

    const metaTotalTurno = filas.reduce(function(s, f){ return s + f.meta; }, 0);

    return { filas: filas, metaTotal: metaTotalTurno, realTotal: realAcum };

  }

  const picking = construirSerie(
    DASH_TARGET_PICKING_TN_PERSONA,
    personasPicking,
    function(h){ return (hxh.PICKING && hxh.PICKING.totales.valores[h]) || 0; }
  );

  const extraccion = construirSerie(
    DASH_TARGET_EXTRACCION_PAL_PERSONA,
    personasExtraccion,
    function(h){ return (hxh.EXTRACCION && hxh.EXTRACCION.totales.valores[h]) || 0; }
  );

  const tnEjecutado = horas.reduce(function(s, h, i){
    if(i > posActual) return s;
    return s + (tnPorHora[h] || 0);
  }, 0);

  const tnPlanificado = canalData.totalTN;
  const tnRestante = Math.max(tnPlanificado - tnEjecutado, 0);

  const horasTranscurridas = posActual + 1;
  const proyeccionCierre = horasTranscurridas > 0
    ? (tnEjecutado / horasTranscurridas) * horas.length
    : 0;

  return {
    fecha: fecha,
    turno: turno,
    horas: horas,
    horaActualReal: horaActualReal,
    posActual: posActual,
    canales: canalData.canales,
    tnPlanificado: tnPlanificado,
    tnEjecutado: tnEjecutado,
    tnRestante: tnRestante,
    proyeccionCierre: proyeccionCierre,
    personasActivas: personasResumen,
    picking: picking,
    extraccion: extraccion
  };

}

// ---------------------------------------------------------
// COMENTARIOS DEL DASHBOARD (tabla propia comentarios_dashboard)
// ---------------------------------------------------------

async function obtenerComentariosDashboard(fecha, turno){

  return await planifFetch(
    "/comentarios_dashboard?select=*" +
    "&fecha=eq." + encodeURIComponent(fecha) +
    "&turno=eq." + encodeURIComponent(turno) +
    "&order=created_at.desc"
  ) || [];

}

async function guardarComentarioDashboard(registro){

  const datos = await planifFetch(
    "/comentarios_dashboard",
    {
      method: "POST",
      headers: { "Prefer": "return=representation" },
      body: JSON.stringify(registro)
    }
  );

  if(!Array.isArray(datos) || datos.length === 0){
    throw new Error("No se pudo guardar el comentario (revisa RLS de comentarios_dashboard).");
  }

  return datos[0];

}

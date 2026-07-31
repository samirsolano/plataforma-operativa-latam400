// =========================================================
// DASHBOARD (PLANIFICACIÓN Y AVANCE DIARIO) - Lógica
// Portado 1:1 desde Dashboard.gs (Apps Script) del proyecto
// original, usando planifFetch en vez de UrlFetchApp/rgGet.
// =========================================================

// ---------------------------------------------------------
// METAS DE REFERENCIA POR HORA (igual que HXH_METAS en Hora x
// Hora). Un valor por cada una de las 12 horas del turno.
// ---------------------------------------------------------
const DASH_METAS = {

  PICKING_HORA: [8.4, 9.6, 9.6, 7.2, 7.2, 7.2, 7.2, 7.2, 7.2, 7.2, 7.2, 7.2],
  EXTRACCION_HORA: [3.6, 2.4, 2.4, 4.8, 4.8, 4.8, 4.8, 4.8, 4.8, 4.8, 4.8, 4.8],
  TARGET_TN_POR_PERSONA_HORA: 1.2

};

// ---------------------------------------------------------
// Horas del turno, en el orden en que se muestran
// (NOCHE cruza medianoche, igual que en HoraXHora.gs)
// ---------------------------------------------------------
function dashHorasTurno(turno){
  return (turno === "NOCHE")
    ? [19, 20, 21, 22, 23, 0, 1, 2, 3, 4, 5, 6]
    : [7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18];
}

// Índice (dentro de "horas") de la última hora ya transcurrida del turno:
//  -1              -> el turno todavía no empieza (todo es proyección)
//  horas.length-1  -> el turno ya terminó por completo (todo es real)
//  0..length-2     -> el turno está en curso, esa es la hora actual
function dashIndiceHoraActual(fecha, turno, horas){

  const ahora = new Date();
  const hoyStr = ahora.getFullYear() + "-" +
    String(ahora.getMonth() + 1).padStart(2, "0") + "-" +
    String(ahora.getDate()).padStart(2, "0");

  if(fecha < hoyStr) return horas.length - 1; // fecha ya pasada: turno completo
  if(fecha > hoyStr) return -1;               // fecha futura: nada ha ocurrido

  // Es hoy: compara la hora actual contra las horas del turno
  const horaAhora = ahora.getHours();
  const idx = horas.indexOf(horaAhora);

  if(idx !== -1) return idx;

  if(turno === "NOCHE"){
    // Turno NOCHE (19h-6h): si la hora actual cae en horario diurno (7-18),
    // el turno de esta madrugada ya terminó por completo.
    return (horaAhora >= 7 && horaAhora <= 18) ? horas.length - 1 : -1;
  }

  // Turno DÍA (7h-18h): si ya pasamos las 18h, el turno terminó completo;
  // si es antes de las 7h, todavía no empieza.
  return horaAhora > 18 ? horas.length - 1 : -1;

}

// ---------------------------------------------------------
// Filas crudas del RPC obtener_hora_x_hora (sin pivotar)
// ---------------------------------------------------------
async function dashFilasHoraXHora(fecha, turno){

  return await planifFetch(
    "/rpc/obtener_hora_x_hora",
    {
      method: "POST",
      body: JSON.stringify({ p_fecha: fecha, p_turno: turno })
    }
  ) || [];

}

// ---------------------------------------------------------
// Picking / Extracción por hora: TN real ejecutado y
// personas activas esa hora (auxiliares con valor > 0)
// ---------------------------------------------------------
function dashProcesarProceso(filasCrudas, nombreProceso, horas, indiceActual, metaHora){

  const filasProceso = filasCrudas.filter(function(f){ return f.proceso === nombreProceso; });
  const auxiliares = [...new Set(filasProceso.map(function(f){ return f.auxiliar; }))];

  const real = [];
  const personas = [];

  horas.forEach(function(h){

    let tnHora = 0;
    let personasHora = 0;

    auxiliares.forEach(function(aux){

      const match = filasProceso.find(function(f){
        return f.auxiliar === aux && f.hora === h;
      });

      if(match){
        const valor = Number(match.tn || match.cantidad || 0);
        if(valor > 0){
          tnHora += valor;
          personasHora++;
        }
      }

    });

    real.push(Math.round(tnHora * 100) / 100);
    personas.push(personasHora);

  });

  let metaAcum = 0;
  let realAcum = 0;

  const metaAcumulada = [];
  const realAcumulada = [];

  horas.forEach(function(h, i){

    metaAcum += metaHora[i] || 0;
    metaAcumulada.push(Math.round(metaAcum * 100) / 100);

    // Solo se acumula "real" hasta la hora actual (incluida);
    // las horas futuras quedan como proyección en el frontend.
    if(indiceActual >= 0 && i <= indiceActual){
      realAcum += real[i];
      realAcumulada.push(Math.round(realAcum * 100) / 100);
    }else{
      realAcumulada.push(null);
    }

  });

  return {
    horas: horas,
    target: metaHora,
    real: real,
    personas: personas,
    metaAcumulada: metaAcumulada,
    realAcumulada: realAcumulada
  };

}

// ---------------------------------------------------------
// Planificación del día por canal (columna "GESTIÓN" del
// Excel de SAP, guardada en planificacion_diaria.gestion)
// ---------------------------------------------------------
async function dashPlanificacionCanales(fecha, turno){

  const filas = await planifFetch(
    "/planificacion_diaria?select=gestion,peso_tn" +
    "&fecha=eq." + encodeURIComponent(fecha) +
    "&turno=eq." + encodeURIComponent(turno)
  ) || [];

  const mapa = {};
  let total = 0;

  filas.forEach(function(f){
    const nombre = f.gestion || "SIN CANAL";
    const peso = Number(f.peso_tn || 0);
    mapa[nombre] = (mapa[nombre] || 0) + peso;
    total += peso;
  });

  const canales = Object.keys(mapa).map(function(nombre){
    return {
      nombre: nombre,
      tn: Math.round(mapa[nombre] * 100) / 100,
      pct: total > 0 ? Math.round((mapa[nombre] / total) * 100) : 0
    };
  });

  canales.sort(function(a, b){ return b.tn - a.tn; });

  return {
    canales: canales,
    totalPlanificado: Math.round(total * 100) / 100
  };

}

// ---------------------------------------------------------
// Personas activas (turno_colaboradores) para la fecha/turno
// ---------------------------------------------------------
async function dashPersonasActivas(fecha, turno){

  const filas = await planifFetch(
    "/turno_colaboradores?select=activo" +
    "&fecha=eq." + encodeURIComponent(fecha) +
    "&turno=eq." + encodeURIComponent(turno)
  ) || [];

  const activas = filas.filter(function(f){ return !!f.activo; }).length;

  return { activas: activas, planificadas: filas.length };

}

// ---------------------------------------------------------
// FUNCIÓN PRINCIPAL: arma todo el payload del Dashboard
// ---------------------------------------------------------
async function obtenerDashboard(fecha, turno){

  turno = turno === "DÍA" ? "DIA" : turno;

  const horas = dashHorasTurno(turno);
  const indiceActual = dashIndiceHoraActual(fecha, turno, horas);

  const [plan, filasCrudas, personas, comentarios] = await Promise.all([
    dashPlanificacionCanales(fecha, turno),
    dashFilasHoraXHora(fecha, turno),
    dashPersonasActivas(fecha, turno),
    obtenerComentariosDashboard(fecha, turno)
  ]);

  const picking = dashProcesarProceso(filasCrudas, "PICKING", horas, indiceActual, DASH_METAS.PICKING_HORA);
  const extraccion = dashProcesarProceso(filasCrudas, "EXTRACCION", horas, indiceActual, DASH_METAS.EXTRACCION_HORA);

  const tnEjecutado =
    picking.real.reduce(function(s, v){ return s + v; }, 0) +
    extraccion.real.reduce(function(s, v){ return s + v; }, 0);

  const tnRestante = Math.max(plan.totalPlanificado - tnEjecutado, 0);

  const horasTranscurridas = indiceActual >= 0 ? indiceActual + 1 : horas.length;
  const proporcionTurno = horasTranscurridas / horas.length;

  const proyeccionCierre = proporcionTurno > 0
    ? tnEjecutado / proporcionTurno
    : tnEjecutado;

  return {

    fecha: fecha,
    turno: turno,
    horas: horas,
    indiceHoraActual: indiceActual,

    planificacion: plan,

    kpis: {
      tnEjecutado: Math.round(tnEjecutado * 100) / 100,
      tnRestante: Math.round(tnRestante * 100) / 100,
      proyeccionCierre: Math.round(proyeccionCierre * 100) / 100,
      pctEjecutado: plan.totalPlanificado > 0
        ? Math.round((tnEjecutado / plan.totalPlanificado) * 1000) / 10
        : 0,
      pctProyeccion: plan.totalPlanificado > 0
        ? Math.round((proyeccionCierre / plan.totalPlanificado) * 1000) / 10
        : 0,
      personasActivas: personas.activas,
      personasPlanificadas: personas.planificadas
    },

    picking: picking,
    extraccion: extraccion,

    comentarios: comentarios

  };

}

// =========================================================
// COMENTARIOS DEL DASHBOARD
//
// Tabla en Supabase (proyecto "Planificación y Avance"):
//
//   create table comentarios_dashboard (
//     id uuid primary key default gen_random_uuid(),
//     fecha date not null,
//     turno text not null,
//     proceso text not null,      -- 'PICKING' | 'EXTRACCION'
//     hora int not null,
//     autor text not null,
//     comentario text not null,
//     created_at timestamptz default now()
//   );
// =========================================================

async function obtenerComentariosDashboard(fecha, turno){

  return await planifFetch(
    "/comentarios_dashboard?select=id,proceso,hora,autor,comentario,created_at" +
    "&fecha=eq." + encodeURIComponent(fecha) +
    "&turno=eq." + encodeURIComponent(turno) +
    "&order=created_at.desc"
  ) || [];

}

async function guardarComentarioDashboard(registro){

  const payload = [{
    fecha: registro.fecha,
    turno: registro.turno === "DÍA" ? "DIA" : registro.turno,
    proceso: registro.proceso,
    hora: registro.hora,
    autor: registro.autor || "Usuario",
    comentario: registro.comentario
  }];

  const datos = await planifFetch(
    "/comentarios_dashboard",
    {
      method: "POST",
      headers: { "Prefer": "return=representation" },
      body: JSON.stringify(payload)
    }
  );

  if(!Array.isArray(datos) || datos.length === 0){
    throw new Error("No se pudo guardar el comentario (revisa RLS de comentarios_dashboard).");
  }

  return datos[0];

}

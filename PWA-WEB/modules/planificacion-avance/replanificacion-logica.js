// =========================================================
// REPLANIFICACIÓN RECURSOS - Lógica (Supabase, desde el navegador)
// Equivalente a Replanificacion.js (Apps Script).
// Reutiliza rgGet/rgPost/rgPatch definidos en recursos-logica.js.
// Filtro: SOLO fecha + turno (todo el turno, todos los supervisores).
// La función planificada (turno_colaboradores.funcion) NUNCA se modifica aquí.
// Los cambios en vivo viven en turno_colaboradores.funcion_actual,
// y cada cambio queda registrado en historial_replanificacion.
// =========================================================

// ---------------------------------------------------------
// CARGAR TABLA + DISTRIBUCIÓN PARA EL TURNO (fecha + turno)
// ---------------------------------------------------------

async function obtenerReplanificacionTurno(fecha, turno){

    const registros = await rgGet(
        "turno_colaboradores",
        "fecha=eq." + encodeURIComponent(fecha) +
        "&turno=eq." + encodeURIComponent(turno) +
        "&activo=eq.true" +
        "&select=id,colaborador_id,funcion,funcion_actual,usuario_turno,supervisor_efectivo," +
        "colaboradores(dni,nombre_completo)"
    );

    const filas = registros.map(function(r){

        const funcionInicio = r.funcion || "";
        const funcionActualCruda = r.funcion_actual || "";
        const funcionEfectiva = funcionActualCruda || funcionInicio;

        return {
            turno_colaborador_id: r.id,
            colaborador_id: r.colaborador_id,
            dni: r.colaboradores ? r.colaboradores.dni : "",
            nombre_completo: r.colaboradores ? r.colaboradores.nombre_completo : ("colaborador #" + r.colaborador_id),
            funcion_inicio: funcionInicio,
            funcion_actual: funcionActualCruda,
            funcion_efectiva: funcionEfectiva,
            usuario: r.usuario_turno || "",
            supervisor_efectivo: r.supervisor_efectivo || "",
            replanificado: funcionEfectiva !== funcionInicio
        };

    }).sort(function(a, b){
        return a.nombre_completo.localeCompare(b.nombre_completo);
    });

    return {
        filas: filas,
        distribucion: calcularDistribucion(filas),
        historial: await obtenerHistorialReplanificacion(fecha, turno)
    };

}

// ---------------------------------------------------------
// DISTRIBUCIÓN ACTUAL POR FUNCIÓN (con delta vs. lo planificado)
// ---------------------------------------------------------

function calcularDistribucion(filas){

    const SIN_FUNCION = "SIN FUNCIÓN";

    const conteoInicio = {};
    const conteoActual = {};

    filas.forEach(function(f){

        const inicio = f.funcion_inicio || SIN_FUNCION;
        const actual = f.funcion_efectiva || SIN_FUNCION;

        conteoInicio[inicio] = (conteoInicio[inicio] || 0) + 1;
        conteoActual[actual] = (conteoActual[actual] || 0) + 1;

    });

    const funciones = Array.from(new Set(Object.keys(conteoInicio).concat(Object.keys(conteoActual))));

    return funciones.map(function(fn){

        const antes = conteoInicio[fn] || 0;
        const ahora = conteoActual[fn] || 0;

        return {
            funcion: fn,
            colaboradores: ahora,
            delta: ahora - antes
        };

    });

}

// ---------------------------------------------------------
// HISTORIAL DE CAMBIOS RECIENTES (fecha + turno), con nombre del colaborador
// ---------------------------------------------------------

async function obtenerHistorialReplanificacion(fecha, turno){

    const registrosTurno = await rgGet(
        "turno_colaboradores",
        "fecha=eq." + encodeURIComponent(fecha) +
        "&turno=eq." + encodeURIComponent(turno) +
        "&select=id"
    );

    const idsTurno = registrosTurno.map(r => r.id);

    if(idsTurno.length === 0){
        return [];
    }

    const historial = await rgGet(
        "historial_replanificacion",
        "turno_colaborador_id=in.(" + idsTurno.join(",") + ")" +
        "&select=id,turno_colaborador_id,funcion_antes,funcion_despues,supervisor,observacion,creado_en," +
        "turno_colaboradores(colaborador_id,colaboradores(dni,nombre_completo))" +
        "&order=creado_en.desc" +
        "&limit=30"
    );

    return historial.map(function(h){

        const colaborador = h.turno_colaboradores && h.turno_colaboradores.colaboradores
            ? h.turno_colaboradores.colaboradores
            : null;

        return {
            hora: new Date(h.creado_en).toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" }),
            dni: colaborador ? colaborador.dni : "",
            nombre_completo: colaborador ? colaborador.nombre_completo : "colaborador",
            funcion_antes: h.funcion_antes,
            funcion_despues: h.funcion_despues,
            supervisor: h.supervisor || "",
            observacion: h.observacion || ""
        };

    });

}

// ---------------------------------------------------------
// GUARDAR UNA REPLANIFICACIÓN (una fila / una persona)
// ---------------------------------------------------------

async function guardarReplanificacionFila(turnoColaboradorId, nuevaFuncion, observacion){

    const actuales = await rgGet(
        "turno_colaboradores",
        "id=eq." + turnoColaboradorId + "&select=funcion,funcion_actual,supervisor_efectivo"
    );

    if(actuales.length === 0){
        throw new Error("No se encontró el registro de turno #" + turnoColaboradorId);
    }

    const funcionAntes = actuales[0].funcion_actual || actuales[0].funcion || "";
    const supervisor = actuales[0].supervisor_efectivo || "";

    if(funcionAntes === nuevaFuncion){
        return { sinCambios: true };
    }

    await rgPatch("turno_colaboradores", "id=eq." + turnoColaboradorId, {
        funcion_actual: nuevaFuncion
    });

    await rgPost("historial_replanificacion", [{
        turno_colaborador_id: turnoColaboradorId,
        funcion_antes: funcionAntes,
        funcion_despues: nuevaFuncion,
        supervisor: supervisor || null,
        observacion: observacion || null
    }]);

    return { sinCambios: false };

}

// ---------------------------------------------------------
// GUARDAR REPLANIFICACIÓN EN LOTE (varias filas a la vez)
// cambios: [{ turno_colaborador_id, funcion_actual, observacion }, ...]
// ---------------------------------------------------------

async function guardarReplanificacionBatch(fecha, turno, cambios){

    if(!cambios || cambios.length === 0){
        return await obtenerReplanificacionTurno(fecha, turno);
    }

    const ids = cambios.map(c => c.turno_colaborador_id);

    // 1. Traer de UN SOLO jalón el estado actual de todas las filas a
    //    tocar (antes: 1 GET por fila, uno detrás de otro).
    const actuales = await rgGet(
        "turno_colaboradores",
        "id=in.(" + ids.join(",") + ")" +
        "&select=id,funcion,funcion_actual,supervisor_efectivo"
    );

    const actualPorId = {};
    actuales.forEach(r => { actualPorId[r.id] = r; });

    // 2. Descartar los que en realidad no cambian de función
    const cambiosReales = cambios.filter(function(item){

        const actual = actualPorId[item.turno_colaborador_id];
        if(!actual) return false; // fila ya no existe: se ignora, no tumba el resto del lote

        const funcionAntes = actual.funcion_actual || actual.funcion || "";
        return funcionAntes !== item.funcion_actual;

    });

    if(cambiosReales.length === 0){
        return await obtenerReplanificacionTurno(fecha, turno);
    }

    // 3. PATCH de todas las filas EN PARALELO (antes: 1 PATCH por fila,
    //    secuencial — era el cuello de botella con varios cambios juntos)
    await Promise.all(cambiosReales.map(function(item){
        return rgPatch("turno_colaboradores", "id=eq." + item.turno_colaborador_id, {
            funcion_actual: item.funcion_actual
        });
    }));

    // 4. Historial: UN SOLO POST con todos los cambios del lote juntos
    //    (antes: 1 POST separado por cada fila modificada)
    const registrosHistorial = cambiosReales.map(function(item){

        const actual = actualPorId[item.turno_colaborador_id];
        const funcionAntes = actual.funcion_actual || actual.funcion || "";

        return {
            turno_colaborador_id: item.turno_colaborador_id,
            funcion_antes: funcionAntes,
            funcion_despues: item.funcion_actual,
            supervisor: actual.supervisor_efectivo || null,
            observacion: item.observacion || null
        };

    });

    await rgPost("historial_replanificacion", registrosHistorial);

    return await obtenerReplanificacionTurno(fecha, turno);

}

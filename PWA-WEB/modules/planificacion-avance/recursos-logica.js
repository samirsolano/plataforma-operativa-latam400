// =========================================================
// PLANIFICACIÓN RECURSOS - Lógica (Supabase, desde el navegador)
// Equivalente a Recursos.js (Apps Script), usando planifFetch
// (definido en shared/planificacion-config.js) en vez de UrlFetchApp.
// =========================================================

// ---------------------------------------------------------
// Helpers genéricos GET / POST / PATCH / DELETE
// ---------------------------------------------------------

async function rgGet(tabla, query){

    const datos = await planifFetch("/" + tabla + "?" + query);
    return datos || [];

}

async function rgPost(tabla, payload){

    const datos = await planifFetch(
        "/" + tabla,
        {
            method: "POST",
            headers: { "Prefer": "return=representation" },
            body: JSON.stringify(payload)
        }
    );

    if(!Array.isArray(datos) || datos.length === 0){
        throw new Error(
            "POST " + tabla + ": Supabase no devolvió la fila insertada. " +
            "Revisa las políticas RLS (Row Level Security) de la tabla '" + tabla + "'."
        );
    }

    return datos;

}

async function rgDelete(tabla, query){

    const datos = await planifFetch(
        "/" + tabla + "?" + query,
        {
            method: "DELETE",
            headers: { "Prefer": "return=representation" }
        }
    );

    return datos || [];

}

async function rgPatch(tabla, query, payload){

    const datos = await planifFetch(
        "/" + tabla + "?" + query,
        {
            method: "PATCH",
            headers: { "Prefer": "return=representation" },
            body: JSON.stringify(payload)
        }
    );

    if(!Array.isArray(datos) || datos.length === 0){
        throw new Error("PATCH " + tabla + ": no se actualizó ninguna fila (" + query + ")");
    }

    return datos;

}

// ---------------------------------------------------------
// Construir la fila combinada colaborador + estado del turno
// ---------------------------------------------------------

function construirFilaRecurso(colaborador, turnoRow, supervisorActual){

    return {
        colaborador_id: colaborador.id,
        turno_colaborador_id: turnoRow ? turnoRow.id : null,
        dni: colaborador.dni,
        nombre_completo: colaborador.nombre_completo,
        categoria: colaborador.categoria,
        puesto: colaborador.puesto,
        supervisor: colaborador.supervisor,
        supervisor_efectivo: turnoRow ? turnoRow.supervisor_efectivo : supervisorActual,
        tipo: turnoRow ? turnoRow.tipo : "NORMAL",
        funcion: turnoRow ? (turnoRow.funcion || colaborador.funcion || "") : (colaborador.funcion || ""),
        usuario_fijo: turnoRow ? (turnoRow.usuario_fijo || colaborador.usuario_fijo || "") : (colaborador.usuario_fijo || ""),
        usuarios: turnoRow && turnoRow.usuario_turno
            ? String(turnoRow.usuario_turno).split(",").map(u => u.trim()).filter(u => u !== "")
            : [],
        desde_hora: turnoRow ? (turnoRow.desde_hora || "") : "",
        activo: turnoRow ? !!turnoRow.activo : false
    };

}

// ---------------------------------------------------------
// Encontrar o crear el registro turno_colaboradores
// ---------------------------------------------------------

async function obtenerOCrearTurnoColaborador(colaboradorId, fecha, turno, supervisorEfectivo){

    const existentes = await rgGet(
        "turno_colaboradores",
        "colaborador_id=eq." + colaboradorId +
        "&fecha=eq." + encodeURIComponent(fecha) +
        "&turno=eq." + encodeURIComponent(turno) +
        "&select=*"
    );

    if(existentes.length > 0){
        return existentes[0];
    }

    const nuevo = await rgPost("turno_colaboradores", [{
        colaborador_id: colaboradorId,
        fecha: fecha,
        turno: turno,
        supervisor_efectivo: supervisorEfectivo,
        tipo: "NORMAL",
        funcion: null,
        usuario_turno: null,
        usuario_fijo: null,
        desde_hora: null,
        activo: false
    }]);

    return nuevo[0];

}

// ---------------------------------------------------------
// LISTAR SUPERVISORES (para el <select>)
// ---------------------------------------------------------

async function obtenerSupervisoresRecursos(){

    const datos = await rgGet("colaboradores", "select=supervisor");

    const set = {};
    datos.forEach(d => {
        if(d.supervisor) set[d.supervisor] = true;
    });

    return Object.keys(set).sort();

}

// ---------------------------------------------------------
// CARGAR TABLA PRINCIPAL (equipo fijo + apoyos recibidos)
// ---------------------------------------------------------

async function obtenerRecursosTurno(fecha, turno, supervisor){

    const equipo = await rgGet(
        "colaboradores",
        "supervisor=eq." + encodeURIComponent(supervisor) +
        "&select=*&order=nombre_completo.asc"
    );

    const turnoRegistros = await rgGet(
        "turno_colaboradores",
        "fecha=eq." + encodeURIComponent(fecha) +
        "&turno=eq." + encodeURIComponent(turno) +
        "&supervisor_efectivo=eq." + encodeURIComponent(supervisor) +
        "&select=*"
    );

    const mapaTurno = {};
    turnoRegistros.forEach(r => { mapaTurno[r.colaborador_id] = r; });

    const idsEquipo = {};
    equipo.forEach(c => { idsEquipo[c.id] = true; });

    const idsApoyoFaltantes = turnoRegistros
        .filter(r => r.tipo === "APOYO" && !idsEquipo[r.colaborador_id])
        .map(r => r.colaborador_id);

    let colaboradoresApoyo = [];

    if(idsApoyoFaltantes.length > 0){
        colaboradoresApoyo = await rgGet(
            "colaboradores",
            "id=in.(" + idsApoyoFaltantes.join(",") + ")&select=*"
        );
    }

    const resultado = [];

    equipo.forEach(c => {
        resultado.push(construirFilaRecurso(c, mapaTurno[c.id], supervisor));
    });

    colaboradoresApoyo.forEach(c => {
        resultado.push(construirFilaRecurso(c, mapaTurno[c.id], supervisor));
    });

    return resultado;

}

// ---------------------------------------------------------
// VALIDAR SI UN USUARIO YA ESTÁ ACTIVO EN OTRA PERSONA
// ---------------------------------------------------------

async function usuarioYaActivoEnOtraPersona(fecha, turno, usuario, colaboradorIdExcluir){

    const usuarioNorm = String(usuario).trim().toUpperCase();

    if(usuarioNorm === ""){
        return null;
    }

    const activos = await rgGet(
        "turno_colaboradores",
        "fecha=eq." + encodeURIComponent(fecha) +
        "&turno=eq." + encodeURIComponent(turno) +
        "&activo=eq.true" +
        "&select=colaborador_id,usuario_turno"
    );

    const conflicto = activos.find(function(r){

        if(r.colaborador_id === colaboradorIdExcluir) return false;
        if(!r.usuario_turno) return false;

        const lista = String(r.usuario_turno).split(",").map(u => u.trim().toUpperCase());

        return lista.indexOf(usuarioNorm) !== -1;

    });

    if(!conflicto){
        return null;
    }

    const persona = await rgGet("colaboradores", "id=eq." + conflicto.colaborador_id + "&select=nombre_completo");

    return persona.length > 0 ? persona[0].nombre_completo : ("colaborador #" + conflicto.colaborador_id);

}

// ---------------------------------------------------------
// AGREGAR UN USUARIO A UNA PERSONA EN ESTE TURNO
// ---------------------------------------------------------

async function cambiarUsuarioTurno(fecha, turno, colaboradorId, supervisor, nuevoUsuario, motivo, desdeHora, forzar){

    const nombreConflicto = await usuarioYaActivoEnOtraPersona(fecha, turno, nuevoUsuario, colaboradorId);

    if(nombreConflicto && !forzar){
        return {
            conflicto: true,
            mensaje: "El usuario " + nuevoUsuario + " ya está activo con " + nombreConflicto + " en este turno. ¿Deseas continuar de todas formas?"
        };
    }

    const fila = await obtenerOCrearTurnoColaborador(colaboradorId, fecha, turno, supervisor);

    const listaActual = fila.usuario_turno
        ? String(fila.usuario_turno).split(",").map(u => u.trim()).filter(u => u !== "")
        : [];

    if(listaActual.map(u => u.toUpperCase()).indexOf(String(nuevoUsuario).trim().toUpperCase()) !== -1){
        return { conflicto: true, mensaje: "Ese usuario ya está agregado a esta persona." };
    }

    listaActual.push(String(nuevoUsuario).trim());

    await rgPatch("turno_colaboradores", "id=eq." + fila.id, {
        usuario_turno: listaActual.join(","),
        desde_hora: desdeHora,
        activo: true
    });

    await rgPost("historial_usuario_turno", [{
        turno_colaborador_id: fila.id,
        usuario: nuevoUsuario,
        hora_inicio: desdeHora,
        hora_fin: null,
        motivo: motivo || null
    }]);

    return { conflicto: false };

}

// ---------------------------------------------------------
// GUARDAR PLANIFICACIÓN (masivo): activo + función + usuarios
// pendientes de todas las filas de la tabla, en LOTE/PARALELO
// (antes: 1 request por colaborador, de forma secuencial — con
// 20-30 personas eran 70-100+ llamadas HTTP una tras otra).
// ---------------------------------------------------------

async function guardarPlanificacionRecursosBatch(fecha, turno, supervisor, cambios, forzar){

    // 1. Detectar duplicados DENTRO del mismo lote
    const usuarioAColaborador = {};
    const advertencias = [];

    cambios.forEach(function(item){

        (item.usuarios || []).forEach(function(u){

            const key = String(u).trim().toUpperCase();
            if(key === "") return;

            if(usuarioAColaborador[key] && usuarioAColaborador[key] !== item.colaborador_id){
                advertencias.push("El usuario " + u + " está asignado a más de una persona en esta planificación.");
            }

            usuarioAColaborador[key] = item.colaborador_id;

        });

    });

    // 2. Detectar contra colaboradores YA activos fuera de este lote
    const idsLote = cambios.map(c => c.colaborador_id);

    const activosExternos = (await rgGet(
        "turno_colaboradores",
        "fecha=eq." + encodeURIComponent(fecha) +
        "&turno=eq." + encodeURIComponent(turno) +
        "&activo=eq.true" +
        "&select=colaborador_id,usuario_turno"
    )).filter(r => idsLote.indexOf(r.colaborador_id) === -1);

    for(const usuarioNorm in usuarioAColaborador){

        const conflicto = activosExternos.find(function(r){

            if(!r.usuario_turno) return false;

            const lista = String(r.usuario_turno).split(",").map(x => x.trim().toUpperCase());

            return lista.indexOf(usuarioNorm) !== -1;

        });

        if(conflicto){

            const persona = await rgGet("colaboradores", "id=eq." + conflicto.colaborador_id + "&select=nombre_completo");
            const nombre = persona.length > 0 ? persona[0].nombre_completo : ("colaborador #" + conflicto.colaborador_id);

            advertencias.push("El usuario " + usuarioNorm + " ya está activo con " + nombre + " en este turno.");

        }

    }

    if(advertencias.length > 0 && !forzar){
        return { conflicto: true, mensajes: advertencias };
    }

    // 3. Grabar todo — en lote/paralelo en vez de secuencial
    const errorespatchMaestra = [];

    const idsColaboradores = cambios.map(item => item.colaborador_id);

    // 3a. Traer de UN SOLO jalón las filas turno_colaboradores que ya
    //     existen para todo el lote (antes: 1 GET por colaborador).
    const existentesLote = idsColaboradores.length > 0
        ? await rgGet(
            "turno_colaboradores",
            "colaborador_id=in.(" + idsColaboradores.join(",") + ")" +
            "&fecha=eq." + encodeURIComponent(fecha) +
            "&turno=eq." + encodeURIComponent(turno) +
            "&select=*"
          )
        : [];

    const filaPorColaborador = {};
    existentesLote.forEach(row => { filaPorColaborador[row.colaborador_id] = row; });

    const itemsNuevos = cambios.filter(item => !filaPorColaborador[item.colaborador_id]);
    const itemsExistentes = cambios.filter(item => !!filaPorColaborador[item.colaborador_id]);

    // 3b. Colaboradores SIN fila todavía: se crean todos de una vez,
    //     ya con los valores finales (antes: crear "vacía" y luego
    //     hacer un PATCH aparte por cada uno).
    if(itemsNuevos.length > 0){

        const payloadNuevos = itemsNuevos.map(function(item){

            const usuariosNuevos = (item.usuarios || [])
                .map(x => String(x).trim())
                .filter(x => x !== "");

            return {
                colaborador_id: item.colaborador_id,
                fecha: fecha,
                turno: turno,
                supervisor_efectivo: item.supervisor_efectivo || supervisor,
                tipo: "NORMAL",
                activo: !!item.activo,
                funcion: item.funcion || null,
                usuario_turno: usuariosNuevos.length > 0 ? usuariosNuevos.join(",") : null,
                usuario_fijo: item.usuario_fijo || null,
                desde_hora: null
            };

        });

        const creados = await rgPost("turno_colaboradores", payloadNuevos);
        creados.forEach(row => { filaPorColaborador[row.colaborador_id] = row; });

    }

    // 3c. Colaboradores que YA tenían fila: actualizarlas todas EN
    //     PARALELO con Promise.all (antes: 1 PATCH secuencial por persona).
    //     Guardamos también los usuarios_turno de ANTES del patch, para
    //     poder calcular más abajo qué usuarios son "nuevos" (historial).
    const usuariosAnterioresPorColaborador = {};
    itemsExistentes.forEach(function(item){
        const filaVieja = filaPorColaborador[item.colaborador_id];
        usuariosAnterioresPorColaborador[item.colaborador_id] = filaVieja.usuario_turno
            ? String(filaVieja.usuario_turno).split(",").map(x => x.trim()).filter(x => x !== "")
            : [];
    });

    if(itemsExistentes.length > 0){

        const resultadosPatchTurno = await Promise.all(itemsExistentes.map(function(item){

            const usuariosNuevos = (item.usuarios || [])
                .map(x => String(x).trim())
                .filter(x => x !== "");

            return rgPatch("turno_colaboradores", "id=eq." + filaPorColaborador[item.colaborador_id].id, {
                activo: !!item.activo,
                funcion: item.funcion || null,
                usuario_turno: usuariosNuevos.length > 0 ? usuariosNuevos.join(",") : null,
                usuario_fijo: item.usuario_fijo || null
            });

        }));

        itemsExistentes.forEach(function(item, i){
            filaPorColaborador[item.colaborador_id] = resultadosPatchTurno[i][0];
        });

    }

    // 3d. Ficha maestra de "colaboradores" (función + usuario fijo):
    //     también en paralelo. Si alguna falla (ej. RLS), no tumba las
    //     demás — se reporta igual que antes en erroresMaestra.
    if(cambios.length > 0){

        const resultadosMaestra = await Promise.allSettled(cambios.map(function(item){

            return rgPatch("colaboradores", "id=eq." + item.colaborador_id, {
                funcion: item.funcion || null,
                usuario_fijo: item.usuario_fijo || null
            });

        }));

        resultadosMaestra.forEach(function(resultado, i){

            if(resultado.status === "rejected"){

                errorespatchMaestra.push(
                    "No se pudo actualizar la ficha maestra de colaborador_id " +
                    cambios[i].colaborador_id + ": " + resultado.reason.message
                );

            }

        });

    }

    // 3e. Historial: juntar TODOS los usuarios nuevos de TODO el lote
    //     y mandarlos en UN SOLO POST (antes: 1 POST por cada usuario
    //     agregado, de cada persona, uno por uno).
    const horaAhora = new Date().toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" });
    const registrosHistorial = [];

    cambios.forEach(function(item){

        const fila = filaPorColaborador[item.colaborador_id];

        const usuariosAnteriores = usuariosAnterioresPorColaborador[item.colaborador_id] || [];

        const usuariosNuevos = (item.usuarios || [])
            .map(x => String(x).trim())
            .filter(x => x !== "");

        const agregados = usuariosNuevos.filter(u => usuariosAnteriores.indexOf(u) === -1);

        agregados.forEach(function(u){
            registrosHistorial.push({
                turno_colaborador_id: fila.id,
                usuario: u,
                hora_inicio: horaAhora,
                hora_fin: null,
                motivo: "Agregado desde Guardar Planificación"
            });
        });

    });

    if(registrosHistorial.length > 0){
        await rgPost("historial_usuario_turno", registrosHistorial);
    }

    return {
        conflicto: false,
        datos: await obtenerRecursosTurno(fecha, turno, supervisor),
        erroresMaestra: errorespatchMaestra
    };

}

// ---------------------------------------------------------
// HISTORIAL DE UN COLABORADOR EN ESE TURNO
// ---------------------------------------------------------

async function obtenerHistorialTurno(turnoColaboradorId){

    if(!turnoColaboradorId){
        return [];
    }

    return await rgGet(
        "historial_usuario_turno",
        "turno_colaborador_id=eq." + turnoColaboradorId +
        "&select=*&order=hora_inicio.asc"
    );

}

// ---------------------------------------------------------
// BUSCAR COLABORADORES (para "Agregar apoyo")
// ---------------------------------------------------------

async function buscarColaboradoresGlobal(texto){

    texto = String(texto || "").trim();

    if(texto.length < 2){
        return [];
    }

    const filtroNombre = "nombre_completo.ilike.*" + encodeURIComponent(texto) + "*";
    const filtroDni = "dni.ilike.*" + encodeURIComponent(texto) + "*";

    return await rgGet(
        "colaboradores",
        "or=(" + filtroNombre + "," + filtroDni + ")&select=*&limit=10"
    );

}

// ---------------------------------------------------------
// AGREGAR APOYO
// ---------------------------------------------------------

async function agregarApoyoRecursos(fecha, turno, colaboradorId, supervisorDestino, funcion, usuarioTurno, desdeHora, forzar){

    if(usuarioTurno){

        const nombreConflicto = await usuarioYaActivoEnOtraPersona(fecha, turno, usuarioTurno, colaboradorId);

        if(nombreConflicto && !forzar){
            return {
                conflicto: true,
                mensaje: "El usuario " + usuarioTurno + " ya está activo con " + nombreConflicto + " en este turno. ¿Deseas continuar de todas formas?"
            };
        }

    }

    const fila = await obtenerOCrearTurnoColaborador(colaboradorId, fecha, turno, supervisorDestino);

    await rgPatch("turno_colaboradores", "id=eq." + fila.id, {
        supervisor_efectivo: supervisorDestino,
        tipo: "APOYO",
        funcion: funcion || null,
        usuario_turno: usuarioTurno || null,
        desde_hora: desdeHora || null,
        activo: true
    });

    if(usuarioTurno){
        await rgPost("historial_usuario_turno", [{
            turno_colaborador_id: fila.id,
            usuario: usuarioTurno,
            hora_inicio: desdeHora || null,
            hora_fin: null,
            motivo: "Asignado como apoyo a " + supervisorDestino
        }]);
    }

    return { conflicto: false, datos: await obtenerRecursosTurno(fecha, turno, supervisorDestino) };

}

// ---------------------------------------------------------
// REGISTRAR UN COLABORADOR NUEVO
// ---------------------------------------------------------

async function registrarColaboradorNuevo(dni, nombreCompleto, categoria, puesto, supervisor, funcion, usuarioFijo){

    const nuevo = await rgPost("colaboradores", [{
        dni: dni,
        nombre_completo: nombreCompleto,
        categoria: categoria || null,
        puesto: puesto || null,
        supervisor: supervisor || null,
        funcion: funcion || null,
        usuario_fijo: usuarioFijo || null,
        activo_general: true
    }]);

    return nuevo[0];

}

// ---------------------------------------------------------
// ELIMINAR UN COLABORADOR DE LA DATA PRINCIPAL
// ---------------------------------------------------------

async function eliminarColaboradorRecursos(colaboradorId){

    await rgDelete("colaboradores", "id=eq." + colaboradorId);

    return true;

}

// =======================================
// SUPERVISOR GUARDADO PARA ESTA FECHA/TURNO
// =======================================
//
// Busca en turno_colaboradores si ya hay actividad guardada para
// esta fecha/turno (de una sesión anterior) y devuelve ese supervisor,
// para preseleccionarlo automáticamente al abrir el módulo.

async function obtenerUltimoSupervisorTurno(fecha, turno){

    turno = normalizarTurnoPlanif(turno);

    const filas = await rgGet(
        "turno_colaboradores",
        "fecha=eq." + encodeURIComponent(fecha) +
        "&turno=eq." + encodeURIComponent(turno) +
        "&select=supervisor_efectivo" +
        "&order=id.desc" +
        "&limit=1"
    );

    return filas.length > 0 ? filas[0].supervisor_efectivo : null;

}

// =======================================
// NECESIDAD DEL TURNO (pickers / apiladores)
// =======================================
//
// Tasas de referencia:
//  - Picking:    0.9 TN por persona por hora
//  - Extracción: 16 paletas por persona por hora
//
// Se calcula sobre el total planificado (estado_planificacion = PLANIFICADO)
// de planificacion_diaria para la fecha/turno, dividido entre 10.5 horas
// efectivas del turno (12 horas de turno menos 1.5h de almuerzo/refrigerio).

async function obtenerNecesidadTurno(fecha, turno){

    turno = normalizarTurnoPlanif(turno);

    const HORAS_TURNO = 10.5; // 12 horas de turno - 1.5h de almuerzo
    const TN_POR_PERSONA_HORA_PICKING = 0.9;
    const PALETAS_POR_PERSONA_HORA_EXTRACCION = 16;

    const filas = await rgGet(
        "planificacion_diaria",
        "fecha=eq." + encodeURIComponent(fecha) +
        "&turno=eq." + encodeURIComponent(turno) +
        "&estado_planificacion=eq.PLANIFICADO" +
        "&select=tnl_picking,ctd_extraccion"
    );

    let totalTnlPicking = 0;
    let totalCtdExtraccion = 0;

    filas.forEach(function(f){
        totalTnlPicking += Number(f.tnl_picking || 0);
        totalCtdExtraccion += Number(f.ctd_extraccion || 0);
    });

    const necesidadPicking = Math.ceil(
        totalTnlPicking / (TN_POR_PERSONA_HORA_PICKING * HORAS_TURNO)
    );

    const necesidadApiladores = Math.ceil(
        totalCtdExtraccion / (PALETAS_POR_PERSONA_HORA_EXTRACCION * HORAS_TURNO)
    );

    return {
        totalTnlPicking: Math.round(totalTnlPicking * 100) / 100,
        totalCtdExtraccion: totalCtdExtraccion,
        necesidadPicking: necesidadPicking,
        necesidadApiladores: necesidadApiladores
    };

}

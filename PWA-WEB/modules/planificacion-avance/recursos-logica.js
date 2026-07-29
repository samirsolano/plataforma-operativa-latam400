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
// GUARDAR PLANIFICACIÓN (masivo)
// ---------------------------------------------------------

async function guardarPlanificacionRecursosBatch(fecha, turno, supervisor, cambios, forzar){

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

    const idsLote = cambios.map(c => c.colaborador_id);

    const activosTodos = await rgGet(
        "turno_colaboradores",
        "fecha=eq." + encodeURIComponent(fecha) +
        "&turno=eq." + encodeURIComponent(turno) +
        "&activo=eq.true" +
        "&select=colaborador_id,usuario_turno"
    );

    const activosExternos = activosTodos.filter(r => idsLote.indexOf(r.colaborador_id) === -1);

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

    const errorespatchMaestra = [];

    for(const item of cambios){

        const fila = await obtenerOCrearTurnoColaborador(
            item.colaborador_id, fecha, turno, item.supervisor_efectivo || supervisor
        );

        const usuariosAnteriores = fila.usuario_turno
            ? String(fila.usuario_turno).split(",").map(x => x.trim()).filter(x => x !== "")
            : [];

        const usuariosNuevos = (item.usuarios || [])
            .map(x => String(x).trim())
            .filter(x => x !== "");

        await rgPatch("turno_colaboradores", "id=eq." + fila.id, {
            activo: !!item.activo,
            funcion: item.funcion || null,
            usuario_turno: usuariosNuevos.length > 0 ? usuariosNuevos.join(",") : null,
            usuario_fijo: item.usuario_fijo || null
        });

        try{

            await rgPatch("colaboradores", "id=eq." + item.colaborador_id, {
                funcion: item.funcion || null,
                usuario_fijo: item.usuario_fijo || null
            });

        }catch(errorMaestra){

            errorespatchMaestra.push(
                "No se pudo actualizar la ficha maestra de colaborador_id " +
                item.colaborador_id + ": " + errorMaestra.message
            );

        }

        const agregados = usuariosNuevos.filter(u => usuariosAnteriores.indexOf(u) === -1);

        for(const u of agregados){

            await rgPost("historial_usuario_turno", [{
                turno_colaborador_id: fila.id,
                usuario: u,
                hora_inicio: new Date().toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" }),
                hora_fin: null,
                motivo: "Agregado desde Guardar Planificación"
            }]);

        }

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

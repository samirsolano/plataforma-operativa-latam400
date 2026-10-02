// ========================================
// SESIÓN Y PERMISOS
// ========================================

const sesion = requerirSesion();

if(sesion && !tienePermiso(sesion, "planificacion-avance")){
    window.location.href = "../inicio/home.html";
}

if(sesion){

    aplicarPermisosEnIds(sesion, {
        btnPlanificado: "planificacion-avance.planificado",
        btnRecursos: "planificacion-avance.recursos",
        btnReplanificacion: "planificacion-avance.replanificacion",
        btnSAP: "planificacion-avance.sap",
        btnDashboard: "planificacion-avance.dashboard",
        btnHoraHora: "planificacion-avance.horahora",
        btnDialogoDiario: "planificacion-avance.dialogodiario",
        btnProductividad: "planificacion-avance.productividad"
    });

}

let fechaSeleccionada = "";
let turnoSeleccionado = "";

// =====================================================================
// FECHA/TURNO ACTIVO — se puede elegir cualquier fecha/turno en el
// sidebar para VER su planificación (Planificado Drive, Recursos,
// Replanificación), pero solo se puede GUARDAR/MODIFICAR cuando lo
// elegido coincide con el turno que está corriendo ahora mismo
// (obtenerFechaTurnoActivo, en planificacion-config.js). Cada acción
// de guardado llama a bloquearSiNoEsTurnoActivo() primero.
// =====================================================================

// Al abrir la página, arranca con la fecha/turno activo como punto de
// partida (conveniencia) — de ahí en adelante el usuario puede
// cambiarlo libremente para solo consultar otro día.
(function inicializarFechaTurno(){
    const activo = obtenerFechaTurnoActivo();
    document.getElementById("fecha").value = activo.fecha;
    document.getElementById("turno").value = activo.turno;
})();

function esFechaTurnoActivo(fecha, turno){
    const activo = obtenerFechaTurnoActivo();
    return fecha === activo.fecha && normalizarTurnoPlanif(turno) === activo.turno;
}

// Copia lo que está en los campos FECHA/TURNO del sidebar a
// fechaSeleccionada/turnoSeleccionado. Los guardados leen la fecha
// directo del campo, así que el guard tiene que mirar lo mismo — si
// no, se podía abrir el módulo en el turno activo, cambiar la fecha
// del sidebar y guardar sobre otro día sin que el guard lo notara.
function sincronizarFechaTurnoSidebar(){
    fechaSeleccionada = document.getElementById("fecha").value;
    turnoSeleccionado = normalizarTurnoPlanif(document.getElementById("turno").value);
    actualizarNotaTurnoActivo();
}

/**
 * Guard para cualquier acción que GUARDE/MODIFIQUE datos de
 * Planificación. Usa la fecha/turno elegidos en el sidebar en este
 * momento. Devuelve `true` si la acción debe bloquearse (y ya mostró
 * el aviso), `false` si puede continuar.
 */
function bloquearSiNoEsTurnoActivo(){

    sincronizarFechaTurnoSidebar();

    if(esFechaTurnoActivo(fechaSeleccionada, turnoSeleccionado)){
        return false;
    }

    const activo = obtenerFechaTurnoActivo();
    const nombreTurno = activo.turno === "DIA" ? "DÍA" : "NOCHE";

    // Caso típico: la página se abrió antes del cambio de turno (ej. a
    // las 18:50 queda en DÍA) y a las 19:10 se intenta guardar la
    // NOCHE. En vez de solo bloquear, se ofrece pasar al turno activo
    // con un clic (recarga el módulo con esa fecha/turno; lo que se
    // haya editado en pantalla para el turno anterior se descarta).
    mostrarConfirmModal(
        "Solo puedes planificar o modificar el turno que está corriendo ahora mismo: " +
        nombreTurno + " del " + activo.fecha + ". " +
        "Estás viendo " + fechaSeleccionada + " / " + turnoSeleccionado + ", que aquí es solo de consulta.\n\n" +
        "¿Quieres pasar al turno " + nombreTurno + " del " + activo.fecha + "? (Revisa tus cambios y vuelve a guardar.)",
        function(){
            document.getElementById("fecha").value = activo.fecha;
            document.getElementById("turno").value = activo.turno;
            _fechaTurnoSidebarPrevio = { fecha: activo.fecha, turno: activo.turno };
            if(window.moduloActual && window.botonActual){
                recargarModuloActual();
            }else{
                sincronizarFechaTurnoSidebar();
            }
        },
        null,
        { titulo: "Turno no activo", textoAceptar: "Ir al turno activo", textoCancelar: "Solo consultar" }
    );

    return true;

}

// =====================================================================
// MODAL GLOBAL — reemplaza a alert()/confirm() nativos en todo el sistema
// =====================================================================

let _modalGlobalCallback = null;

const _MODAL_ICONOS = { info: "ℹ️", error: "❌", warning: "⚠️", success: "✅", pregunta: "❓" };
const _MODAL_TITULOS = { info: "Aviso", error: "Error", warning: "Atención", success: "Listo", pregunta: "Confirmar" };

function mostrarAlertaModal(mensaje, tipo){

    tipo = tipo || "info";

    document.getElementById("modalGlobalIcono").textContent = _MODAL_ICONOS[tipo] || _MODAL_ICONOS.info;
    document.getElementById("modalGlobalTitulo").textContent = _MODAL_TITULOS[tipo] || _MODAL_TITULOS.info;
    document.getElementById("modalGlobalMensaje").textContent = mensaje;

    document.getElementById("modalGlobalBtnCancelar").style.display = "none";
    document.getElementById("modalGlobalBtnAceptar").textContent = "Aceptar";

    document.getElementById("modalGlobal").style.display = "flex";

    _modalGlobalCallback = null;

}

function mostrarConfirmModal(mensaje, onConfirmar, onCancelar, opciones){

    opciones = opciones || {};

    document.getElementById("modalGlobalIcono").textContent = _MODAL_ICONOS.pregunta;
    document.getElementById("modalGlobalTitulo").textContent = opciones.titulo || _MODAL_TITULOS.pregunta;
    document.getElementById("modalGlobalMensaje").textContent = mensaje;

    document.getElementById("modalGlobalBtnCancelar").style.display = "inline-block";
    document.getElementById("modalGlobalBtnCancelar").textContent = opciones.textoCancelar || "Cancelar";
    document.getElementById("modalGlobalBtnAceptar").textContent = opciones.textoAceptar || "Confirmar";

    document.getElementById("modalGlobal").style.display = "flex";

    _modalGlobalCallback = function(confirmado){
        if(confirmado && typeof onConfirmar === "function") onConfirmar();
        if(!confirmado && typeof onCancelar === "function") onCancelar();
    };

}

function cerrarModalGlobal(confirmado){

    document.getElementById("modalGlobal").style.display = "none";

    const callback = _modalGlobalCallback;
    _modalGlobalCallback = null;

    if(callback) callback(confirmado);

}

// =====================================================================
// NAVEGACIÓN ENTRE MÓDULOS
// =====================================================================

function abrirModulo(modulo, boton){

    if(!tienePermiso(sesion, "planificacion-avance", modulo)){
        mostrarAlertaModal("No tienes permiso para acceder a esta sección.", "error");
        return;
    }

    // Si venía del modo "pantalla completa" de Hora x Hora, se sale al cambiar de módulo
    document.body.classList.remove("hxh-pantalla-completa");

    // Guarda el módulo/botón que estaba activo ANTES de este cambio,
    // para que "Volver" (usado en Hora x Hora) pueda regresar a él.
    window.moduloPrevio = window.moduloActual || null;
    window.botonPrevio = window.botonActual || null;

    sincronizarFechaTurnoSidebar();

    if(fechaSeleccionada === ""){
        mostrarAlertaModal("Seleccione una fecha antes de continuar.", "warning");
        return;
    }

    if(turnoSeleccionado === ""){
        mostrarAlertaModal("Seleccione un turno antes de continuar.", "warning");
        return;
    }

    document.getElementById("inicio").style.display = "none";

    document.getElementById("modPlanificado").style.display = "none";
    document.getElementById("modRecursos").style.display = "none";
    document.getElementById("modReplanificacion").style.display = "none";
    document.getElementById("modSAP").style.display = "none";
    document.getElementById("modDashboard").style.display = "none";
    document.getElementById("modHoraHora").style.display = "none";
    document.getElementById("modDialogoDiario").style.display = "none";
    document.getElementById("modProductividad").style.display = "none";

    document.querySelectorAll(".menu button").forEach(btn => {
        btn.classList.remove("activo");
    });

    boton.classList.add("activo");

    switch(modulo){

        case "planificado":
            document.getElementById("modPlanificado").style.display = "block";
            cargarPlanificacion();
            break;

        case "recursos":
            document.getElementById("modRecursos").style.display = "block";
            cargarRecursos();
            break;

        case "replanificacion":
            document.getElementById("modReplanificacion").style.display = "block";
            iniciarReplanificacion();
            break;

        case "sap":
            document.getElementById("modSAP").style.display = "block";
            break;

        case "dashboard":
            abrirDashboard();
            break;

        case "horahora":
            abrirHoraXHora();
            break;

        case "dialogodiario":
            abrirDialogoDiario();
            break;

        case "productividad":
            abrirResumenProductividad();
            break;

    }

    // Queda registrado como el módulo/botón activo, para la próxima vez que se use "Volver"
    window.moduloActual = modulo;
    window.botonActual = boton;

}

// =====================================================================
// CAMBIO DE FECHA/TURNO EN EL SIDEBAR — recarga el módulo abierto con
// la nueva fecha/turno (antes la tabla seguía mostrando el día anterior
// mientras el sidebar ya decía otro). Si hay cambios sin guardar en
// Recursos o Replanificación, pregunta antes de descartarlos.
// =====================================================================

let _fechaTurnoSidebarPrevio = {
    fecha: document.getElementById("fecha").value,
    turno: document.getElementById("turno").value
};

function hayCambiosSinGuardarPlanificacion(){

    if(window.moduloActual === "recursos" && typeof recursosData !== "undefined"){
        return recursosData.some(function(r){ return r._modificado; });
    }

    if(window.moduloActual === "replanificacion" && typeof rpData !== "undefined"){
        return rpData.some(function(r){ return r._modificado; });
    }

    return false;

}

function recargarModuloActual(){

    const previo = window.moduloPrevio;
    const botonPrevio = window.botonPrevio;

    abrirModulo(window.moduloActual, window.botonActual);

    // abrirModulo registra el mismo módulo como "previo"; se restaura
    // el real para que "Volver" siga funcionando.
    window.moduloPrevio = previo;
    window.botonPrevio = botonPrevio;

}

function onCambioFechaTurnoSidebar(){

    const campoFecha = document.getElementById("fecha");
    const campoTurno = document.getElementById("turno");

    // Módulos que no dependen de la fecha/turno del sidebar: no se recargan
    const independientes = ["sap", "dialogodiario", "productividad"];

    if(!window.moduloActual || !window.botonActual || independientes.indexOf(window.moduloActual) !== -1){
        _fechaTurnoSidebarPrevio = { fecha: campoFecha.value, turno: campoTurno.value };
        return;
    }

    if(hayCambiosSinGuardarPlanificacion()){

        const nuevo = { fecha: campoFecha.value, turno: campoTurno.value };

        // Se vuelve al valor anterior mientras el usuario decide
        campoFecha.value = _fechaTurnoSidebarPrevio.fecha;
        campoTurno.value = _fechaTurnoSidebarPrevio.turno;
        actualizarNotaTurnoActivo();

        mostrarConfirmModal(
            "Tienes cambios sin guardar en este módulo. Si cambias de fecha/turno se perderán. ¿Continuar?",
            function(){
                campoFecha.value = nuevo.fecha;
                campoTurno.value = nuevo.turno;
                _fechaTurnoSidebarPrevio = nuevo;
                recargarModuloActual();
            },
            null,
            { textoAceptar: "Sí, cambiar", textoCancelar: "Cancelar" }
        );

        return;

    }

    _fechaTurnoSidebarPrevio = { fecha: campoFecha.value, turno: campoTurno.value };
    recargarModuloActual();

}

document.getElementById("fecha").addEventListener("change", onCambioFechaTurnoSidebar);
document.getElementById("turno").addEventListener("change", onCambioFechaTurnoSidebar);

// Aviso visible en el sidebar cuando lo elegido NO es el turno que está
// corriendo (se revisa cada minuto: a las 07:00/19:00 el turno activo
// cambia aunque nadie toque la página).
function actualizarNotaTurnoActivo(){

    const nota = document.getElementById("notaTurnoActivo");
    if(!nota) return;

    const fecha = document.getElementById("fecha").value;
    const turno = document.getElementById("turno").value;

    if(!fecha || esFechaTurnoActivo(fecha, turno)){
        nota.style.color = "#9aa5b1";
        nota.style.fontWeight = "";
        nota.textContent = "Puedes ver cualquier fecha/turno, pero solo se puede planificar o modificar el que está corriendo ahora mismo.";
        return;
    }

    const activo = obtenerFechaTurnoActivo();

    nota.style.color = "#fff3b0";
    nota.style.fontWeight = "700";
    nota.textContent = "⚠️ Solo consulta. El turno activo ahora es " +
        (activo.turno === "DIA" ? "DÍA" : "NOCHE") + " del " + activo.fecha + ".";

}

document.getElementById("fecha").addEventListener("change", actualizarNotaTurnoActivo);
document.getElementById("turno").addEventListener("change", actualizarNotaTurnoActivo);
setInterval(actualizarNotaTurnoActivo, 60000);
actualizarNotaTurnoActivo();

/**
 * Botón "Volver" (usado en Hora x Hora): regresa al módulo que estaba
 * abierto justo antes de entrar aquí. Si no hay ninguno registrado
 * (por ejemplo, se entró directo por URL), vuelve al Dashboard.
 */
function volverModuloAnterior(){

    if(window.moduloPrevio && window.botonPrevio){
        abrirModulo(window.moduloPrevio, window.botonPrevio);
        return;
    }

    const botonDashboard = document.querySelector('.menu button[onclick*="dashboard"]');

    if(botonDashboard){
        abrirModulo("dashboard", botonDashboard);
    }

}

/**
 * "Pantalla completa" para Hora x Hora: NO es el fullscreen nativo del
 * navegador, es ocultar el sidebar rojo para que el dashboard ocupe
 * toda la ventana (ideal para un monitor/TV de pared).
 */
function alternarPantallaCompleta(){

    const activo = document.body.classList.toggle("hxh-pantalla-completa");

    document.querySelectorAll('button[onclick*="alternarPantallaCompleta"]').forEach(function(boton){
        boton.innerHTML = activo ? "⛶ Salir de pantalla completa" : "⛶ Pantalla completa";
    });

}

// ========================================
// SESIÓN
// ========================================

requerirSesion();

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

/**
 * Guard para cualquier acción que GUARDE/MODIFIQUE datos de
 * Planificación. Usa fechaSeleccionada/turnoSeleccionado (lo que el
 * usuario tiene elegido en el sidebar en este momento). Devuelve
 * `true` si la acción debe bloquearse (y ya mostró el aviso), `false`
 * si puede continuar.
 */
function bloquearSiNoEsTurnoActivo(){

    if(esFechaTurnoActivo(fechaSeleccionada, turnoSeleccionado)){
        return false;
    }

    const activo = obtenerFechaTurnoActivo();
    const nombreTurno = activo.turno === "DIA" ? "DÍA" : "NOCHE";

    mostrarAlertaModal(
        "Solo puedes planificar o modificar el turno que está corriendo ahora mismo: " +
        nombreTurno + " del " + activo.fecha + ". " +
        "Estás viendo " + fechaSeleccionada + " / " + turnoSeleccionado + ", que aquí es solo de consulta.",
        "warning"
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

    // Si venía del modo "pantalla completa" de Hora x Hora, se sale al cambiar de módulo
    document.body.classList.remove("hxh-pantalla-completa");

    // Guarda el módulo/botón que estaba activo ANTES de este cambio,
    // para que "Volver" (usado en Hora x Hora) pueda regresar a él.
    window.moduloPrevio = window.moduloActual || null;
    window.botonPrevio = window.botonActual || null;

    fechaSeleccionada = document.getElementById("fecha").value;
    turnoSeleccionado = normalizarTurnoPlanif(document.getElementById("turno").value);

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

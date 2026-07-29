// ========================================
// SESIÓN
// ========================================

requerirSesion();

let fechaSeleccionada = "";
let turnoSeleccionado = "";

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

    fechaSeleccionada = document.getElementById("fecha").value;

    const turnoCrudo = document.getElementById("turno").value;
    turnoSeleccionado = normalizarTurnoPlanif(turnoCrudo);

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
            document.getElementById("modDashboard").style.display = "block";
            break;

        case "horahora":
            document.getElementById("modHoraHora").style.display = "block";
            break;

    }

}

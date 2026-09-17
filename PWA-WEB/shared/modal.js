// ========================================
// MODAL PROPIO (reemplaza alert/confirm/prompt nativos del navegador)
// ========================================
// El panel no debe interrumpir con los cuadros del propio navegador —
// estas 3 funciones son reemplazo "drop-in" pero asíncrono:
// mostrarAlerta() resuelve cuando se cierra, mostrarConfirmacion()
// resuelve true/false, y pedirTexto() resuelve el texto escrito o
// null si se cancela — mismo contrato que sus equivalentes nativos,
// por eso todo lo que las usa lleva await.

(function(){

    let overlayModal = null;

    function construirOverlay(){

        if(overlayModal){
            return overlayModal;
        }

        const estilos = document.createElement("style");
        estilos.textContent = `
            .modalOverlay{
                position:fixed; inset:0; background:rgba(17,24,39,.55);
                display:flex; align-items:center; justify-content:center;
                z-index:9999; padding:20px;
            }
            .modalOverlay.oculto{ display:none; }
            .modalCaja{
                background:#fff; border-radius:16px; padding:22px;
                max-width:400px; width:100%;
                box-shadow:0 20px 50px rgba(0,0,0,.25);
                font-family:inherit;
            }
            .modalMensaje{
                font-size:15px; color:#111827; line-height:1.4;
                white-space:pre-line; margin-bottom:16px;
            }
            .modalInput{
                width:100%; padding:10px 12px; border:1.5px solid #d5dbe5;
                border-radius:10px; font-size:15px; margin-bottom:16px;
                box-sizing:border-box;
            }
            .modalBotones{
                display:flex; gap:10px; justify-content:flex-end;
            }
            .modalBoton{
                padding:10px 18px; border-radius:10px; font-size:14px;
                font-weight:700; border:none; cursor:pointer;
            }
            .modalBotonPrimario{ background:#FC000D; color:#fff; }
            .modalBotonSecundario{ background:#f3f4f6; color:#111827; }
        `;
        document.head.appendChild(estilos);

        overlayModal = document.createElement("div");
        overlayModal.className = "modalOverlay oculto";
        overlayModal.innerHTML = `
            <div class="modalCaja">
                <div class="modalMensaje" id="modalMensajeTexto"></div>
                <input type="text" class="modalInput oculto" id="modalInputTexto">
                <div class="modalBotones">
                    <button class="modalBoton modalBotonSecundario oculto" id="modalBotonCancelar">Cancelar</button>
                    <button class="modalBoton modalBotonPrimario" id="modalBotonAceptar">Aceptar</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlayModal);

        return overlayModal;

    }

    function mostrarModalBase(opciones){

        const overlay = construirOverlay();
        const mensajeEl = overlay.querySelector("#modalMensajeTexto");
        const inputEl = overlay.querySelector("#modalInputTexto");
        const btnAceptar = overlay.querySelector("#modalBotonAceptar");
        const btnCancelar = overlay.querySelector("#modalBotonCancelar");

        mensajeEl.textContent = opciones.mensaje || "";
        btnAceptar.textContent = opciones.textoAceptar || "Aceptar";

        inputEl.classList.toggle("oculto", !opciones.conInput);
        btnCancelar.classList.toggle("oculto", !opciones.conCancelar);

        if(opciones.conInput){
            inputEl.value = opciones.valorInicial || "";
        }

        overlay.classList.remove("oculto");

        return new Promise(function(resolve){

            function cerrar(valor){
                overlay.classList.add("oculto");
                btnAceptar.removeEventListener("click", alAceptar);
                btnCancelar.removeEventListener("click", alCancelar);
                inputEl.removeEventListener("keydown", alTecla);
                resolve(valor);
            }

            function alAceptar(){
                cerrar(opciones.conInput ? inputEl.value : true);
            }

            function alCancelar(){
                cerrar(opciones.conInput ? null : false);
            }

            function alTecla(e){
                if(e.key === "Enter"){ alAceptar(); }
                if(e.key === "Escape" && opciones.conCancelar){ alCancelar(); }
            }

            btnAceptar.addEventListener("click", alAceptar);
            btnCancelar.addEventListener("click", alCancelar);
            inputEl.addEventListener("keydown", alTecla);

            if(opciones.conInput){
                setTimeout(function(){ inputEl.focus(); inputEl.select(); }, 50);
            } else {
                setTimeout(function(){ btnAceptar.focus(); }, 50);
            }

        });

    }

    window.mostrarAlerta = function(mensaje){
        return mostrarModalBase({ mensaje: mensaje, conCancelar: false, conInput: false });
    };

    window.mostrarConfirmacion = function(mensaje){
        return mostrarModalBase({ mensaje: mensaje, conCancelar: true, conInput: false });
    };

    window.pedirTexto = function(mensaje, valorInicial){
        return mostrarModalBase({ mensaje: mensaje, conCancelar: true, conInput: true, valorInicial: valorInicial });
    };

})();

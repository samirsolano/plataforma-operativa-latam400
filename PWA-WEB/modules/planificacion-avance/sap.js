const sapArchivoInput = document.getElementById("archivoSAP");
const sapDropzone = document.getElementById("sapDropzone");
const sapBadge = document.getElementById("sapBadge");
const sapBadgeTexto = document.getElementById("sapBadgeTexto");
const sapBtnSubir = document.getElementById("sapBtnSubir");

function sapMostrarArchivo(nombre){

  sapBadgeTexto.textContent = nombre;
  sapBadge.classList.add("sap-badge-ok");
  sapBtnSubir.disabled = false;

}

function sapLimpiarArchivo(){

  sapBadgeTexto.textContent = "Ningún archivo seleccionado";
  sapBadge.classList.remove("sap-badge-ok");
  sapBtnSubir.disabled = true;

}

sapArchivoInput.addEventListener("change", function(){
  if(this.files && this.files[0]){
    sapMostrarArchivo(this.files[0].name);
  } else {
    sapLimpiarArchivo();
  }
});

// ---- Arrastrar y soltar ----
["dragenter", "dragover"].forEach(function(evento){
  sapDropzone.addEventListener(evento, function(e){
    e.preventDefault();
    e.stopPropagation();
    sapDropzone.classList.add("sap-dropzone-activo");
  });
});

["dragleave", "dragend"].forEach(function(evento){
  sapDropzone.addEventListener(evento, function(e){
    e.preventDefault();
    e.stopPropagation();
    sapDropzone.classList.remove("sap-dropzone-activo");
  });
});

sapDropzone.addEventListener("drop", function(e){
  e.preventDefault();
  e.stopPropagation();
  sapDropzone.classList.remove("sap-dropzone-activo");

  const archivos = e.dataTransfer.files;
  if(archivos && archivos[0]){
    sapArchivoInput.files = archivos;
    sapMostrarArchivo(archivos[0].name);
  }

});

// Clic en cualquier parte de la zona (fuera del botón) también abre el explorador
sapDropzone.addEventListener("click", function(){
  sapArchivoInput.click();
});

async function subirArchivoSAP(){

  const archivo = sapArchivoInput.files[0];

  if(!archivo){
    mostrarAlertaModal("Seleccione un archivo", "warning");
    return;
  }

  sapBtnSubir.disabled = true;
  sapBtnSubir.textContent = "Subiendo...";

  try{

    const r = await procesarArchivoSAP(archivo);

    mostrarAlertaModal(
      "Filas: " + r.filas +
      "\nColumnas: " + r.columnas +
      "\nCargados: " + r.cargados,
      "success"
    );

    sapRestaurarBoton();

    const ahora = document.getElementById("sapUltimaActualizacion");
    if(ahora) ahora.textContent = new Date().toLocaleString("es-PE");

  }catch(err){

    mostrarAlertaModal("Error: " + err.message, "error");
    sapRestaurarBoton();

  }

}

function sapRestaurarBoton(){
  sapBtnSubir.disabled = !sapArchivoInput.files[0];
  sapBtnSubir.innerHTML =
    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg> SUBIR ARCHIVO SAP';
}

// ========================================
// PARCHE: Modulación acepta la columna "Entrega" mal etiquetada
// ========================================
// El reporte de SAP de Modulación siempre trae la columna V (índice
// 21) como la Entrega, pero a veces sale exportada repitiendo el
// nombre de la columna T ("Nº documento referencia") en vez de decir
// "Entrega" — el dato en sí es correcto, solo cambia la etiqueta.
// Este archivo se carga después de toma-lote-supermercados.js y
// redefine validarFormatoModulacion para aceptar ambas variantes,
// sin tocar el archivo original.

const ENCABEZADOS_VALIDOS_COL_ENTREGA = [
    "entrega", "nº documento referencia", "n° documento referencia", "no documento referencia"
];

function validarFormatoModulacion(filas){

    if(!filas.length){
        return "El archivo está vacío.";
    }

    const encabezado = filas[0].map(c => String(c).trim().toLowerCase());

    if(
        encabezado[0] !== "estatus" ||
        encabezado[3] !== "wt modulacion" ||
        !ENCABEZADOS_VALIDOS_COL_ENTREGA.includes(encabezado[21])
    ){
        return "Este archivo no tiene el formato esperado de Modulación " +
            "(Estatus en columna A, WT modulacion en D, entrega en V).";
    }

    return null;

}

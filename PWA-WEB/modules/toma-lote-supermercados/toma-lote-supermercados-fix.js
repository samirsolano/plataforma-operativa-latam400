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

// ========================================
// PARCHE: Fecha de Fase (FeCaduc/FePreferCons) llegaba vacía
// ========================================
// En Centro de Proyectos, el pistoleo mostraba "Fecha Vencimiento
// (SAP)" vacía aunque el Lote (SAP) sí salía bien — ambos vienen de
// la misma fila de Fase. Ya se probó (1) aceptar texto/objeto Date
// además del serial numérico, y (2) tolerar espacios distintos
// alrededor de la barra en el encabezado, y sigue saliendo vacía
// incluso volviendo a subir el archivo. Se agrega un log temporal
// para ver el valor y encabezado EXACTOS que llegan al procesar
// Fase, en vez de seguir adivinando la causa.

function excelSerialADate(valor){

    if(valor === "" || valor === null || valor === undefined){
        return null;
    }

    // SheetJS a veces entrega un objeto Date en vez de un serial,
    // según cómo esté tipeada la celda en el Excel de SAP.
    if(valor instanceof Date){
        return isNaN(valor.getTime()) ? null : valor.toISOString().split("T")[0];
    }

    // Caso normal: serial de Excel (días desde 1899-12-30).
    if(!isNaN(Number(valor)) && String(valor).trim() !== ""){
        const epochMs = Date.UTC(1899, 11, 30);
        return new Date(epochMs + Number(valor) * 86400000).toISOString().split("T")[0];
    }

    // Texto con la fecha ya formateada (otro caso visto en exports de
    // SAP): "2029-08-06", "06/08/2029", "06.08.2029".
    const texto = String(valor).trim();

    let m = texto.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if(m){
        return m[1] + "-" + m[2].padStart(2, "0") + "-" + m[3].padStart(2, "0");
    }

    m = texto.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})$/);
    if(m){
        return m[3] + "-" + m[2].padStart(2, "0") + "-" + m[1].padStart(2, "0");
    }

    return null;

}

// Solo se loguea la primera fila que se procesa, para no llenar la
// consola — basta una para ver el problema.
let _debugFaseLogueado = false;

function normalizarFilaFase(filaOriginal, viaje, archivo, cargadoPor){

    if(!_debugFaseLogueado){

        _debugFaseLogueado = true;

        console.log("=== DEBUG FASE: encabezados crudos del Excel ===", Object.keys(filaOriginal));

        Object.keys(filaOriginal).forEach(function(clave){
            if(clave.toLowerCase().indexOf("caduc") !== -1 || clave.toLowerCase().indexOf("prefer") !== -1){
                console.log(
                    "=== DEBUG FASE: columna de fecha ===",
                    "clave=[" + clave + "]",
                    "valor=", filaOriginal[clave],
                    "tipo=", typeof filaOriginal[clave]
                );
            }
        });

    }

    const mapaFila = {};

    Object.keys(filaOriginal).forEach(function(clave){
        // Solo se le quitan los espacios pegados a la barra ("FeCaduc
        // / FePreferCons" -> "fecaduc/fepreferecons"); el resto de
        // encabezados con espacios entre palabras ("orden de
        // almacén") se dejan intactos.
        const normalizada = clave.trim().toLowerCase().replace(/\s*\/\s*/g, "/");
        mapaFila[normalizada] = filaOriginal[clave];
    });

    function valor(clave){
        const v = mapaFila[clave];
        return (v === undefined || v === null) ? "" : v;
    }

    function num(clave){
        const n = Number(valor(clave));
        return isNaN(n) || valor(clave) === "" ? null : n;
    }

    function texto(clave){
        return String(valor(clave)).trim();
    }

    function fecha(clave){
        return excelSerialADate(valor(clave));
    }

    return {
        viaje: viaje,
        tarea_almacen: num("tarea de almacén"),
        orden_almacen: num("orden de almacén"),
        status_tarea: texto("status de tarea de almacén"),
        producto: texto("producto"),
        descripcion_producto: texto("descripción de producto"),
        fecaduc_fepreferecons: fecha("fecaduc/fepreferecons"),
        lote: texto("lote"),
        tipo_stocks: texto("tipo de stocks"),
        ctd_prev_proced_uma: num("ctd.prev.proced.uma"),
        ctd_real_dest_uma: num("ctd.real dest.uma"),
        ctd_dif_dest_uma: num("ctd.dif.dest.en uma"),
        ubic_procedencia: texto("ubic.procedencia"),
        ubicacion_destino: texto("ubicación de destino"),
        un_medida_alternat: texto("un.medida alternat."),
        cl_proceso_almacen: texto("cl.proceso almacén"),
        ubic_dest_original: texto("ubic.dest.original"),
        un_manipulac_origen: texto("un.manipulac.origen"),
        ump_destino: texto("ump destino"),
        confirmado_por: texto("confirmado por"),
        fecha_confirmacion: fecha("fecha confirmación"),
        hora_confirmacion: texto("hora de confirmación"),
        autor: texto("autor"),
        fecha_creacion: fecha("fecha de creación"),
        hora_creacion: texto("hora de creación"),
        grupo_consolidacion: num("grupo consolidación"),
        fase: num("fase"),
        peso_carga: num("peso de carga"),
        unidad_peso: texto("unidad de peso"),
        cola: texto("cola"),
        tipo_proceso_almacen: texto("tipo proceso almacén"),
        denominacion_tipo_proceso: texto("denomin.tipo proceso almacén"),
        denominacion_tipo_stocks: texto("denominación de tipo de stocks"),
        ctd_prev_proced_umb: num("ctd.prev.proced.umb"),
        ctd_real_dest_umb: num("ctd.real dest.umb"),
        ctd_dif_dest_umb: num("ctd.dif.dest.en umb"),
        unidad_medida_base: texto("unidad medida base"),
        archivo_origen: archivo,
        cargado_por: cargadoPor
    };

}

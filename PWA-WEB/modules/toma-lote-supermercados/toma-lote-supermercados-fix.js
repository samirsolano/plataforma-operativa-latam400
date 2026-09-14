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
// PARCHE: Fase — Fecha de vencimiento y Descripción de producto
// llegaban vacías para TODAS las filas
// ========================================
// En la tabla fase de Supabase, fecaduc_fepreferecons salía NULL y
// descripcion_producto salía vacío para todas las filas de un
// archivo, mientras que lote (y las columnas obligatorias) sí se
// guardaban bien. Como es sistemático (no una celda puntual), la
// causa es que normalizarFilaFase() busca esas dos columnas por un
// nombre exacto que no calza con el encabezado real del Excel de SAP
// ("descripción DE producto" en el código vs "Descripción producto"
// en el archivo real, por ejemplo). Se agrega una búsqueda de
// respaldo por palabras clave (sin tildes/mayúsculas) para esas dos
// columnas, que se activa solo si la búsqueda exacta no encuentra
// nada — el resto de columnas sigue igual que en el archivo original.

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

function normalizarFilaFase(filaOriginal, viaje, archivo, cargadoPor){

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

    // Respaldo: si la clave exacta no calza con ningún encabezado,
    // busca cualquier columna cuyo nombre (normalizado) contenga
    // TODAS las palabras dadas — cubre variantes de redacción del
    // mismo campo entre distintos exports de SAP.
    function valorPorPalabras(){

        const palabras = Array.prototype.slice.call(arguments);

        const claveEncontrada = Object.keys(mapaFila).find(function(k){
            return palabras.every(function(p){ return k.indexOf(p) !== -1; });
        });

        return claveEncontrada ? mapaFila[claveEncontrada] : "";

    }

    function num(clave){
        const n = Number(valor(clave));
        return isNaN(n) || valor(clave) === "" ? null : n;
    }

    function texto(clave, palabrasRespaldo){
        let v = valor(clave);
        if(v === "" && palabrasRespaldo){
            v = valorPorPalabras.apply(null, palabrasRespaldo);
        }
        return String(v).trim();
    }

    function fecha(clave, palabrasRespaldo){
        let v = valor(clave);
        if(v === "" && palabrasRespaldo){
            v = valorPorPalabras.apply(null, palabrasRespaldo);
        }
        return excelSerialADate(v);
    }

    return {
        viaje: viaje,
        tarea_almacen: num("tarea de almacén"),
        orden_almacen: num("orden de almacén"),
        status_tarea: texto("status de tarea de almacén"),
        producto: texto("producto"),
        descripcion_producto: texto("descripción de producto", ["descripcion", "producto"]),
        fecaduc_fepreferecons: fecha("fecaduc/fepreferecons", ["caduc"]),
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
        denominacion_tipo_proceso: texto("denomin.tipo proceso almacén", ["proceso", "almac"]),
        denominacion_tipo_stocks: texto("denominación de tipo de stocks", ["stocks"]),
        ctd_prev_proced_umb: num("ctd.prev.proced.umb"),
        ctd_real_dest_umb: num("ctd.real dest.umb"),
        ctd_dif_dest_umb: num("ctd.dif.dest.en umb"),
        unidad_medida_base: texto("unidad medida base"),
        archivo_origen: archivo,
        cargado_por: cargadoPor
    };

}

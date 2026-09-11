// ========================================
// CHECKLIST DE HIGIENE (ALI-R-GC-00-013)
// ========================================
// Usa checklistFetch (shared/checklist-config.js) porque las tablas
// higiene_checklist_cabecera / higiene_checklist_detalle viven en el
// mismo proyecto Supabase que colaboradores_activos
// (iaitqquphjohgsmelhcj) — el mismo en ambos repos, así que ambos
// módulos (escritorio y celular) leen/escriben exactamente los
// mismos datos. Ver sql/higiene_checklist.sql para crear esas tablas.
//
// Archivo duplicado idéntico en los dos repos (mismo patrón que ya
// usan con checklist-config.js / supabase-config.js).

const CRITERIOS_HIGIENE = [
    {
        clave: "uniforme_epp",
        numero: 1,
        titulo: "UNIFORME Y EPPS",
        detalle: "Completo, limpio y en buen estado"
    },
    {
        clave: "manos_unas",
        numero: 2,
        titulo: "MANOS Y UÑAS",
        detalle: "Limpias, sin cortes ni heridas, uñas cortas y sin esmalte."
    },
    {
        clave: "cabello",
        numero: 3,
        titulo: "CABELLO",
        detalle: "Manufactura y Almacenes de Entrada: protegido con toca / Almacenes de Salida: en caso de llevar cabello largo, amarrarlo."
    },
    {
        clave: "rostro",
        numero: 4,
        titulo: "ROSTRO",
        detalle: "Manufactura y Almacenes de Entrada: sin barba y sin maquillaje / Almacenes de Salida: sin maquillaje"
    },
    {
        clave: "objetos_no_autorizados",
        numero: 5,
        titulo: "AUSENCIA DE OBJETOS NO AUTORIZADOS",
        detalle: "Joyas (anillos, aretes, pulseras, gargantillas, medallas, cadenas, etc.), relojes, medicamentos, material de escritorio no autorizado (grapas, clips, tapas de plumones, etc.) y cualquier objeto colgante que pueda caerse o deslizarse."
    },
    {
        clave: "sintomas_enfermedad",
        numero: 6,
        titulo: "AUSENCIA DE SÍNTOMAS DE ENFERMEDAD",
        detalle: "Diarrea, vómitos, dolor de garganta con fiebre, ictericia, lesiones que tengan pus (infectada o quemadura), que esté abierta y drenando."
    }
];

const MARCAS_HIGIENE = [
    { valor: "C", etiqueta: "✓ Conforme" },
    { valor: "NC", etiqueta: "✗ No Conforme" },
    { valor: "NA", etiqueta: "N.A." }
];

// El equipo carga con todo en Conforme por defecto — el supervisor
// solo entra a corregir (y a poner observación) a quien tenga algo
// distinto, en vez de marcar los 6 criterios de cada persona a mano.
function marcasTodoConforme(){

    const marcas = {};

    CRITERIOS_HIGIENE.forEach(function(c){
        marcas[c.clave] = "C";
    });

    return marcas;

}

// ========================================
// SUPERVISOR + EQUIPO
// ========================================
// Lee de "matrix_colaboradores" — el roster general de personal
// (DNI, nombre, grupo Blue/White, puesto, jefe directo) cargado desde
// el Excel "matrix.xlsx" (ver sql/matrix_colaboradores.sql). Tabla
// propia de este módulo, separada de "colaboradores" (que sigue
// alimentando Reconocimiento y Planificación de Recursos) para no
// afectar esos otros módulos.

async function obtenerSupervisoresHigiene(){

    const filas = await checklistFetch(
        "/matrix_colaboradores?select=supervisor"
    );

    const unicos = Array.from(new Set(
        (filas || [])
            .map(function(f){ return String(f.supervisor || "").trim(); })
            .filter(Boolean)
    )).sort();

    return unicos;

}

// Por si "colaboradores" trae más de una fila para el mismo DNI —
// sin esto, esa misma persona aparecería dos veces en el checklist.
function deduplicarPorDni(filas){

    const vistos = new Set();

    return (filas || []).filter(function(f){

        const dni = String(f.dni || "").trim();

        if(!dni || vistos.has(dni)){
            return false;
        }

        vistos.add(dni);
        return true;

    });

}

async function obtenerEquipoPorSupervisor(supervisor){

    const filas = await checklistFetch(
        "/matrix_colaboradores?select=dni,nombre_completo&supervisor=eq." +
        encodeURIComponent(supervisor) +
        "&order=nombre_completo.asc"
    );

    return deduplicarPorDni((filas || []).map(function(c){
        return { dni: c.dni, nombre: c.nombre_completo };
    }));

}

// Busca por DNI o nombre en TODA la tabla maestra (de cualquier
// supervisor) — para el caso de alguien de apoyo que no pertenece al
// equipo del supervisor seleccionado. Como "colaboradores" no guarda
// turno (eso es dato del día, no del maestro), quien se agregue así
// puede marcar su turno a mano si hace falta (ver selectTurnoManual).
async function buscarColaboradorPorTexto(texto){

    const termino = String(texto || "").trim();

    if(termino.length < 2){
        return [];
    }

    const filtro = encodeURIComponent(termino);

    const filas = await checklistFetch(
        "/matrix_colaboradores?select=dni,nombre_completo,supervisor" +
        "&or=(dni.ilike.*" + filtro + "*,nombre_completo.ilike.*" + filtro + "*)" +
        "&order=nombre_completo.asc&limit=8"
    );

    return deduplicarPorDni((filas || []).map(function(c){
        return { dni: c.dni, nombre: c.nombre_completo, supervisor: c.supervisor };
    }));

}

// Busca el nombre del propio colaborador logueado (por DNI), para
// auto-detectar su "nombre de supervisor" tal como aparece en la
// columna supervisor de sus subordinados. Devuelve null si no
// encuentra coincidencia (el módulo debe caer a un <select> manual).
async function detectarNombreSupervisorPorDni(dni){

    if(!dni){
        return null;
    }

    const filas = await checklistFetch(
        "/matrix_colaboradores?select=nombre_completo&dni=eq." +
        encodeURIComponent(dni) +
        "&limit=1"
    );

    return (filas && filas[0] && filas[0].nombre_completo) || null;

}

// ========================================
// GUARDAR / LISTAR
// ========================================

async function guardarChecklistHigiene(cabecera, detalleArray){

    const cabeceraGuardada = await checklistFetch(
        "/higiene_checklist_cabecera",
        {
            method: "POST",
            headers: { Prefer: "return=representation" },
            body: JSON.stringify(cabecera)
        }
    );

    const cabeceraId = cabeceraGuardada && cabeceraGuardada[0] && cabeceraGuardada[0].id;

    if(!cabeceraId){
        throw new Error("No se pudo guardar la cabecera del checklist.");
    }

    if(detalleArray && detalleArray.length){

        const detalleConCabecera = detalleArray.map(function(d){
            return Object.assign({}, d, { cabecera_id: cabeceraId });
        });

        await checklistFetch(
            "/higiene_checklist_detalle",
            {
                method: "POST",
                body: JSON.stringify(detalleConCabecera)
            }
        );

    }

    return cabeceraId;

}

async function listarChecklistsHigiene(filtros){

    filtros = filtros || {};

    let ruta = "/higiene_checklist_cabecera?select=*&order=fecha.desc,created_at.desc";

    if(filtros.fecha){
        ruta += "&fecha=eq." + encodeURIComponent(filtros.fecha);
    }

    if(filtros.supervisor){
        ruta += "&supervisor=eq." + encodeURIComponent(filtros.supervisor);
    }

    return await checklistFetch(ruta);

}

async function obtenerDetalleChecklist(cabeceraId){

    return await checklistFetch(
        "/higiene_checklist_detalle?select=*&cabecera_id=eq." +
        encodeURIComponent(cabeceraId) +
        "&order=nombre.asc"
    );

}

// ========================================
// EXPORTAR EXCEL (réplica de la plantilla oficial)
// ========================================
// Carga shared/assets/plantilla-higiene.xlsx (copia limpia de la hoja
// "v.1" del formato ALI-R-GC-00-013 que compartió el usuario) y
// escribe los valores directamente en el XML interno del archivo
// (xl/worksheets/sheet1.xml, que es donde vive el contenido de un
// .xlsx real — un .xlsx es un .zip) en vez de usar SheetJS para
// leer/escribir el libro completo. Se probó con SheetJS primero, pero
// su edición gratuita (la misma "xlsx" que ya usa esta app en otros
// módulos) no conserva el estilo de las celdas al reescribir el
// archivo — el resultado quedaba con el texto correcto pero sin
// negritas, colores ni bordes del formato oficial. Editando el XML a
// mano solo se toca el <v> (valor) de cada celda puntual, dejando
// intacto su atributo de estilo "s", así que el resto del archivo
// (fuente, colores, bordes, celdas combinadas) queda exactamente
// igual al original. Usa JSZip (no SheetJS) para abrir/cerrar el zip.
//
// Coordenadas mapeadas a mano con Excel (COM) sobre el archivo real:
//
//   C5  = Fecha            D5 = "Área: ..."      K5 = Responsable de verificación
//   F5/G5/H5 = casilleros de turno (1/2/3)
//   Fila 15 = encabezados de tabla
//   Filas 16-28 (13 filas) = personas: B=código, C=nombre (C:D combinada),
//                            E..J = las 6 marcas, K = observaciones
//   J30 = Nombre del Responsable de la Operación (footer)
//
// Si hay más de 13 personas, la plantilla oficial no trae más filas
// con formato — esas se agregan como filas XML nuevas sin estilo,
// debajo del bloque de firma, con su propio encabezado.
function formatearFechaDDMMYYYY(fechaISO){

    if(!fechaISO){
        return "";
    }

    const partes = String(fechaISO).slice(0, 10).split("-");

    if(partes.length !== 3){
        return String(fechaISO);
    }

    return partes[2] + "/" + partes[1] + "/" + partes[0];

}

const SIMBOLO_MARCA_HIGIENE = { C: "✓", NC: "x", NA: "N.A." };

function escaparXML(texto){

    return String(texto === undefined || texto === null ? "" : texto)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");

}

// Reemplaza el <c r="DIRECCION" ...>...</c> (o su forma autocerrada
// <c r="DIRECCION" .../>) por una celda de texto en línea (inlineStr)
// con el mismo valor de "s" (índice de estilo) que ya tenía, para no
// perder su formato. Si la dirección no existe en el XML de la
// plantilla (celda fuera del bloque con formato), no hace nada.
function fijarCeldaXML(xml, direccion, texto){

    const patron = new RegExp('<c r="' + direccion + '"([^>]*?)(?:/>|>[\\s\\S]*?</c>)');
    const coincidencia = xml.match(patron);

    if(!coincidencia){
        return xml;
    }

    const atributos = coincidencia[1].replace(/\s+t="[^"]*"/g, "");
    const valor = String(texto === undefined || texto === null ? "" : texto);

    const nuevaCelda = valor
        ? `<c r="${direccion}"${atributos} t="inlineStr"><is><t xml:space="preserve">${escaparXML(valor)}</t></is></c>`
        : `<c r="${direccion}"${atributos}/>`;

    return xml.slice(0, coincidencia.index) + nuevaCelda + xml.slice(coincidencia.index + coincidencia[0].length);

}

// Celda de texto en línea sin referencia de estilo, para las filas
// nuevas (personas 14 en adelante) que no existen en la plantilla.
function celdaTextoPlanoXML(direccion, texto){

    const valor = escaparXML(texto);

    return valor
        ? `<c r="${direccion}" t="inlineStr"><is><t xml:space="preserve">${valor}</t></is></c>`
        : `<c r="${direccion}"/>`;

}

function agregarFilasContinuacionXML(xml, personas){

    const FILA_ENCABEZADO = 33;
    const FILA_INICIO = 34;

    let filasXML = `<row r="${FILA_ENCABEZADO}">` +
        celdaTextoPlanoXML("B" + FILA_ENCABEZADO, "CÓDIGO") +
        celdaTextoPlanoXML("C" + FILA_ENCABEZADO, "APELLIDOS Y NOMBRES") +
        celdaTextoPlanoXML("E" + FILA_ENCABEZADO, "UNIFORME Y EPPS (1)") +
        celdaTextoPlanoXML("F" + FILA_ENCABEZADO, "MANOS Y UÑAS (2)") +
        celdaTextoPlanoXML("G" + FILA_ENCABEZADO, "CABELLO (3)") +
        celdaTextoPlanoXML("H" + FILA_ENCABEZADO, "ROSTRO (4)") +
        celdaTextoPlanoXML("I" + FILA_ENCABEZADO, "Ausencia obj. no autorizados (5)") +
        celdaTextoPlanoXML("J" + FILA_ENCABEZADO, "Ausencia síntomas (6)") +
        celdaTextoPlanoXML("K" + FILA_ENCABEZADO, "OBSERVACIONES") +
        `</row>`;

    personas.forEach(function(persona, indice){

        const fila = FILA_INICIO + indice;

        filasXML += `<row r="${fila}">` +
            celdaTextoPlanoXML("B" + fila, persona.dni || "") +
            celdaTextoPlanoXML("C" + fila, persona.nombre || "") +
            celdaTextoPlanoXML("E" + fila, SIMBOLO_MARCA_HIGIENE[persona.uniforme_epp] || "") +
            celdaTextoPlanoXML("F" + fila, SIMBOLO_MARCA_HIGIENE[persona.manos_unas] || "") +
            celdaTextoPlanoXML("G" + fila, SIMBOLO_MARCA_HIGIENE[persona.cabello] || "") +
            celdaTextoPlanoXML("H" + fila, SIMBOLO_MARCA_HIGIENE[persona.rostro] || "") +
            celdaTextoPlanoXML("I" + fila, SIMBOLO_MARCA_HIGIENE[persona.objetos_no_autorizados] || "") +
            celdaTextoPlanoXML("J" + fila, SIMBOLO_MARCA_HIGIENE[persona.sintomas_enfermedad] || "") +
            celdaTextoPlanoXML("K" + fila, persona.observaciones || "") +
            `</row>`;

    });

    return xml.replace("</sheetData>", filasXML + "</sheetData>");

}

function descargarBlob(blob, nombreArchivo){

    const url = URL.createObjectURL(blob);
    const enlace = document.createElement("a");

    enlace.href = url;
    enlace.download = nombreArchivo;
    document.body.appendChild(enlace);
    enlace.click();
    document.body.removeChild(enlace);

    setTimeout(function(){ URL.revokeObjectURL(url); }, 1000);

}

async function exportarPlantillaHigieneExcel(cabecera, detalle, rutaPlantilla){

    rutaPlantilla = rutaPlantilla || "../../shared/assets/plantilla-higiene.xlsx";

    const buffer = await fetch(rutaPlantilla).then(function(r){ return r.arrayBuffer(); });
    const zip = await JSZip.loadAsync(buffer);

    const rutaHoja = "xl/worksheets/sheet1.xml";
    let xml = await zip.file(rutaHoja).async("string");

    xml = fijarCeldaXML(xml, "C5", formatearFechaDDMMYYYY(cabecera.fecha));
    xml = fijarCeldaXML(xml, "D5", "Área: " + (cabecera.area || "Almacén"));
    xml = fijarCeldaXML(xml, "K5", cabecera.responsable_verificacion || "");

    const CELDA_TURNO = { DIA: "F5", NOCHE: "G5", INTERMEDIO: "H5" };

    ["F5", "G5", "H5"].forEach(function(direccion, indice){

        const numero = indice + 1;
        const esSeleccionado = CELDA_TURNO[cabecera.turno] === direccion;

        xml = fijarCeldaXML(xml, direccion, esSeleccionado ? (numero + " ✓") : String(numero));

    });

    const FILA_INICIAL = 16;
    const personasEnPlantilla = (detalle || []).slice(0, 13);
    const personasExtra = (detalle || []).slice(13);

    personasEnPlantilla.forEach(function(persona, indice){

        const fila = FILA_INICIAL + indice;

        xml = fijarCeldaXML(xml, "B" + fila, persona.dni || "");
        xml = fijarCeldaXML(xml, "C" + fila, persona.nombre || "");
        xml = fijarCeldaXML(xml, "E" + fila, SIMBOLO_MARCA_HIGIENE[persona.uniforme_epp] || "");
        xml = fijarCeldaXML(xml, "F" + fila, SIMBOLO_MARCA_HIGIENE[persona.manos_unas] || "");
        xml = fijarCeldaXML(xml, "G" + fila, SIMBOLO_MARCA_HIGIENE[persona.cabello] || "");
        xml = fijarCeldaXML(xml, "H" + fila, SIMBOLO_MARCA_HIGIENE[persona.rostro] || "");
        xml = fijarCeldaXML(xml, "I" + fila, SIMBOLO_MARCA_HIGIENE[persona.objetos_no_autorizados] || "");
        xml = fijarCeldaXML(xml, "J" + fila, SIMBOLO_MARCA_HIGIENE[persona.sintomas_enfermedad] || "");
        xml = fijarCeldaXML(xml, "K" + fila, persona.observaciones || "");

    });

    xml = fijarCeldaXML(xml, "J30", cabecera.responsable_operacion_nombre || "");

    if(personasExtra.length){
        xml = agregarFilasContinuacionXML(xml, personasExtra);
    }

    zip.file(rutaHoja, xml);

    const blob = await zip.generateAsync({
        type: "blob",
        mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    });

    const nombreArchivo =
        "higiene-" + (cabecera.fecha || "") + "-" +
        String(cabecera.supervisor || "").trim().replace(/\s+/g, "_") +
        ".xlsx";

    descargarBlob(blob, nombreArchivo);

}

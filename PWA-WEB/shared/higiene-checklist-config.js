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

// De las personas que aparecen como "Jefe Directo" en el roster,
// solo estas 3 son supervisores de turno reales (el resto son roles
// administrativos/gerenciales que no llenan un checklist de higiene
// por turno) — el selector de supervisor (y la auto-detección) se
// restringen a esta lista. Buscar a alguien de OTRO jefe directo
// (ej. el equipo de Eduardo Pasache) sigue funcionando sin
// restricción vía "+ Agregar persona" (buscarColaboradorPorTexto).
const SUPERVISORES_HIGIENE_PERMITIDOS = [
    "ESTEPHANIE PONCE",
    "JONATHAN QUINTANILLA",
    "MELQUIADES PANGALIMA"
];

async function obtenerSupervisoresHigiene(){

    const filas = await checklistFetch(
        "/matrix_colaboradores?select=supervisor"
    );

    const unicos = Array.from(new Set(
        (filas || [])
            .map(function(f){ return String(f.supervisor || "").trim(); })
            .filter(Boolean)
    ));

    return unicos
        .filter(function(s){ return SUPERVISORES_HIGIENE_PERMITIDOS.includes(s); })
        .sort();

}

// Para el filtro de historial (ver checklists ya guardados) — a
// diferencia de obtenerSupervisoresHigiene, aquí NO se restringe a
// los 3 supervisores de turno: el historial es una lista aparte, y
// debe poder filtrarse por cualquier supervisor que haya quedado
// guardado en algún checklist (pasado o presente), sin importar si
// hoy sigue siendo válido para crear uno nuevo.
async function obtenerTodosLosSupervisoresHigiene(){

    const filas = await checklistFetch(
        "/matrix_colaboradores?select=supervisor"
    );

    return Array.from(new Set(
        (filas || [])
            .map(function(f){ return String(f.supervisor || "").trim(); })
            .filter(Boolean)
    )).sort();

}

// Misma técnica que obtenerFechaHoyServidorMHE (shared/mhe-checklist-config.js):
// aprovecha el header "Date" que ya trae cualquier respuesta HTTP de
// Supabase, para que la fecha del checklist no dependa de la hora del
// celular (que se puede adelantar/atrasar a mano).
async function obtenerFechaHoyServidorHigiene(){

    try{

        const respuesta = await fetch(
            SUPABASE_URL_CHECKLIST + "/matrix_colaboradores?select=id&limit=1",
            {
                headers: {
                    apikey: SUPABASE_KEY_CHECKLIST,
                    Authorization: "Bearer " + SUPABASE_KEY_CHECKLIST
                },
                cache: "no-store"
            }
        );

        const fechaServidor = respuesta.headers.get("date");

        if(fechaServidor){

            const instanteServidor = new Date(fechaServidor);
            const offset = new Date().getTimezoneOffset() * 60000;

            return new Date(instanteServidor.getTime() - offset).toISOString().slice(0, 10);

        }

    }catch(error){
        console.error("No se pudo obtener la fecha del servidor, se usa la del dispositivo.", error);
    }

    const ahora = new Date();
    const offset = ahora.getTimezoneOffset() * 60000;
    return new Date(ahora.getTime() - offset).toISOString().slice(0, 10);

}

// Mismo cálculo que calcularTurnoActualMHE (shared/mhe-checklist-config.js)
// y calcularTurnoActual (checklist5s-dinamico/auditoria.js): el turno no
// depende solo de la hora, sino de la combinación día de la semana +
// si es horario "día" (07:00-18:59) o "noche" (19:00-06:59).
function calcularTurnoActualHigiene(){

    const ahora = new Date();
    const dia = ahora.getDay();
    const hora = ahora.getHours();
    const esDia = hora >= 7 && hora < 19;

    if(dia === 0) return esDia ? "" : "INTERMEDIO";     // Domingo
    if(dia === 1) return esDia ? "DIA" : "INTERMEDIO";  // Lunes
    if(dia === 2) return esDia ? "DIA" : "NOCHE";        // Martes
    if(dia === 3) return esDia ? "DIA" : "NOCHE";        // Miércoles
    if(dia === 4) return esDia ? "DIA" : "NOCHE";        // Jueves
    if(dia === 5) return esDia ? "INTERMEDIO" : "NOCHE"; // Viernes
    if(dia === 6) return esDia ? "INTERMEDIO" : "";      // Sábado

    return "";

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

    // select=* (y filtro en el cliente) para no romper si todavía no
    // se corrió base-colaboradores.sql (Plataforma Operativa) — quien
    // está en VACACIONES (módulo Base de Colaboradores) no entra al
    // equipo.
    const filas = await checklistFetch(
        "/matrix_colaboradores?select=*&supervisor=eq." +
        encodeURIComponent(supervisor) +
        "&order=nombre_completo.asc"
    );

    const enTurno = (filas || []).filter(function(c){
        return c.estado !== "VACACIONES";
    });

    return deduplicarPorDni(enTurno.map(function(c){
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
// APROBACIÓN (Responsable de la Operación)
// ========================================
// El "Nombre del Responsable de la Operación" ya no se escribe a mano:
// es la aprobación del checklist, y solo la pueden dar estas personas
// desde su propia sesión. Se guarda en responsable_operacion_nombre
// (vacío = pendiente), que es lo que la plantilla Excel imprime en
// J30. armarCabecera NO manda ese campo, para que corregir un
// checklist ya aprobado no borre la aprobación.
const APROBADORES_HIGIENE = [
    "ALBERT PEREZ",
    "EDUARDO PASACHE",
    "GABRIELA CISNEROS"
];

// "ALBERT PEREZ, EDUARDO PASACHE o GABRIELA CISNEROS" — para los textos
// de "Pendiente".
function textoAprobadoresHigiene(){

    return APROBADORES_HIGIENE.length > 1
        ? APROBADORES_HIGIENE.slice(0, -1).join(", ") + " o " + APROBADORES_HIGIENE[APROBADORES_HIGIENE.length - 1]
        : APROBADORES_HIGIENE.join("");

}

function normalizarNombreHigiene(nombre){

    const descompuesto = String(nombre || "").toUpperCase().normalize("NFD");
    let sinTildes = "";

    for(let i = 0; i < descompuesto.length; i++){

        const codigo = descompuesto.charCodeAt(i);

        if(codigo < 768 || codigo > 879){ // fuera de U+0300–U+036F
            sinTildes += descompuesto[i];
        }

    }

    return sinTildes.replace(/[^A-Z\s]/g, " ").trim().replace(/\s+/g, " ");

}

// Devuelve el aprobador (tal como está en APROBADORES_HIGIENE) si
// todas sus palabras aparecen en el nombre de la sesión — así calza
// "PEREZ VASQUEZ ALBERT" o "Eduardo Felipe Pasache Medina".
function aprobadorHigienePorNombre(nombreSesion){

    const palabrasSesion = normalizarNombreHigiene(nombreSesion).split(" ");

    return APROBADORES_HIGIENE.find(function(aprobador){
        return aprobador.split(" ").every(function(palabra){
            return palabrasSesion.includes(palabra);
        });
    }) || null;

}

async function aprobarChecklistHigiene(cabeceraId, aprobador){

    await checklistFetch(
        "/higiene_checklist_cabecera?id=eq." + encodeURIComponent(cabeceraId),
        {
            method: "PATCH",
            body: JSON.stringify({ responsable_operacion_nombre: aprobador })
        }
    );

}

// ========================================
// GUARDAR / LISTAR
// ========================================

// Solo puede haber un checklist por fecha+turno (sin importar cuál
// supervisor lo creó — ver constraint única en
// sql/higiene_checklist.sql). Si ya existe uno para esa fecha+turno
// se sigue corrigiendo ese mismo (editable durante el turno, con el
// supervisor real que lo creó); al día siguiente la fecha ya es
// distinta, así que no hay coincidencia y se crea uno nuevo.
async function buscarChecklistHigieneExistente(fecha, turno){

    const filas = await checklistFetch(
        "/higiene_checklist_cabecera?select=*&fecha=eq." + encodeURIComponent(fecha) +
        "&turno=eq." + encodeURIComponent(turno) +
        "&limit=1"
    );

    return (filas && filas[0]) || null;

}

// Actualiza un checklist ya existente: la cabecera se actualiza campo
// a campo y el detalle se reemplaza completo (borra + vuelve a
// insertar) — más simple que calcular altas/bajas/cambios persona por
// persona cuando se agregó o quitó gente entre una edición y otra.
async function actualizarChecklistHigiene(cabeceraId, cabecera, detalleArray){

    await checklistFetch(
        "/higiene_checklist_cabecera?id=eq." + encodeURIComponent(cabeceraId),
        {
            method: "PATCH",
            body: JSON.stringify(cabecera)
        }
    );

    await checklistFetch(
        "/higiene_checklist_detalle?cabecera_id=eq." + encodeURIComponent(cabeceraId),
        { method: "DELETE" }
    );

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
//   Filas 16-27 (12 filas) = personas: B=código, C=nombre (C:D combinada),
//                            E..J = las 6 marcas, K = observaciones
//   J30 = Nombre del Responsable de la Operación (footer)
//
// La plantilla trae 12 filas de personas: si hay más, se arma una hoja
// más (copia completa de la plantilla, con su encabezado y firma) por
// cada 12 personas — "v.1", "v.1 (2)", "v.1 (3)"...

const PERSONAS_POR_HOJA_HIGIENE = 12;
const FILA_INICIAL_PERSONAS_HIGIENE = 16;

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

// Centra (horizontal y vertical) todas las celdas de la tabla de
// personas (B..K, filas 16-27). En la plantilla original las marcas
// quedaban pegadas a la izquierda: en vez de tocar el estilo original
// (que comparten otras celdas del formato), se agrega a styles.xml una
// copia centrada de cada estilo usado en la tabla y esas celdas pasan
// a apuntar a la copia.
function centrarTablaHigieneXML(stylesXml, hojaXml){

    const filaFinal = FILA_INICIAL_PERSONAS_HIGIENE + PERSONAS_POR_HOJA_HIGIENE - 1;
    const patronCelda = /<c r="([B-K])(\d+)"([^>]*?) s="(\d+)"/g;

    const estilosUsados = new Set();
    let m;

    while((m = patronCelda.exec(hojaXml))){
        const fila = parseInt(m[2], 10);
        if(fila >= FILA_INICIAL_PERSONAS_HIGIENE && fila <= filaFinal){
            estilosUsados.add(m[4]);
        }
    }

    const bloque = stylesXml.match(/<cellXfs count="(\d+)">([\s\S]*?)<\/cellXfs>/);

    if(!bloque || !estilosUsados.size){
        return { stylesXml: stylesXml, hojaXml: hojaXml };
    }

    const xfs = bloque[2].match(/<xf\b[^>]*?(?:\/>|>[\s\S]*?<\/xf>)/g) || [];
    const nuevos = [];
    const mapa = {};

    estilosUsados.forEach(function(indice){

        const original = xfs[parseInt(indice, 10)];

        if(!original){
            return;
        }

        const alineacion = '<alignment horizontal="center" vertical="center" wrapText="1"/>';
        let copia;

        if(/\/>$/.test(original) && !/<\/xf>$/.test(original)){
            copia = original.replace(/\/>$/, ">" + alineacion + "</xf>");
        }else{
            copia = original
                .replace(/<alignment\b[^>]*?(?:\/>|>[\s\S]*?<\/alignment>)/, "")
                .replace(/^(<xf\b[^>]*>)/, "$1" + alineacion);
        }

        copia = copia.replace(/\sapplyAlignment="[^"]*"/, "").replace(/^<xf\b/, '<xf applyAlignment="1"');

        mapa[indice] = String(xfs.length + nuevos.length);
        nuevos.push(copia);

    });

    const nuevoBloque = `<cellXfs count="${xfs.length + nuevos.length}">${bloque[2]}${nuevos.join("")}</cellXfs>`;

    const nuevaHoja = hojaXml.replace(patronCelda, function(todo, col, fila, resto, indice){
        const numero = parseInt(fila, 10);
        const dentro = numero >= FILA_INICIAL_PERSONAS_HIGIENE && numero <= filaFinal;
        return (dentro && mapa[indice])
            ? `<c r="${col}${fila}"${resto} s="${mapa[indice]}"`
            : todo;
    });

    return {
        stylesXml: stylesXml.replace(bloque[0], nuevoBloque),
        hojaXml: nuevaHoja
    };

}

// Llena una hoja (copia de la plantilla) con la cabecera y hasta 12
// personas.
function llenarHojaHigieneXML(xml, cabecera, personas){

    xml = fijarCeldaXML(xml, "C5", formatearFechaDDMMYYYY(cabecera.fecha));
    xml = fijarCeldaXML(xml, "D5", "Área: " + (cabecera.area || "Almacén"));
    xml = fijarCeldaXML(xml, "K5", cabecera.responsable_verificacion || "");

    const CELDA_TURNO = { DIA: "F5", NOCHE: "G5", INTERMEDIO: "H5" };

    ["F5", "G5", "H5"].forEach(function(direccion, indice){

        const numero = indice + 1;
        const esSeleccionado = CELDA_TURNO[cabecera.turno] === direccion;

        xml = fijarCeldaXML(xml, direccion, esSeleccionado ? (numero + " ✓") : String(numero));

    });

    personas.forEach(function(persona, indice){

        const fila = FILA_INICIAL_PERSONAS_HIGIENE + indice;

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

    return xml;

}

// Agrega al libro la hoja número `numero` (2, 3, ...) como copia de la
// hoja 1: su propio XML, sus relaciones (dibujo y configuración de
// impresión copiados aparte, para que cada hoja tenga los suyos), su
// entrada en el libro y su área de impresión.
async function agregarHojaCopiaHigiene(zip, numero, hojaXml, partes){

    const nombreHoja = "v.1 (" + numero + ")";
    const rId = "rIdHigiene" + numero;

    zip.file(`xl/worksheets/sheet${numero}.xml`, hojaXml);

    zip.file(
        `xl/worksheets/_rels/sheet${numero}.xml.rels`,
        partes.relsHoja
            .replace("drawings/drawing1.xml", `drawings/drawing${numero}.xml`)
            .replace("printerSettings/printerSettings1.bin", `printerSettings/printerSettings${numero}.bin`)
    );

    if(partes.dibujo !== null){
        zip.file(`xl/drawings/drawing${numero}.xml`, partes.dibujo);
    }

    if(partes.impresion !== null){
        zip.file(`xl/printerSettings/printerSettings${numero}.bin`, partes.impresion);
    }

    partes.tipos = partes.tipos.replace(
        "</Types>",
        `<Override PartName="/xl/worksheets/sheet${numero}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>` +
        (partes.dibujo !== null
            ? `<Override PartName="/xl/drawings/drawing${numero}.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/>`
            : "") +
        "</Types>"
    );

    partes.relsLibro = partes.relsLibro.replace(
        "</Relationships>",
        `<Relationship Id="${rId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${numero}.xml"/></Relationships>`
    );

    partes.libro = partes.libro
        .replace("</sheets>", `<sheet name="${nombreHoja}" sheetId="${100 + numero}" r:id="${rId}"/></sheets>`);

    // Misma área de impresión que la hoja 1 (mismo nombre de definedName
    // que trae la plantilla, solo que para esta hoja).
    const areaImpresion = partes.libro.match(/<definedName name="([^"]+)" localSheetId="0">[^<]*!(\$[^<]+)<\/definedName>/);

    if(areaImpresion){
        partes.libro = partes.libro.replace(
            "</definedNames>",
            `<definedName name="${areaImpresion[1]}" localSheetId="${numero - 1}">'${nombreHoja}'!${areaImpresion[2]}</definedName></definedNames>`
        );
    }

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

// Arma el .xlsx en memoria y devuelve el Blob (sin descargarlo).
async function generarPlantillaHigieneExcel(cabecera, detalle, rutaPlantilla){

    rutaPlantilla = rutaPlantilla || "../../shared/assets/plantilla-higiene.xlsx";

    const buffer = await fetch(rutaPlantilla).then(function(r){ return r.arrayBuffer(); });
    const zip = await JSZip.loadAsync(buffer);

    const leer = async function(ruta, tipo){
        const archivo = zip.file(ruta);
        return archivo ? await archivo.async(tipo || "string") : null;
    };

    const centrado = centrarTablaHigieneXML(
        await leer("xl/styles.xml"),
        await leer("xl/worksheets/sheet1.xml")
    );

    zip.file("xl/styles.xml", centrado.stylesXml);

    const plantillaHoja = centrado.hojaXml;
    const personas = detalle || [];

    const grupos = [];

    for(let i = 0; i < personas.length; i += PERSONAS_POR_HOJA_HIGIENE){
        grupos.push(personas.slice(i, i + PERSONAS_POR_HOJA_HIGIENE));
    }

    if(!grupos.length){
        grupos.push([]);
    }

    zip.file("xl/worksheets/sheet1.xml", llenarHojaHigieneXML(plantillaHoja, cabecera, grupos[0]));

    if(grupos.length > 1){

        const partes = {
            relsHoja: await leer("xl/worksheets/_rels/sheet1.xml.rels") || "",
            dibujo: await leer("xl/drawings/drawing1.xml"),
            impresion: await leer("xl/printerSettings/printerSettings1.bin", "uint8array"),
            tipos: await leer("[Content_Types].xml"),
            relsLibro: await leer("xl/_rels/workbook.xml.rels"),
            libro: await leer("xl/workbook.xml")
        };

        // En las copias: sin "pestaña seleccionada" (solo la primera)
        // ni el identificador interno de la hoja original.
        const plantillaCopia = plantillaHoja
            .replace(/\stabSelected="1"/, "")
            .replace(/\sxr:uid="\{[^}]*\}"/, "");

        for(let i = 1; i < grupos.length; i++){
            await agregarHojaCopiaHigiene(
                zip,
                i + 1,
                llenarHojaHigieneXML(plantillaCopia, cabecera, grupos[i]),
                partes
            );
        }

        zip.file("[Content_Types].xml", partes.tipos);
        zip.file("xl/_rels/workbook.xml.rels", partes.relsLibro);
        zip.file("xl/workbook.xml", partes.libro);

    }

    return await zip.generateAsync({
        type: "blob",
        compression: "DEFLATE",
        mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    });

}

async function exportarPlantillaHigieneExcel(cabecera, detalle, rutaPlantilla){

    const blob = await generarPlantillaHigieneExcel(cabecera, detalle, rutaPlantilla);

    const nombreArchivo =
        "higiene-" + (cabecera.fecha || "") + "-" +
        String(cabecera.supervisor || "").trim().replace(/\s+/g, "_") +
        ".xlsx";

    descargarBlob(blob, nombreArchivo);

}

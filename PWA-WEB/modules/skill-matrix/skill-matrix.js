// ========================================
// TOASTS
// ========================================

function mostrarToast(mensaje, tipo){

    tipo = tipo || "error";

    const contenedor = document.getElementById("toastContainer");

    const toast = document.createElement("div");
    toast.className = "toast toast-" + tipo;
    toast.textContent = mensaje;

    contenedor.appendChild(toast);

    requestAnimationFrame(function(){
        toast.classList.add("toast-visible");
    });

    setTimeout(function(){
        toast.classList.remove("toast-visible");
        setTimeout(function(){ toast.remove(); }, 250);
    }, 4500);

}

// ========================================
// SESIÓN Y PERMISOS — solo Administrador (por ahora)
// ========================================

const sesion = requerirSesion();

if(sesion && sesion.rol !== "Administrador"){
    window.location.href = "../inicio/home.html";
}

if(sesion){
    document.getElementById("nombreUsuario").textContent = sesion.nombre_completo;
    document.getElementById("rolUsuario").textContent = sesion.rol;
}

const btnPerfil = document.getElementById("btnPerfil");
const menuUsuario = document.getElementById("menuUsuario");

btnPerfil.addEventListener("click", function(e){
    e.stopPropagation();
    menuUsuario.style.display = menuUsuario.style.display === "block" ? "none" : "block";
});

document.addEventListener("click", function(){
    menuUsuario.style.display = "none";
});

document.getElementById("btnCerrarSesion").addEventListener("click", function(e){
    e.preventDefault();
    e.stopPropagation();
    cerrarSesion();
});

// ========================================
// ESTADO
// ========================================

let habilidades = [];               // [{codigo, categoria, nombre, orden}]
let colaboradores = [];             // [{dni, nombre_completo, turno, cargo, activo}]
let nivelesPorClave = {};           // "dni||codigo" -> nivel
let categoriasOrdenadas = [];       // orden de aparición de categorías

function claveNivel(dni, codigo){
    return dni + "||" + codigo;
}

function categoriaClase(categoria){
    return "cat-" + String(categoria)
        .toUpperCase()
        .normalize("NFD").replace(/[̀-ͯ]/g, "")
        .replace(/[^A-Z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
}

// ========================================
// CARGA
// ========================================

const mensajeCarga = document.getElementById("mensajeCarga");
const contenedorTabla = document.getElementById("contenedorTabla");

async function cargarMatriz(){

    mensajeCarga.style.display = "block";
    mensajeCarga.textContent = "Cargando matriz...";
    contenedorTabla.style.display = "none";

    try{

        const [habilidadesData, colaboradoresData, nivelesData] = await Promise.all([
            obtenerHabilidadesSkillMatrix(),
            obtenerColaboradoresSkillMatrix(),
            obtenerNivelesSkillMatrix()
        ]);

        habilidades = habilidadesData || [];
        colaboradores = (colaboradoresData || []).filter(c => c.activo !== false);

        categoriasOrdenadas = Array.from(new Set(habilidades.map(h => h.categoria)));

        nivelesPorClave = {};
        (nivelesData || []).forEach(function(n){
            nivelesPorClave[claveNivel(n.dni, n.codigo_habilidad)] = n.nivel;
        });

        if(!habilidades.length || !colaboradores.length){
            mensajeCarga.textContent = "Todavía no hay datos cargados. Usa \"Importar Excel\" para cargar la matriz.";
            return;
        }

        poblarFiltros();
        renderizarTabla();

        mensajeCarga.style.display = "none";
        contenedorTabla.style.display = "block";

    }catch(e){

        console.error(e);
        mensajeCarga.textContent = "No se pudo cargar la matriz. Revisa la conexión con Supabase.";

    }

}

function poblarFiltros(){

    const filtroCategoria = document.getElementById("filtroCategoria");
    const filtroTurno = document.getElementById("filtroTurno");

    const catActual = filtroCategoria.value;
    const turnoActual = filtroTurno.value;

    filtroCategoria.innerHTML = '<option value="">Categoría (todas)</option>' +
        categoriasOrdenadas.map(c => `<option value="${c}">${c}</option>`).join("");

    const turnos = Array.from(new Set(colaboradores.map(c => c.turno).filter(Boolean))).sort();

    filtroTurno.innerHTML = '<option value="">Turno (todos)</option>' +
        turnos.map(t => `<option value="${t}">${t}</option>`).join("");

    filtroCategoria.value = catActual;
    filtroTurno.value = turnoActual;

}

// ========================================
// RENDER
// ========================================

function habilidadesFiltradas(){

    const categoria = document.getElementById("filtroCategoria").value;

    if(!categoria){
        return habilidades;
    }

    return habilidades.filter(h => h.categoria === categoria);

}

function colaboradoresFiltrados(){

    const termino = document.getElementById("buscador").value.trim().toLowerCase();
    const turno = document.getElementById("filtroTurno").value;

    return colaboradores.filter(function(c){

        const coincideTexto = !termino ||
            c.dni.toLowerCase().includes(termino) ||
            c.nombre_completo.toLowerCase().includes(termino);

        const coincideTurno = !turno || c.turno === turno;

        return coincideTexto && coincideTurno;

    });

}

function porcentajeEntrenado(dni, listaHabilidades){

    let aplica = 0;
    let entrenado = 0;

    listaHabilidades.forEach(function(h){

        const nivel = nivelesPorClave[claveNivel(dni, h.codigo)] || 0;

        if(nivel === 4){
            return; // no aplica: no cuenta ni en el numerador ni en el denominador
        }

        aplica++;

        if(nivel === 2 || nivel === 3){
            entrenado++;
        }

    });

    if(!aplica){
        return null;
    }

    return Math.round((entrenado / aplica) * 100);

}

function renderizarTabla(){

    const habs = habilidadesFiltradas();
    const cols = colaboradoresFiltrados();

    // ---- HEAD ----

    const thead = document.getElementById("theadMatriz");

    // Fila 1: categorías (agrupadas por bloques consecutivos)
    let filaCategoria = "<tr class=\"fila-categoria\">";

    filaCategoria += `
        <th class="col-fija col-fija-nombre" rowspan="3">Nombre</th>
        <th class="col-fija col-fija-dni" rowspan="3">DNI</th>
        <th class="col-fija col-fija-turno" rowspan="3">Turno</th>
        <th class="col-fija col-fija-cargo" rowspan="3">Cargo</th>
        <th class="col-fija col-fija-pct" rowspan="3">% Entren.</th>
    `;

    let i = 0;

    while(i < habs.length){

        const categoria = habs[i].categoria;
        let span = 0;

        while(i + span < habs.length && habs[i + span].categoria === categoria){
            span++;
        }

        filaCategoria += `<th colspan="${span}" class="${categoriaClase(categoria)}">${categoria}</th>`;

        i += span;

    }

    filaCategoria += "</tr>";

    // Fila 2: nombre de cada habilidad
    let filaHabilidad = "<tr class=\"fila-habilidad\">";

    habs.forEach(function(h){
        filaHabilidad += `<th title="${escaparHtml(h.nombre)} (${h.codigo})"><span class="nombre-habilidad">${escaparHtml(h.nombre)}</span></th>`;
    });

    filaHabilidad += "</tr>";

    // Fila 3: código (LAT-XXX / GEN-XX), igual que la fila 8 del Excel original
    let filaCodigo = "<tr class=\"fila-codigo\">";

    habs.forEach(function(h){
        filaCodigo += `<th title="${escaparHtml(h.nombre)}">${escaparHtml(h.codigo)}</th>`;
    });

    filaCodigo += "</tr>";

    thead.innerHTML = filaCategoria + filaHabilidad + filaCodigo;

    // ---- BODY ----

    const tbody = document.getElementById("tbodyMatriz");

    if(!cols.length){
        tbody.innerHTML = `<tr><td colspan="${5 + habs.length}" class="sin-datos">Ningún colaborador coincide con el filtro.</td></tr>`;
        return;
    }

    let html = "";

    cols.forEach(function(c){

        const pct = porcentajeEntrenado(c.dni, habs);

        html += `<tr class="fila-colaborador">
            <td class="col-fija col-fija-nombre">${escaparHtml(c.nombre_completo)}</td>
            <td class="col-fija col-fija-dni dni-col">${escaparHtml(c.dni)}</td>
            <td class="col-fija col-fija-turno">${escaparHtml(c.turno || "-")}</td>
            <td class="col-fija col-fija-cargo">${escaparHtml(c.cargo || "-")}</td>
            <td class="col-fija col-fija-pct pct-col">${pct === null ? "-" : pct + "%"}</td>
        `;

        habs.forEach(function(h){

            const nivel = nivelesPorClave[claveNivel(c.dni, h.codigo)] || 0;

            html += `<td class="celda-nivel ${claseNivelSkillMatrix(nivel)}"
                data-dni="${escaparHtml(c.dni)}"
                data-codigo="${escaparHtml(h.codigo)}"
                title="${escaparHtml(c.nombre_completo)} — ${escaparHtml(h.nombre)}: ${etiquetaNivelSkillMatrix(nivel)}"
            ></td>`;

        });

        html += "</tr>";

    });

    tbody.innerHTML = html;

}

function escaparHtml(texto){
    const div = document.createElement("div");
    div.textContent = texto === null || texto === undefined ? "" : String(texto);
    return div.innerHTML;
}

// ========================================
// EDITAR UN NIVEL (popover)
// ========================================

const popoverNivel = document.getElementById("popoverNivel");
const popoverFondo = document.getElementById("popoverFondo");
const popoverTitulo = document.getElementById("popoverTitulo");
const popoverOpciones = document.getElementById("popoverOpciones");

let celdaEnEdicion = null;

document.getElementById("tbodyMatriz").addEventListener("click", function(e){

    const celda = e.target.closest(".celda-nivel");

    if(!celda){
        return;
    }

    abrirPopoverNivel(celda);

});

function abrirPopoverNivel(celda){

    celdaEnEdicion = celda;

    const dni = celda.dataset.dni;
    const codigo = celda.dataset.codigo;

    const colaborador = colaboradores.find(c => c.dni === dni);
    const habilidad = habilidades.find(h => h.codigo === codigo);
    const nivelActual = nivelesPorClave[claveNivel(dni, codigo)] || 0;

    popoverTitulo.textContent = (colaborador ? colaborador.nombre_completo : dni) +
        " — " + (habilidad ? habilidad.nombre : codigo);

    popoverOpciones.innerHTML = NIVELES_SKILL_MATRIX.map(function(n){
        return `<button type="button" class="opcion-nivel ${n.valor === nivelActual ? "seleccionada" : ""}" data-valor="${n.valor}">
            <i class="chip ${n.clase}"></i> ${n.etiqueta}
        </button>`;
    }).join("");

    const rect = celda.getBoundingClientRect();

    popoverNivel.style.top = Math.min(rect.bottom + 6, window.innerHeight - 260) + "px";
    popoverNivel.style.left = Math.min(rect.left, window.innerWidth - 260) + "px";

    popoverNivel.classList.remove("oculto");
    popoverFondo.classList.remove("oculto");

}

function cerrarPopoverNivel(){
    popoverNivel.classList.add("oculto");
    popoverFondo.classList.add("oculto");
    celdaEnEdicion = null;
}

popoverFondo.addEventListener("click", cerrarPopoverNivel);

popoverOpciones.addEventListener("click", async function(e){

    const boton = e.target.closest(".opcion-nivel");

    if(!boton || !celdaEnEdicion){
        return;
    }

    const nuevoNivel = parseInt(boton.dataset.valor, 10);
    const dni = celdaEnEdicion.dataset.dni;
    const codigo = celdaEnEdicion.dataset.codigo;

    boton.disabled = true;

    try{

        await guardarNivelSkillMatrix(dni, codigo, nuevoNivel, sesion ? sesion.nombre_completo : "");

        nivelesPorClave[claveNivel(dni, codigo)] = nuevoNivel;

        celdaEnEdicion.className = "celda-nivel " + claseNivelSkillMatrix(nuevoNivel);

        const colaborador = colaboradores.find(c => c.dni === dni);
        const habilidad = habilidades.find(h => h.codigo === codigo);

        celdaEnEdicion.title = (colaborador ? colaborador.nombre_completo : dni) + " — " +
            (habilidad ? habilidad.nombre : codigo) + ": " + etiquetaNivelSkillMatrix(nuevoNivel);

        // Refresca la columna "% Entren." de esa fila sin re-renderizar todo.
        const fila = celdaEnEdicion.closest("tr");
        const celdaPct = fila.querySelector(".col-fija-pct");

        if(celdaPct){
            const pct = porcentajeEntrenado(dni, habilidadesFiltradas());
            celdaPct.textContent = pct === null ? "-" : pct + "%";
        }

        mostrarToast("Nivel actualizado.", "exito");
        cerrarPopoverNivel();

    }catch(err){

        console.error(err);
        mostrarToast("No se pudo guardar el nivel.", "error");
        boton.disabled = false;

    }

});

// ========================================
// FILTROS
// ========================================

document.getElementById("buscador").addEventListener("input", renderizarTabla);
document.getElementById("filtroCategoria").addEventListener("change", renderizarTabla);
document.getElementById("filtroTurno").addEventListener("change", renderizarTabla);
document.getElementById("btnRecargar").addEventListener("click", cargarMatriz);

// ========================================
// IMPORTAR EXCEL
// ========================================
// El Excel de Skill Matrix no tiene una única fila de headers: la
// categoría vive en la fila 6 (por rango de columnas), el nombre de
// la habilidad en la fila 7, el código LAT-XXX (si existe) en la
// fila 8, y los datos empiezan en la fila 9 hasta que la columna DNI
// queda vacía. Por eso se lee como array-of-arrays en vez de con
// XLSX.utils.sheet_to_json (que asume una sola fila de headers).

const archivoExcel = document.getElementById("archivoExcel");
const btnImportar = document.getElementById("btnImportar");

btnImportar.addEventListener("click", function(){
    archivoExcel.click();
});

archivoExcel.addEventListener("change", async function(){

    const archivo = archivoExcel.files[0];

    if(!archivo){
        return;
    }

    btnImportar.disabled = true;
    btnImportar.textContent = "Leyendo archivo...";

    try{

        const buffer = await archivo.arrayBuffer();
        const libro = XLSX.read(buffer, { type: "array" });

        const nombreHoja =
            libro.SheetNames.find(n => n.trim().toLowerCase() === "skill matrix") ||
            libro.SheetNames[0];

        const hoja = libro.Sheets[nombreHoja];
        const filas = XLSX.utils.sheet_to_json(hoja, { header: 1, defval: "" });

        const resultado = parsearMatrizExcel(filas);

        if(!resultado.habilidades.length || !resultado.colaboradores.length){
            mostrarToast("No se encontró el formato esperado (filas 6-8 de cabecera + datos desde la fila 9).", "error");
            return;
        }

        const confirmado = confirm(
            "Se van a cargar " + resultado.colaboradores.length + " colaboradores y " +
            resultado.habilidades.length + " habilidades (" + resultado.niveles.length + " niveles). " +
            "Los que ya existan se actualizan (no se duplican). ¿Continuar?"
        );

        if(!confirmado){
            return;
        }

        btnImportar.textContent = "Guardando habilidades...";

        await subirEnBloques(
            "/skill_matrix_habilidades",
            resultado.habilidades,
            "resolution=merge-duplicates"
        );

        btnImportar.textContent = "Guardando colaboradores...";

        await subirEnBloques(
            "/skill_matrix_colaboradores",
            resultado.colaboradores,
            "resolution=merge-duplicates"
        );

        btnImportar.textContent = "Guardando niveles...";

        await subirEnBloques(
            "/skill_matrix_niveles?on_conflict=dni,codigo_habilidad",
            resultado.niveles,
            "resolution=merge-duplicates"
        );

        mostrarToast("Matriz importada correctamente.", "exito");
        archivoExcel.value = "";

        await cargarMatriz();

    }catch(e){

        console.error(e);
        mostrarToast("No se pudo importar el archivo. Revisa que sea un Skill Matrix con el mismo formato.", "error");

    }finally{

        btnImportar.disabled = false;
        btnImportar.textContent = "⬆️ Importar Excel";

    }

});

function celda(filas, fila, colIndice){
    const f = filas[fila];
    if(!f){ return ""; }
    const v = f[colIndice];
    return v === undefined || v === null ? "" : String(v).trim();
}

function parsearMatrizExcel(filas){

    // Recorre las columnas de habilidades desde la columna F (índice 5)
    // hacia la derecha. La fila 8 trae el código LAT-XXX para las
    // habilidades "con código"; las 10 primeras (inducción general) no
    // tienen código, igual que las columnas RESUMEN que vienen después
    // de INVENTARIO (Necesidad de entrenamiento, Multiplicador, etc. —
    // esas son fórmulas del Excel, no habilidades, y no se importan).
    // Por eso no alcanza con "tiene texto en la fila 7": una vez que ya
    // vimos al menos un código LAT-XXX, la primera columna siguiente
    // que vuelve a no tener código marca el inicio del bloque resumen
    // y ahí se corta.
    const FILA_CATEGORIA = 5;   // fila 6 (0-index)
    const FILA_NOMBRE = 6;      // fila 7
    const FILA_CODIGO = 7;      // fila 8
    const FILA_DATOS_DESDE = 8; // fila 9
    const COL_INICIO = 5;       // columna F

    const habilidades = [];
    const colIndiceHabilidad = [];
    let categoriaActual = "GENERAL";
    let genCounter = 0;
    let orden = 0;
    let vioCodigo = false;

    const totalColumnas = (filas[FILA_NOMBRE] || []).length;

    for(let c = COL_INICIO; c < totalColumnas; c++){

        const nombre = celda(filas, FILA_NOMBRE, c);

        if(!nombre){
            // Columna vacía en medio del bloque de habilidades: se
            // ignora (puede ser una separación visual), pero si ya
            // hay habilidades cargadas y esto se repite, fin del rango.
            if(vioCodigo && !habilidades.length){
                continue;
            }
            if(habilidades.length){
                break;
            }
            continue;
        }

        const codigoCelda = celda(filas, FILA_CODIGO, c);
        const esCodigoLat = /^LAT-\d+$/.test(codigoCelda);

        if(!esCodigoLat && vioCodigo){
            // Ya pasamos el bloque de habilidades con código y esta
            // columna no tiene uno: es el bloque resumen (CH:CO). Corta.
            break;
        }

        if(esCodigoLat){
            vioCodigo = true;
        }

        const catCelda = celda(filas, FILA_CATEGORIA, c);

        if(catCelda){
            categoriaActual = catCelda.toUpperCase();
        }

        let codigo = codigoCelda;

        if(!esCodigoLat){
            genCounter++;
            codigo = "GEN-" + String(genCounter).padStart(2, "0");
        }

        orden++;

        habilidades.push({
            codigo: codigo,
            categoria: categoriaActual,
            nombre: nombre.replace(/\s+/g, " ").trim(),
            orden: orden
        });

        colIndiceHabilidad.push(c);

    }

    const colaboradores = [];
    const niveles = [];

    for(let f = FILA_DATOS_DESDE; f < filas.length; f++){

        const primeraCelda = celda(filas, f, 0);

        // Sentinela real del archivo: la fila "TOTAL DE COLABORADORES"
        // marca el fin de la lista de personas.
        if(primeraCelda && /total de colaboradores/i.test(primeraCelda)){
            break;
        }

        const dniCrudo = celda(filas, f, 1);
        const nombreCrudo = celda(filas, f, 2);

        if(!dniCrudo || !nombreCrudo){
            continue; // fila vacía suelta: se ignora, no corta el import
        }

        // Algunos DNI antiguos tienen 7 dígitos — se rellenan con un
        // cero a la izquierda, mismo criterio que ya usa Carga Mensual
        // (ver modules/carga-mensual/carga-mensual.js, normalizarFilaExcel).
        const dniLimpio = dniCrudo.replace(/\D/g, "");

        if(!dniLimpio || dniLimpio.length > 8){
            continue;
        }

        const dni = dniLimpio.padStart(8, "0");

        colaboradores.push({
            dni: dni,
            nombre_completo: nombreCrudo.replace(/\s+/g, " ").trim(),
            turno: celda(filas, f, 3),
            cargo: celda(filas, f, 4)
        });

        habilidades.forEach(function(h, idx){

            const v = celda(filas, f, colIndiceHabilidad[idx]);
            const nivel = parseInt(v, 10);

            niveles.push({
                dni: dni,
                codigo_habilidad: h.codigo,
                nivel: (Number.isInteger(nivel) && nivel >= 0 && nivel <= 4) ? nivel : 0,
                actualizado_por: sesion ? sesion.nombre_completo : ""
            });

        });

    }

    return { habilidades: habilidades, colaboradores: colaboradores, niveles: niveles };

}

// ========================================
// EXPORTAR EXCEL
// ========================================

document.getElementById("btnExportar").addEventListener("click", function(){

    if(!habilidades.length || !colaboradores.length){
        mostrarToast("No hay datos cargados para exportar.", "error");
        return;
    }

    const filas = [];

    filas.push(["", "", "", "", ""].concat(habilidades.map(h => h.categoria)));
    filas.push(["Nº", "DNI", "Nombre", "Turno", "Cargo"].concat(habilidades.map(h => h.nombre)));
    filas.push(["", "", "", "", ""].concat(habilidades.map(h => h.codigo)));

    colaboradores.forEach(function(c, idx){

        const fila = [idx + 1, c.dni, c.nombre_completo, c.turno || "", c.cargo || ""];

        habilidades.forEach(function(h){
            fila.push(nivelesPorClave[claveNivel(c.dni, h.codigo)] || 0);
        });

        filas.push(fila);

    });

    const hoja = XLSX.utils.aoa_to_sheet(filas);
    const libro = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(libro, hoja, "Skill Matrix");

    const fecha = new Date().toISOString().slice(0, 10);

    XLSX.writeFile(libro, "skill-matrix-" + fecha + ".xlsx");

});

// ========================================
// INICIO
// ========================================

if(sesion && sesion.rol === "Administrador"){
    cargarMatriz();
}

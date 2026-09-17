// ========================================
// FETCH PAGINADO
// ========================================

async function supabaseFetchTodo(ruta){

    const TAMANO_PAGINA = 1000;
    let desde = 0;
    let todas = [];

    while(true){

        const pagina = await supabaseFetch(ruta, {
            headers: { "Range": desde + "-" + (desde + TAMANO_PAGINA - 1) }
        });

        if(!pagina || !pagina.length){
            break;
        }

        todas = todas.concat(pagina);

        if(pagina.length < TAMANO_PAGINA){
            break;
        }

        desde += TAMANO_PAGINA;

    }

    return todas;

}

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
// SESIÓN
// ========================================

const sesion = requerirSesion();

if(sesion){

    if(sesion.rol !== "Administrador"){
        window.location.href = "../inicio/home.html";
    }

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
// TABS
// ========================================

document.querySelectorAll(".tab-link").forEach(function(link){

    link.addEventListener("click", function(e){

        e.preventDefault();

        document.querySelectorAll(".tab-link").forEach(l => l.classList.remove("activo"));
        document.querySelectorAll(".tab-contenido").forEach(c => c.classList.add("oculto"));

        link.classList.add("activo");
        document.getElementById(link.dataset.tab).classList.remove("oculto");

        if(link.dataset.tab === "tabMara" && !_maraPickingCargadaAlMenosUnaVez){
            cargarMaraPicking();
        }

        if(link.dataset.tab === "tabDiscrepancias" || link.dataset.tab === "tabReconteo"){
            cargarDiscrepancias();
        }

        if(link.dataset.tab === "tabReconteo"){
            cargarEstadoReconteo();
        }

        if(link.dataset.tab === "tabRech"){
            cargarRech();
        }

        if(link.dataset.tab === "tabReporte"){
            cargarReporte();
        }

    });

});

// ========================================
// SEMANA ISO + UBICACIONES (mismas reglas que Centro de Proyectos)
// ========================================

function semanaActual(fecha){

    fecha = fecha || new Date();

    const d = new Date(Date.UTC(fecha.getFullYear(), fecha.getMonth(), fecha.getDate()));
    const diaNum = (d.getUTCDay() + 6) % 7;
    d.setUTCDate(d.getUTCDate() - diaNum + 3);

    const primerJueves = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
    const numSemana = 1 + Math.round(
        ((d - primerJueves) / 86400000 - 3 + ((primerJueves.getUTCDay() + 6) % 7)) / 7
    );

    return d.getUTCFullYear() + "-W" + String(numSemana).padStart(2, "0");

}

const SEMANA = semanaActual();

document.getElementById("semanaTextoAsignacion").textContent = SEMANA.split("-W")[1];
document.getElementById("semanaTextoDiscrepancias").textContent = SEMANA.split("-W")[1];
document.getElementById("semanaTextoReconteo").textContent = SEMANA.split("-W")[1];
document.getElementById("semanaTextoRech").textContent = SEMANA.split("-W")[1];
document.getElementById("semanaTextoReporte").textContent = SEMANA.split("-W")[1];


// ========================================
// TAB 1: ASIGNACIÓN DE PASILLOS
// ========================================

// Roster de personal (DNI + nombre) que ya usan Checklist 5S y el
// Checklist de Higiene — vive en el proyecto Supabase de "check list"
// (matrix_colaboradores, ver shared/checklist-config.js), no en el
// proyecto principal de picking. Se carga una sola vez.
let _rosterColaboradoresPasillo = [];
let _rosterColaboradoresPasilloCargado = false;

async function cargarRosterColaboradoresPasillo(){

    if(_rosterColaboradoresPasilloCargado){
        return;
    }

    try{

        const filas = await checklistFetch(
            "/matrix_colaboradores?select=dni,nombre_completo&order=nombre_completo.asc"
        );

        _rosterColaboradoresPasillo = (filas || [])
            .filter(function(c){ return c.dni && c.nombre_completo; })
            .map(function(c){ return { dni: String(c.dni).trim(), nombre: c.nombre_completo }; });

        _rosterColaboradoresPasilloCargado = true;

    }catch(e){
        console.error(e);
        _rosterColaboradoresPasillo = [];
    }

}

function opcionesSelectColaboradorPasillo(dniAsignado){

    const opciones = ['<option value="">Sin asignar</option>'];

    _rosterColaboradoresPasillo.forEach(function(c){
        const seleccionado = c.dni === dniAsignado ? " selected" : "";
        opciones.push(`<option value="${c.dni}"${seleccionado}>${c.nombre}</option>`);
    });

    return opciones.join("");

}

// Solo puede contar ese pasillo el DNI asignado — se le manda al
// mismo picking_pasillos que ya usa Centro de Proyectos para
// reclamar/bloquear pasillos, preservando estado/horas si ya existía.
async function asignarColaboradorPasillo(pasillo, dni, nombre){

    try{

        const existentes = await supabaseFetch(
            "/picking_pasillos?select=estado,hora_inicio,hora_fin&pasillo=eq." + pasillo + "&semana=eq." + SEMANA
        );

        const actual = (existentes && existentes[0]) || {};

        await supabaseFetch("/picking_pasillos?on_conflict=pasillo,semana", {
            method: "POST",
            headers: { "Prefer": "resolution=merge-duplicates" },
            body: JSON.stringify({
                pasillo: pasillo,
                semana: SEMANA,
                colaborador: nombre || null,
                colaborador_dni: dni || null,
                estado: actual.estado || null,
                hora_inicio: actual.hora_inicio || null,
                hora_fin: actual.hora_fin || null
            })
        });

        mostrarToast(
            nombre ? "Pasillo " + String(pasillo).padStart(2, "0") + " asignado a " + nombre + "." : "Asignación quitada.",
            "exito"
        );

        cargarAsignacion();

    }catch(e){

        console.error(e);
        mostrarToast("No se pudo guardar la asignación.", "error");

    }

}

document.getElementById("tblAsignacion").addEventListener("click", function(e){

    const boton = e.target.closest(".btn-asignar-pasillo");

    if(!boton){
        return;
    }

    const pasillo = Number(boton.dataset.pasillo);
    const select = document.querySelector('.selectColaboradorPasillo[data-pasillo="' + pasillo + '"]');
    const dni = select.value;
    const colaborador = dni
        ? (_rosterColaboradoresPasillo.find(function(c){ return c.dni === dni; }) || {}).nombre
        : null;

    asignarColaboradorPasillo(pasillo, dni || null, colaborador || null);

});

async function cargarAsignacion(){

    const tbody = document.getElementById("tblAsignacion");
    tbody.innerHTML = `<tr><td colspan="4" class="sin-datos">Cargando pasillos...</td></tr>`;

    try{

        const [ubicacionesFilas, conteoFilas, pasillosFilas] = await Promise.all([
            supabaseFetchTodo("/picking_ubicaciones?select=pasillo"),
            supabaseFetchTodo("/picking_conteos?select=pasillo&semana=eq." + SEMANA + "&es_reconteo=eq.false"),
            supabaseFetch("/picking_pasillos?select=pasillo,colaborador,colaborador_dni,estado&semana=eq." + SEMANA).catch(function(e){
                console.error(e);
                return [];
            }),
            cargarRosterColaboradoresPasillo()
        ]);

        const totalPorPasillo = {};

        (ubicacionesFilas || []).forEach(function(f){
            totalPorPasillo[f.pasillo] = (totalPorPasillo[f.pasillo] || 0) + 1;
        });

        const registradoPorPasillo = {};

        (conteoFilas || []).forEach(function(f){
            registradoPorPasillo[f.pasillo] = (registradoPorPasillo[f.pasillo] || 0) + 1;
        });

        const colaboradorPorPasillo = {};
        const dniPorPasillo = {};
        const cerradoPorPasillo = {};

        (pasillosFilas || []).forEach(function(a){
            if(a.colaborador){ colaboradorPorPasillo[a.pasillo] = a.colaborador; }
            if(a.colaborador_dni){ dniPorPasillo[a.pasillo] = a.colaborador_dni; }
            if(a.estado === "cerrado"){ cerradoPorPasillo[a.pasillo] = true; }
        });

        const pasillos = Object.keys(totalPorPasillo).map(Number).sort((a, b) => a - b);

        tbody.innerHTML = "";

        if(!pasillos.length){
            tbody.innerHTML = `<tr><td colspan="4" class="sin-datos">Carga las Ubicaciones de Picking para ver los pasillos.</td></tr>`;
            document.getElementById("kpiTotalPasillos").textContent = "0";
            document.getElementById("kpiAsignados").textContent = "0";
            document.getElementById("kpiCompletados").textContent = "0";
            document.getElementById("kpiAvanceGeneral").textContent = "0%";
            return;
        }

        let enProceso = 0;
        let completados = 0;
        let sumaPorcentajes = 0;

        pasillos.forEach(function(p){

            const colaborador = colaboradorPorPasillo[p] || "";
            const dniAsignado = dniPorPasillo[p] || "";
            const total = totalPorPasillo[p] || 0;
            const registrado = Math.min(registradoPorPasillo[p] || 0, total);
            const porcentaje = total > 0 ? Math.round((registrado / total) * 100) : 0;

            sumaPorcentajes += porcentaje;

            let estado = "sin-asignar";
            let estadoTexto = "Sin iniciar";

            if(cerradoPorPasillo[p]){
                estado = "cerrado";
                estadoTexto = "Cerrado";
                completados++;
            }else if(porcentaje >= 100){
                estado = "completado";
                estadoTexto = "Completado";
                completados++;
            }else if(porcentaje > 0 || colaborador){
                estado = "en-proceso";
                estadoTexto = colaborador ? "En proceso" : "Sin iniciar";
                if(colaborador){ enProceso++; }
            }

            const tr = document.createElement("tr");

            tr.innerHTML = `
                <td><b>Pasillo ${String(p).padStart(2, "0")}</b></td>
                <td>
                    <div class="asignarColaborador">
                        <select class="selectColaboradorPasillo" data-pasillo="${p}">
                            ${opcionesSelectColaboradorPasillo(dniAsignado)}
                        </select>
                        <button class="btn-secundario btn-asignar-pasillo" data-pasillo="${p}">Asignar</button>
                    </div>
                </td>
                <td>
                    <span class="barraAvanceMini"><span class="barraAvanceMiniRelleno" style="width:${porcentaje}%;"></span></span>
                    ${porcentaje}% (${registrado}/${total})
                </td>
                <td><span class="badge-estado-asig ${estado}">${estadoTexto}</span></td>
            `;

            tbody.appendChild(tr);

        });

        document.getElementById("kpiTotalPasillos").textContent = pasillos.length;
        document.getElementById("kpiAsignados").textContent = enProceso;
        document.getElementById("kpiCompletados").textContent = completados;
        document.getElementById("kpiAvanceGeneral").textContent = Math.round(sumaPorcentajes / pasillos.length) + "%";

    }catch(e){

        console.error(e);
        tbody.innerHTML = `<tr><td colspan="4" class="sin-datos">No se pudo cargar la asignación de pasillos.</td></tr>`;

    }

}

document.getElementById("btnActualizarAsignacion").addEventListener("click", cargarAsignacion);

cargarAsignacion();

// ========================================
// TAB 2: CATÁLOGO MARA PICKING (CRUD + carga masiva)
// ========================================

let _maraPickingCargadaAlMenosUnaVez = false;
let _catalogoMaraPicking = [];
let _paginaActualMaraPicking = 1;
const FILAS_POR_PAGINA_MARA_PICKING = 50;

const tblMaraPicking = document.getElementById("tblMaraPicking");
const paginacionMaraPicking = document.getElementById("paginacionMaraPicking");
const buscadorMaraPicking = document.getElementById("buscadorMaraPicking");

const modalMaraPicking = document.getElementById("modalMaraPicking");
const modalMaraPickingTitulo = document.getElementById("modalMaraPickingTitulo");
const formMaraPicking = document.getElementById("formMaraPicking");

async function cargarMaraPicking(){

    tblMaraPicking.innerHTML = `<tr><td colspan="9" class="sin-datos">Cargando catálogo...</td></tr>`;

    try{

        _catalogoMaraPicking = await supabaseFetchTodo("/picking_mara?select=*&order=sku.asc");
        _maraPickingCargadaAlMenosUnaVez = true;
        _paginaActualMaraPicking = 1;
        pintarMaraPicking();

    }catch(e){

        console.error(e);
        tblMaraPicking.innerHTML = `<tr><td colspan="9" class="sin-datos">No se pudo cargar el catálogo.</td></tr>`;

    }

}

function filasFiltradasMaraPicking(){

    const texto = buscadorMaraPicking.value.trim().toLowerCase();

    if(!texto){
        return _catalogoMaraPicking;
    }

    return _catalogoMaraPicking.filter(function(p){
        return (
            (p.sku || "").toLowerCase().includes(texto) ||
            (p.descripcion || "").toLowerCase().includes(texto)
        );
    });

}

function pintarMaraPicking(){

    const filas = filasFiltradasMaraPicking();

    if(!filas.length){
        tblMaraPicking.innerHTML = `<tr><td colspan="9" class="sin-datos">Sin productos en el catálogo.</td></tr>`;
        paginacionMaraPicking.innerHTML = "";
        return;
    }

    const totalPaginas = Math.max(1, Math.ceil(filas.length / FILAS_POR_PAGINA_MARA_PICKING));
    _paginaActualMaraPicking = Math.min(_paginaActualMaraPicking, totalPaginas);

    const desde = (_paginaActualMaraPicking - 1) * FILAS_POR_PAGINA_MARA_PICKING;
    const visibles = filas.slice(desde, desde + FILAS_POR_PAGINA_MARA_PICKING);

    tblMaraPicking.innerHTML = visibles.map(function(p){

        return `
            <tr>
                <td>${p.sku || "-"}</td>
                <td>${p.descripcion || "-"}</td>
                <td>${p.unidad_venta || "-"}</td>
                <td>${p.unidad_base || "-"}</td>
                <td>${p.conversion_cama_pqt ?? "-"}</td>
                <td>${p.ean14 || "-"}</td>
                <td>${p.ean13 || "-"}</td>
                <td>
                    <button class="btn-fila-mara" title="Editar" onclick="abrirModalMaraPicking('${p.sku}')">✏️</button>
                    <button class="btn-fila-mara" title="Eliminar" onclick="eliminarProductoMaraPicking('${p.sku}')">🗑</button>
                </td>
            </tr>
        `;

    }).join("");

    paginacionMaraPicking.innerHTML = `
        <button ${_paginaActualMaraPicking <= 1 ? "disabled" : ""} onclick="cambiarPaginaMaraPicking(-1)">‹ Anterior</button>
        <span>Página ${_paginaActualMaraPicking} de ${totalPaginas} · ${filas.length} producto(s)</span>
        <button ${_paginaActualMaraPicking >= totalPaginas ? "disabled" : ""} onclick="cambiarPaginaMaraPicking(1)">Siguiente ›</button>
    `;

}

function cambiarPaginaMaraPicking(delta){
    _paginaActualMaraPicking += delta;
    pintarMaraPicking();
}

buscadorMaraPicking.addEventListener("input", function(){
    _paginaActualMaraPicking = 1;
    pintarMaraPicking();
});

function abrirModalMaraPicking(sku){

    formMaraPicking.reset();
    document.getElementById("campoSkuPicking").disabled = false;

    if(sku){

        const p = _catalogoMaraPicking.find(x => x.sku === sku);
        if(!p){ return; }

        modalMaraPickingTitulo.textContent = "Editar Producto";
        document.getElementById("campoSkuPicking").value = p.sku || "";
        document.getElementById("campoSkuPicking").disabled = true;
        document.getElementById("campoDescripcionPicking").value = p.descripcion || "";
        document.getElementById("campoUnidadVentaPicking").value = p.unidad_venta || "";
        document.getElementById("campoUnidadBasePicking").value = p.unidad_base || "";
        document.getElementById("campoConversionCamaPicking").value = p.conversion_cama_pqt ?? "";
        document.getElementById("campoEan14Picking").value = p.ean14 || "";
        document.getElementById("campoEan13Picking").value = p.ean13 || "";

    }else{
        modalMaraPickingTitulo.textContent = "Agregar Producto";
    }

    modalMaraPicking.classList.remove("oculto");

}

function cerrarModalMaraPicking(){
    modalMaraPicking.classList.add("oculto");
}

document.getElementById("btnAgregarMaraPicking").addEventListener("click", function(){
    abrirModalMaraPicking(null);
});

document.getElementById("modalMaraPickingCerrar").addEventListener("click", cerrarModalMaraPicking);
document.getElementById("modalMaraPickingFondo").addEventListener("click", cerrarModalMaraPicking);

formMaraPicking.addEventListener("submit", async function(e){

    e.preventDefault();

    const sku = document.getElementById("campoSkuPicking").value.trim();

    if(!sku){
        mostrarToast("El SKU es obligatorio.", "error");
        return;
    }

    const registro = {
        sku: sku,
        descripcion: document.getElementById("campoDescripcionPicking").value.trim() || null,
        unidad_venta: document.getElementById("campoUnidadVentaPicking").value.trim() || null,
        unidad_base: document.getElementById("campoUnidadBasePicking").value.trim() || null,
        conversion_cama_pqt: document.getElementById("campoConversionCamaPicking").value === "" ? null : Number(document.getElementById("campoConversionCamaPicking").value),
        ean14: document.getElementById("campoEan14Picking").value.trim() || null,
        ean13: document.getElementById("campoEan13Picking").value.trim() || null,
        actualizado_por: (sesion && sesion.nombre_completo) || null
    };

    const btnGuardar = document.getElementById("btnGuardarMaraPicking");
    btnGuardar.disabled = true;
    btnGuardar.textContent = "Guardando...";

    try{

        await supabaseFetch("/picking_mara?on_conflict=sku", {
            method: "POST",
            headers: { "Prefer": "resolution=merge-duplicates" },
            body: JSON.stringify(registro)
        });

        mostrarToast("Producto guardado.", "exito");
        cerrarModalMaraPicking();
        await cargarMaraPicking();

    }catch(err){

        console.error(err);
        mostrarToast("No se pudo guardar el producto.", "error");

    }finally{

        btnGuardar.disabled = false;
        btnGuardar.textContent = "Guardar";

    }

});

async function eliminarProductoMaraPicking(sku){

    if(!(await mostrarConfirmacion("¿Eliminar el producto " + sku + " del Catálogo MARA Picking?"))){
        return;
    }

    try{

        await supabaseFetch("/picking_mara?sku=eq." + encodeURIComponent(sku), { method: "DELETE" });
        mostrarToast("Producto eliminado.", "exito");
        await cargarMaraPicking();

    }catch(err){

        console.error(err);
        mostrarToast("No se pudo eliminar el producto.", "error");

    }

}

function normalizarEncabezadoMaraPicking(texto){

    return String(texto || "")
        .trim()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "");

}

const ALIAS_COLUMNAS_MARA_PICKING = {
    sku: ["codigo", "material ewm", "material", "sku", "material s4h", "codigo material"],
    descripcion: ["descripcion", "des. de material", "denominacion", "descripcion de material"],
    unidad_venta: ["umb", "unidad de venta"],
    unidad_base: ["uma", "unidad base"],
    conversion_cama_pqt: ["conversion cama / pqt", "conversion cama/pqt", "conversion cama pqt"],
    ean14: ["ean 14", "ean14"],
    ean13: ["ean 13", "ean13"]
};

function mapearFilaMaraPicking(filaObjeto, mapaColumnas){

    const registro = {};

    Object.keys(mapaColumnas).forEach(function(campo){

        const encabezadoReal = mapaColumnas[campo];

        if(!encabezadoReal){
            registro[campo] = null;
            return;
        }

        let valor = filaObjeto[encabezadoReal];

        if(valor === undefined || valor === null || valor === ""){
            registro[campo] = null;
            return;
        }

        if(campo === "conversion_cama_pqt"){
            const numero = Number(valor);
            registro[campo] = isNaN(numero) ? null : numero;
        }else{
            registro[campo] = String(valor).trim();
        }

    });

    return registro;

}

document.getElementById("archivoMaraPicking").addEventListener("change", async function(e){

    const archivo = e.target.files[0];
    if(!archivo){ return; }

    try{

        const buffer = await archivo.arrayBuffer();
        const libro = XLSX.read(buffer, { type: "array" });
        const hoja = libro.Sheets[libro.SheetNames[0]];
        const filas = XLSX.utils.sheet_to_json(hoja, { defval: "" });

        if(!filas.length){
            mostrarToast("El archivo no tiene filas.", "error");
            e.target.value = "";
            return;
        }

        const encabezadosReales = Object.keys(filas[0]);
        const mapaColumnas = {};

        Object.keys(ALIAS_COLUMNAS_MARA_PICKING).forEach(function(campo){

            const alias = ALIAS_COLUMNAS_MARA_PICKING[campo];

            const encontrado = encabezadosReales.find(function(h){
                return alias.includes(normalizarEncabezadoMaraPicking(h));
            });

            mapaColumnas[campo] = encontrado || null;

        });

        if(!mapaColumnas.sku){
            mostrarToast("No se encontró la columna de SKU/Material en el archivo.", "error");
            e.target.value = "";
            return;
        }

        const registrosCrudos = filas
            .map(function(fila){ return mapearFilaMaraPicking(fila, mapaColumnas); })
            .filter(function(r){ return r.sku; })
            .map(function(r){ return Object.assign(r, { actualizado_por: (sesion && sesion.nombre_completo) || null }); });

        // Si el mismo SKU se repite en el archivo, Postgres rechaza el
        // upsert ("no puede afectar la misma fila 2 veces") — se deja
        // solo la última fila de cada SKU repetido.
        const porSku = new Map();
        registrosCrudos.forEach(function(r){
            porSku.set(r.sku, r);
        });
        const registros = [...porSku.values()];

        if(!registros.length){
            mostrarToast("No se encontraron productos con SKU válido.", "error");
            e.target.value = "";
            return;
        }

        const TAMANO_BLOQUE = 500;

        for(let i = 0; i < registros.length; i += TAMANO_BLOQUE){

            const bloque = registros.slice(i, i + TAMANO_BLOQUE);

            await supabaseFetch("/picking_mara?on_conflict=sku", {
                method: "POST",
                headers: { "Prefer": "resolution=merge-duplicates" },
                body: JSON.stringify(bloque)
            });

        }

        mostrarToast(registros.length + " producto(s) cargado(s)/actualizado(s) en el Catálogo MARA Picking.", "exito");
        await cargarMaraPicking();
        await cargarAsignacion();

    }catch(err){

        console.error(err);
        mostrarToast("No se pudo procesar el archivo.", "error");

    }finally{

        e.target.value = "";

    }

});

// ========================================
// TAB 3: CARGAR SAP
// ========================================

const ALIAS_COLUMNAS_SAP_PICKING = {
    tipo_almacen: ["tipo almacen"],
    ubicacion: ["ubicacion"],
    sku: ["producto"],
    descripcion: ["descripcion de producto"],
    lote: ["lote"],
    fecha_caducidad: ["fecaduc/feprefercons", "fecaduc / feprefercons", "fecaduc feprefercons"],
    tipo_stock: ["tipo de stocks", "tipo de stock"],
    stock: ["stock"],
    umb: ["umb"],
    unidad_manipulacion: ["unidad manipulacion"],
    ctd: ["ctd.", "ctd"],
    fecha_em: ["fecha em"],
    hora_em: ["hora em"],
    documento: ["documento"],
    grupo_consolidacion: ["grupo consolidacion"],
    insp_calidad: ["insp.calidad", "insp calidad"],
    peso_carga: ["peso de carga"]
};

// ========================================
// UBICACIONES DE PICKING: se arman solas a partir del saldo SAP. El
// código siempre viene PREFIJO-PASILLO-COLUMNA-NIVEL (ej. PP-07-001-1)
// y cada pasillo tiene 52 ubicaciones — pero SAP solo trae las que
// tienen stock, así que se generan las 52 completas para auditar
// también las vacías.
// ========================================

const UBICACIONES_POR_PASILLO = 52;

function derivarPasilloDeUbicacion(ubicacionTexto){

    const partes = String(ubicacionTexto || "").trim().toUpperCase().split("-");

    if(partes.length !== 4){
        return null;
    }

    const pasillo = Number(partes[1]);

    if(isNaN(pasillo)){
        return null;
    }

    return { prefijo: partes[0], pasilloTexto: partes[1], pasillo: pasillo };

}

async function generarUbicacionesDesdeSap(registrosSap){

    const muestraPorPasillo = new Map();

    registrosSap.forEach(function(r){

        // RECH es un tipo de almacén aparte (rechazos) — sus
        // ubicaciones no se agrupan en pasillos de picking, tienen su
        // propia pestaña.
        if(String(r.tipo_almacen || "").trim().toUpperCase() === "RECH"){
            return;
        }

        const info = derivarPasilloDeUbicacion(r.ubicacion);

        if(!info || muestraPorPasillo.has(info.pasillo)){
            return;
        }

        muestraPorPasillo.set(info.pasillo, {
            prefijo: info.prefijo,
            pasilloTexto: info.pasilloTexto,
            tipo_almacen: r.tipo_almacen || null
        });

    });

    if(!muestraPorPasillo.size){
        return 0;
    }

    const registrosUbicacion = [];

    muestraPorPasillo.forEach(function(muestra, pasillo){

        for(let columna = 1; columna <= UBICACIONES_POR_PASILLO; columna++){

            const columnaTexto = String(columna).padStart(3, "0");

            registrosUbicacion.push({
                ubicacion: muestra.prefijo + "-" + muestra.pasilloTexto + "-" + columnaTexto + "-1",
                pasillo: pasillo,
                columna: columna,
                nivel: "1",
                tipo_almacen: muestra.tipo_almacen
            });

        }

    });

    const TAMANO_BLOQUE = 500;

    for(let i = 0; i < registrosUbicacion.length; i += TAMANO_BLOQUE){

        const bloque = registrosUbicacion.slice(i, i + TAMANO_BLOQUE);

        await supabaseFetch("/picking_ubicaciones?on_conflict=ubicacion", {
            method: "POST",
            headers: { "Prefer": "resolution=merge-duplicates" },
            body: JSON.stringify(bloque)
        });

    }

    return muestraPorPasillo.size;

}

document.getElementById("archivoSapPicking").addEventListener("change", async function(e){

    const archivo = e.target.files[0];
    if(!archivo){ return; }

    const estadoEl = document.getElementById("estadoCargaSapPicking");
    estadoEl.textContent = "Leyendo " + archivo.name + "...";

    try{

        const buffer = await archivo.arrayBuffer();
        const libro = XLSX.read(buffer, { type: "array" });
        const hoja = libro.Sheets[libro.SheetNames[0]];
        const filasCrudas = XLSX.utils.sheet_to_json(hoja, { defval: "" });

        if(!filasCrudas.length){
            mostrarToast("El archivo está vacío.", "error");
            estadoEl.textContent = "";
            return;
        }

        const encabezadosReales = Object.keys(filasCrudas[0]);
        const mapaColumnas = {};

        Object.keys(ALIAS_COLUMNAS_SAP_PICKING).forEach(function(campo){

            const alias = ALIAS_COLUMNAS_SAP_PICKING[campo];

            const encontrado = encabezadosReales.find(function(h){
                return alias.includes(normalizarEncabezadoMaraPicking(h));
            });

            mapaColumnas[campo] = encontrado || null;

        });

        if(!mapaColumnas.ubicacion || !mapaColumnas.sku){
            mostrarToast("No se encontraron las columnas Ubicación/Producto en el archivo.", "error");
            estadoEl.textContent = "";
            return;
        }

        const cargadoPor = (sesion && sesion.nombre_completo) || "";

        const registros = filasCrudas.map(function(f){

            const registro = {};

            Object.keys(mapaColumnas).forEach(function(campo){

                const encabezadoReal = mapaColumnas[campo];
                let valor = encabezadoReal ? f[encabezadoReal] : "";

                if(valor === undefined || valor === null || valor === ""){
                    registro[campo] = null;
                    return;
                }

                if(campo === "stock" || campo === "ctd" || campo === "peso_carga"){
                    const numero = Number(valor);
                    registro[campo] = isNaN(numero) ? null : numero;
                }else{
                    registro[campo] = String(valor).trim();
                }

            });

            registro.cargado_por = cargadoPor;

            return registro;

        }).filter(function(r){ return r.ubicacion && r.sku; });

        if(!registros.length){
            mostrarToast("No se encontraron filas válidas (revisa Ubicación y Producto).", "error");
            estadoEl.textContent = "";
            return;
        }

        estadoEl.textContent = "Borrando saldo SAP anterior...";

        // Cada carga reemplaza el saldo completo — si no se borra antes,
        // un archivo subido dos veces deja filas viejas y nuevas mezcladas.
        await supabaseFetch("/picking_sap_stock?id=gt.0", { method: "DELETE" });

        estadoEl.textContent = "Guardando " + registros.length.toLocaleString("es-PE") + " filas...";

        const TAMANO_BLOQUE = 500;

        for(let i = 0; i < registros.length; i += TAMANO_BLOQUE){

            const bloque = registros.slice(i, i + TAMANO_BLOQUE);

            await supabaseFetch("/picking_sap_stock", {
                method: "POST",
                body: JSON.stringify(bloque)
            });

            estadoEl.textContent = "Guardando... " + Math.min(i + TAMANO_BLOQUE, registros.length).toLocaleString("es-PE") +
                " / " + registros.length.toLocaleString("es-PE");

        }

        estadoEl.textContent = "Generando ubicaciones de picking...";

        const pasillosGenerados = await generarUbicacionesDesdeSap(registros);

        estadoEl.textContent = "✓ Cargado: " + registros.length.toLocaleString("es-PE") + " filas de " + archivo.name +
            " · " + pasillosGenerados + " pasillo(s) con ubicaciones generadas.";
        mostrarToast(
            "Saldo SAP cargado: " + registros.length.toLocaleString("es-PE") + " filas · " +
            pasillosGenerados + " pasillo(s) con ubicaciones generadas.",
            "exito"
        );

        document.getElementById("archivoSapPicking").value = "";
        await cargarAsignacion();

    }catch(err){

        console.error(err);
        mostrarToast("No se pudo cargar el archivo: " + err.message, "error");
        estadoEl.textContent = "";

    }

});

document.getElementById("btnBorrarSap").addEventListener("click", async function(){

    const btn = document.getElementById("btnBorrarSap");

    const confirmado = await mostrarConfirmacion(
        "Esto borra TODO el saldo SAP cargado en Inventario Picking. No se puede deshacer.\n\n¿Continuar?"
    );

    if(!confirmado){ return; }

    const escrito = await pedirTexto('Para confirmar, escribe BORRAR (en mayúsculas):');

    if(escrito !== "BORRAR"){
        mostrarToast("Cancelado: no se escribió BORRAR, no se borró nada.", "info");
        return;
    }

    btn.disabled = true;
    btn.textContent = "Borrando...";

    try{

        await supabaseFetch("/picking_sap_stock?id=gt.0", { method: "DELETE" });

        document.getElementById("estadoCargaSapPicking").textContent = "";
        mostrarToast("Saldo SAP borrado.", "exito");

    }catch(err){

        console.error(err);
        mostrarToast("No se pudo borrar: " + err.message, "error");

    }finally{

        btn.disabled = false;
        btn.textContent = "🗑 Borrar Todo";

    }

});

// ========================================
// TAB 4: DISCREPANCIAS
// ========================================

function normalizarTextoAuditoria(t){
    return String(t || "").trim().toUpperCase();
}

let _catalogoAuditoria = [];
let _paginaActualAuditoria = 1;
const FILAS_POR_PAGINA_AUDITORIA = 50;

function filasFiltradasAuditoria(){

    const texto = document.getElementById("buscadorAuditoria").value.trim().toLowerCase();

    if(!texto){
        return _catalogoAuditoria;
    }

    return _catalogoAuditoria.filter(function(f){
        return (
            f.ubicacion.toLowerCase().includes(texto) ||
            f.codigoContado.toLowerCase().includes(texto) ||
            f.codigoSap.toLowerCase().includes(texto) ||
            f.colaborador.toLowerCase().includes(texto)
        );
    });

}

function pintarAuditoria(){

    const tbody = document.getElementById("tblAuditoria");
    const paginacion = document.getElementById("paginacionAuditoria");
    const filas = filasFiltradasAuditoria();

    if(!filas.length){
        tbody.innerHTML = `<tr><td colspan="8" class="sin-datos">Sin ubicaciones auditadas todavía.</td></tr>`;
        paginacion.innerHTML = "";
        return;
    }

    const totalPaginas = Math.max(1, Math.ceil(filas.length / FILAS_POR_PAGINA_AUDITORIA));
    _paginaActualAuditoria = Math.min(_paginaActualAuditoria, totalPaginas);

    const desde = (_paginaActualAuditoria - 1) * FILAS_POR_PAGINA_AUDITORIA;
    const visibles = filas.slice(desde, desde + FILAS_POR_PAGINA_AUDITORIA);

    tbody.innerHTML = visibles.map(function(f){
        return `
            <tr>
                <td>${String(f.pasillo).padStart(2, "0")}</td>
                <td>${f.ubicacion}</td>
                <td>${f.codigoSap}</td>
                <td>${f.cantidadSap}</td>
                <td>${f.codigoContado}</td>
                <td>${f.cantidad}</td>
                <td>${f.colaborador}</td>
                <td><span class="badge-auditoria ${f.claseEstado}">${f.estado}</span></td>
            </tr>
        `;
    }).join("");

    paginacion.innerHTML = `
        <button ${_paginaActualAuditoria <= 1 ? "disabled" : ""} onclick="cambiarPaginaAuditoria(-1)">‹ Anterior</button>
        <span>Página ${_paginaActualAuditoria} de ${totalPaginas} · ${filas.length} ubicación(es)</span>
        <button ${_paginaActualAuditoria >= totalPaginas ? "disabled" : ""} onclick="cambiarPaginaAuditoria(1)">Siguiente ›</button>
    `;

}

function cambiarPaginaAuditoria(delta){
    _paginaActualAuditoria += delta;
    pintarAuditoria();
}

// ========================================
// TAB 5: RECONTEO — mismas filas de Auditoría, filtradas a las que
// ya se revisaron en Revalidar y siguen sin cuadrar con SAP.
// ========================================

let _catalogoReconteo = [];
let _paginaActualReconteo = 1;
const FILAS_POR_PAGINA_RECONTEO = 50;

function filasFiltradasReconteo(){

    const texto = document.getElementById("buscadorReconteo").value.trim().toLowerCase();

    if(!texto){
        return _catalogoReconteo;
    }

    return _catalogoReconteo.filter(function(f){
        return (
            f.ubicacion.toLowerCase().includes(texto) ||
            f.codigoContado.toLowerCase().includes(texto) ||
            f.codigoSap.toLowerCase().includes(texto) ||
            f.colaborador.toLowerCase().includes(texto)
        );
    });

}

function pintarReconteo(){

    const tbody = document.getElementById("tblReconteo");
    const paginacion = document.getElementById("paginacionReconteo");
    const filas = filasFiltradasReconteo();

    if(!filas.length){
        tbody.innerHTML = `<tr><td colspan="8" class="sin-datos">Sin diferencias revisadas todavía.</td></tr>`;
        paginacion.innerHTML = "";
        return;
    }

    const totalPaginas = Math.max(1, Math.ceil(filas.length / FILAS_POR_PAGINA_RECONTEO));
    _paginaActualReconteo = Math.min(_paginaActualReconteo, totalPaginas);

    const desde = (_paginaActualReconteo - 1) * FILAS_POR_PAGINA_RECONTEO;
    const visibles = filas.slice(desde, desde + FILAS_POR_PAGINA_RECONTEO);

    tbody.innerHTML = visibles.map(function(f){

        const idInput = idInputCantidadSap(f.ubicacion);
        const puedeEditar = f.codigoContado && f.codigoContado !== "-";

        return `
            <tr>
                <td>${String(f.pasillo).padStart(2, "0")}</td>
                <td>${f.ubicacion}</td>
                <td>${f.codigoSap}</td>
                <td>
                    ${puedeEditar
                        ? `<input type="number" step="any" class="input-cantidad-sap" id="${idInput}" value="${f.cantidadSap === "-" ? 0 : f.cantidadSap}">`
                        : f.cantidadSap}
                </td>
                <td>${f.codigoContado}</td>
                <td>${f.cantidad}</td>
                <td>${f.colaborador}</td>
                <td>
                    ${puedeEditar
                        ? `<button class="btn-secundario" onclick="actualizarCantidadSap('${f.ubicacion}', '${f.codigoContado}', '${idInput}')">Guardar</button>`
                        : ""}
                </td>
            </tr>
        `;
    }).join("");

    paginacion.innerHTML = `
        <button ${_paginaActualReconteo <= 1 ? "disabled" : ""} onclick="cambiarPaginaReconteo(-1)">‹ Anterior</button>
        <span>Página ${_paginaActualReconteo} de ${totalPaginas} · ${filas.length} ubicación(es)</span>
        <button ${_paginaActualReconteo >= totalPaginas ? "disabled" : ""} onclick="cambiarPaginaReconteo(1)">Siguiente ›</button>
    `;

}

function cambiarPaginaReconteo(delta){
    _paginaActualReconteo += delta;
    pintarReconteo();
}

function idInputCantidadSap(ubicacion){
    return "cantidadSap_" + String(ubicacion).replace(/[^a-zA-Z0-9]/g, "_");
}

// Corrige a mano el saldo SAP de esa ubicación/código cuando el
// conteo físico (ya revalidado) confirma que el sistema estaba
// desactualizado — reemplaza las filas de picking_sap_stock de ese
// código en esa ubicación por una sola con la cantidad nueva.
async function actualizarCantidadSap(ubicacion, sku, idInput){

    const input = document.getElementById(idInput);
    const nuevaCantidad = Number(input.value);

    if(isNaN(nuevaCantidad) || nuevaCantidad < 0){
        mostrarToast("Cantidad inválida.", "error");
        return;
    }

    const claveUbicacion = normalizarTextoAuditoria(ubicacion);

    try{

        // ilike (no eq) en la ubicación: lo que se subió del Excel de
        // SAP puede no venir en mayúsculas, y acá se compara contra el
        // valor ya normalizado.
        await supabaseFetch(
            "/picking_sap_stock?ubicacion=ilike." + encodeURIComponent(claveUbicacion) +
            "&sku=eq." + encodeURIComponent(sku),
            { method: "DELETE" }
        );

        await supabaseFetch("/picking_sap_stock", {
            method: "POST",
            body: JSON.stringify({
                ubicacion: claveUbicacion,
                sku: sku,
                stock: nuevaCantidad,
                cargado_por: (sesion && sesion.nombre_completo) || null
            })
        });

        mostrarToast("Cantidad SAP de " + ubicacion + " actualizada a " + nuevaCantidad + ".", "exito");
        await cargarDiscrepancias();

    }catch(err){

        console.error(err);
        mostrarToast("No se pudo actualizar: " + err.message, "error");

    }

}

document.getElementById("buscadorReconteo").addEventListener("input", function(){
    _paginaActualReconteo = 1;
    pintarReconteo();
});

document.getElementById("btnActualizarReconteo").addEventListener("click", cargarDiscrepancias);

// ========================================
// ACTIVAR/DESACTIVAR RECONTEO: prende o apaga la tarjeta "Reconteo"
// en Centro de Proyectos (tabla aparte, picking_reconteo_activo — no
// existe en las demás pestañas porque es un simple flag por semana).
// ========================================

let _reconteoActivo = false;

async function cargarEstadoReconteo(){

    const btn = document.getElementById("btnToggleReconteo");
    const estadoEl = document.getElementById("estadoReconteoActivo");

    try{

        const filas = await supabaseFetch(
            "/picking_reconteo_activo?select=activo,activado_por,activado_en&semana=eq." + SEMANA
        );

        const fila = filas && filas[0];
        _reconteoActivo = !!(fila && fila.activo);

        btn.textContent = _reconteoActivo ? "Desactivar Reconteo" : "Activar Reconteo";
        btn.classList.toggle("btn-peligro", _reconteoActivo);

        estadoEl.textContent = _reconteoActivo
            ? "🔁 Tarjeta \"Reconteo\" visible en Centro de Proyectos" +
                (fila.activado_por ? " — activada por " + fila.activado_por : "") + "."
            : "";

    }catch(e){

        console.error(e);
        estadoEl.textContent = "No se pudo consultar el estado de Reconteo — ¿ya creaste la tabla picking_reconteo_activo?";

    }

}

document.getElementById("btnToggleReconteo").addEventListener("click", async function(){

    const btn = this;
    btn.disabled = true;

    try{

        await supabaseFetch("/picking_reconteo_activo?on_conflict=semana", {
            method: "POST",
            headers: { "Prefer": "resolution=merge-duplicates" },
            body: JSON.stringify({
                semana: SEMANA,
                activo: !_reconteoActivo,
                activado_por: (sesion && sesion.nombre_completo) || null,
                activado_en: new Date().toISOString()
            })
        });

        await cargarEstadoReconteo();
        mostrarToast(_reconteoActivo ? "Reconteo activado." : "Reconteo desactivado.", "exito");

    }catch(err){

        console.error(err);
        mostrarToast("No se pudo actualizar: " + err.message, "error");

    }finally{

        btn.disabled = false;

    }

});

document.getElementById("buscadorAuditoria").addEventListener("input", function(){
    _paginaActualAuditoria = 1;
    pintarAuditoria();
});

// Fetch + cálculo compartido entre Discrepancias y Reporte: el último
// registro vigente de cada ubicación, cruzado contra el saldo SAP.
// "Cuadrada" exige DOS cosas: que el código coincida (cruce OK) Y que
// la cantidad contada coincida con la del saldo SAP — un código
// correcto con cantidad distinta también es una diferencia que hay
// que reverificar.
async function obtenerDatosAuditoria(){

    const [conteoFilas, sapFilas] = await Promise.all([
        supabaseFetchTodo(
            "/picking_conteos?select=pasillo,sku,descripcion,ubicacion_escaneada,ubicacion_esperada,colaborador,cruce,conteo_total,vacia,es_reconteo,creado_en" +
            "&semana=eq." + SEMANA + "&order=creado_en.desc"
        ),
        supabaseFetchTodo("/picking_sap_stock?select=sku,descripcion,stock,ubicacion")
    ]);

    // El % de avance/exactitud y la tabla de auditoría deben mirar el
    // ÚLTIMO registro de cada ubicación, no solo el conteo original —
    // si hubo una corrección desde Revalidar (reconteo), esa es la
    // verdad vigente y debe reemplazar al número viejo.
    const ultimoPorUbicacion = {};

    (conteoFilas || []).forEach(function(f){

        const u = normalizarTextoAuditoria(f.ubicacion_escaneada);

        if(!ultimoPorUbicacion[u]){
            ultimoPorUbicacion[u] = f;
        }

    });

    const vigentes = Object.values(ultimoPorUbicacion);

    // Código SAP esperado por ubicación (puede haber más de un código
    // registrado en la misma ubicación).
    const sapPorUbicacion = {};
    const stockPorUbicacion = {};

    (sapFilas || []).forEach(function(f){

        if(!f.sku){
            return;
        }

        const u = normalizarTextoAuditoria(f.ubicacion);

        if(!sapPorUbicacion[u]){
            sapPorUbicacion[u] = [];
        }

        if(sapPorUbicacion[u].indexOf(f.sku) === -1){
            sapPorUbicacion[u].push(f.sku);
        }

        stockPorUbicacion[u] = (stockPorUbicacion[u] || 0) + Number(f.stock || 0);

    });

    const auditadas = vigentes.map(function(f){

        const ubicacion = f.ubicacion_escaneada || "-";
        const claveUbicacion = normalizarTextoAuditoria(ubicacion);
        const tieneStockSap = claveUbicacion in stockPorUbicacion;
        const cantidadSap = tieneStockSap ? stockPorUbicacion[claveUbicacion] : null;
        const cantidadRegistrada = f.conteo_total ?? 0;
        const tieneDiferencia = f.vacia
            ? tieneStockSap
            : (f.cruce === "ERROR" || !tieneStockSap || Number(cantidadSap) !== Number(cantidadRegistrada));

        return Object.assign({ claveUbicacion, tieneStockSap, cantidadSap, tieneDiferencia }, f);

    });

    return { vigentes, auditadas, sapFilas, sapPorUbicacion, stockPorUbicacion };

}

async function cargarDiscrepancias(){

    const tblAuditoria = document.getElementById("tblAuditoria");
    const tblDiferencias = document.getElementById("tblDiferenciasStock");

    tblAuditoria.innerHTML = `<tr><td colspan="7" class="sin-datos">Cargando...</td></tr>`;
    tblDiferencias.innerHTML = `<tr><td colspan="5" class="sin-datos">Cargando...</td></tr>`;

    try{

        const { vigentes, auditadas, sapFilas, sapPorUbicacion } = await obtenerDatosAuditoria();

        // KPIs generales: ubicaciones contadas (sin las vacías), cuántas
        // cuadraron de verdad (código Y cantidad), y % de exactitud.
        const contadas = auditadas.filter(f => !f.vacia);
        const conDiferencia = contadas.filter(f => f.tieneDiferencia);
        const cuadradas = contadas.length - conDiferencia.length;

        document.getElementById("kpiCodigosContados").textContent = contadas.length;
        document.getElementById("kpiCodigosCuadrados").textContent = cuadradas;
        document.getElementById("kpiErroresUbicacion").textContent = conDiferencia.length;
        document.getElementById("kpiExactitud").textContent = contadas.length > 0
            ? Math.round((cuadradas / contadas.length) * 100) + "%"
            : "-";

        _catalogoAuditoria = auditadas.map(function(f){

            const ubicacion = f.ubicacion_escaneada || "-";
            const codigoSap = sapPorUbicacion[f.claveUbicacion] || [];

            let estado = "Cuadrada";
            let claseEstado = "cuadrada";

            if(f.vacia){
                estado = "Ubicación Vacía";
                claseEstado = "vacia";
            }else if(f.tieneDiferencia && f.es_reconteo){
                // Ya pasó por Revalidar (Correcto o Corregir) y la
                // diferencia contra SAP sigue existiendo — es una
                // diferencia confirmada, no una pendiente por revisar.
                estado = "Reconteo";
                claseEstado = "revisado";
            }else if(f.tieneDiferencia){
                estado = "Segundo Conteo";
                claseEstado = "segundo-conteo";
            }

            return {
                pasillo: f.pasillo,
                ubicacion: ubicacion,
                codigoSap: codigoSap.join(" / ") || "-",
                cantidadSap: f.tieneStockSap ? f.cantidadSap : "-",
                codigoContado: f.vacia ? "-" : (f.sku || "-"),
                cantidad: f.conteo_total ?? 0,
                colaborador: f.colaborador || "-",
                estado: estado,
                claseEstado: claseEstado
            };

        }).sort(function(a, b){
            return a.pasillo - b.pasillo || a.ubicacion.localeCompare(b.ubicacion);
        });

        _paginaActualAuditoria = 1;
        pintarAuditoria();

        _catalogoReconteo = _catalogoAuditoria.filter(f => f.claseEstado === "revisado");
        _paginaActualReconteo = 1;
        pintarReconteo();

        // Contado vs SAP, por SKU
        const contadoPorSku = {};
        const descripcionPorSku = {};

        vigentes.forEach(function(f){
            contadoPorSku[f.sku] = (contadoPorSku[f.sku] || 0) + Number(f.conteo_total || 0);
            if(f.descripcion){ descripcionPorSku[f.sku] = f.descripcion; }
        });

        const sapPorSku = {};

        (sapFilas || []).forEach(function(f){
            sapPorSku[f.sku] = (sapPorSku[f.sku] || 0) + Number(f.stock || 0);
            if(f.descripcion && !descripcionPorSku[f.sku]){ descripcionPorSku[f.sku] = f.descripcion; }
        });

        if(!sapFilas || !sapFilas.length){
            tblDiferencias.innerHTML = `<tr><td colspan="5" class="sin-datos">Carga un saldo SAP para ver la comparativa.</td></tr>`;
        }else{

            const skusTodos = new Set([...Object.keys(contadoPorSku), ...Object.keys(sapPorSku)]);

            const filasDiferencia = [...skusTodos]
                .map(function(sku){
                    return {
                        sku: sku,
                        descripcion: descripcionPorSku[sku] || "-",
                        sap: sapPorSku[sku] || 0,
                        contado: contadoPorSku[sku] || 0
                    };
                })
                .filter(f => f.sap !== f.contado)
                .sort((a, b) => Math.abs(b.sap - b.contado) - Math.abs(a.sap - a.contado));

            if(!filasDiferencia.length){
                tblDiferencias.innerHTML = `<tr><td colspan="5" class="sin-datos">Todo cuadra — sin diferencias.</td></tr>`;
            }else{

                tblDiferencias.innerHTML = filasDiferencia.map(function(f){

                    const diferencia = f.sap - f.contado;

                    return `
                        <tr>
                            <td>${f.sku}</td>
                            <td>${f.descripcion}</td>
                            <td>${f.sap.toLocaleString("es-PE")}</td>
                            <td>${f.contado.toLocaleString("es-PE")}</td>
                            <td class="${diferencia === 0 ? "diferencia-cero" : "diferencia-positiva"}">${diferencia > 0 ? "+" : ""}${diferencia}</td>
                        </tr>
                    `;

                }).join("");

            }

        }

    }catch(e){

        console.error(e);
        tblAuditoria.innerHTML = `<tr><td colspan="7" class="sin-datos">No se pudo cargar.</td></tr>`;
        tblDiferencias.innerHTML = `<tr><td colspan="5" class="sin-datos">No se pudo cargar.</td></tr>`;

    }

}

document.getElementById("btnActualizarDiscrepancias").addEventListener("click", cargarDiscrepancias);

// ========================================
// TAB 6: RECH — ubicaciones de tipo de almacén RECH (rechazos), fuera
// del sistema de pasillos de picking. Una ubicación puede tener varios
// productos, así que se compara por (ubicación, sku), no por
// ubicación sola.
// ========================================

let _catalogoRech = [];
let _paginaActualRech = 1;
const FILAS_POR_PAGINA_RECH = 50;

async function cargarRech(){

    const tbody = document.getElementById("tblRech");
    tbody.innerHTML = `<tr><td colspan="7" class="sin-datos">Cargando...</td></tr>`;

    try{

        const [sapFilas, contadoFilas] = await Promise.all([
            supabaseFetchTodo("/picking_sap_stock?select=ubicacion,sku,stock,descripcion&tipo_almacen=eq.RECH"),
            supabaseFetchTodo("/picking_rech_conteos?select=*&semana=eq." + SEMANA + "&order=creado_en.desc")
        ]);

        const sapPorClave = {};
        const ubicacionesSap = new Set();

        (sapFilas || []).forEach(function(f){

            if(!f.sku){
                return;
            }

            const u = normalizarTextoAuditoria(f.ubicacion);
            const skuTexto = String(f.sku).trim();
            const clave = u + "||" + skuTexto;

            ubicacionesSap.add(u);

            if(!sapPorClave[clave]){
                sapPorClave[clave] = { ubicacion: u, sku: skuTexto, stock: 0, descripcion: f.descripcion || null };
            }

            sapPorClave[clave].stock += Number(f.stock || 0);

            if(f.descripcion && !sapPorClave[clave].descripcion){
                sapPorClave[clave].descripcion = f.descripcion;
            }

        });

        // El registro más reciente por (ubicación, sku) es el conteo
        // vigente — conteoFilas ya viene ordenado por creado_en desc.
        const ultimoPorClave = {};

        (contadoFilas || []).forEach(function(f){

            if(!f.sku){
                return;
            }

            const u = normalizarTextoAuditoria(f.ubicacion_escaneada);
            const clave = u + "||" + String(f.sku).trim();

            if(!ultimoPorClave[clave]){
                ultimoPorClave[clave] = f;
            }

        });

        const clavesTodas = new Set([...Object.keys(sapPorClave), ...Object.keys(ultimoPorClave)]);

        _catalogoRech = [...clavesTodas].map(function(clave){

            const sap = sapPorClave[clave];
            const contado = ultimoPorClave[clave];
            const cantidadSap = sap ? sap.stock : 0;
            const cantidadContada = contado ? Number(contado.conteo_total || 0) : 0;

            return {
                ubicacion: sap ? sap.ubicacion : normalizarTextoAuditoria(contado.ubicacion_escaneada),
                sku: sap ? sap.sku : String(contado.sku || "-").trim(),
                descripcion: (sap && sap.descripcion) || (contado && contado.descripcion) || "-",
                cantidadSap: sap ? cantidadSap : "-",
                cantidadContada: contado ? cantidadContada : "-",
                diferencia: cantidadContada - cantidadSap,
                tieneDiferencia: !sap || !contado || cantidadContada !== cantidadSap,
                colaborador: (contado && contado.colaborador) || "-"
            };

        }).sort(function(a, b){
            return a.ubicacion.localeCompare(b.ubicacion) || a.sku.localeCompare(b.sku);
        });

        document.getElementById("kpiUbicacionesRech").textContent = ubicacionesSap.size;
        document.getElementById("kpiProductosContadosRech").textContent = Object.keys(ultimoPorClave).length;
        document.getElementById("kpiDiferenciasRech").textContent = _catalogoRech.filter(f => f.tieneDiferencia).length;

        _paginaActualRech = 1;
        pintarRech();

    }catch(e){

        console.error(e);
        tbody.innerHTML = `<tr><td colspan="7" class="sin-datos">No se pudo cargar RECH — ¿ya creaste la tabla picking_rech_conteos?</td></tr>`;

    }

}

function filasFiltradasRech(){

    const texto = document.getElementById("buscadorRech").value.trim().toLowerCase();

    if(!texto){
        return _catalogoRech;
    }

    return _catalogoRech.filter(function(f){
        return (
            f.ubicacion.toLowerCase().includes(texto) ||
            String(f.sku).toLowerCase().includes(texto) ||
            f.colaborador.toLowerCase().includes(texto)
        );
    });

}

function pintarRech(){

    const tbody = document.getElementById("tblRech");
    const paginacion = document.getElementById("paginacionRech");
    const filas = filasFiltradasRech();

    if(!filas.length){
        tbody.innerHTML = `<tr><td colspan="7" class="sin-datos">Sin datos de RECH todavía.</td></tr>`;
        paginacion.innerHTML = "";
        return;
    }

    const totalPaginas = Math.max(1, Math.ceil(filas.length / FILAS_POR_PAGINA_RECH));
    _paginaActualRech = Math.min(_paginaActualRech, totalPaginas);

    const desde = (_paginaActualRech - 1) * FILAS_POR_PAGINA_RECH;
    const visibles = filas.slice(desde, desde + FILAS_POR_PAGINA_RECH);

    tbody.innerHTML = visibles.map(function(f){

        const claseDif = f.tieneDiferencia ? "diferencia-positiva" : "diferencia-cero";

        return `
            <tr>
                <td>${f.ubicacion}</td>
                <td>${f.sku}</td>
                <td>${f.descripcion}</td>
                <td>${f.cantidadSap}</td>
                <td>${f.cantidadContada}</td>
                <td class="${claseDif}">${f.tieneDiferencia ? f.diferencia : 0}</td>
                <td>${f.colaborador}</td>
            </tr>
        `;

    }).join("");

    paginacion.innerHTML = `
        <button ${_paginaActualRech <= 1 ? "disabled" : ""} onclick="cambiarPaginaRech(-1)">‹ Anterior</button>
        <span>Página ${_paginaActualRech} de ${totalPaginas} · ${filas.length} fila(s)</span>
        <button ${_paginaActualRech >= totalPaginas ? "disabled" : ""} onclick="cambiarPaginaRech(1)">Siguiente ›</button>
    `;

}

function cambiarPaginaRech(delta){
    _paginaActualRech += delta;
    pintarRech();
}

document.getElementById("buscadorRech").addEventListener("input", function(){
    _paginaActualRech = 1;
    pintarRech();
});

document.getElementById("btnActualizarRech").addEventListener("click", cargarRech);

// ========================================
// TAB 7: REPORTE — mismo formato del reporte que se manda por correo:
// Códigos/ERI, Ubicaciones/ERU, inicio de cada pasillo, y diferencias
// contra SAP. No incluye la columna "Observación" del correo (esa se
// escribe a mano cruzando viajes y HU de planta, datos que no existen
// en esta plataforma).
// ========================================

let _catalogoReporteDiferencias = [];
let _paginaActualReporte = 1;
const FILAS_POR_PAGINA_REPORTE = 50;
let _observacionesReporte = {};

async function cargarReporte(){

    const tblInicio = document.getElementById("tblReporteInicio");
    const tblDiferencias = document.getElementById("tblReporteDiferencias");

    tblInicio.innerHTML = `<tr><td colspan="5" class="sin-datos">Cargando...</td></tr>`;
    tblDiferencias.innerHTML = `<tr><td colspan="9" class="sin-datos">Cargando...</td></tr>`;

    try{

        const [{ auditadas, sapFilas }, maraFilas, pasillosFilas, observacionesFilas] = await Promise.all([
            obtenerDatosAuditoria(),
            supabaseFetchTodo("/picking_mara?select=sku,unidad_base"),
            supabaseFetch("/picking_pasillos?select=pasillo,colaborador,hora_inicio,hora_fin,estado&semana=eq." + SEMANA).catch(function(e){
                console.error(e);
                return [];
            }),
            supabaseFetchTodo("/picking_reporte_observaciones?select=ubicacion,sku,observacion&semana=eq." + SEMANA).catch(function(e){
                console.error(e);
                return [];
            })
        ]);

        _observacionesReporte = {};

        (observacionesFilas || []).forEach(function(o){
            const clave = normalizarTextoAuditoria(o.ubicacion) + "||" + String(o.sku || "").trim();
            _observacionesReporte[clave] = o.observacion || "";
        });

        // ERU: por ubicación (código Y cantidad correctos).
        const contadas = auditadas.filter(f => !f.vacia);
        const cuadradasUbicacion = contadas.filter(f => !f.tieneDiferencia);

        document.getElementById("repUbicacionesContadas").textContent = contadas.length;
        document.getElementById("repUbicacionesCuadradas").textContent = cuadradasUbicacion.length;
        document.getElementById("repEru").textContent = contadas.length > 0
            ? (Math.round((cuadradasUbicacion.length / contadas.length) * 10000) / 100).toFixed(2) + "%"
            : "-";

        // ERI: por código (SKU) — total contado vs total SAP, sumando
        // en toda la semana (un mismo código puede estar en varias
        // ubicaciones).
        const contadoPorSku = {};

        auditadas.forEach(function(f){
            if(!f.sku){ return; }
            contadoPorSku[f.sku] = (contadoPorSku[f.sku] || 0) + Number(f.conteo_total || 0);
        });

        const sapPorSku = {};

        (sapFilas || []).forEach(function(f){
            if(!f.sku){ return; }
            sapPorSku[f.sku] = (sapPorSku[f.sku] || 0) + Number(f.stock || 0);
        });

        const skusContados = Object.keys(contadoPorSku);
        const skusCuadrados = skusContados.filter(function(sku){ return contadoPorSku[sku] === (sapPorSku[sku] || 0); });

        document.getElementById("repCodigosContados").textContent = skusContados.length;
        document.getElementById("repCodigosCuadrados").textContent = skusCuadrados.length;
        document.getElementById("repEri").textContent = skusContados.length > 0
            ? (Math.round((skusCuadrados.length / skusContados.length) * 10000) / 100).toFixed(2) + "%"
            : "-";

        const umaPorSku = {};

        (maraFilas || []).forEach(function(m){
            if(m.sku){ umaPorSku[String(m.sku).trim()] = m.unidad_base || "-"; }
        });

        // Diferencias, una fila por ubicación con problema — mismo
        // criterio que Discrepancias/Reconteo (código y/o cantidad).
        _catalogoReporteDiferencias = auditadas
            .filter(function(f){ return f.tieneDiferencia; })
            .map(function(f){

                const cantidadSap = f.tieneStockSap ? f.cantidadSap : 0;
                const cantidadContada = f.conteo_total ?? 0;
                const diferencia = cantidadSap - cantidadContada;
                const ubicacion = f.ubicacion_escaneada || "-";
                const codigo = f.vacia ? "-" : (f.sku || "-");
                const claveObs = normalizarTextoAuditoria(ubicacion) + "||" + String(codigo === "-" ? "" : codigo).trim();

                return {
                    pasillo: f.pasillo,
                    ubicacion: ubicacion,
                    codigo: codigo,
                    descripcion: f.descripcion || "-",
                    uma: f.sku ? (umaPorSku[String(f.sku).trim()] || "-") : "-",
                    cantidadSap: cantidadSap,
                    cantidadContada: cantidadContada,
                    diferencia: diferencia,
                    status: diferencia > 0 ? "Faltante" : (diferencia < 0 ? "Sobrante" : "-"),
                    claveObs: claveObs,
                    observacion: _observacionesReporte[claveObs] || ""
                };

            })
            .sort(function(a, b){
                return a.pasillo - b.pasillo || a.ubicacion.localeCompare(b.ubicacion);
            });

        _paginaActualReporte = 1;
        pintarReporteDiferencias();

        const pasillosOrdenados = (pasillosFilas || []).slice().sort(function(a, b){ return a.pasillo - b.pasillo; });

        if(!pasillosOrdenados.length){
            tblInicio.innerHTML = `<tr><td colspan="5" class="sin-datos">Sin pasillos iniciados esta semana.</td></tr>`;
        }else{

            tblInicio.innerHTML = pasillosOrdenados.map(function(p){
                return `
                    <tr>
                        <td>${String(p.pasillo).padStart(2, "0")}</td>
                        <td>${p.colaborador || "-"}</td>
                        <td>${p.hora_inicio ? new Date(p.hora_inicio).toLocaleString("es-PE") : "-"}</td>
                        <td>${p.hora_fin ? new Date(p.hora_fin).toLocaleString("es-PE") : "-"}</td>
                        <td>${p.estado || "-"}</td>
                    </tr>
                `;
            }).join("");

        }

    }catch(e){

        console.error(e);
        tblInicio.innerHTML = `<tr><td colspan="5" class="sin-datos">No se pudo cargar.</td></tr>`;
        tblDiferencias.innerHTML = `<tr><td colspan="9" class="sin-datos">No se pudo cargar.</td></tr>`;

    }

}

function filasFiltradasReporte(){
    return _catalogoReporteDiferencias;
}

function pintarReporteDiferencias(){

    const tbody = document.getElementById("tblReporteDiferencias");
    const paginacion = document.getElementById("paginacionReporteDiferencias");
    const filas = filasFiltradasReporte();

    if(!filas.length){
        tbody.innerHTML = `<tr><td colspan="9" class="sin-datos">Sin diferencias — todo cuadra.</td></tr>`;
        paginacion.innerHTML = "";
        return;
    }

    const totalPaginas = Math.max(1, Math.ceil(filas.length / FILAS_POR_PAGINA_REPORTE));
    _paginaActualReporte = Math.min(_paginaActualReporte, totalPaginas);

    const desde = (_paginaActualReporte - 1) * FILAS_POR_PAGINA_REPORTE;
    const visibles = filas.slice(desde, desde + FILAS_POR_PAGINA_REPORTE);

    tbody.innerHTML = visibles.map(function(f){

        const claseStatus = f.status === "Faltante" ? "status-faltante" : (f.status === "Sobrante" ? "status-sobrante" : "");

        return `
            <tr>
                <td>${f.ubicacion}</td>
                <td>${f.codigo}</td>
                <td>${f.descripcion}</td>
                <td>${f.uma}</td>
                <td>${f.cantidadSap}</td>
                <td>${f.cantidadContada}</td>
                <td>${f.diferencia > 0 ? "+" : ""}${f.diferencia}</td>
                <td class="${claseStatus}">${f.status}</td>
                <td>
                    <div class="celda-observacion">
                        <span>${f.observacion || "-"}</span>
                        <button class="btn-secundario" onclick="editarObservacionReporte('${f.claveObs}')">✎ Editar</button>
                    </div>
                </td>
            </tr>
        `;

    }).join("");

    paginacion.innerHTML = `
        <button ${_paginaActualReporte <= 1 ? "disabled" : ""} onclick="cambiarPaginaReporte(-1)">‹ Anterior</button>
        <span>Página ${_paginaActualReporte} de ${totalPaginas} · ${filas.length} fila(s)</span>
        <button ${_paginaActualReporte >= totalPaginas ? "disabled" : ""} onclick="cambiarPaginaReporte(1)">Siguiente ›</button>
    `;

}

function cambiarPaginaReporte(delta){
    _paginaActualReporte += delta;
    pintarReporteDiferencias();
}

document.getElementById("btnActualizarReporte").addEventListener("click", cargarReporte);

// Arma el mismo reporte que se manda por correo (con tablas y colores,
// no solo texto), para pegarlo directo en el cuerpo de un correo.
function escaparHtml(texto){
    return String(texto)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}

function htmlCopiarReporte(){

    const fechaHoy = new Date().toLocaleDateString("es-PE");

    const codigosContados = document.getElementById("repCodigosContados").textContent;
    const codigosCuadrados = document.getElementById("repCodigosCuadrados").textContent;
    const eri = document.getElementById("repEri").textContent;
    const ubicacionesContadas = document.getElementById("repUbicacionesContadas").textContent;
    const ubicacionesCuadradas = document.getElementById("repUbicacionesCuadradas").textContent;
    const eru = document.getElementById("repEru").textContent;

    const estiloCeldaTitulo = "background:#FC000D;color:#ffffff;font-weight:bold;padding:6px 10px;border:1px solid #ffffff;text-align:center;";
    const estiloCeldaTexto = "background:#ffffff;color:#111827;padding:6px 10px;border:1px solid #d1d5db;";
    const estiloCeldaValor = "background:#ffffff;color:#111827;padding:6px 10px;border:1px solid #d1d5db;text-align:center;";

    const tablaCodigos = `
        <table style="border-collapse:collapse;font-family:Arial,sans-serif;font-size:13px;">
            <tr><td colspan="2" style="${estiloCeldaTitulo}">Códigos</td></tr>
            <tr><td style="${estiloCeldaTexto}">Códigos Contados</td><td style="${estiloCeldaValor}">${codigosContados}</td></tr>
            <tr><td style="${estiloCeldaTexto}">Códigos Cuadrados</td><td style="${estiloCeldaValor}">${codigosCuadrados}</td></tr>
            <tr><td style="${estiloCeldaTitulo}">ERI</td><td style="${estiloCeldaTitulo}">${eri}</td></tr>
        </table>
    `;

    const tablaUbicaciones = `
        <table style="border-collapse:collapse;font-family:Arial,sans-serif;font-size:13px;">
            <tr><td colspan="2" style="${estiloCeldaTitulo}">Ubicaciones</td></tr>
            <tr><td style="${estiloCeldaTexto}">Ubicaciones Contadas</td><td style="${estiloCeldaValor}">${ubicacionesContadas}</td></tr>
            <tr><td style="${estiloCeldaTexto}">Ubicaciones Cuadradas</td><td style="${estiloCeldaValor}">${ubicacionesCuadradas}</td></tr>
            <tr><td style="${estiloCeldaTitulo}">ERU</td><td style="${estiloCeldaTitulo}">${eru}</td></tr>
        </table>
    `;

    const estiloEncabezadoAzul = "background:#4472C4;color:#ffffff;font-weight:bold;padding:6px 8px;border:1px solid #ffffff;text-align:center;";
    const estiloEncabezadoRojo = "background:#FC000D;color:#ffffff;font-weight:bold;padding:6px 8px;border:1px solid #ffffff;text-align:center;";
    const estiloEncabezadoVerde = "background:#2e7d32;color:#ffffff;font-weight:bold;padding:6px 8px;border:1px solid #ffffff;text-align:center;";
    const estiloCeldaFila = "background:#ffffff;color:#111827;padding:6px 8px;border:1px solid #d1d5db;font-family:Arial,sans-serif;font-size:12px;";

    const filasDiferencias = !_catalogoReporteDiferencias.length
        ? `<tr><td colspan="9" style="${estiloCeldaFila}text-align:center;">Sin diferencias — todo cuadra.</td></tr>`
        : _catalogoReporteDiferencias.map(function(f){
            const diferenciaTexto = (f.diferencia > 0 ? "+" : "") + f.diferencia;
            const colorStatus = f.status === "Sobrante" ? "#FFF176" : (f.status === "Faltante" ? "#FFB74D" : "#ffffff");
            return `
                <tr>
                    <td style="${estiloCeldaFila}">${escaparHtml(f.ubicacion)}</td>
                    <td style="${estiloCeldaFila}">${escaparHtml(f.codigo)}</td>
                    <td style="${estiloCeldaFila}">${escaparHtml(f.descripcion)}</td>
                    <td style="${estiloCeldaFila}text-align:center;">${escaparHtml(f.uma)}</td>
                    <td style="${estiloCeldaFila}text-align:center;">${escaparHtml(f.cantidadSap)}</td>
                    <td style="${estiloCeldaFila}text-align:center;">${escaparHtml(f.cantidadContada)}</td>
                    <td style="${estiloCeldaFila}text-align:center;">${escaparHtml(diferenciaTexto)}</td>
                    <td style="${estiloCeldaFila}text-align:center;background:${colorStatus};font-weight:bold;">${escaparHtml(f.status)}</td>
                    <td style="${estiloCeldaFila}">${escaparHtml(f.observacion ? f.observacion : "Sin observaciones")}</td>
                </tr>
            `;
        }).join("");

    return `
        <div style="font-family:Arial,sans-serif;">
            <p style="font-size:14px;color:#111827;">
                <b>Equipo buenos días,</b><br>
                Se envía el resultado del inventario del turno día de la fecha ${fechaHoy}.
            </p>

            <table style="border-collapse:separate;border-spacing:20px 0;">
                <tr>
                    <td style="vertical-align:top;padding:0;">${tablaCodigos}</td>
                    <td style="vertical-align:top;padding:0;">${tablaUbicaciones}</td>
                </tr>
            </table>

            <p style="font-size:14px;color:#111827;"><b><i>Observación:</i></b></p>

            <table style="border-collapse:collapse;width:100%;">
                <thead>
                    <tr>
                        <th style="${estiloEncabezadoAzul}">Ubicación</th>
                        <th style="${estiloEncabezadoAzul}">Código</th>
                        <th style="${estiloEncabezadoAzul}">Descripción</th>
                        <th style="${estiloEncabezadoAzul}">UMA</th>
                        <th style="${estiloEncabezadoAzul}">Cant. SAP</th>
                        <th style="${estiloEncabezadoAzul}">Cant. Contado</th>
                        <th style="${estiloEncabezadoRojo}">Diferencia</th>
                        <th style="${estiloEncabezadoAzul}">Status</th>
                        <th style="${estiloEncabezadoVerde}">Observación</th>
                    </tr>
                </thead>
                <tbody>
                    ${filasDiferencias}
                </tbody>
            </table>
        </div>
    `;

}

// Versión en texto plano, como respaldo por si el destino no acepta HTML.
function textoCopiarReporte(){

    const semana = document.getElementById("semanaTextoReporte").textContent;

    const lineas = [];

    lineas.push("REPORTE INVENTARIO DE PICKING — SEMANA " + semana);
    lineas.push("");
    lineas.push("CÓDIGOS");
    lineas.push("Códigos Contados: " + document.getElementById("repCodigosContados").textContent);
    lineas.push("Códigos Cuadrados: " + document.getElementById("repCodigosCuadrados").textContent);
    lineas.push("ERI: " + document.getElementById("repEri").textContent);
    lineas.push("");
    lineas.push("UBICACIONES");
    lineas.push("Ubicaciones Contadas: " + document.getElementById("repUbicacionesContadas").textContent);
    lineas.push("Ubicaciones Cuadradas: " + document.getElementById("repUbicacionesCuadradas").textContent);
    lineas.push("ERU: " + document.getElementById("repEru").textContent);
    lineas.push("");
    lineas.push("OBSERVACIONES");

    if(!_catalogoReporteDiferencias.length){
        lineas.push("Sin diferencias — todo cuadra.");
    } else {
        _catalogoReporteDiferencias.forEach(function(f){
            const diferenciaTexto = (f.diferencia > 0 ? "+" : "") + f.diferencia;
            lineas.push(
                f.ubicacion + " · " + f.codigo + " · " + f.descripcion + " · " + f.uma +
                " · Cant. SAP: " + f.cantidadSap + " · Cant. Contado: " + f.cantidadContada +
                " · Diferencia: " + diferenciaTexto + " · " + f.status +
                " · Observación: " + (f.observacion ? f.observacion : "Sin observaciones")
            );
        });
    }

    return lineas.join("\n");

}

document.getElementById("btnCopiarReporte").addEventListener("click", async function(){

    const boton = document.getElementById("btnCopiarReporte");
    const textoOriginal = boton.textContent;

    try{
        const html = htmlCopiarReporte();
        const texto = textoCopiarReporte();

        if(window.ClipboardItem){
            await navigator.clipboard.write([
                new ClipboardItem({
                    "text/html": new Blob([html], { type: "text/html" }),
                    "text/plain": new Blob([texto], { type: "text/plain" })
                })
            ]);
        } else {
            await navigator.clipboard.writeText(texto);
        }

        boton.textContent = "✓ Copiado";
    } catch(e){
        console.error(e);
        boton.textContent = "✗ No se pudo copiar";
    }

    setTimeout(function(){ boton.textContent = textoOriginal; }, 1800);

});

// Observación es manual — la plataforma no tiene los datos de viajes/
// HU de planta para calcularla sola. Se guarda por (semana, ubicación,
// código) en picking_reporte_observaciones.
async function editarObservacionReporte(clave){

    const fila = _catalogoReporteDiferencias.find(function(f){ return f.claveObs === clave; });

    if(!fila){
        return;
    }

    const texto = await pedirTexto("Observación para " + fila.ubicacion + " · " + fila.codigo + ":", fila.observacion || "");

    if(texto === null){
        return;
    }

    const partes = clave.split("||");

    try{

        await supabaseFetch("/picking_reporte_observaciones?on_conflict=semana,ubicacion,sku", {
            method: "POST",
            headers: { "Prefer": "resolution=merge-duplicates" },
            body: JSON.stringify({
                semana: SEMANA,
                ubicacion: partes[0],
                sku: partes[1],
                observacion: texto,
                actualizado_por: (sesion && sesion.nombre_completo) || null,
                actualizado_en: new Date().toISOString()
            })
        });

        _observacionesReporte[clave] = texto;

        _catalogoReporteDiferencias.forEach(function(f){
            if(f.claveObs === clave){ f.observacion = texto; }
        });

        pintarReporteDiferencias();
        mostrarToast("Observación guardada.", "exito");

    }catch(err){

        console.error(err);
        mostrarToast("No se pudo guardar la observación: " + err.message, "error");

    }

}

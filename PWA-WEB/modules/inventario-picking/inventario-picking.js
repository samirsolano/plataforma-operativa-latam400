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

        if(link.dataset.tab === "tabUbicaciones" && !_ubicacionesCargadasAlMenosUnaVez){
            cargarUbicaciones();
        }

        if(link.dataset.tab === "tabMara" && !_maraPickingCargadaAlMenosUnaVez){
            cargarMaraPicking();
        }

        if(link.dataset.tab === "tabDiscrepancias"){
            cargarDiscrepancias();
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


// ========================================
// TAB 1: ASIGNACIÓN DE PASILLOS
// ========================================

async function cargarAsignacion(){

    const tbody = document.getElementById("tblAsignacion");
    tbody.innerHTML = `<tr><td colspan="4" class="sin-datos">Cargando pasillos...</td></tr>`;

    try{

        const [ubicacionesFilas, conteoFilas, pasillosFilas] = await Promise.all([
            supabaseFetchTodo("/picking_ubicaciones?select=pasillo"),
            supabaseFetchTodo("/picking_conteos?select=pasillo&semana=eq." + SEMANA + "&es_reconteo=eq.false"),
            supabaseFetch("/picking_pasillos?select=pasillo,colaborador,estado&semana=eq." + SEMANA).catch(function(e){
                console.error(e);
                return [];
            })
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

        (pasillosFilas || []).forEach(function(a){
            if(a.colaborador){ colaboradorPorPasillo[a.pasillo] = a.colaborador; }
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
            const total = totalPorPasillo[p] || 0;
            const registrado = Math.min(registradoPorPasillo[p] || 0, total);
            const porcentaje = total > 0 ? Math.round((registrado / total) * 100) : 0;

            sumaPorcentajes += porcentaje;

            let estado = "sin-asignar";
            let estadoTexto = "Sin iniciar";

            if(porcentaje >= 100){
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
                <td>${colaborador || "-"}</td>
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
// TAB: UBICACIONES DE PICKING (lista maestra)
// ========================================

let _ubicacionesCargadasAlMenosUnaVez = false;
let _catalogoUbicaciones = [];
let _paginaActualUbicaciones = 1;
const FILAS_POR_PAGINA_UBICACIONES = 50;

async function cargarUbicaciones(){

    const tbody = document.getElementById("tblUbicaciones");
    tbody.innerHTML = `<tr><td colspan="5" class="sin-datos">Cargando...</td></tr>`;

    try{

        _catalogoUbicaciones = await supabaseFetchTodo("/picking_ubicaciones?select=*&order=pasillo.asc,columna.asc");
        _ubicacionesCargadasAlMenosUnaVez = true;
        _paginaActualUbicaciones = 1;
        pintarUbicaciones();

    }catch(e){

        console.error(e);
        tbody.innerHTML = `<tr><td colspan="5" class="sin-datos">No se pudo cargar la lista.</td></tr>`;

    }

}

function pintarUbicaciones(){

    const tbody = document.getElementById("tblUbicaciones");
    const paginacion = document.getElementById("paginacionUbicaciones");

    if(!_catalogoUbicaciones.length){
        tbody.innerHTML = `<tr><td colspan="5" class="sin-datos">Sin ubicaciones cargadas.</td></tr>`;
        paginacion.innerHTML = "";
        return;
    }

    const totalPaginas = Math.max(1, Math.ceil(_catalogoUbicaciones.length / FILAS_POR_PAGINA_UBICACIONES));
    _paginaActualUbicaciones = Math.min(_paginaActualUbicaciones, totalPaginas);

    const desde = (_paginaActualUbicaciones - 1) * FILAS_POR_PAGINA_UBICACIONES;
    const visibles = _catalogoUbicaciones.slice(desde, desde + FILAS_POR_PAGINA_UBICACIONES);

    tbody.innerHTML = visibles.map(function(u){
        return `
            <tr>
                <td>${u.ubicacion}</td>
                <td>${String(u.pasillo).padStart(2, "0")}</td>
                <td>${u.columna}</td>
                <td>${u.nivel || "-"}</td>
                <td>${u.tipo_almacen || "-"}</td>
            </tr>
        `;
    }).join("");

    paginacion.innerHTML = `
        <button ${_paginaActualUbicaciones <= 1 ? "disabled" : ""} onclick="cambiarPaginaUbicaciones(-1)">‹ Anterior</button>
        <span>Página ${_paginaActualUbicaciones} de ${totalPaginas} · ${_catalogoUbicaciones.length} ubicación(es)</span>
        <button ${_paginaActualUbicaciones >= totalPaginas ? "disabled" : ""} onclick="cambiarPaginaUbicaciones(1)">Siguiente ›</button>
    `;

}

function cambiarPaginaUbicaciones(delta){
    _paginaActualUbicaciones += delta;
    pintarUbicaciones();
}

const ALIAS_COLUMNAS_UBICACIONES = {
    ubicacion: ["ubicacion"],
    tipo_almacen: ["tipo almacen"],
    area: ["area almacenamiento"],
    tipo_ubicacion: ["tipo de ubicacion"],
    tp_acceso: ["tp.acceso ubicacion", "tp acceso ubicacion"],
    pasillo: ["pasillo de ubicacion"],
    columna: ["columna ubicacion"],
    nivel: ["nivel de ubicacion"]
};

document.getElementById("archivoUbicaciones").addEventListener("change", async function(e){

    const archivo = e.target.files[0];
    if(!archivo){ return; }

    const estadoEl = document.getElementById("estadoCargaUbicaciones");
    estadoEl.textContent = "Leyendo " + archivo.name + "...";

    try{

        const buffer = await archivo.arrayBuffer();
        const libro = XLSX.read(buffer, { type: "array" });
        const hoja = libro.Sheets[libro.SheetNames[0]];
        const filas = XLSX.utils.sheet_to_json(hoja, { defval: "" });

        if(!filas.length){
            mostrarToast("El archivo no tiene filas.", "error");
            estadoEl.textContent = "";
            return;
        }

        const encabezadosReales = Object.keys(filas[0]);
        const mapaColumnas = {};

        Object.keys(ALIAS_COLUMNAS_UBICACIONES).forEach(function(campo){

            const alias = ALIAS_COLUMNAS_UBICACIONES[campo];

            const encontrado = encabezadosReales.find(function(h){
                return alias.includes(normalizarEncabezadoMaraPicking(h));
            });

            mapaColumnas[campo] = encontrado || null;

        });

        if(!mapaColumnas.ubicacion || !mapaColumnas.pasillo || !mapaColumnas.columna){
            mostrarToast("No se encontraron las columnas Ubicación/Pasillo/Columna en el archivo.", "error");
            estadoEl.textContent = "";
            return;
        }

        const registrosCrudos = filas.map(function(f){

            const ubicacion = String(f[mapaColumnas.ubicacion] || "").trim().toUpperCase();
            const pasillo = Number(f[mapaColumnas.pasillo]);
            const columna = Number(f[mapaColumnas.columna]);

            if(!ubicacion || isNaN(pasillo) || isNaN(columna)){
                return null;
            }

            return {
                ubicacion: ubicacion,
                pasillo: pasillo,
                columna: columna,
                nivel: mapaColumnas.nivel ? String(f[mapaColumnas.nivel] || "").trim() : null,
                tipo_almacen: mapaColumnas.tipo_almacen ? String(f[mapaColumnas.tipo_almacen] || "").trim() : null,
                area: mapaColumnas.area ? String(f[mapaColumnas.area] || "").trim() : null,
                tipo_ubicacion: mapaColumnas.tipo_ubicacion ? String(f[mapaColumnas.tipo_ubicacion] || "").trim() : null,
                tp_acceso: mapaColumnas.tp_acceso ? String(f[mapaColumnas.tp_acceso] || "").trim() : null
            };

        }).filter(Boolean);

        const porUbicacion = new Map();
        registrosCrudos.forEach(function(r){ porUbicacion.set(r.ubicacion, r); });
        const registros = [...porUbicacion.values()];

        if(!registros.length){
            mostrarToast("No se encontraron filas válidas.", "error");
            estadoEl.textContent = "";
            return;
        }

        const TAMANO_BLOQUE = 500;

        for(let i = 0; i < registros.length; i += TAMANO_BLOQUE){

            const bloque = registros.slice(i, i + TAMANO_BLOQUE);

            await supabaseFetch("/picking_ubicaciones?on_conflict=ubicacion", {
                method: "POST",
                headers: { "Prefer": "resolution=merge-duplicates" },
                body: JSON.stringify(bloque)
            });

        }

        estadoEl.textContent = "✓ Cargado: " + registros.length.toLocaleString("es-PE") + " ubicación(es).";
        mostrarToast(registros.length + " ubicación(es) cargada(s)/actualizada(s).", "exito");

        document.getElementById("archivoUbicaciones").value = "";
        await cargarUbicaciones();
        await cargarAsignacion();

    }catch(err){

        console.error(err);
        mostrarToast("No se pudo procesar el archivo.", "error");
        estadoEl.textContent = "";

    }

});

document.getElementById("btnBorrarUbicaciones").addEventListener("click", async function(){

    const btn = document.getElementById("btnBorrarUbicaciones");

    const confirmado = confirm(
        "Esto borra TODA la lista de Ubicaciones de Picking. Los pasillos dejarán de aparecer en " +
        "Centro de Proyectos hasta que se vuelva a cargar. No se puede deshacer.\n\n¿Continuar?"
    );

    if(!confirmado){ return; }

    btn.disabled = true;
    btn.textContent = "Borrando...";

    try{

        await supabaseFetch("/picking_ubicaciones?ubicacion=not.is.null", { method: "DELETE" });

        mostrarToast("Ubicaciones de Picking borradas.", "exito");
        document.getElementById("estadoCargaUbicaciones").textContent = "";
        await cargarUbicaciones();
        await cargarAsignacion();

    }catch(err){

        console.error(err);
        mostrarToast("No se pudo borrar: " + err.message, "error");

    }finally{

        btn.disabled = false;
        btn.textContent = "🗑 Borrar Todo";

    }

});

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

    if(!confirm("¿Eliminar el producto " + sku + " del Catálogo MARA Picking?")){
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

        estadoEl.textContent = "✓ Cargado: " + registros.length.toLocaleString("es-PE") + " filas de " + archivo.name + ".";
        mostrarToast("Saldo SAP cargado: " + registros.length.toLocaleString("es-PE") + " filas.", "exito");

        document.getElementById("archivoSapPicking").value = "";

    }catch(err){

        console.error(err);
        mostrarToast("No se pudo cargar el archivo: " + err.message, "error");
        estadoEl.textContent = "";

    }

});

document.getElementById("btnBorrarSap").addEventListener("click", async function(){

    const btn = document.getElementById("btnBorrarSap");

    const confirmado = confirm(
        "Esto borra TODO el saldo SAP cargado en Inventario Picking. No se puede deshacer.\n\n¿Continuar?"
    );

    if(!confirmado){ return; }

    const escrito = prompt('Para confirmar, escribe BORRAR (en mayúsculas):');

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
        tbody.innerHTML = `<tr><td colspan="7" class="sin-datos">Sin ubicaciones auditadas todavía.</td></tr>`;
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

document.getElementById("buscadorAuditoria").addEventListener("input", function(){
    _paginaActualAuditoria = 1;
    pintarAuditoria();
});

async function cargarDiscrepancias(){

    const tblAuditoria = document.getElementById("tblAuditoria");
    const tblDiferencias = document.getElementById("tblDiferenciasStock");

    tblAuditoria.innerHTML = `<tr><td colspan="7" class="sin-datos">Cargando...</td></tr>`;
    tblDiferencias.innerHTML = `<tr><td colspan="5" class="sin-datos">Cargando...</td></tr>`;

    try{

        const [conteoFilas, sapFilas] = await Promise.all([
            supabaseFetchTodo(
                "/picking_conteos?select=pasillo,sku,descripcion,ubicacion_escaneada,ubicacion_esperada,colaborador,cruce,conteo_total,vacia,es_reconteo" +
                "&semana=eq." + SEMANA
            ),
            supabaseFetchTodo("/picking_sap_stock?select=sku,descripcion,stock,ubicacion")
        ]);

        // El % de avance/exactitud y la tabla de auditoría solo miran
        // el conteo normal — un reconteo es una verificación aparte,
        // no una ubicación nueva.
        const normales = (conteoFilas || []).filter(function(f){ return !f.es_reconteo; });

        // KPIs generales (equivalente a "Eri Eru"/Dashboard de la
        // plantilla original): códigos únicos contados, cuántos
        // cuadraron (Cruce = OK), y % de exactitud.
        const skusContados = new Set(normales.map(f => f.sku).filter(Boolean));
        const errores = normales.filter(f => f.cruce === "ERROR");
        const skusConError = new Set(errores.map(f => f.sku).filter(Boolean));
        const skusCuadrados = [...skusContados].filter(sku => !skusConError.has(sku));

        document.getElementById("kpiCodigosContados").textContent = skusContados.size;
        document.getElementById("kpiCodigosCuadrados").textContent = skusCuadrados.length;
        document.getElementById("kpiErroresUbicacion").textContent = errores.length;
        document.getElementById("kpiExactitud").textContent = skusContados.size > 0
            ? Math.round((skusCuadrados.length / skusContados.size) * 100) + "%"
            : "-";

        // Código SAP esperado por ubicación (puede haber más de un
        // código registrado en la misma ubicación).
        const sapPorUbicacion = {};

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

        });

        _catalogoAuditoria = normales.map(function(f){

            const ubicacion = f.ubicacion_escaneada || "-";
            const codigoSap = sapPorUbicacion[normalizarTextoAuditoria(ubicacion)] || [];

            let estado = "Cuadrada";
            let claseEstado = "cuadrada";

            if(f.vacia){
                estado = "Ubicación Vacía";
                claseEstado = "vacia";
            }else if(f.cruce === "ERROR"){
                estado = "Segundo Conteo";
                claseEstado = "segundo-conteo";
            }

            return {
                pasillo: f.pasillo,
                ubicacion: ubicacion,
                codigoSap: codigoSap.join(" / ") || "-",
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

        // Contado vs SAP, por SKU
        const contadoPorSku = {};
        const descripcionPorSku = {};

        normales.forEach(function(f){
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

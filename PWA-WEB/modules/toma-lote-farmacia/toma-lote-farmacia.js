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
// SESIÓN Y PERMISOS
// ========================================
// Solo el rol Administrador puede ver este módulo.

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
// TABS (links del sidebar)
// ========================================

document.querySelectorAll(".tab-link").forEach(function(link){

    link.addEventListener("click", function(e){

        e.preventDefault();

        document.querySelectorAll(".tab-link").forEach(function(l){
            l.classList.remove("activo");
        });

        document.querySelectorAll(".tab-contenido").forEach(function(c){
            c.classList.add("oculto");
        });

        link.classList.add("activo");
        document.getElementById(link.dataset.tab).classList.remove("oculto");

        if(link.dataset.tab === "tabLecturas"){
            cargarViajesParaFiltro();
        }

        if(link.dataset.tab === "tabMara"){
            cargarResumenExistenteMara();
            buscarMara();
        }

        if(link.dataset.tab === "tabOcPortal"){
            cargarOcsParaSubir();
            cargarResumenExistenteOcPortal();
            buscarOcPortal();
        }

        if(link.dataset.tab === "tabMaraAlicorp"){
            cargarResumenExistenteAlicorp();
            buscarAlicorp();
        }

        if(link.dataset.tab === "tabStockFisico"){
            cargarViajesParaStock();
            cargarViajesFiltroStock();
            buscarStock();
        }

    });

});

// ========================================
// DESCARGAR PLANTILLA
// ========================================

document.getElementById("btnDescargarPlantilla").addEventListener("click", function(){

    const encabezados = [
        "VIAJE", "ORDEN DE COMPRA", "ENTREGA", "N° CITA",
        "CODIGO/SKU", "DESCRIPCION", "UN", "CANTIDAD SOLICITADA"
    ];

    const filasEjemplo = [
        [1000150787, 1000427525, 85758703, 324837, "8301101", "CEP DENTO PREMIUM GRAB RT MED.14UND 6DSP", "CJA", 36],
        [1000150787, 1000427525, 85758703, 324837, "8301123", "ENJ.BUCAL DENTO XTRA COOL 500ML 12UND", "CJA", 6],
        [1000150787, 1000427526, 85758704, 324840, "8301102", "CEP DENTO PREMIUM GRAB RT DUR.14UND 6DSP", "CJA", 25]
    ];

    const hoja = XLSX.utils.aoa_to_sheet([encabezados, ...filasEjemplo]);
    const libro = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(libro, hoja, "TOMA DE LOTE FARMACIA");

    XLSX.writeFile(libro, "PLANTILLA_TOMA_LOTE_FARMACIA.xlsx");

});

// ========================================
// CARGA DE LA PLANTILLA
// ========================================
// Encabezados únicos (a diferencia de Modulación de Supermercados), así
// que se puede leer por nombre de columna directamente.

const archivoFarmacia = document.getElementById("archivoFarmacia");
const nombreArchivo = document.getElementById("nombreArchivo");
const fechaArchivo = document.getElementById("fechaArchivo");

const COLUMNAS_ESPERADAS_FARMACIA = [
    "viaje", "orden de compra", "entrega", "n° cita",
    "codigo/sku", "descripcion", "un", "cantidad solicitada"
];

async function leerFilasFarmaciaExcel(archivo){

    const buffer = await archivo.arrayBuffer();
    const libro = XLSX.read(buffer, { type: "array" });

    const hoja = libro.Sheets[libro.SheetNames[0]];

    return XLSX.utils.sheet_to_json(hoja, { defval: "" });

}

function validarFormatoFarmacia(filasCrudas){

    if(!filasCrudas.length){
        return "El archivo está vacío.";
    }

    const columnasArchivo = Object.keys(filasCrudas[0]).map(c => c.trim().toLowerCase());

    const faltantes = COLUMNAS_ESPERADAS_FARMACIA.filter(
        esperada => !columnasArchivo.includes(esperada)
    );

    if(faltantes.length){
        return "Este archivo no tiene el formato de la plantilla de Farmacia. Faltan las columnas: " +
            faltantes.join(", ") + ".";
    }

    return null;

}

function normalizarFilaFarmacia(filaOriginal, archivo, cargadoPor){

    const mapaFila = {};

    Object.keys(filaOriginal).forEach(function(clave){
        mapaFila[clave.trim().toLowerCase()] = filaOriginal[clave];
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

    return {
        viaje: num("viaje"),
        orden_compra: num("orden de compra"),
        entrega: num("entrega"),
        n_cita: num("n° cita"),
        codigo: texto("codigo/sku"),
        descripcion: texto("descripcion"),
        un: texto("un"),
        cantidad: num("cantidad solicitada") || 0,
        archivo_origen: archivo,
        cargado_por: cargadoPor
    };

}

async function guardarEnBloques(tabla, filas){

    const TAMANO_BLOQUE = 200;

    for(let i = 0; i < filas.length; i += TAMANO_BLOQUE){

        const bloque = filas.slice(i, i + TAMANO_BLOQUE);

        await supabaseFetch("/" + tabla, {
            method: "POST",
            body: JSON.stringify(bloque)
        });

    }

}

archivoFarmacia.addEventListener("change", async function(e){

    const archivo = e.target.files[0];

    if(!archivo){
        return;
    }

    nombreArchivo.textContent = "Leyendo " + archivo.name + "...";

    try{

        const filasCrudas = await leerFilasFarmaciaExcel(archivo);

        const errorFormato = validarFormatoFarmacia(filasCrudas);

        if(errorFormato){
            mostrarToast(errorFormato, "error");
            nombreArchivo.textContent = "-";
            archivoFarmacia.value = "";
            return;
        }

        const cargadoPor = (sesion && (sesion.nombre_completo || sesion.usuario)) || "";

        const filasNormalizadas = filasCrudas
            .map(f => normalizarFilaFarmacia(f, archivo.name, cargadoPor))
            .filter(f => f.viaje !== null && f.codigo);

        if(!filasNormalizadas.length){
            mostrarToast("No se encontraron filas válidas en el archivo (revisa columnas VIAJE y CODIGO/SKU).", "error");
            nombreArchivo.textContent = "-";
            archivoFarmacia.value = "";
            return;
        }

        const existentes = await supabaseFetch("/farmacia_data?select=id&limit=1");

        if(existentes && existentes.length){

            const confirmado = confirm(
                "Ya hay datos de Toma de Lote Farmacia cargados. ¿Deseas reemplazarlos con este archivo (" +
                filasNormalizadas.length + " filas)?"
            );

            if(!confirmado){
                nombreArchivo.textContent = "-";
                archivoFarmacia.value = "";
                return;
            }

            await supabaseFetch("/farmacia_data?id=gt.0", { method: "DELETE" });

        }

        nombreArchivo.textContent = "Guardando " + archivo.name + "...";

        await guardarEnBloques("farmacia_data", filasNormalizadas);

        nombreArchivo.textContent = archivo.name;
        fechaArchivo.textContent = new Date().toLocaleDateString("es-PE");

        document.getElementById("totalRegistros").textContent =
            filasNormalizadas.length.toLocaleString("es-PE");

        const viajesUnicos = [...new Set(filasNormalizadas.map(f => f.viaje))];

        document.getElementById("totalViajes").textContent =
            viajesUnicos.length.toLocaleString("es-PE");

        mostrarToast("Plantilla cargada: " + filasNormalizadas.length + " filas.", "exito");

        refrescarVistaViajes();

    }catch(err){

        console.error(err);
        mostrarToast("No se pudo cargar el archivo: " + err.message, "error");
        nombreArchivo.textContent = "-";
        archivoFarmacia.value = "";

    }

});

// ========================================
// VIAJES GENERADOS
// ========================================

function formatearNumeroFarmacia(n){
    return Number(n || 0).toLocaleString("es-PE", { maximumFractionDigits: 2 });
}

function cargarViajesReales(filas, activadosSet){

    activadosSet = activadosSet || new Set();

    const porViaje = {};

    filas.forEach(function(f){

        const clave = f.viaje;
        if(clave === null || clave === undefined){
            return;
        }

        if(!porViaje[clave]){
            porViaje[clave] = { viaje: clave, ocs: new Set(), codigos: 0, cantidad: 0 };
        }

        if(f.orden_compra !== null && f.orden_compra !== undefined){
            porViaje[clave].ocs.add(f.orden_compra);
        }

        porViaje[clave].codigos++;
        porViaje[clave].cantidad += Number(f.cantidad || 0);

    });

    const viajes = Object.values(porViaje).sort((a, b) => a.viaje - b.viaje);

    const tbody = document.getElementById("tblViajes");
    tbody.innerHTML = "";

    if(!viajes.length){
        tbody.innerHTML = `<tr><td colspan="6" class="sin-datos">Sube la plantilla para ver los viajes.</td></tr>`;
        return;
    }

    viajes.forEach(function(v){

        const tr = document.createElement("tr");

        const yaActivado = activadosSet.has(v.viaje);

        const estadoTexto = yaActivado ? "Activado" : "Disponible";
        const estadoClase = yaActivado ? "activado" : "disponible";

        const accion = yaActivado
            ? "✓ Activado"
            : '<button class="btn-activar" data-viaje="' + v.viaje + '">Activar</button>';

        tr.innerHTML = `
            <td>${v.viaje}</td>
            <td>${v.ocs.size}</td>
            <td>${v.codigos}</td>
            <td>${formatearNumeroFarmacia(v.cantidad)}</td>
            <td><span class="estado ${estadoClase}">${estadoTexto}</span></td>
            <td>${accion}</td>
        `;

        tbody.appendChild(tr);

    });

}

document.getElementById("tblViajes").addEventListener("click", async function(e){

    const boton = e.target.closest(".btn-activar");
    if(!boton){
        return;
    }

    const viaje = Number(boton.dataset.viaje);

    boton.disabled = true;
    boton.textContent = "Activando...";

    try{

        await supabaseFetch("/farmacia_viajes_activados?on_conflict=viaje", {
            method: "POST",
            headers: { "Prefer": "resolution=merge-duplicates" },
            body: JSON.stringify({
                viaje: viaje,
                activado_por: (sesion && (sesion.nombre_completo || sesion.usuario)) || ""
            })
        });

        mostrarToast("Viaje " + viaje + " activado.", "exito");

        await refrescarVistaViajes();

    }catch(err){

        console.error(err);
        mostrarToast("No se pudo activar el viaje: " + err.message, "error");
        boton.disabled = false;
        boton.textContent = "Activar";

    }

});

async function obtenerViajesActivadosFarmacia(){

    try{

        const filas = await supabaseFetch("/farmacia_viajes_activados?select=viaje");
        return new Set((filas || []).map(f => f.viaje));

    }catch(e){
        console.error(e);
        return new Set();
    }

}

async function refrescarVistaViajes(){

    const filas = await supabaseFetch(
        "/farmacia_data?select=viaje,orden_compra,cantidad"
    );

    if(!filas || !filas.length){
        cargarViajesReales([]);
        return;
    }

    const activados = await obtenerViajesActivadosFarmacia();

    cargarViajesReales(filas, activados);

}

// ========================================
// CARGAR RESUMEN YA EXISTENTE (al abrir la página)
// ========================================

async function cargarResumenExistente(){

    try{

        const filas = await supabaseFetch(
            "/farmacia_data?select=viaje,orden_compra,cantidad,archivo_origen,created_at&order=created_at.desc"
        );

        if(!filas || !filas.length){
            return;
        }

        document.getElementById("totalRegistros").textContent =
            filas.length.toLocaleString("es-PE");

        const viajesUnicos = [...new Set(filas.map(f => f.viaje))];

        document.getElementById("totalViajes").textContent =
            viajesUnicos.length.toLocaleString("es-PE");

        nombreArchivo.textContent = filas[0].archivo_origen || "-";
        fechaArchivo.textContent = new Date(filas[0].created_at).toLocaleDateString("es-PE");

        const activados = await obtenerViajesActivadosFarmacia();

        cargarViajesReales(filas, activados);

    }catch(e){
        console.error(e);
    }

}

cargarResumenExistente();

// ========================================
// LECTURAS Y EVIDENCIAS
// ========================================

let _viajesLecturasCargados = false;
let _ultimasLecturas = [];

async function cargarViajesParaFiltro(){

    if(_viajesLecturasCargados){
        return;
    }

    try{

        const filas = await supabaseFetch("/farmacia_data?select=viaje");

        const viajes = [...new Set((filas || []).map(f => f.viaje))]
            .filter(v => v !== null && v !== undefined)
            .sort((a, b) => a - b);

        const cmb = document.getElementById("cmbViajeLecturas");

        viajes.forEach(function(v){
            const option = document.createElement("option");
            option.value = String(v);
            option.textContent = String(v);
            cmb.appendChild(option);
        });

        _viajesLecturasCargados = true;

    }catch(e){
        console.error(e);
    }

}

function formatearFechaHoraLecturas(iso){

    if(!iso){
        return "-";
    }

    return new Date(iso).toLocaleString("es-PE", {
        day: "2-digit", month: "2-digit", year: "numeric",
        hour: "2-digit", minute: "2-digit"
    });

}

async function buscarLecturas(){

    const viaje = document.getElementById("cmbViajeLecturas").value;
    const codigo = document.getElementById("filtroCodigo").value.trim();
    const lote = document.getElementById("filtroLote").value.trim();

    const tbody = document.getElementById("tblLecturas");
    tbody.innerHTML = `<tr><td colspan="10" class="sin-datos">Buscando...</td></tr>`;

    try{

        let ruta = "/farmacia_lecturas?select=viaje,oc,codigo,descripcion,lote,fv,cantidad_cajas,escaneado_por,foto_url,created_at&order=created_at.desc";

        if(viaje){
            ruta += "&viaje=eq." + viaje;
        }

        if(codigo){
            ruta += "&codigo=ilike.*" + encodeURIComponent(codigo) + "*";
        }

        if(lote){
            ruta += "&lote=ilike.*" + encodeURIComponent(lote) + "*";
        }

        const filas = await supabaseFetch(ruta);

        _ultimasLecturas = filas || [];

        tbody.innerHTML = "";

        if(!_ultimasLecturas.length){
            tbody.innerHTML = `<tr><td colspan="10" class="sin-datos">No se encontraron lecturas con esos filtros.</td></tr>`;
            return;
        }

        _ultimasLecturas.forEach(function(f){

            const tr = document.createElement("tr");

            const accionFoto = f.foto_url
                ? '<button class="btn-ver-foto" data-foto="' + f.foto_url.replace(/"/g, "&quot;") + '">Ver Foto</button>'
                : '<span class="sin-foto">Sin foto</span>';

            tr.innerHTML = `
                <td>${f.viaje}</td>
                <td>${f.oc}</td>
                <td>${f.codigo}</td>
                <td>${f.descripcion || "-"}</td>
                <td>${f.lote || "-"}</td>
                <td>${f.fv || "-"}</td>
                <td>${formatearNumeroFarmacia(f.cantidad_cajas)}</td>
                <td>${f.escaneado_por || "-"}</td>
                <td>${formatearFechaHoraLecturas(f.created_at)}</td>
                <td>${accionFoto}</td>
            `;

            tbody.appendChild(tr);

        });

    }catch(e){

        console.error(e);
        tbody.innerHTML = `<tr><td colspan="10" class="sin-datos">No se pudo cargar las lecturas.</td></tr>`;

    }

}

document.getElementById("btnBuscarLecturas").addEventListener("click", buscarLecturas);

document.getElementById("tblLecturas").addEventListener("click", function(e){

    const boton = e.target.closest(".btn-ver-foto");
    if(!boton){
        return;
    }

    document.getElementById("modalFotoImg").src = boton.dataset.foto;
    document.getElementById("modalFoto").classList.remove("oculto");

});

function cerrarModalFoto(){
    document.getElementById("modalFoto").classList.add("oculto");
    document.getElementById("modalFotoImg").src = "";
}

document.getElementById("btnCerrarModalFoto").addEventListener("click", cerrarModalFoto);
document.getElementById("modalFotoFondo").addEventListener("click", cerrarModalFoto);

document.getElementById("btnExportarLecturas").addEventListener("click", async function(){

    if(!_ultimasLecturas.length){
        mostrarToast("Busca lecturas antes de exportar.", "error");
        return;
    }

    const encabezados = [
        "Viaje", "OC", "Código", "Descripción", "Lote", "F.V.",
        "Cantidad de Cajas", "Escaneado por", "Fecha", "URL Foto"
    ];

    const filas = _ultimasLecturas.map(function(f){
        return [
            String(f.viaje), String(f.oc), f.codigo, f.descripcion || "",
            f.lote || "", f.fv || "", String(f.cantidad_cajas || 0),
            f.escaneado_por || "", formatearFechaHoraLecturas(f.created_at), f.foto_url || ""
        ];
    });

    const hoja = XLSX.utils.aoa_to_sheet([encabezados, ...filas]);
    const libro = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(libro, hoja, "LECTURAS FARMACIA");

    XLSX.writeFile(libro, "LECTURAS_FARMACIA_" + new Date().toISOString().slice(0, 10) + ".xlsx");

});

// ========================================
// MAESTRO MARA
// ========================================
// Cód. Proveedor es el que coincide con el CODIGO/SKU que se usa en
// el resto de este módulo. Reusa mostrarToast, sesion y
// guardarEnBloques (definidos arriba, en la sección de Carga y Viajes).

// PostgREST limita cada respuesta a 1000 filas por defecto — el
// maestro puede tener más SKUs que eso, así que se pagina con el
// header Range hasta traer todo.
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

document.getElementById("btnDescargarPlantillaMara").addEventListener("click", function(){

    const encabezados = [
        "COD. LAB.", "LABORATORIO", "COD. SAP", "COD. PROVEEDOR", "EAN PRINCIPAL",
        "DESCRIPCION", "CODIGO INKAVENTA", "ESTADO", "UM BASE", "UM PEDIDO", "MASTER PACK"
    ];

    const filasEjemplo = [
        [80000151, "ALICORP", 109454001, 109454001, 7751851001724, "DENTO CR DENT HERBAL EXTR NAT TBO 90.1G", "261392", "ACTIVO", "UN", "UN", 72],
        [80000323, "INTRADEVCO INDUSTRIAL CONSUMO", 138805, 8326097, 7751851032438, "DENTITO GEL DENTAL TBOX85G, CHICHA MORAD", "025896", "ACTIVO", "UN", "UN", 144]
    ];

    const hoja = XLSX.utils.aoa_to_sheet([encabezados, ...filasEjemplo]);
    const libro = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(libro, hoja, "MARA FARMACIA");

    XLSX.writeFile(libro, "PLANTILLA_MARA_FARMACIA.xlsx");

});

const archivoMara = document.getElementById("archivoMara");
const nombreArchivoMara = document.getElementById("nombreArchivoMara");
const fechaArchivoMara = document.getElementById("fechaArchivoMara");

const COLUMNAS_ESPERADAS_MARA = [
    "cod. lab.", "laboratorio", "cod. sap", "cod. proveedor", "ean principal",
    "descripcion", "codigo inkaventa", "estado", "um base", "um pedido", "master pack"
];

// Quita tildes/diéresis para no depender de que el Excel traiga
// exactamente "Cód." vs "Cod." o "Descripción" vs "Descripcion".
function sinTildes(texto){
    return String(texto).normalize("NFD").replace(/[̀-ͯ]/g, "");
}

async function leerFilasMaraExcel(archivo){

    const buffer = await archivo.arrayBuffer();
    const libro = XLSX.read(buffer, { type: "array" });

    const hoja = libro.Sheets[libro.SheetNames[0]];

    return XLSX.utils.sheet_to_json(hoja, { defval: "" });

}

function validarFormatoMara(filasCrudas){

    if(!filasCrudas.length){
        return "El archivo está vacío.";
    }

    const columnasArchivo = Object.keys(filasCrudas[0]).map(c => sinTildes(c).trim().toLowerCase());

    const faltantes = COLUMNAS_ESPERADAS_MARA.filter(
        esperada => !columnasArchivo.includes(sinTildes(esperada))
    );

    if(faltantes.length){
        return "Este archivo no tiene el formato del maestro MARA. Faltan las columnas: " +
            faltantes.join(", ") + ".";
    }

    return null;

}

function normalizarFilaMara(filaOriginal, archivo, cargadoPor){

    const mapaFila = {};

    Object.keys(filaOriginal).forEach(function(clave){
        mapaFila[sinTildes(clave).trim().toLowerCase()] = filaOriginal[clave];
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

    return {
        cod_lab: texto("cod. lab."),
        laboratorio: texto("laboratorio"),
        cod_sap: texto("cod. sap"),
        cod_proveedor: texto("cod. proveedor"),
        ean_principal: texto("ean principal"),
        descripcion: texto("descripcion"),
        codigo_inkaventa: texto("codigo inkaventa"),
        estado: texto("estado"),
        um_base: texto("um base"),
        um_pedido: texto("um pedido"),
        master_pack: num("master pack"),
        archivo_origen: archivo,
        cargado_por: cargadoPor
    };

}

archivoMara.addEventListener("change", async function(e){

    const archivo = e.target.files[0];

    if(!archivo){
        return;
    }

    nombreArchivoMara.textContent = "Leyendo " + archivo.name + "...";

    try{

        const filasCrudas = await leerFilasMaraExcel(archivo);

        const errorFormato = validarFormatoMara(filasCrudas);

        if(errorFormato){
            mostrarToast(errorFormato, "error");
            nombreArchivoMara.textContent = "-";
            archivoMara.value = "";
            return;
        }

        const cargadoPor = (sesion && (sesion.nombre_completo || sesion.usuario)) || "";

        const filasNormalizadas = filasCrudas
            .map(f => normalizarFilaMara(f, archivo.name, cargadoPor))
            .filter(f => f.cod_sap && f.descripcion);

        if(!filasNormalizadas.length){
            mostrarToast("No se encontraron filas válidas en el archivo (revisa las columnas COD. SAP y DESCRIPCION).", "error");
            nombreArchivoMara.textContent = "-";
            archivoMara.value = "";
            return;
        }

        const existentes = await supabaseFetch("/mara_farmacia?select=id&limit=1");

        if(existentes && existentes.length){

            const confirmado = confirm(
                "Ya hay un maestro MARA cargado. ¿Deseas reemplazarlo con este archivo (" +
                filasNormalizadas.length + " filas)?"
            );

            if(!confirmado){
                nombreArchivoMara.textContent = "-";
                archivoMara.value = "";
                return;
            }

            await supabaseFetch("/mara_farmacia?id=gt.0", { method: "DELETE" });

        }

        nombreArchivoMara.textContent = "Guardando " + archivo.name + "...";

        await guardarEnBloques("mara_farmacia", filasNormalizadas);

        nombreArchivoMara.textContent = archivo.name;
        fechaArchivoMara.textContent = new Date().toLocaleDateString("es-PE");

        document.getElementById("totalRegistrosMara").textContent =
            filasNormalizadas.length.toLocaleString("es-PE");

        mostrarToast("Maestro MARA cargado: " + filasNormalizadas.length + " filas.", "exito");

    }catch(err){

        console.error(err);
        mostrarToast("No se pudo cargar el archivo: " + err.message, "error");
        nombreArchivoMara.textContent = "-";
        archivoMara.value = "";

    }

});

async function cargarResumenExistenteMara(){

    try{

        const filas = await supabaseFetchTodo(
            "/mara_farmacia?select=id,archivo_origen,created_at&order=created_at.desc"
        );

        if(!filas || !filas.length){
            return;
        }

        document.getElementById("totalRegistrosMara").textContent =
            filas.length.toLocaleString("es-PE");

        nombreArchivoMara.textContent = filas[0].archivo_origen || "-";
        fechaArchivoMara.textContent = new Date(filas[0].created_at).toLocaleDateString("es-PE");

    }catch(e){
        console.error(e);
    }

}

async function buscarMara(){

    const codigo = document.getElementById("filtroCodigoMara").value.trim();
    const descripcion = document.getElementById("filtroDescripcionMara").value.trim();

    const tbody = document.getElementById("tblMara");
    tbody.innerHTML = `<tr><td colspan="9" class="sin-datos">Cargando...</td></tr>`;

    try{

        let ruta = "/mara_farmacia?select=cod_sap,cod_proveedor,ean_principal,descripcion,laboratorio,um_base,um_pedido,master_pack,estado&order=descripcion.asc";

        if(codigo){
            ruta += "&or=(cod_sap.ilike.*" + encodeURIComponent(codigo) + "*,cod_proveedor.ilike.*" + encodeURIComponent(codigo) + "*)";
        }

        if(descripcion){
            ruta += "&descripcion=ilike.*" + encodeURIComponent(descripcion) + "*";
        }

        // Sin filtros trae el maestro completo (paginado); con
        // filtros, la misma paginación cubre resultados grandes.
        const filas = await supabaseFetchTodo(ruta);

        tbody.innerHTML = "";

        if(!filas || !filas.length){
            tbody.innerHTML = `<tr><td colspan="9" class="sin-datos">No se encontraron materiales con esos filtros.</td></tr>`;
            return;
        }

        filas.forEach(function(f){

            const tr = document.createElement("tr");

            tr.innerHTML = `
                <td>${f.cod_sap || "-"}</td>
                <td>${f.cod_proveedor || "-"}</td>
                <td>${f.ean_principal || "-"}</td>
                <td>${f.descripcion || "-"}</td>
                <td>${f.laboratorio || "-"}</td>
                <td>${f.um_base || "-"}</td>
                <td>${f.um_pedido || "-"}</td>
                <td>${f.master_pack || "-"}</td>
                <td>${f.estado || "-"}</td>
            `;

            tbody.appendChild(tr);

        });

    }catch(e){

        console.error(e);
        tbody.innerHTML = `<tr><td colspan="9" class="sin-datos">No se pudo cargar el maestro.</td></tr>`;

    }

}

document.getElementById("btnBuscarMara").addEventListener("click", buscarMara);

// ========================================
// OC PORTAL CLIENTE
// ========================================
// La OC a subir se elige de un combo poblado con las OC que ya
// existen en farmacia_data (la plantilla de "1. Carga y Viajes") —
// no se puede subir un archivo con una OC distinta a la seleccionada.
// Reusa mostrarToast, sesion, guardarEnBloques, sinTildes y
// supabaseFetchTodo (definidos arriba).

document.getElementById("btnDescargarPlantillaOc").addEventListener("click", function(){

    const encabezados = [
        "OC", "Tipo O/C", "Clase de Documento", "Codigo lugar de Entrega", "Nombre lugar de entrega",
        "Dirección de entrega", "Fecha Emisión", "Fecha Vencimiento", "Posición", "Inretail / QS",
        "EAN", "Codigo Proveedor", "Descripción Producto", "Empaque", "SKU/Empaque", "P. Lista",
        "Desc. 1", "Desc. 2", "Desc. 3", "Desc. 4", "Desc. 5", "Desc. 6", "P. Final Neto",
        "P. Final(con imp)", "Codigo local destino", "Nombre local destino", "Ctdad. SKU solicitadas"
    ];

    const filasEjemplo = [
        [
            1000429027, "STOCK", "PCN", "CD11", "CENTRO DE DISTRIBUCION STA. ANITA",
            "AV. CARRETERA CENTRAL 1115", "2026-08-17", "2026-08-22", 3409666, "118969002",
            "7751851007863", "8301101", "DENTO CEP PREM GRAB RECT MED BLSTX1UN", "EA", 84, 2.34,
            0, 0, 0, 0, 0, 0, 2.34, 18323.323, "CD11", "CENTRO DE DISTRIBUCION STA. ANITA", 6636
        ]
    ];

    const hoja = XLSX.utils.aoa_to_sheet([encabezados, ...filasEjemplo]);
    const libro = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(libro, hoja, "OC PORTAL CLIENTE");

    XLSX.writeFile(libro, "PLANTILLA_OC_PORTAL_CLIENTE.xlsx");

});

const cmbOcASubir = document.getElementById("cmbOcASubir");
const archivoOcPortal = document.getElementById("archivoOcPortal");
const nombreArchivoOc = document.getElementById("nombreArchivoOc");
const fechaArchivoOc = document.getElementById("fechaArchivoOc");

let _ocsParaSubirCargadas = false;

async function cargarOcsParaSubir(){

    if(_ocsParaSubirCargadas){
        return;
    }

    try{

        const filas = await supabaseFetchTodo("/farmacia_data?select=orden_compra");

        const ocs = [...new Set((filas || []).map(f => f.orden_compra))]
            .filter(v => v !== null && v !== undefined)
            .sort((a, b) => a - b);

        ocs.forEach(function(oc){
            const option = document.createElement("option");
            option.value = String(oc);
            option.textContent = String(oc);
            cmbOcASubir.appendChild(option);
        });

        _ocsParaSubirCargadas = true;

    }catch(e){
        console.error(e);
    }

}

cmbOcASubir.addEventListener("change", function(){

    archivoOcPortal.value = "";
    archivoOcPortal.disabled = !cmbOcASubir.value;

});

const COLUMNAS_ESPERADAS_OC = [
    "oc", "tipo o/c", "clase de documento", "codigo lugar de entrega", "nombre lugar de entrega",
    "direccion de entrega", "fecha emision", "fecha vencimiento", "posicion", "inretail / qs",
    "ean", "codigo proveedor", "descripcion producto", "empaque", "sku/empaque", "p. lista",
    "desc. 1", "desc. 2", "desc. 3", "desc. 4", "desc. 5", "desc. 6", "p. final neto",
    "p. final(con imp)", "codigo local destino", "nombre local destino", "ctdad. sku solicitadas"
];

async function leerFilasOcExcel(archivo){

    const buffer = await archivo.arrayBuffer();
    const libro = XLSX.read(buffer, { type: "array", cellDates: true });

    const hoja = libro.Sheets[libro.SheetNames[0]];

    return XLSX.utils.sheet_to_json(hoja, { defval: "" });

}

function validarFormatoOc(filasCrudas){

    if(!filasCrudas.length){
        return "El archivo está vacío.";
    }

    const columnasArchivo = Object.keys(filasCrudas[0]).map(c => sinTildes(c).trim().toLowerCase());

    const faltantes = COLUMNAS_ESPERADAS_OC.filter(
        esperada => !columnasArchivo.includes(sinTildes(esperada))
    );

    if(faltantes.length){
        return "Este archivo no tiene el formato de OC del portal del cliente. Faltan las columnas: " +
            faltantes.join(", ") + ".";
    }

    return null;

}

function normalizarFilaOc(filaOriginal, archivo, cargadoPor){

    const mapaFila = {};

    Object.keys(filaOriginal).forEach(function(clave){
        mapaFila[sinTildes(clave).trim().toLowerCase()] = filaOriginal[clave];
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

        const v = valor(clave);

        if(v === ""){
            return null;
        }

        const d = (v instanceof Date) ? v : new Date(v);

        return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);

    }

    return {
        oc: num("oc"),
        tipo_oc: texto("tipo o/c"),
        clase_documento: texto("clase de documento"),
        cod_lugar_entrega: texto("codigo lugar de entrega"),
        nombre_lugar_entrega: texto("nombre lugar de entrega"),
        direccion_entrega: texto("direccion de entrega"),
        fecha_emision: fecha("fecha emision"),
        fecha_vencimiento: fecha("fecha vencimiento"),
        posicion: num("posicion"),
        inretail_qs: texto("inretail / qs"),
        ean: texto("ean"),
        codigo_proveedor: texto("codigo proveedor"),
        descripcion_producto: texto("descripcion producto"),
        empaque: texto("empaque"),
        sku_empaque: num("sku/empaque"),
        precio_lista: num("p. lista"),
        desc_1: num("desc. 1"),
        desc_2: num("desc. 2"),
        desc_3: num("desc. 3"),
        desc_4: num("desc. 4"),
        desc_5: num("desc. 5"),
        desc_6: num("desc. 6"),
        precio_final_neto: num("p. final neto"),
        precio_final_con_imp: num("p. final(con imp)"),
        codigo_local_destino: texto("codigo local destino"),
        nombre_local_destino: texto("nombre local destino"),
        cantidad_sku_solicitada: num("ctdad. sku solicitadas"),
        archivo_origen: archivo,
        cargado_por: cargadoPor
    };

}

archivoOcPortal.addEventListener("change", async function(e){

    const archivo = e.target.files[0];

    if(!archivo){
        return;
    }

    const ocSeleccionada = Number(cmbOcASubir.value);

    if(!cmbOcASubir.value){
        mostrarToast("Primero selecciona la OC que vas a subir.", "error");
        archivoOcPortal.value = "";
        return;
    }

    nombreArchivoOc.textContent = "Leyendo " + archivo.name + "...";

    try{

        const filasCrudas = await leerFilasOcExcel(archivo);

        const errorFormato = validarFormatoOc(filasCrudas);

        if(errorFormato){
            mostrarToast(errorFormato, "error");
            nombreArchivoOc.textContent = "-";
            archivoOcPortal.value = "";
            return;
        }

        const cargadoPor = (sesion && (sesion.nombre_completo || sesion.usuario)) || "";

        const filasNormalizadas = filasCrudas
            .map(f => normalizarFilaOc(f, archivo.name, cargadoPor))
            .filter(f => f.oc !== null && f.codigo_proveedor);

        if(!filasNormalizadas.length){
            mostrarToast("No se encontraron filas válidas en el archivo (revisa las columnas OC y CODIGO PROVEEDOR).", "error");
            nombreArchivoOc.textContent = "-";
            archivoOcPortal.value = "";
            return;
        }

        const ocsDelArchivo = [...new Set(filasNormalizadas.map(f => f.oc))];

        if(ocsDelArchivo.length > 1 || ocsDelArchivo[0] !== ocSeleccionada){

            mostrarToast(
                "El archivo trae la OC " + ocsDelArchivo.join(", ") +
                ", pero seleccionaste la OC " + ocSeleccionada +
                ". Solo puedes subir el archivo de la OC seleccionada.",
                "error"
            );

            nombreArchivoOc.textContent = "-";
            archivoOcPortal.value = "";
            return;

        }

        const existentes = await supabaseFetch("/oc_portal_cliente?oc=eq." + ocSeleccionada + "&select=id&limit=1");

        if(existentes && existentes.length){

            const confirmado = confirm(
                "Ya hay datos cargados para la OC " + ocSeleccionada +
                ". ¿Deseas reemplazarlos con este archivo (" + filasNormalizadas.length + " filas)?"
            );

            if(!confirmado){
                nombreArchivoOc.textContent = "-";
                archivoOcPortal.value = "";
                return;
            }

            await supabaseFetch("/oc_portal_cliente?oc=eq." + ocSeleccionada, { method: "DELETE" });

        }

        nombreArchivoOc.textContent = "Guardando " + archivo.name + "...";

        await guardarEnBloques("oc_portal_cliente", filasNormalizadas);

        nombreArchivoOc.textContent = archivo.name;
        fechaArchivoOc.textContent = new Date().toLocaleDateString("es-PE");

        mostrarToast(
            "OC " + ocSeleccionada + " cargada: " + filasNormalizadas.length + " filas.",
            "exito"
        );

        cargarResumenExistenteOcPortal();

    }catch(err){

        console.error(err);
        mostrarToast("No se pudo cargar el archivo: " + err.message, "error");
        nombreArchivoOc.textContent = "-";
        archivoOcPortal.value = "";

    }

});

async function cargarResumenExistenteOcPortal(){

    try{

        const filas = await supabaseFetchTodo(
            "/oc_portal_cliente?select=id,archivo_origen,created_at&order=created_at.desc"
        );

        if(!filas || !filas.length){
            return;
        }

        document.getElementById("totalRegistrosOc").textContent =
            filas.length.toLocaleString("es-PE");

        nombreArchivoOc.textContent = filas[0].archivo_origen || "-";
        fechaArchivoOc.textContent = new Date(filas[0].created_at).toLocaleDateString("es-PE");

    }catch(e){
        console.error(e);
    }

}

async function buscarOcPortal(){

    const oc = document.getElementById("filtroOcPortal").value.trim();
    const codigo = document.getElementById("filtroCodigoOcPortal").value.trim();

    const tbody = document.getElementById("tblOcPortal");
    tbody.innerHTML = `<tr><td colspan="9" class="sin-datos">Cargando...</td></tr>`;

    try{

        let ruta = "/oc_portal_cliente?select=oc,posicion,codigo_proveedor,descripcion_producto,empaque,cantidad_sku_solicitada,fecha_emision,fecha_vencimiento,nombre_local_destino&order=oc.asc,posicion.asc";

        if(oc){
            ruta += "&oc=eq." + encodeURIComponent(oc);
        }

        if(codigo){
            ruta += "&codigo_proveedor=ilike.*" + encodeURIComponent(codigo) + "*";
        }

        const filas = await supabaseFetchTodo(ruta);

        tbody.innerHTML = "";

        if(!filas || !filas.length){
            tbody.innerHTML = `<tr><td colspan="9" class="sin-datos">No se encontraron OC con esos filtros.</td></tr>`;
            return;
        }

        filas.forEach(function(f){

            const tr = document.createElement("tr");

            tr.innerHTML = `
                <td>${f.oc}</td>
                <td>${f.posicion || "-"}</td>
                <td>${f.codigo_proveedor || "-"}</td>
                <td>${f.descripcion_producto || "-"}</td>
                <td>${f.empaque || "-"}</td>
                <td>${formatearNumeroFarmacia(f.cantidad_sku_solicitada)}</td>
                <td>${f.fecha_emision || "-"}</td>
                <td>${f.fecha_vencimiento || "-"}</td>
                <td>${f.nombre_local_destino || "-"}</td>
            `;

            tbody.appendChild(tr);

        });

    }catch(e){

        console.error(e);
        tbody.innerHTML = `<tr><td colspan="9" class="sin-datos">No se pudo cargar las OC del portal.</td></tr>`;

    }

}

document.getElementById("btnBuscarOcPortal").addEventListener("click", buscarOcPortal);

// ========================================
// MARA ALICORP
// ========================================
// Maestro más simple que "3. MARA InRetail Pharma": acá "codigo" SÍ
// coincide directo con el CODIGO/SKU que se usa en el resto del
// módulo. Reusa mostrarToast, sesion, guardarEnBloques, sinTildes y
// supabaseFetchTodo (definidos arriba).

document.getElementById("btnDescargarPlantillaAlicorp").addEventListener("click", function(){

    const encabezados = [
        "codigo", "Decripción de material", "Código EAN/UPC", "Factor Unid. de Alm.", "Und. de almacenamiento"
    ];

    const filasEjemplo = [
        [8321091, "SHAMPOO REPARADOR AMARAS 12FCO 400ML", "7750243073837", 12, "CJA"],
        [8301104, "CEP DENTO GALAXY NIÑOS 14UND 6DSP", "7751851007931", 84, "CJA"]
    ];

    const hoja = XLSX.utils.aoa_to_sheet([encabezados, ...filasEjemplo]);
    const libro = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(libro, hoja, "MARA ALICORP");

    XLSX.writeFile(libro, "PLANTILLA_MARA_ALICORP.xlsx");

});

const archivoAlicorp = document.getElementById("archivoAlicorp");
const nombreArchivoAlicorp = document.getElementById("nombreArchivoAlicorp");
const fechaArchivoAlicorp = document.getElementById("fechaArchivoAlicorp");

async function leerFilasAlicorpExcel(archivo){

    const buffer = await archivo.arrayBuffer();
    const libro = XLSX.read(buffer, { type: "array" });

    const hoja = libro.Sheets[libro.SheetNames[0]];

    return XLSX.utils.sheet_to_json(hoja, { defval: "" });

}

// El nombre exacto de las columnas de descripción/EAN/factor/unidad
// varía según cómo lo exporten (p.ej. "Decripción" sin la "s"), así
// que se aceptan varios nombres candidatos por campo. Solo "codigo"
// es realmente obligatorio.
function valorPorCandidatos(mapaFila, candidatos){

    for(let i = 0; i < candidatos.length; i++){
        if(mapaFila[candidatos[i]] !== undefined){
            return mapaFila[candidatos[i]];
        }
    }

    return "";

}

function validarFormatoAlicorp(filasCrudas){

    if(!filasCrudas.length){
        return "El archivo está vacío.";
    }

    const columnasArchivo = Object.keys(filasCrudas[0]).map(c => sinTildes(c).trim().toLowerCase());

    if(!columnasArchivo.includes("codigo")){
        return "Este archivo no tiene el formato del maestro Alicorp. Falta la columna: CODIGO.";
    }

    const candidatosDescripcion = ["descripcion de material", "decripcion de material", "descripcion"];

    if(!candidatosDescripcion.some(c => columnasArchivo.includes(c))){
        return "Este archivo no tiene el formato del maestro Alicorp. Falta la columna de descripción del material.";
    }

    return null;

}

function normalizarFilaAlicorp(filaOriginal, archivo, cargadoPor){

    const mapaFila = {};

    Object.keys(filaOriginal).forEach(function(clave){
        mapaFila[sinTildes(clave).trim().toLowerCase()] = filaOriginal[clave];
    });

    function texto(candidatos){
        const v = valorPorCandidatos(mapaFila, candidatos);
        return (v === undefined || v === null) ? "" : String(v).trim();
    }

    function num(candidatos){
        const v = valorPorCandidatos(mapaFila, candidatos);
        const n = Number(v);
        return (v === "" || v === undefined || isNaN(n)) ? null : n;
    }

    return {
        codigo: texto(["codigo"]),
        descripcion: texto(["descripcion de material", "decripcion de material", "descripcion"]),
        ean: texto(["codigo ean/upc", "ean/upc", "ean"]),
        factor_unidad_alm: num(["factor unid. de alm.", "factor unid de alm", "factor unidad de almacenamiento"]),
        unidad_almacenamiento: texto(["und. de almacenamiento", "und de almacenamiento", "unidad de almacenamiento"]),
        archivo_origen: archivo,
        cargado_por: cargadoPor
    };

}

archivoAlicorp.addEventListener("change", async function(e){

    const archivo = e.target.files[0];

    if(!archivo){
        return;
    }

    nombreArchivoAlicorp.textContent = "Leyendo " + archivo.name + "...";

    try{

        const filasCrudas = await leerFilasAlicorpExcel(archivo);

        const errorFormato = validarFormatoAlicorp(filasCrudas);

        if(errorFormato){
            mostrarToast(errorFormato, "error");
            nombreArchivoAlicorp.textContent = "-";
            archivoAlicorp.value = "";
            return;
        }

        const cargadoPor = (sesion && (sesion.nombre_completo || sesion.usuario)) || "";

        const filasNormalizadas = filasCrudas
            .map(f => normalizarFilaAlicorp(f, archivo.name, cargadoPor))
            .filter(f => f.codigo && f.descripcion);

        if(!filasNormalizadas.length){
            mostrarToast("No se encontraron filas válidas en el archivo (revisa las columnas CODIGO y DESCRIPCION).", "error");
            nombreArchivoAlicorp.textContent = "-";
            archivoAlicorp.value = "";
            return;
        }

        const existentes = await supabaseFetch("/mara_alicorp?select=id&limit=1");

        if(existentes && existentes.length){

            const confirmado = confirm(
                "Ya hay un maestro Alicorp cargado. ¿Deseas reemplazarlo con este archivo (" +
                filasNormalizadas.length + " filas)?"
            );

            if(!confirmado){
                nombreArchivoAlicorp.textContent = "-";
                archivoAlicorp.value = "";
                return;
            }

            await supabaseFetch("/mara_alicorp?id=gt.0", { method: "DELETE" });

        }

        nombreArchivoAlicorp.textContent = "Guardando " + archivo.name + "...";

        await guardarEnBloques("mara_alicorp", filasNormalizadas);

        nombreArchivoAlicorp.textContent = archivo.name;
        fechaArchivoAlicorp.textContent = new Date().toLocaleDateString("es-PE");

        document.getElementById("totalRegistrosAlicorp").textContent =
            filasNormalizadas.length.toLocaleString("es-PE");

        mostrarToast("Maestro Alicorp cargado: " + filasNormalizadas.length + " filas.", "exito");

    }catch(err){

        console.error(err);
        mostrarToast("No se pudo cargar el archivo: " + err.message, "error");
        nombreArchivoAlicorp.textContent = "-";
        archivoAlicorp.value = "";

    }

});

async function cargarResumenExistenteAlicorp(){

    try{

        const filas = await supabaseFetchTodo(
            "/mara_alicorp?select=id,archivo_origen,created_at&order=created_at.desc"
        );

        if(!filas || !filas.length){
            return;
        }

        document.getElementById("totalRegistrosAlicorp").textContent =
            filas.length.toLocaleString("es-PE");

        nombreArchivoAlicorp.textContent = filas[0].archivo_origen || "-";
        fechaArchivoAlicorp.textContent = new Date(filas[0].created_at).toLocaleDateString("es-PE");

    }catch(e){
        console.error(e);
    }

}

async function buscarAlicorp(){

    const codigo = document.getElementById("filtroCodigoAlicorp").value.trim();
    const descripcion = document.getElementById("filtroDescripcionAlicorp").value.trim();

    const tbody = document.getElementById("tblAlicorp");
    tbody.innerHTML = `<tr><td colspan="5" class="sin-datos">Cargando...</td></tr>`;

    try{

        let ruta = "/mara_alicorp?select=codigo,descripcion,ean,factor_unidad_alm,unidad_almacenamiento&order=descripcion.asc";

        if(codigo){
            ruta += "&codigo=ilike.*" + encodeURIComponent(codigo) + "*";
        }

        if(descripcion){
            ruta += "&descripcion=ilike.*" + encodeURIComponent(descripcion) + "*";
        }

        const filas = await supabaseFetchTodo(ruta);

        tbody.innerHTML = "";

        if(!filas || !filas.length){
            tbody.innerHTML = `<tr><td colspan="5" class="sin-datos">No se encontraron materiales con esos filtros.</td></tr>`;
            return;
        }

        filas.forEach(function(f){

            const tr = document.createElement("tr");

            tr.innerHTML = `
                <td>${f.codigo || "-"}</td>
                <td>${f.descripcion || "-"}</td>
                <td>${f.ean || "-"}</td>
                <td>${f.factor_unidad_alm || "-"}</td>
                <td>${f.unidad_almacenamiento || "-"}</td>
            `;

            tbody.appendChild(tr);

        });

    }catch(e){

        console.error(e);
        tbody.innerHTML = `<tr><td colspan="5" class="sin-datos">No se pudo cargar el maestro Alicorp.</td></tr>`;

    }

}

document.getElementById("btnBuscarAlicorp").addEventListener("click", buscarAlicorp);

// ========================================
// STOCK FÍSICO SAP
// ========================================
// El export de SAP no trae Viaje ni OC — por eso primero se elige
// el Viaje (de farmacia_data) y luego la OC de ese viaje, y recién
// ahí se habilita subir el archivo. Reusa mostrarToast, sesion,
// guardarEnBloques, sinTildes, supabaseFetchTodo y
// formatearNumeroFarmacia (definidos arriba).

document.getElementById("btnDescargarPlantillaStock").addEventListener("click", function(){

    const encabezados = [
        "Tipo almacén", "Ubicación", "Producto", "Descripción producto", "Lote",
        "FeCaduc/FePreferCons", "Tipo de stock", "Ctd.embalada (UMA)", "Un.medida alternat.",
        "Ctd.", "Fecha EM"
    ];

    const filasEjemplo = [
        ["9025", "CNL-OUT-92", "8300117", "LEJIA SAPOLIO CLORO B 4.8 KG 4UND", "2609055060", "2027-09-05", "1F", 27, "CJA", 108, "2026-09-07"]
    ];

    const hoja = XLSX.utils.aoa_to_sheet([encabezados, ...filasEjemplo]);
    const libro = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(libro, hoja, "STOCK FISICO SAP");

    XLSX.writeFile(libro, "PLANTILLA_STOCK_FISICO_SAP.xlsx");

});

const cmbViajeStock = document.getElementById("cmbViajeStock");
const cmbOcStock = document.getElementById("cmbOcStock");
const archivoStock = document.getElementById("archivoStock");
const nombreArchivoStock = document.getElementById("nombreArchivoStock");
const fechaArchivoStock = document.getElementById("fechaArchivoStock");

let _viajesStockCargados = false;

async function cargarViajesParaStock(){

    if(_viajesStockCargados){
        return;
    }

    try{

        const filas = await supabaseFetchTodo("/farmacia_data?select=viaje");

        const viajes = [...new Set((filas || []).map(f => f.viaje))]
            .filter(v => v !== null && v !== undefined)
            .sort((a, b) => a - b);

        viajes.forEach(function(v){
            const option = document.createElement("option");
            option.value = String(v);
            option.textContent = String(v);
            cmbViajeStock.appendChild(option);
        });

        _viajesStockCargados = true;

    }catch(e){
        console.error(e);
    }

}

function resetearSeleccionStock(){

    cmbOcStock.innerHTML = `<option value="">Selecciona primero el viaje...</option>`;
    cmbOcStock.disabled = true;

    archivoStock.value = "";
    archivoStock.disabled = true;

    nombreArchivoStock.textContent = "-";
    fechaArchivoStock.textContent = "-";
    document.getElementById("totalRegistrosStock").textContent = "-";

}

cmbViajeStock.addEventListener("change", async function(){

    resetearSeleccionStock();

    if(!cmbViajeStock.value){
        return;
    }

    try{

        const filas = await supabaseFetchTodo(
            "/farmacia_data?select=orden_compra&viaje=eq." + cmbViajeStock.value
        );

        const ocs = [...new Set((filas || []).map(f => f.orden_compra))]
            .filter(v => v !== null && v !== undefined)
            .sort((a, b) => a - b);

        cmbOcStock.innerHTML = `<option value="">Selecciona la OC...</option>`;

        ocs.forEach(function(oc){
            const option = document.createElement("option");
            option.value = String(oc);
            option.textContent = String(oc);
            cmbOcStock.appendChild(option);
        });

        cmbOcStock.disabled = false;

    }catch(e){
        console.error(e);
        mostrarToast("No se pudieron cargar las OC de ese viaje.", "error");
    }

});

cmbOcStock.addEventListener("change", async function(){

    archivoStock.value = "";
    archivoStock.disabled = !cmbOcStock.value;

    if(!cmbOcStock.value){
        nombreArchivoStock.textContent = "-";
        fechaArchivoStock.textContent = "-";
        document.getElementById("totalRegistrosStock").textContent = "-";
        return;
    }

    try{

        const filas = await supabaseFetchTodo(
            "/stock_fisico_sap?select=id,archivo_origen,created_at&viaje=eq." + cmbViajeStock.value +
            "&oc=eq." + cmbOcStock.value + "&order=created_at.desc"
        );

        if(!filas || !filas.length){
            nombreArchivoStock.textContent = "-";
            fechaArchivoStock.textContent = "-";
            document.getElementById("totalRegistrosStock").textContent = "0";
            return;
        }

        nombreArchivoStock.textContent = filas[0].archivo_origen || "-";
        fechaArchivoStock.textContent = new Date(filas[0].created_at).toLocaleDateString("es-PE");
        document.getElementById("totalRegistrosStock").textContent = filas.length.toLocaleString("es-PE");

    }catch(e){
        console.error(e);
    }

});

const COLUMNAS_ESPERADAS_STOCK = [
    "tipo almacen", "ubicacion", "producto", "descripcion producto", "lote",
    "fecaduc/feprefercons", "tipo de stock", "ctd.embalada (uma)", "un.medida alternat.",
    "ctd.", "fecha em"
];

async function leerFilasStockExcel(archivo){

    const buffer = await archivo.arrayBuffer();
    const libro = XLSX.read(buffer, { type: "array", cellDates: true });

    const hoja = libro.Sheets[libro.SheetNames[0]];

    return XLSX.utils.sheet_to_json(hoja, { defval: "" });

}

function validarFormatoStock(filasCrudas){

    if(!filasCrudas.length){
        return "El archivo está vacío.";
    }

    const columnasArchivo = Object.keys(filasCrudas[0]).map(c => sinTildes(c).trim().toLowerCase());

    const faltantes = COLUMNAS_ESPERADAS_STOCK.filter(
        esperada => !columnasArchivo.includes(sinTildes(esperada))
    );

    if(faltantes.length){
        return "Este archivo no tiene el formato de Stock Físico SAP. Faltan las columnas: " +
            faltantes.join(", ") + ".";
    }

    return null;

}

function normalizarFilaStock(filaOriginal, archivo, cargadoPor, viaje, oc){

    const mapaFila = {};

    Object.keys(filaOriginal).forEach(function(clave){
        mapaFila[sinTildes(clave).trim().toLowerCase()] = filaOriginal[clave];
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

        const v = valor(clave);

        if(v === ""){
            return null;
        }

        const d = (v instanceof Date) ? v : new Date(v);

        return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);

    }

    return {
        viaje: viaje,
        oc: oc,
        tipo_almacen: texto("tipo almacen"),
        ubicacion: texto("ubicacion"),
        producto: texto("producto"),
        descripcion_producto: texto("descripcion producto"),
        lote: texto("lote"),
        fecha_caducidad: fecha("fecaduc/feprefercons"),
        tipo_stock: texto("tipo de stock"),
        cantidad_embalada: num("ctd.embalada (uma)"),
        unidad_medida_alt: texto("un.medida alternat."),
        cantidad: num("ctd."),
        fecha_em: fecha("fecha em"),
        archivo_origen: archivo,
        cargado_por: cargadoPor
    };

}

archivoStock.addEventListener("change", async function(e){

    const archivo = e.target.files[0];

    if(!archivo){
        return;
    }

    const viajeSeleccionado = Number(cmbViajeStock.value);
    const ocSeleccionada = Number(cmbOcStock.value);

    if(!cmbViajeStock.value || !cmbOcStock.value){
        mostrarToast("Primero selecciona el Viaje y la OC.", "error");
        archivoStock.value = "";
        return;
    }

    nombreArchivoStock.textContent = "Leyendo " + archivo.name + "...";

    try{

        const filasCrudas = await leerFilasStockExcel(archivo);

        const errorFormato = validarFormatoStock(filasCrudas);

        if(errorFormato){
            mostrarToast(errorFormato, "error");
            nombreArchivoStock.textContent = "-";
            archivoStock.value = "";
            return;
        }

        const cargadoPor = (sesion && (sesion.nombre_completo || sesion.usuario)) || "";

        const filasNormalizadas = filasCrudas
            .map(f => normalizarFilaStock(f, archivo.name, cargadoPor, viajeSeleccionado, ocSeleccionada))
            .filter(f => f.producto && f.lote);

        if(!filasNormalizadas.length){
            mostrarToast("No se encontraron filas válidas en el archivo (revisa las columnas PRODUCTO y LOTE).", "error");
            nombreArchivoStock.textContent = "-";
            archivoStock.value = "";
            return;
        }

        const existentes = await supabaseFetch(
            "/stock_fisico_sap?viaje=eq." + viajeSeleccionado + "&oc=eq." + ocSeleccionada + "&select=id&limit=1"
        );

        if(existentes && existentes.length){

            const confirmado = confirm(
                "Ya hay stock físico cargado para el Viaje " + viajeSeleccionado + " / OC " + ocSeleccionada +
                ". ¿Deseas reemplazarlo con este archivo (" + filasNormalizadas.length + " filas)?"
            );

            if(!confirmado){
                nombreArchivoStock.textContent = "-";
                archivoStock.value = "";
                return;
            }

            await supabaseFetch(
                "/stock_fisico_sap?viaje=eq." + viajeSeleccionado + "&oc=eq." + ocSeleccionada,
                { method: "DELETE" }
            );

        }

        nombreArchivoStock.textContent = "Guardando " + archivo.name + "...";

        await guardarEnBloques("stock_fisico_sap", filasNormalizadas);

        nombreArchivoStock.textContent = archivo.name;
        fechaArchivoStock.textContent = new Date().toLocaleDateString("es-PE");

        document.getElementById("totalRegistrosStock").textContent =
            filasNormalizadas.length.toLocaleString("es-PE");

        mostrarToast(
            "Stock físico cargado para Viaje " + viajeSeleccionado + " / OC " + ocSeleccionada +
            ": " + filasNormalizadas.length + " filas.",
            "exito"
        );

    }catch(err){

        console.error(err);
        mostrarToast("No se pudo cargar el archivo: " + err.message, "error");
        nombreArchivoStock.textContent = "-";
        archivoStock.value = "";

    }

});

const cmbViajeFiltroStock = document.getElementById("cmbViajeFiltroStock");

let _viajesFiltroStockCargados = false;

async function cargarViajesFiltroStock(){

    if(_viajesFiltroStockCargados){
        return;
    }

    try{

        const filas = await supabaseFetchTodo("/stock_fisico_sap?select=viaje");

        const viajes = [...new Set((filas || []).map(f => f.viaje))]
            .filter(v => v !== null && v !== undefined)
            .sort((a, b) => a - b);

        viajes.forEach(function(v){
            const option = document.createElement("option");
            option.value = String(v);
            option.textContent = String(v);
            cmbViajeFiltroStock.appendChild(option);
        });

        _viajesFiltroStockCargados = true;

    }catch(e){
        console.error(e);
    }

}

async function buscarStock(){

    const viaje = cmbViajeFiltroStock.value;
    const oc = document.getElementById("filtroOcStock").value.trim();
    const producto = document.getElementById("filtroProductoStock").value.trim();

    const tbody = document.getElementById("tblStock");
    tbody.innerHTML = `<tr><td colspan="9" class="sin-datos">Cargando...</td></tr>`;

    try{

        let ruta = "/stock_fisico_sap?select=viaje,oc,producto,descripcion_producto,lote,fecha_caducidad,cantidad,unidad_medida_alt,ubicacion&order=viaje.asc,oc.asc";

        if(viaje){
            ruta += "&viaje=eq." + viaje;
        }

        if(oc){
            ruta += "&oc=eq." + encodeURIComponent(oc);
        }

        if(producto){
            ruta += "&producto=ilike.*" + encodeURIComponent(producto) + "*";
        }

        const filas = await supabaseFetchTodo(ruta);

        tbody.innerHTML = "";

        if(!filas || !filas.length){
            tbody.innerHTML = `<tr><td colspan="9" class="sin-datos">No se encontró stock físico con esos filtros.</td></tr>`;
            return;
        }

        filas.forEach(function(f){

            const tr = document.createElement("tr");

            tr.innerHTML = `
                <td>${f.viaje}</td>
                <td>${f.oc}</td>
                <td>${f.producto || "-"}</td>
                <td>${f.descripcion_producto || "-"}</td>
                <td>${f.lote || "-"}</td>
                <td>${f.fecha_caducidad || "-"}</td>
                <td>${formatearNumeroFarmacia(f.cantidad)}</td>
                <td>${f.unidad_medida_alt || "-"}</td>
                <td>${f.ubicacion || "-"}</td>
            `;

            tbody.appendChild(tr);

        });

    }catch(e){

        console.error(e);
        tbody.innerHTML = `<tr><td colspan="9" class="sin-datos">No se pudo cargar el stock físico.</td></tr>`;

    }

}

document.getElementById("btnBuscarStock").addEventListener("click", buscarStock);

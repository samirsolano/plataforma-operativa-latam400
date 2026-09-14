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

    if(!codigo && !descripcion){
        mostrarToast("Escribe un código o una descripción para buscar.", "error");
        return;
    }

    const tbody = document.getElementById("tblMara");
    tbody.innerHTML = `<tr><td colspan="9" class="sin-datos">Buscando...</td></tr>`;

    try{

        let ruta = "/mara_farmacia?select=cod_sap,cod_proveedor,ean_principal,descripcion,laboratorio,um_base,um_pedido,master_pack,estado&order=descripcion.asc&limit=200";

        if(codigo){
            ruta += "&or=(cod_sap.ilike.*" + encodeURIComponent(codigo) + "*,cod_proveedor.ilike.*" + encodeURIComponent(codigo) + "*)";
        }

        if(descripcion){
            ruta += "&descripcion=ilike.*" + encodeURIComponent(descripcion) + "*";
        }

        const filas = await supabaseFetch(ruta);

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

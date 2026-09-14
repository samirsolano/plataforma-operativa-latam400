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
// SUPABASE — LECTURA PAGINADA
// ========================================
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

// ========================================
// DESCARGAR PLANTILLA
// ========================================

document.getElementById("btnDescargarPlantilla").addEventListener("click", function(){

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

// ========================================
// CARGA DEL MAESTRO
// ========================================

const archivoMara = document.getElementById("archivoMara");
const nombreArchivo = document.getElementById("nombreArchivo");
const fechaArchivo = document.getElementById("fechaArchivo");

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

archivoMara.addEventListener("change", async function(e){

    const archivo = e.target.files[0];

    if(!archivo){
        return;
    }

    nombreArchivo.textContent = "Leyendo " + archivo.name + "...";

    try{

        const filasCrudas = await leerFilasMaraExcel(archivo);

        const errorFormato = validarFormatoMara(filasCrudas);

        if(errorFormato){
            mostrarToast(errorFormato, "error");
            nombreArchivo.textContent = "-";
            archivoMara.value = "";
            return;
        }

        const cargadoPor = (sesion && (sesion.nombre_completo || sesion.usuario)) || "";

        const filasNormalizadas = filasCrudas
            .map(f => normalizarFilaMara(f, archivo.name, cargadoPor))
            .filter(f => f.cod_sap && f.descripcion);

        if(!filasNormalizadas.length){
            mostrarToast("No se encontraron filas válidas en el archivo (revisa las columnas COD. SAP y DESCRIPCION).", "error");
            nombreArchivo.textContent = "-";
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
                nombreArchivo.textContent = "-";
                archivoMara.value = "";
                return;
            }

            await supabaseFetch("/mara_farmacia?id=gt.0", { method: "DELETE" });

        }

        nombreArchivo.textContent = "Guardando " + archivo.name + "...";

        await guardarEnBloques("mara_farmacia", filasNormalizadas);

        nombreArchivo.textContent = archivo.name;
        fechaArchivo.textContent = new Date().toLocaleDateString("es-PE");

        document.getElementById("totalRegistros").textContent =
            filasNormalizadas.length.toLocaleString("es-PE");

        mostrarToast("Maestro MARA cargado: " + filasNormalizadas.length + " filas.", "exito");

    }catch(err){

        console.error(err);
        mostrarToast("No se pudo cargar el archivo: " + err.message, "error");
        nombreArchivo.textContent = "-";
        archivoMara.value = "";

    }

});

// ========================================
// CARGAR RESUMEN YA EXISTENTE (al abrir la página)
// ========================================

async function cargarResumenExistente(){

    try{

        const filas = await supabaseFetchTodo(
            "/mara_farmacia?select=id,archivo_origen,created_at&order=created_at.desc"
        );

        if(!filas || !filas.length){
            return;
        }

        document.getElementById("totalRegistros").textContent =
            filas.length.toLocaleString("es-PE");

        nombreArchivo.textContent = filas[0].archivo_origen || "-";
        fechaArchivo.textContent = new Date(filas[0].created_at).toLocaleDateString("es-PE");

    }catch(e){
        console.error(e);
    }

}

cargarResumenExistente();

// ========================================
// CONSULTAR MAESTRO
// ========================================

async function buscarMara(){

    const codigo = document.getElementById("filtroCodigo").value.trim();
    const descripcion = document.getElementById("filtroDescripcion").value.trim();

    if(!codigo && !descripcion){
        mostrarToast("Escribe un código o una descripción para buscar.", "error");
        return;
    }

    const tbody = document.getElementById("tblMara");
    tbody.innerHTML = `<tr><td colspan="8" class="sin-datos">Buscando...</td></tr>`;

    try{

        let ruta = "/mara_farmacia?select=cod_sap,cod_proveedor,descripcion,laboratorio,um_base,um_pedido,master_pack,estado&order=descripcion.asc&limit=200";

        if(codigo){
            ruta += "&or=(cod_sap.ilike.*" + encodeURIComponent(codigo) + "*,cod_proveedor.ilike.*" + encodeURIComponent(codigo) + "*)";
        }

        if(descripcion){
            ruta += "&descripcion=ilike.*" + encodeURIComponent(descripcion) + "*";
        }

        const filas = await supabaseFetch(ruta);

        tbody.innerHTML = "";

        if(!filas || !filas.length){
            tbody.innerHTML = `<tr><td colspan="8" class="sin-datos">No se encontraron materiales con esos filtros.</td></tr>`;
            return;
        }

        filas.forEach(function(f){

            const tr = document.createElement("tr");

            tr.innerHTML = `
                <td>${f.cod_sap || "-"}</td>
                <td>${f.cod_proveedor || "-"}</td>
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
        tbody.innerHTML = `<tr><td colspan="8" class="sin-datos">No se pudo cargar el maestro.</td></tr>`;

    }

}

document.getElementById("btnBuscarMara").addEventListener("click", buscarMara);

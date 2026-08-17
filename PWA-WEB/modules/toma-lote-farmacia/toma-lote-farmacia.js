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

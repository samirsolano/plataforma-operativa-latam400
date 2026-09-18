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
// SELECT PERSONALIZADO
// ========================================
// Un <select> nativo nunca deja pintar la LISTA de opciones con CSS
// (eso lo dibuja el sistema operativo, no el navegador) — solo el
// control cerrado. Para que se vea bien de verdad, se reemplaza cada
// <select> por un botón + una lista propia (mismo estilo que los
// menús ⋮ de Viajes Generados). El <select> original NO se borra:
// queda oculto pero sigue siendo la fuente de verdad (su .value y su
// evento "change"), así que todo el resto del código (cascadas
// Viaje→OC, filtros, etc.) sigue funcionando exactamente igual, sin
// tocarlo.
function mejorarSelect(id){

    const original = document.getElementById(id);

    if(!original || original.dataset.mejorado){
        return;
    }

    original.dataset.mejorado = "1";

    const wrapper = document.createElement("div");
    wrapper.className = "select-bonito";

    const boton = document.createElement("button");
    boton.type = "button";
    boton.className = "select-bonito-boton";

    const lista = document.createElement("div");
    lista.className = "select-bonito-lista oculto";

    original.parentNode.insertBefore(wrapper, original);
    wrapper.appendChild(original);
    wrapper.appendChild(boton);
    wrapper.appendChild(lista);

    function render(){

        const opcionActual = original.options[original.selectedIndex];
        boton.textContent = opcionActual ? opcionActual.textContent : "";
        boton.disabled = original.disabled;

        lista.innerHTML = "";

        Array.from(original.options).forEach(function(op, indice){

            const item = document.createElement("div");
            item.className = "select-bonito-item" + (indice === original.selectedIndex ? " activo" : "");
            item.textContent = op.textContent;

            item.addEventListener("click", function(){

                if(original.selectedIndex !== indice){
                    original.selectedIndex = indice;
                    original.dispatchEvent(new Event("change", { bubbles: true }));
                }

                lista.classList.add("oculto");
                render();

            });

            lista.appendChild(item);

        });

    }

    boton.addEventListener("click", function(e){

        if(boton.disabled){
            return;
        }

        e.stopPropagation();

        const abierto = !lista.classList.contains("oculto");

        document.querySelectorAll(".select-bonito-lista").forEach(function(l){
            l.classList.add("oculto");
        });

        if(!abierto){
            lista.classList.remove("oculto");
        }

    });

    // El select original puede repoblarse (innerHTML nuevo con otras
    // OC/Viajes) o habilitarse/deshabilitarse en cualquier momento
    // desde el resto del código — se observa para mantener la lista
    // propia siempre al día sin tener que tocar esas funciones.
    new MutationObserver(render).observe(original, {
        childList: true,
        attributes: true,
        attributeFilter: ["disabled"]
    });

    render();

}

document.addEventListener("click", function(){
    document.querySelectorAll(".select-bonito-lista").forEach(function(l){
        l.classList.add("oculto");
    });
});

[
    "cmbViajeLecturas", "filtroOcLecturas", "filtroEstadoResumen", "cmbOcASubir",
    "cmbViajeStock", "cmbViajeFiltroStock",
    "cmbViajeCruce", "cmbOcCruce", "cmbOcDataFinal",
    "cmbViajeCruceLotes", "filtroOcCruceLotes", "filtroEstadoCruceLotes"
].forEach(mejorarSelect);

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

        if(link.dataset.tab === "tabCruce"){
            cargarViajesParaCruce();
        }

        if(link.dataset.tab === "tabDataFinal"){
            cargarOcsCompletasParaDataFinal();
        }

        if(link.dataset.tab === "tabCruceLotesSap"){
            cargarViajesParaCruceLotes();
        }

    });

});

// ========================================
// DESCARGAR PLANTILLA
// ========================================

document.getElementById("btnDescargarPlantilla").addEventListener("click", function(){

    const encabezados = [
        "FECHA DE CITA", "VIAJE", "ORDEN DE COMPRA", "ENTREGA",
        "CODIGO/SKU", "DESCRIPCION", "UN", "CANTIDAD SOLICITADA"
    ];

    const hoja = XLSX.utils.aoa_to_sheet([encabezados]);
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
const archivoReemplazarViaje = document.getElementById("archivoReemplazarViaje");
let _viajeAReemplazar = null;

const COLUMNAS_ESPERADAS_FARMACIA = [
    "fecha de cita", "viaje", "orden de compra", "entrega",
    "codigo/sku", "descripcion", "un", "cantidad solicitada"
];

async function leerFilasFarmaciaExcel(archivo){

    const buffer = await archivo.arrayBuffer();
    const libro = XLSX.read(buffer, { type: "array", cellDates: true });

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

    function fecha(clave){
        return parsearFechaExcel(valor(clave));
    }

    return {
        viaje: num("viaje"),
        orden_compra: num("orden de compra"),
        entrega: num("entrega"),
        fecha_cita: fecha("fecha de cita"),
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

        // Este cargador es SOLO para viajes nuevos. Si el archivo
        // trae algún viaje que ya tiene datos (sea cual sea su
        // estado), se rechaza completo — reemplazar un viaje ya
        // cargado es un flujo aparte: botón "Reemplazar" en el menú
        // ⋮ de VIAJES GENERADOS (solo disponible si está Desactivado).
        const viajesEnArchivo = [...new Set(filasNormalizadas.map(f => f.viaje))];

        const viajesYaCargados = [];

        for(const v of viajesEnArchivo){

            const existentes = await supabaseFetch(
                "/farmacia_data?select=id&limit=1&viaje=eq." + v
            );

            if(existentes && existentes.length){
                viajesYaCargados.push(v);
            }

        }

        if(viajesYaCargados.length){

            mostrarToast(
                "No se puede cargar: el viaje " + viajesYaCargados.join(", ") +
                " ya está cargado. Usa \"Reemplazar\" en el menú ⋮ de Viajes Generados para actualizarlo.",
                "error"
            );

            nombreArchivo.textContent = "-";
            archivoFarmacia.value = "";
            return;

        }

        nombreArchivo.textContent = "Guardando " + archivo.name + "...";

        // Todo viaje recién cargado queda en "desactivado" — hay que
        // activarlo a propósito desde "VIAJES GENERADOS".
        await supabaseFetch("/farmacia_viajes_activados?on_conflict=viaje", {
            method: "POST",
            headers: { "Prefer": "resolution=merge-duplicates" },
            body: JSON.stringify(viajesEnArchivo.map(function(v){
                return { viaje: v, estado: "desactivado" };
            }))
        });

        await guardarEnBloques("farmacia_data", filasNormalizadas);

        nombreArchivo.textContent = archivo.name;
        fechaArchivo.textContent = new Date().toLocaleDateString("es-PE");

        mostrarToast("Plantilla cargada: " + filasNormalizadas.length + " filas.", "exito");

        // Los totales/tabla de viajes reflejan TODO lo que hay en
        // farmacia_data (no solo este archivo), ya que ahora la carga
        // es por viaje y no reemplaza el resto.
        await cargarResumenExistente();

    }catch(err){

        console.error(err);
        mostrarToast("No se pudo cargar el archivo: " + err.message, "error");
        nombreArchivo.textContent = "-";
        archivoFarmacia.value = "";

    }

});

// Reemplazo dedicado de UN viaje puntual (disparado desde el botón
// "Reemplazar" del menú ⋮ en Viajes Generados). A diferencia del
// cargador de arriba, este exige que el archivo traiga únicamente
// el viaje que se está reemplazando.
archivoReemplazarViaje.addEventListener("change", async function(e){

    const archivo = e.target.files[0];
    const viaje = _viajeAReemplazar;

    if(!archivo || !viaje){
        archivoReemplazarViaje.value = "";
        return;
    }

    try{

        // Revalida el estado por si cambió mientras se elegía el archivo.
        const estados = await obtenerViajesActivadosFarmacia();
        const estadoActual = estados.get(viaje) || "desactivado";

        if(estadoActual !== "desactivado"){
            mostrarToast("El viaje " + viaje + " ya no está Desactivado, no se puede reemplazar.", "error");
            archivoReemplazarViaje.value = "";
            _viajeAReemplazar = null;
            return;
        }

        const filasCrudas = await leerFilasFarmaciaExcel(archivo);

        const errorFormato = validarFormatoFarmacia(filasCrudas);

        if(errorFormato){
            mostrarToast(errorFormato, "error");
            archivoReemplazarViaje.value = "";
            return;
        }

        const cargadoPor = (sesion && (sesion.nombre_completo || sesion.usuario)) || "";

        const filasNormalizadas = filasCrudas
            .map(f => normalizarFilaFarmacia(f, archivo.name, cargadoPor))
            .filter(f => f.viaje !== null && f.codigo);

        if(!filasNormalizadas.length){
            mostrarToast("No se encontraron filas válidas en el archivo (revisa columnas VIAJE y CODIGO/SKU).", "error");
            archivoReemplazarViaje.value = "";
            return;
        }

        const viajesDelArchivo = [...new Set(filasNormalizadas.map(f => f.viaje))];

        if(viajesDelArchivo.length > 1 || viajesDelArchivo[0] !== viaje){

            mostrarToast(
                "Este archivo trae el viaje " + viajesDelArchivo.join(", ") +
                ", pero estás reemplazando el viaje " + viaje + ". Sube el archivo de ese viaje exacto.",
                "error"
            );

            archivoReemplazarViaje.value = "";
            return;

        }

        const confirmado = confirm(
            "¿Reemplazar los datos del viaje " + viaje + " con este archivo (" +
            filasNormalizadas.length + " filas)?"
        );

        if(!confirmado){
            archivoReemplazarViaje.value = "";
            return;
        }

        await supabaseFetch("/farmacia_data?viaje=eq." + viaje, { method: "DELETE" });

        await guardarEnBloques("farmacia_data", filasNormalizadas);

        mostrarToast("Viaje " + viaje + " reemplazado: " + filasNormalizadas.length + " filas.", "exito");

        await cargarResumenExistente();

    }catch(err){

        console.error(err);
        mostrarToast("No se pudo reemplazar el viaje: " + err.message, "error");

    }finally{

        archivoReemplazarViaje.value = "";
        _viajeAReemplazar = null;

    }

});

// ========================================
// VIAJES GENERADOS
// ========================================

function formatearNumeroFarmacia(n){
    return Number(n || 0).toLocaleString("es-PE", { maximumFractionDigits: 2 });
}

function cargarViajesReales(filas, estadosMap){

    estadosMap = estadosMap || new Map();

    const porViaje = {};

    filas.forEach(function(f){

        const clave = f.viaje;
        if(clave === null || clave === undefined){
            return;
        }

        if(!porViaje[clave]){
            porViaje[clave] = { viaje: clave, ocs: new Set(), codigos: 0, cantidad: 0, fecha_cita: null };
        }

        if(f.orden_compra !== null && f.orden_compra !== undefined){
            porViaje[clave].ocs.add(f.orden_compra);
        }

        if(!porViaje[clave].fecha_cita && f.fecha_cita){
            porViaje[clave].fecha_cita = f.fecha_cita;
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

    const TEXTOS_ESTADO = { activo: "Activo", desactivado: "Desactivado", finalizado: "Finalizado" };
    const CLASES_ESTADO = { activo: "activado", desactivado: "advertencia", finalizado: "disponible" };

    viajes.forEach(function(v){

        const tr = document.createElement("tr");

        const estado = estadosMap.get(v.viaje) || "desactivado";
        const estadoTexto = TEXTOS_ESTADO[estado];
        const estadoClase = CLASES_ESTADO[estado];

        let items = "";

        if(estado === "desactivado"){
            items =
                '<button class="btn-activar" data-viaje="' + v.viaje + '">Activar</button>' +
                '<button class="btn-reemplazar" data-viaje="' + v.viaje + '">Reemplazar</button>' +
                '<button class="btn-finalizar" data-viaje="' + v.viaje + '">Guardar (Finalizar)</button>' +
                '<button class="btn-eliminar" data-viaje="' + v.viaje + '">Eliminar</button>';
        }else if(estado === "activo"){
            // Bloqueado: mientras está Activo no se puede Reemplazar
            // ni Eliminar — primero hay que Desactivarlo.
            items =
                '<button class="btn-desactivar" data-viaje="' + v.viaje + '">Desactivar</button>' +
                '<button class="btn-finalizar" data-viaje="' + v.viaje + '">Guardar (Finalizar)</button>';
        }else{
            items = '<button class="btn-guardar" data-viaje="' + v.viaje + '">Guardar</button>';
        }

        // Badge de Estado + botón ⋮ (que sigue siendo el que abre el
        // menú) juntos en una sola columna, para que no se corte en
        // pantallas angostas como pasaba antes con "Acción" aparte.
        const estadoConMenu = `
            <div class="menu-acciones">
                <span class="estado ${estadoClase}">${estadoTexto}</span>
                <button class="btn-menu-acciones" data-viaje="${v.viaje}">⋮</button>
                <div class="dropdown-acciones oculto">${items}</div>
            </div>
        `;

        tr.innerHTML = `
            <td>${v.viaje}</td>
            <td>${v.ocs.size}</td>
            <td>${v.fecha_cita || "-"}</td>
            <td>${v.codigos}</td>
            <td>${formatearNumeroFarmacia(v.cantidad)}</td>
            <td>${estadoConMenu}</td>
        `;

        tbody.appendChild(tr);

    });

}

// "Finalizado" significa que ya se pistoleó todo lo que pide el
// viaje (todos sus códigos, en todas sus OC). Devuelve
// {completo, pendientes} — pendientes es la lista de códigos a los
// que aún les falta.
async function viajeCompletamenteEscaneado(viaje){

    const [dataFilas, lecturasFilas] = await Promise.all([
        supabaseFetchTodo("/farmacia_data?select=codigo,cantidad&viaje=eq." + viaje),
        supabaseFetchTodo("/farmacia_lecturas?select=codigo,cantidad_cajas&viaje=eq." + viaje)
    ]);

    const solicitadoPorCodigo = {};

    (dataFilas || []).forEach(function(f){
        if(!f.codigo){
            return;
        }
        solicitadoPorCodigo[f.codigo] = (solicitadoPorCodigo[f.codigo] || 0) + Number(f.cantidad || 0);
    });

    const escaneadoPorCodigo = {};

    (lecturasFilas || []).forEach(function(f){
        if(!f.codigo){
            return;
        }
        escaneadoPorCodigo[f.codigo] = (escaneadoPorCodigo[f.codigo] || 0) + Number(f.cantidad_cajas || 0);
    });

    const pendientes = Object.keys(solicitadoPorCodigo).filter(function(codigo){
        const solicitado = solicitadoPorCodigo[codigo];
        const escaneado = escaneadoPorCodigo[codigo] || 0;
        return solicitado > 0 && escaneado < solicitado;
    });

    return { completo: pendientes.length === 0, pendientes: pendientes };

}

async function cambiarEstadoViaje(viaje, nuevoEstado){

    await supabaseFetch("/farmacia_viajes_activados?on_conflict=viaje", {
        method: "POST",
        headers: { "Prefer": "resolution=merge-duplicates" },
        body: JSON.stringify({
            viaje: viaje,
            estado: nuevoEstado,
            activado_por: (sesion && (sesion.nombre_completo || sesion.usuario)) || ""
        })
    });

}

function cerrarMenusAcciones(exceptoEste){

    document.querySelectorAll("#tblViajes .dropdown-acciones").forEach(function(d){
        if(d !== exceptoEste){
            d.classList.add("oculto");
        }
    });

}

document.addEventListener("click", function(){
    cerrarMenusAcciones(null);
});

document.getElementById("tblViajes").addEventListener("click", async function(e){

    const botonMenu = e.target.closest(".btn-menu-acciones");

    if(botonMenu){

        e.stopPropagation();

        const dropdown = botonMenu.nextElementSibling;
        const yaAbierto = !dropdown.classList.contains("oculto");

        cerrarMenusAcciones(null);

        if(!yaAbierto){
            dropdown.classList.remove("oculto");
        }

        return;

    }

    const botonActivar = e.target.closest(".btn-activar");
    const botonDesactivar = e.target.closest(".btn-desactivar");
    const botonFinalizar = e.target.closest(".btn-finalizar");
    const botonReemplazar = e.target.closest(".btn-reemplazar");
    const botonGuardar = e.target.closest(".btn-guardar");
    const botonEliminar = e.target.closest(".btn-eliminar");

    if(botonReemplazar){
        cerrarMenusAcciones(null);
        _viajeAReemplazar = Number(botonReemplazar.dataset.viaje);
        archivoReemplazarViaje.click();
        return;
    }

    if(botonGuardar){
        cerrarMenusAcciones(null);
        mostrarToast(
            "Función en desarrollo: más adelante esto guardará el viaje en un archivo histórico global y lo quitará de las tablas activas. Por ahora queda marcado como Finalizado.",
            "info"
        );
        return;
    }

    if(botonEliminar){

        const viaje = Number(botonEliminar.dataset.viaje);

        cerrarMenusAcciones(null);

        const confirmado = confirm(
            "¿Eliminar por completo el viaje " + viaje + "? Esto borra todos sus códigos, OC, lecturas, " +
            "stock físico y su estado (en todas las pestañas). No se puede deshacer."
        );

        if(!confirmado){
            return;
        }

        try{

            // Antes de borrar farmacia_data hay que saber qué OC
            // tenía este viaje, para poder limpiar también sus filas
            // en oc_portal_cliente (esa tabla no tiene columna
            // "viaje", solo "oc"). Si no se hace esto, la OC queda
            // huérfana ahí y sigue apareciendo en otras pantallas.
            const filasDelViaje = await supabaseFetch(
                "/farmacia_data?select=orden_compra&viaje=eq." + viaje
            );

            const ocsDelViaje = [...new Set((filasDelViaje || []).map(f => f.orden_compra))]
                .filter(v => v !== null && v !== undefined);

            if(ocsDelViaje.length){
                await supabaseFetch(
                    "/oc_portal_cliente?oc=in.(" + ocsDelViaje.join(",") + ")",
                    { method: "DELETE" }
                );
            }

            await supabaseFetch("/farmacia_lecturas?viaje=eq." + viaje, { method: "DELETE" });
            await supabaseFetch("/stock_fisico_sap?viaje=eq." + viaje, { method: "DELETE" });
            await supabaseFetch("/farmacia_data?viaje=eq." + viaje, { method: "DELETE" });
            await supabaseFetch("/farmacia_viajes_activados?viaje=eq." + viaje, { method: "DELETE" });

            mostrarToast("Viaje " + viaje + " eliminado (junto con sus OC, lecturas y stock).", "exito");

            await cargarResumenExistente();

        }catch(err){
            console.error(err);
            mostrarToast("No se pudo eliminar el viaje: " + err.message, "error");
        }

        return;

    }

    const boton = botonActivar || botonDesactivar || botonFinalizar;
    if(!boton){
        return;
    }

    cerrarMenusAcciones(null);

    const viaje = Number(boton.dataset.viaje);

    const nuevoEstado = botonActivar ? "activo" : (botonDesactivar ? "desactivado" : "finalizado");
    const textoProceso = botonActivar ? "Activando..." : (botonDesactivar ? "Desactivando..." : "Verificando...");
    const textoOriginal = boton.textContent;

    boton.disabled = true;
    boton.textContent = textoProceso;

    try{

        if(nuevoEstado === "finalizado"){

            const chequeo = await viajeCompletamenteEscaneado(viaje);

            if(!chequeo.completo){

                mostrarToast(
                    "No se puede finalizar: todavía falta pistolear " + chequeo.pendientes.length +
                    " código(s) de este viaje (" + chequeo.pendientes.join(", ") + ").",
                    "error"
                );

                boton.disabled = false;
                boton.textContent = textoOriginal;

                return;

            }

            boton.textContent = "Finalizando...";

        }

        await cambiarEstadoViaje(viaje, nuevoEstado);

        mostrarToast("Viaje " + viaje + ": " + nuevoEstado + ".", "exito");

        await refrescarVistaViajes();

    }catch(err){

        console.error(err);
        mostrarToast("No se pudo actualizar el viaje: " + err.message, "error");
        boton.disabled = false;
        boton.textContent = textoOriginal;

    }

});

// Devuelve un Map viaje -> estado ("activo" | "desactivado" | "finalizado").
// Un viaje sin fila todavía (nunca tocado) se trata como "desactivado"
// donde se consulte (no bloquea reemplazo, permite Activar).
async function obtenerViajesActivadosFarmacia(){

    try{

        const [filas, dataFilas, lecturasFilas] = await Promise.all([
            supabaseFetch("/farmacia_viajes_activados?select=viaje,estado"),
            supabaseFetchTodo("/farmacia_data?select=viaje,codigo,cantidad"),
            supabaseFetchTodo("/farmacia_lecturas?select=viaje,codigo,cantidad_cajas")
        ]);

        const estadosMap = new Map((filas || []).map(f => [f.viaje, f.estado || "desactivado"]));

        // "Finalizado" aparece SOLO (sin que nadie tenga que apretar
        // "Guardar (Finalizar)") apenas un viaje Activo/Desactivado
        // ya tiene todo pistoleado — mismo criterio que
        // viajeCompletamenteEscaneado, pero calculado para todos los
        // viajes de una sola pasada.
        const porViaje = {}; // viaje -> { codigo: {solicitado, escaneado} }

        (dataFilas || []).forEach(function(f){
            if(!f.codigo || f.viaje === null || f.viaje === undefined){
                return;
            }
            if(!porViaje[f.viaje]){
                porViaje[f.viaje] = {};
            }
            if(!porViaje[f.viaje][f.codigo]){
                porViaje[f.viaje][f.codigo] = { solicitado: 0, escaneado: 0 };
            }
            porViaje[f.viaje][f.codigo].solicitado += Number(f.cantidad || 0);
        });

        (lecturasFilas || []).forEach(function(f){
            if(!f.codigo || f.viaje === null || f.viaje === undefined){
                return;
            }
            if(!porViaje[f.viaje] || !porViaje[f.viaje][f.codigo]){
                return;
            }
            porViaje[f.viaje][f.codigo].escaneado += Number(f.cantidad_cajas || 0);
        });

        const porFinalizar = [];

        Object.keys(porViaje).forEach(function(viajeStr){

            const viaje = Number(viajeStr);
            const estadoActual = estadosMap.get(viaje) || "desactivado";

            if(estadoActual === "finalizado"){
                return;
            }

            const codigos = Object.values(porViaje[viajeStr]);

            const completo = codigos.length > 0 && codigos.every(function(c){
                return c.solicitado <= 0 || c.escaneado >= c.solicitado;
            });

            if(completo){
                porFinalizar.push(viaje);
            }

        });

        if(porFinalizar.length){

            await Promise.all(porFinalizar.map(function(viaje){
                return cambiarEstadoViaje(viaje, "finalizado").catch(function(e){ console.error(e); });
            }));

            porFinalizar.forEach(function(viaje){
                estadosMap.set(viaje, "finalizado");
            });

        }

        return estadosMap;

    }catch(e){
        console.error(e);
        return new Map();
    }

}

async function refrescarVistaViajes(){

    const filas = await supabaseFetch(
        "/farmacia_data?select=viaje,orden_compra,cantidad,fecha_cita"
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
            "/farmacia_data?select=viaje,orden_compra,cantidad,fecha_cita,archivo_origen,created_at&order=created_at.desc"
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

    await cargarOcsParaFiltroLecturas();

}

async function cargarOcsParaFiltroLecturas(){

    const viaje = document.getElementById("cmbViajeLecturas").value;
    const cmbOc = document.getElementById("filtroOcLecturas");
    const ocSeleccionada = cmbOc.value;

    try{

        let ruta = "/farmacia_data?select=orden_compra";

        if(viaje){
            ruta += "&viaje=eq." + viaje;
        }

        const filas = await supabaseFetchTodo(ruta);

        const ocs = [...new Set((filas || []).map(f => f.orden_compra))]
            .filter(v => v !== null && v !== undefined)
            .sort((a, b) => a - b);

        cmbOc.innerHTML = `<option value="">Todos</option>`;

        ocs.forEach(function(oc){
            const option = document.createElement("option");
            option.value = String(oc);
            option.textContent = String(oc);
            cmbOc.appendChild(option);
        });

        if(ocs.map(String).includes(ocSeleccionada)){
            cmbOc.value = ocSeleccionada;
        }

    }catch(e){
        console.error(e);
    }

}

document.getElementById("cmbViajeLecturas").addEventListener("change", cargarOcsParaFiltroLecturas);

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
    const oc = document.getElementById("filtroOcLecturas").value.trim();
    const codigo = document.getElementById("filtroCodigo").value.trim();
    const lote = document.getElementById("filtroLote").value.trim();

    try{

        let ruta = "/farmacia_lecturas?select=viaje,oc,codigo,descripcion,lote,fv,cantidad_cajas,escaneado_por,foto_url,created_at&order=created_at.desc";

        if(viaje){
            ruta += "&viaje=eq." + viaje;
        }

        if(oc){
            ruta += "&oc=eq." + encodeURIComponent(oc);
        }

        if(codigo){
            ruta += "&codigo=ilike.*" + encodeURIComponent(codigo) + "*";
        }

        if(lote){
            ruta += "&lote=ilike.*" + encodeURIComponent(lote) + "*";
        }

        const filas = await supabaseFetch(ruta);

        _ultimasLecturas = filas || [];

    }catch(e){

        console.error(e);
        _ultimasLecturas = [];

    }

}

// ========================================
// RESUMEN POR CÓDIGO (con observaciones)
// ========================================
// "Con observaciones" si: más de 3 lotes distintos, algún lote con
// vida útil restante (F.V. - hoy) menor o igual a la mitad de su TVU
// (de "4. MARA Alicorp"), o se pistoleó más de lo solicitado (si aún
// falta pistolear, eso es solo "Pendiente", no una observación). Para
// el chequeo de vida útil, si el F.V. leído/pistoleado está
// incompleto o vacío, se completa con la fecha de producción del
// Lote + el TVU del código (ver completarFvConLote) — eso solo se usa
// cuando falta el dato, nunca para "corregir" un F.V. ya completo.

let _ultimoResumenCodigo = [];

function mesesEntre(desde, hasta){

    let meses = (hasta.getFullYear() - desde.getFullYear()) * 12 + (hasta.getMonth() - desde.getMonth());

    if(hasta.getDate() < desde.getDate()){
        meses -= 1;
    }

    return meses;

}

// El Lote trae 10 dígitos: los primeros 6 son la fecha de producción
// (AA = año 20XX, MM = mes, DD = día) y los últimos 4 son el código
// de planta. Sirve para validar la F.V. leída/pistoleada contra el
// TVU del código (fecha de producción + TVU en meses = F.V.
// esperada), independiente de si el F.V. fue bien leído por OCR o a
// mano.
function decodificarLote(lote){

    const texto = String(lote || "").trim();

    if(!/^\d{10}$/.test(texto)){
        return null;
    }

    const aa = texto.slice(0, 2);
    const mm = texto.slice(2, 4);
    const dd = texto.slice(4, 6);
    const codigoPlanta = texto.slice(6, 10);

    if(Number(mm) < 1 || Number(mm) > 12 || Number(dd) < 1 || Number(dd) > 31){
        return null;
    }

    return {
        fechaProduccion: "20" + aa + "-" + mm + "-" + dd,
        codigoPlanta: codigoPlanta
    };

}

const MESES_ES = {
    enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6, julio: 7,
    agosto: 8, setiembre: 9, septiembre: 9, octubre: 10, noviembre: 11, diciembre: 12
};

// Detecta "MES AAAA" (ej: "SETIEMBRE 2029") en el texto del F.V.
// cuando no se pudo leer el día. Devuelve {mes, anio} o null.
function extraerMesAnio(texto){

    const limpio = sinTildes(String(texto || "")).trim().toLowerCase();
    const m = limpio.match(/([a-z]+)\D+(\d{4})/);

    if(!m){
        return null;
    }

    const mes = MESES_ES[m[1]];

    return mes ? { mes: mes, anio: Number(m[2]) } : null;

}

function ultimoDiaDeMes(anio, mes){
    return new Date(anio, mes, 0).getDate();
}

// Completa el F.V. SOLO cuando falta el dato (parcial o total),
// usando la fecha de producción del Lote + el TVU del código. Si el
// F.V. ya viene completo (día/mes/año), se devuelve tal cual, sin
// tocarlo.
function completarFvConLote(fvTexto, lote, tvu){

    const fechaCompleta = parsearFechaExcel(fvTexto);

    if(fechaCompleta){
        return fechaCompleta;
    }

    const decodificado = decodificarLote(lote);

    if(!decodificado || !tvu){
        return null;
    }

    const calculada = new Date(decodificado.fechaProduccion + "T00:00:00");
    calculada.setMonth(calculada.getMonth() + tvu);

    const anioCalc = calculada.getFullYear();
    const mesCalc = calculada.getMonth() + 1;
    const diaCalc = calculada.getDate();

    const mesAnio = extraerMesAnio(fvTexto);

    if(mesAnio && mesAnio.mes === mesCalc && mesAnio.anio === anioCalc){
        // Se leyó mes/año y coincide con el cálculo: solo faltaba el
        // día, se completa con el que da el cálculo.
        return anioCalc + "-" + String(mesCalc).padStart(2, "0") + "-" + String(diaCalc).padStart(2, "0");
    }

    if(mesAnio){
        // Se leyó mes/año pero no coincide con el cálculo del Lote:
        // se respeta el mes/año leído y se completa el día con el
        // último día de ese mes (no se confía en el cálculo si el
        // mes/año no cuadra).
        const dia = ultimoDiaDeMes(mesAnio.anio, mesAnio.mes);
        return mesAnio.anio + "-" + String(mesAnio.mes).padStart(2, "0") + "-" + String(dia).padStart(2, "0");
    }

    // No hay nada legible en el F.V. (vacío o ilegible): se completa
    // todo (día, mes y año) con el cálculo del Lote + TVU.
    return anioCalc + "-" + String(mesCalc).padStart(2, "0") + "-" + String(diaCalc).padStart(2, "0");

}

async function buscarResumenCodigo(){

    const viaje = document.getElementById("cmbViajeLecturas").value;
    const oc = document.getElementById("filtroOcLecturas").value.trim();
    const codigo = document.getElementById("filtroCodigo").value.trim();
    const lote = document.getElementById("filtroLote").value.trim();
    const estadoFiltro = document.getElementById("filtroEstadoResumen").value;

    const tbody = document.getElementById("tblResumenCodigo");
    tbody.innerHTML = `<tr><td colspan="8" class="sin-datos">Buscando...</td></tr>`;

    try{

        let rutaLecturas = "/farmacia_lecturas?select=id,viaje,oc,codigo,descripcion,lote,fv,cantidad_cajas,escaneado_por,foto_url,created_at&order=created_at.desc";
        let rutaData = "/farmacia_data?select=viaje,orden_compra,codigo,descripcion,cantidad";

        if(viaje){
            rutaLecturas += "&viaje=eq." + viaje;
            rutaData += "&viaje=eq." + viaje;
        }

        if(oc){
            rutaLecturas += "&oc=eq." + encodeURIComponent(oc);
            rutaData += "&orden_compra=eq." + encodeURIComponent(oc);
        }

        if(codigo){
            rutaLecturas += "&codigo=ilike.*" + encodeURIComponent(codigo) + "*";
            rutaData += "&codigo=ilike.*" + encodeURIComponent(codigo) + "*";
        }

        if(lote){
            rutaLecturas += "&lote=ilike.*" + encodeURIComponent(lote) + "*";
        }

        const [lecturasFilas, dataFilas, tvuFilas] = await Promise.all([
            supabaseFetchTodo(rutaLecturas),
            supabaseFetchTodo(rutaData),
            supabaseFetchTodo("/mara_alicorp?select=codigo,tvu")
        ]);

        const tvuPorCodigo = {};

        (tvuFilas || []).forEach(function(m){
            if(m.codigo && m.tvu){
                tvuPorCodigo[String(m.codigo).trim()] = Number(m.tvu);
            }
        });

        const porGrupo = {};

        function obtenerGrupo(viajeGrupo, ocGrupo, codigo, descripcion){

            const clave = viajeGrupo + "|" + ocGrupo + "|" + codigo;

            if(!porGrupo[clave]){
                porGrupo[clave] = {
                    viaje: viajeGrupo,
                    oc: ocGrupo,
                    codigo: codigo,
                    descripcion: descripcion || "",
                    solicitada: 0,
                    pistoleada: 0,
                    lotes: []
                };
            }

            if(descripcion && !porGrupo[clave].descripcion){
                porGrupo[clave].descripcion = descripcion;
            }

            return porGrupo[clave];

        }

        (dataFilas || []).forEach(function(f){
            if(!f.codigo){
                return;
            }
            const grupo = obtenerGrupo(f.viaje, f.orden_compra, f.codigo, f.descripcion);
            grupo.solicitada += Number(f.cantidad || 0);
        });

        (lecturasFilas || []).forEach(function(f){
            if(!f.codigo){
                return;
            }
            const grupo = obtenerGrupo(f.viaje, f.oc, f.codigo, f.descripcion);
            grupo.pistoleada += Number(f.cantidad_cajas || 0);
            grupo.lotes.push(f);
        });

        const hoy = new Date();

        const filas = Object.values(porGrupo).map(function(g){

            const lotesUnicos = [...new Set(g.lotes.map(l => l.lote).filter(Boolean))];
            const observaciones = [];

            if(lotesUnicos.length > 3){
                observaciones.push("Más de 3 lotes");
            }

            if(g.pistoleada > g.solicitada){
                observaciones.push("Diferencia de cantidad (se pistoleó más de lo solicitado)");
            }

            const tvu = tvuPorCodigo[String(g.codigo).trim()];

            if(tvu){

                const vidaInsuficiente = g.lotes.some(function(l){

                    const fv = completarFvConLote(l.fv, l.lote, tvu);
                    if(!fv){
                        return false;
                    }

                    const mesesRestantes = mesesEntre(hoy, new Date(fv + "T00:00:00"));

                    return mesesRestantes <= (tvu / 2);

                });

                if(vidaInsuficiente){
                    observaciones.push("Vida útil restante menor o igual a la mitad del TVU");
                }

            }

            let estadoClase;
            let estadoTexto;

            if(observaciones.length){
                estadoClase = "advertencia";
                estadoTexto = "Con observaciones";
            }else if(g.pistoleada >= g.solicitada && g.solicitada > 0){
                estadoClase = "activado";
                estadoTexto = "Completo";
            }else{
                estadoClase = "disponible";
                estadoTexto = "Pendiente";
            }

            return {
                viaje: g.viaje,
                oc: g.oc,
                codigo: g.codigo,
                descripcion: g.descripcion,
                solicitada: g.solicitada,
                pistoleada: g.pistoleada,
                lotesUnicos: lotesUnicos,
                lotesDetalle: g.lotes,
                observaciones: observaciones,
                estadoClase: estadoClase,
                estadoTexto: estadoTexto
            };

        }).filter(function(f){

            if(!estadoFiltro){
                return true;
            }

            const mapaFiltro = { completo: "activado", pendiente: "disponible", observaciones: "advertencia" };
            return f.estadoClase === mapaFiltro[estadoFiltro];

        }).sort(function(a, b){
            if(String(a.viaje) !== String(b.viaje)){
                return String(a.viaje).localeCompare(String(b.viaje));
            }
            if(String(a.oc) !== String(b.oc)){
                return String(a.oc).localeCompare(String(b.oc));
            }
            return String(a.codigo).localeCompare(String(b.codigo));
        });

        _ultimoResumenCodigo = filas;

        tbody.innerHTML = "";

        if(!filas.length){
            tbody.innerHTML = `<tr><td colspan="8" class="sin-datos">No se encontraron códigos con esos filtros.</td></tr>`;
            return;
        }

        filas.forEach(function(f, indice){

            const trResumen = document.createElement("tr");
            trResumen.className = "fila-resumen-codigo";
            trResumen.dataset.indice = indice;

            const tituloObservaciones = f.observaciones.length ? f.observaciones.join(" · ") : "";

            trResumen.innerHTML = `
                <td>${f.viaje || "-"}</td>
                <td>${f.oc || "-"}</td>
                <td><span class="flecha-resumen">▸</span>${f.codigo}</td>
                <td>${f.descripcion || "-"}</td>
                <td>
                    ${formatearNumeroFarmacia(f.solicitada)}
                    <button class="btn-editar-solicitada" data-viaje="${f.viaje}" data-oc="${f.oc}" data-codigo="${f.codigo}" data-actual="${f.solicitada}">✎</button>
                </td>
                <td>${formatearNumeroFarmacia(f.pistoleada)}</td>
                <td>${f.lotesUnicos.length}</td>
                <td>
                    <span class="estado ${f.estadoClase}">${f.estadoTexto}</span>
                    ${tituloObservaciones ? `<div class="detalle-observacion">${tituloObservaciones}</div>` : ""}
                </td>
            `;

            const trDetalle = document.createElement("tr");
            trDetalle.className = "fila-detalle-lotes oculto";

            const filasLotes = f.lotesDetalle.map(function(l){

                const accionFoto = l.foto_url
                    ? '<button class="btn-ver-foto" data-foto="' + l.foto_url.replace(/"/g, "&quot;") + '">Ver Foto</button>'
                    : '<span class="sin-foto">Sin foto</span>';

                return `
                    <tr>
                        <td>${formatearNumeroFarmacia(l.cantidad_cajas)}</td>
                        <td>${l.lote || "-"}</td>
                        <td>${l.fv || "-"}</td>
                        <td>${l.escaneado_por || "-"}</td>
                        <td>${formatearFechaHoraLecturas(l.created_at)}</td>
                        <td>${accionFoto}</td>
                        <td><button class="btn-eliminar-lectura" data-id="${l.id}" data-viaje="${l.viaje}">Eliminar</button></td>
                    </tr>
                `;

            }).join("");

            trDetalle.innerHTML = `
                <td colspan="8">
                    <table class="tabla-detalle-lotes">
                        <thead>
                            <tr>
                                <th>Cantidad</th>
                                <th>Lote</th>
                                <th>F.V.</th>
                                <th>Escaneado por</th>
                                <th>Hora</th>
                                <th>Evidencia</th>
                                <th>Acción</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${filasLotes || '<tr><td colspan="7" class="sin-datos">Sin lecturas.</td></tr>'}
                        </tbody>
                    </table>
                </td>
            `;

            tbody.appendChild(trResumen);
            tbody.appendChild(trDetalle);

        });

    }catch(e){

        console.error(e);
        tbody.innerHTML = `<tr><td colspan="8" class="sin-datos">No se pudo cargar el resumen por código.</td></tr>`;

    }

}

document.getElementById("tblResumenCodigo").addEventListener("click", async function(e){

    const botonFoto = e.target.closest(".btn-ver-foto");

    if(botonFoto){
        document.getElementById("modalFotoImg").src = botonFoto.dataset.foto;
        document.getElementById("modalFoto").classList.remove("oculto");
        return;
    }

    const botonEditar = e.target.closest(".btn-editar-solicitada");

    if(botonEditar){

        const viajeBtn = botonEditar.dataset.viaje;
        const ocBtn = botonEditar.dataset.oc;
        const codigoBtn = botonEditar.dataset.codigo;
        const actual = botonEditar.dataset.actual;

        const nuevoTexto = prompt(
            "Nueva cantidad solicitada para el código " + codigoBtn +
            " (Viaje " + viajeBtn + " / OC " + ocBtn + "):",
            actual
        );

        if(nuevoTexto === null){
            return;
        }

        const nuevaCantidad = Number(nuevoTexto);

        if(isNaN(nuevaCantidad) || nuevaCantidad < 0){
            mostrarToast("Ingresa una cantidad numérica válida.", "error");
            return;
        }

        try{

            const respuesta = await supabaseFetch(
                "/farmacia_data?viaje=eq." + viajeBtn + "&orden_compra=eq." + ocBtn + "&codigo=eq." + encodeURIComponent(codigoBtn),
                {
                    method: "PATCH",
                    headers: { "Prefer": "return=representation" },
                    body: JSON.stringify({ cantidad: nuevaCantidad })
                }
            );

            if(!respuesta || !respuesta.length){
                mostrarToast("No se encontró la fila de ese código/viaje/OC en la carga.", "error");
                return;
            }

            mostrarToast("Cantidad solicitada actualizada.", "exito");
            buscarResumenCodigo();

        }catch(err){
            console.error(err);
            mostrarToast("No se pudo actualizar la cantidad solicitada.", "error");
        }

        return;

    }

    const botonEliminar = e.target.closest(".btn-eliminar-lectura");

    if(botonEliminar){

        const id = botonEliminar.dataset.id;
        const viaje = botonEliminar.dataset.viaje;

        if(!confirm("¿Eliminar esta lectura? Esta acción no se puede deshacer.")){
            return;
        }

        try{

            await supabaseFetch("/farmacia_lecturas?id=eq." + id, { method: "DELETE" });

            // Si el viaje ya estaba Finalizado y esta lectura era
            // parte de lo que lo completaba, deja de estarlo: vuelve
            // a Activo (y así reaparece en Centro de Proyectos, en
            // vez de seguir "Finalizado" con datos incompletos).
            let mensaje = "Lectura eliminada.";

            if(viaje){

                const filaEstado = await supabaseFetch("/farmacia_viajes_activados?select=estado&viaje=eq." + viaje);
                const estadoActual = filaEstado && filaEstado[0] && filaEstado[0].estado;

                if(estadoActual === "finalizado"){

                    const chequeo = await viajeCompletamenteEscaneado(viaje);

                    if(!chequeo.completo){
                        await cambiarEstadoViaje(Number(viaje), "activo");
                        mensaje = "Lectura eliminada. El viaje " + viaje + " volvió a Activo (ya no está completo).";
                    }

                }

            }

            mostrarToast(mensaje, "exito");
            buscarResumenCodigo();

        }catch(err){
            console.error(err);
            mostrarToast("No se pudo eliminar la lectura.", "error");
        }

        return;

    }

    const fila = e.target.closest(".fila-resumen-codigo");
    if(!fila){
        return;
    }

    fila.classList.toggle("expandido");
    fila.nextElementSibling.classList.toggle("oculto");

});

document.getElementById("btnBuscarLecturas").addEventListener("click", function(){
    buscarLecturas();
    buscarResumenCodigo();
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

// Quita tildes/diéresis para no depender de que el Excel traiga
// exactamente "Cód." vs "Cod." o "Descripción" vs "Descripcion".
function sinTildes(texto){
    return String(texto).normalize("NFD").replace(/[̀-ͯ]/g, "");
}

// Convierte una celda de fecha (Date real, texto o serial de Excel)
// a "YYYY-MM-DD". OJO: si viene como texto en formato DD.MM.YYYY o
// DD/MM/YYYY (como lo exporta SAP/el portal en español), NO se debe
// usar `new Date(texto)` — el motor de JS lo interpreta como
// MM.DD.YYYY (formato US) y además revienta con días > 12 (ej:
// "27.06.2028" queda inválido, y "06.07.2028" sale como 6 de junio
// en vez de 6 de julio). Por eso se parsea el texto a mano.
function parsearFechaExcel(v){

    if(v === "" || v === undefined || v === null){
        return null;
    }

    if(v instanceof Date){

        if(isNaN(v.getTime())){
            return null;
        }

        // SheetJS arma las fechas en UTC (Date.UTC(y,m,d)), así que
        // hay que leer los componentes en UTC y no en hora local.
        const y = v.getUTCFullYear();
        const m = String(v.getUTCMonth() + 1).padStart(2, "0");
        const d = String(v.getUTCDate()).padStart(2, "0");
        return y + "-" + m + "-" + d;

    }

    const texto = String(v).trim();

    if(!texto){
        return null;
    }

    // DD.MM.YYYY o DD/MM/YYYY o DD-MM-YYYY (formato peruano/español).
    let m = texto.match(/^(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{4})$/);

    if(m){
        const dia = m[1].padStart(2, "0");
        const mes = m[2].padStart(2, "0");
        return m[3] + "-" + mes + "-" + dia;
    }

    // YYYY-MM-DD (ISO), con o sin hora.
    m = texto.match(/^(\d{4})-(\d{2})-(\d{2})/);

    if(m){
        return m[0];
    }

    // Serial de fecha de Excel (días desde 1899-12-30), por si
    // cellDates no llegó a convertir la celda.
    const serial = Number(texto);

    if(!isNaN(serial) && serial > 0){

        const ms = Math.round((serial - 25569) * 86400 * 1000);
        const fecha = new Date(ms);

        if(!isNaN(fecha.getTime())){
            const y = fecha.getUTCFullYear();
            const mo = String(fecha.getUTCMonth() + 1).padStart(2, "0");
            const d = String(fecha.getUTCDate()).padStart(2, "0");
            return y + "-" + mo + "-" + d;
        }

    }

    return null;

}

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

// Marca cada OC del desplegable con si ya tiene archivo cargado en
// "4. OC Portal Cliente" (🟢 Cargado) o no (⚪ Pendiente), para saber
// de un vistazo cuáles faltan sin tener que probarlas una por una.
async function cargarOcsParaSubir(){

    if(_ocsParaSubirCargadas){
        return;
    }

    _ocsParaSubirCargadas = true;

    try{

        const ocSeleccionadaAntes = cmbOcASubir.value;

        const [filas, ocPortalFilas] = await Promise.all([
            supabaseFetchTodo("/farmacia_data?select=orden_compra"),
            supabaseFetchTodo("/oc_portal_cliente?select=oc")
        ]);

        const ocsCargadas = new Set((ocPortalFilas || []).map(f => f.oc));

        // Unión de las OC de "1. Carga y Viajes" con las que ya
        // tengan archivo en "4. OC Portal Cliente" — así una OC no
        // desaparece del desplegable aunque su viaje ya no esté en
        // farmacia_data (por ejemplo, si se eliminó o se reemplazó).
        const ocs = [...new Set([
            ...(filas || []).map(f => f.orden_compra),
            ...ocsCargadas
        ])]
            .filter(v => v !== null && v !== undefined)
            .sort((a, b) => a - b);

        cmbOcASubir.querySelectorAll("option[value]:not([value=''])").forEach(function(op){
            op.remove();
        });

        ocs.forEach(function(oc){
            const option = document.createElement("option");
            option.value = String(oc);
            option.textContent = oc + (ocsCargadas.has(oc) ? " — 🟢 Cargado" : " — ⚪ Pendiente");
            cmbOcASubir.appendChild(option);
        });

        cmbOcASubir.value = ocSeleccionadaAntes;

    }catch(e){

        console.error(e);
        _ocsParaSubirCargadas = false;

    }

}

// Vuelve a consultar cuáles OC ya tienen archivo, para que el
// desplegable quede al día justo después de cargar una.
function refrescarOcsParaSubir(){
    _ocsParaSubirCargadas = false;
    cargarOcsParaSubir();
}

cmbOcASubir.addEventListener("change", function(){

    archivoOcPortal.value = "";
    archivoOcPortal.disabled = !cmbOcASubir.value;

});

// Solo se exigen las columnas que realmente se usan en el módulo; el
// resto del reporte del portal (tipo de documento, direcciones,
// precios, descuentos, destino, etc.) se acepta si viene pero no es
// obligatorio, porque varía según el reporte que exporte el cliente.
// "OC" a veces sale como "No. OC", e "Inretail / QS" a veces sale
// como "Código Inkafarma" — por eso esas dos son listas de nombres
// alternativos aceptados.
const COLUMNAS_ESPERADAS_OC = [
    ["oc", "no. oc"], ["inretail / qs", "codigo inkafarma"], "ean", "descripcion producto",
    "sku/empaque", "ctdad. sku solicitadas"
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

    const faltantes = COLUMNAS_ESPERADAS_OC.filter(function(esperada){
        const alternativas = Array.isArray(esperada) ? esperada : [esperada];
        return !alternativas.some(alt => columnasArchivo.includes(sinTildes(alt)));
    }).map(function(esperada){
        return Array.isArray(esperada) ? esperada.join(" / ") : esperada;
    });

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
        const claves = Array.isArray(clave) ? clave : [clave];
        for(let i = 0; i < claves.length; i++){
            const v = mapaFila[claves[i]];
            if(v !== undefined && v !== null && v !== ""){
                return v;
            }
        }
        return "";
    }

    function num(clave){
        const n = Number(valor(clave));
        return isNaN(n) || valor(clave) === "" ? null : n;
    }

    function texto(clave){
        return String(valor(clave)).trim();
    }

    function fecha(clave){
        return parsearFechaExcel(valor(clave));
    }

    return {
        oc: num(["oc", "no. oc"]),
        tipo_oc: texto("tipo o/c"),
        clase_documento: texto("clase de documento"),
        cod_lugar_entrega: texto("codigo lugar de entrega"),
        nombre_lugar_entrega: texto("nombre lugar de entrega"),
        direccion_entrega: texto("direccion de entrega"),
        fecha_emision: fecha("fecha emision"),
        fecha_vencimiento: fecha("fecha vencimiento"),
        posicion: num("posicion"),
        inretail_qs: texto(["inretail / qs", "codigo inkafarma"]),
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
            .filter(f => f.oc !== null && f.ean);

        if(!filasNormalizadas.length){
            mostrarToast("No se encontraron filas válidas en el archivo (revisa las columnas OC y EAN).", "error");
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
        refrescarOcsParaSubir();

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
    tbody.innerHTML = `<tr><td colspan="6" class="sin-datos">Cargando...</td></tr>`;

    try{

        let ruta = "/oc_portal_cliente?select=oc,posicion,inretail_qs,ean,descripcion_producto,sku_empaque,cantidad_sku_solicitada&order=oc.asc,posicion.asc";

        if(oc){
            ruta += "&oc=eq." + encodeURIComponent(oc);
        }

        if(codigo){
            ruta +=
                "&or=(ean.ilike.*" + encodeURIComponent(codigo) + "*,inretail_qs.ilike.*" + encodeURIComponent(codigo) + "*)";
        }

        const filas = await supabaseFetchTodo(ruta);

        tbody.innerHTML = "";

        if(!filas || !filas.length){
            tbody.innerHTML = `<tr><td colspan="6" class="sin-datos">No se encontraron OC con esos filtros.</td></tr>`;
            return;
        }

        filas.forEach(function(f){

            const tr = document.createElement("tr");

            tr.innerHTML = `
                <td>${f.oc}</td>
                <td>${f.inretail_qs || "-"}</td>
                <td>${f.ean || "-"}</td>
                <td>${f.descripcion_producto || "-"}</td>
                <td>${f.sku_empaque || "-"}</td>
                <td>${formatearNumeroFarmacia(f.cantidad_sku_solicitada)}</td>
            `;

            tbody.appendChild(tr);

        });

    }catch(e){

        console.error(e);
        tbody.innerHTML = `<tr><td colspan="6" class="sin-datos">No se pudo cargar las OC del portal.</td></tr>`;

    }

}

document.getElementById("btnBuscarOcPortal").addEventListener("click", buscarOcPortal);

// ========================================
// MARA ALICORP
// ========================================
// Acá "codigo" coincide directo con el CODIGO/SKU que se usa en el
// resto del módulo. Reusa mostrarToast, sesion, guardarEnBloques,
// sinTildes y supabaseFetchTodo (definidos arriba).

document.getElementById("btnDescargarPlantillaAlicorp").addEventListener("click", function(){

    const encabezados = [
        "codigo", "Decripción de material", "Código EAN/UPC", "Factor Unid. de Alm.",
        "Und. de almacenamiento", "TVU"
    ];

    const filasEjemplo = [
        [8321091, "SHAMPOO REPARADOR AMARAS 12FCO 400ML", "7750243073837", 12, "CJA", 24],
        [8301104, "CEP DENTO GALAXY NIÑOS 14UND 6DSP", "7751851007931", 84, "CJA", 24]
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
        tvu: num(["tvu"]),
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
    tbody.innerHTML = `<tr><td colspan="6" class="sin-datos">Cargando...</td></tr>`;

    try{

        let ruta = "/mara_alicorp?select=codigo,descripcion,ean,factor_unidad_alm,unidad_almacenamiento,tvu&order=descripcion.asc";

        if(codigo){
            ruta += "&codigo=ilike.*" + encodeURIComponent(codigo) + "*";
        }

        if(descripcion){
            ruta += "&descripcion=ilike.*" + encodeURIComponent(descripcion) + "*";
        }

        const filas = await supabaseFetchTodo(ruta);

        tbody.innerHTML = "";

        if(!filas || !filas.length){
            tbody.innerHTML = `<tr><td colspan="6" class="sin-datos">No se encontraron materiales con esos filtros.</td></tr>`;
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
                <td>${f.tvu || "-"}</td>
            `;

            tbody.appendChild(tr);

        });

    }catch(e){

        console.error(e);
        tbody.innerHTML = `<tr><td colspan="6" class="sin-datos">No se pudo cargar el maestro Alicorp.</td></tr>`;

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
const cajaOcsCanalStock = document.getElementById("cajaOcsCanalStock");
const listaOcCanalStock = document.getElementById("listaOcCanalStock");
const btnGuardarCanalesStock = document.getElementById("btnGuardarCanalesStock");
const archivoStock = document.getElementById("archivoStock");
const nombreArchivoStock = document.getElementById("nombreArchivoStock");
const fechaArchivoStock = document.getElementById("fechaArchivoStock");

let _viajesStockCargados = false;

// Se marca 🟢 Cargado / ⚪ Pendiente según si el viaje ya tiene Stock
// Físico SAP guardado, igual que el desplegable de OC en
// "3. OC Portal Cliente" — así se ve de un vistazo cuáles faltan.
async function cargarViajesParaStock(){

    if(_viajesStockCargados){
        return;
    }

    _viajesStockCargados = true;

    try{

        const viajeSeleccionadoAntes = cmbViajeStock.value;

        const [filas, sapFilas] = await Promise.all([
            supabaseFetchTodo("/farmacia_data?select=viaje"),
            supabaseFetchTodo("/stock_fisico_sap?select=viaje")
        ]);

        const viajesConSap = new Set((sapFilas || []).map(f => f.viaje));

        const viajes = [...new Set((filas || []).map(f => f.viaje))]
            .filter(v => v !== null && v !== undefined)
            .sort((a, b) => a - b);

        cmbViajeStock.querySelectorAll("option[value]:not([value=''])").forEach(op => op.remove());

        viajes.forEach(function(v){
            const option = document.createElement("option");
            option.value = String(v);
            option.textContent = v + (viajesConSap.has(v) ? " — 🟢 Cargado" : " — ⚪ Pendiente");
            cmbViajeStock.appendChild(option);
        });

        cmbViajeStock.value = viajeSeleccionadoAntes;

    }catch(e){
        console.error(e);
        _viajesStockCargados = false;
    }

}

function refrescarViajesParaStock(){
    _viajesStockCargados = false;
    cargarViajesParaStock();
}

function resetearSeleccionStock(){

    cajaOcsCanalStock.classList.add("oculto");
    listaOcCanalStock.innerHTML = "";

    archivoStock.value = "";
    archivoStock.disabled = true;

    nombreArchivoStock.textContent = "-";
    fechaArchivoStock.textContent = "-";
    document.getElementById("totalRegistrosStock").textContent = "-";

}

function ocsDelFormularioStock(){
    return Array.from(listaOcCanalStock.querySelectorAll(".input-canal-oc"))
        .map(input => Number(input.dataset.oc));
}

async function guardarCanalesActuales(){

    const filas = Array.from(listaOcCanalStock.querySelectorAll(".input-canal-oc"))
        .map(function(input){
            return { oc: Number(input.dataset.oc), canal: input.value.trim() };
        })
        .filter(f => f.canal);

    if(!filas.length){
        return;
    }

    await supabaseFetch("/oc_canal?on_conflict=oc", {
        method: "POST",
        headers: { "Prefer": "resolution=merge-duplicates" },
        body: JSON.stringify(filas)
    });

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

        if(!ocs.length){
            mostrarToast("Ese viaje no tiene OC cargadas.", "error");
            return;
        }

        const canalesExistentes = await supabaseFetchTodo(
            "/oc_canal?select=oc,canal&oc=in.(" + ocs.join(",") + ")"
        );

        const mapaCanal = new Map((canalesExistentes || []).map(f => [f.oc, f.canal || ""]));

        listaOcCanalStock.innerHTML = "";

        ocs.forEach(function(oc){

            const fila = document.createElement("div");
            fila.className = "fila-oc-canal";
            fila.innerHTML =
                '<span class="oc-numero">' + oc + '</span>' +
                '<input type="text" class="input-canal-oc" data-oc="' + oc + '" ' +
                'placeholder="Ej: CD LIMA" value="' + (mapaCanal.get(oc) || "") + '">';

            listaOcCanalStock.appendChild(fila);

        });

        cajaOcsCanalStock.classList.remove("oculto");
        archivoStock.disabled = false;

        const yaCargado = await supabaseFetchTodo(
            "/stock_fisico_sap?select=id,archivo_origen,created_at&viaje=eq." + cmbViajeStock.value +
            "&order=created_at.desc"
        );

        if(yaCargado && yaCargado.length){
            nombreArchivoStock.textContent = yaCargado[0].archivo_origen || "-";
            fechaArchivoStock.textContent = new Date(yaCargado[0].created_at).toLocaleDateString("es-PE");
            document.getElementById("totalRegistrosStock").textContent = yaCargado.length.toLocaleString("es-PE");
        }

    }catch(e){
        console.error(e);
        mostrarToast("No se pudieron cargar las OC de ese viaje.", "error");
    }

});

btnGuardarCanalesStock.addEventListener("click", async function(){

    const filas = Array.from(listaOcCanalStock.querySelectorAll(".input-canal-oc"))
        .map(function(input){
            return { oc: Number(input.dataset.oc), canal: input.value.trim() };
        })
        .filter(f => f.canal);

    if(!filas.length){
        mostrarToast("Escribe al menos un Canal para guardar.", "error");
        return;
    }

    try{
        await guardarCanalesActuales();
        mostrarToast("Canales guardados.", "exito");
    }catch(e){
        console.error(e);
        mostrarToast("No se pudieron guardar los canales: " + e.message, "error");
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

function normalizarFilaStock(filaOriginal, archivo, cargadoPor, viaje, mapaCanalPorUbicacion){

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
        return parsearFechaExcel(valor(clave));
    }

    const ubicacionTexto = texto("ubicacion");
    const ocEncontrada = mapaCanalPorUbicacion.get(sinTildes(ubicacionTexto).trim().toLowerCase());

    return {
        viaje: viaje,
        oc: (ocEncontrada === undefined) ? null : ocEncontrada,
        tipo_almacen: texto("tipo almacen"),
        ubicacion: ubicacionTexto,
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

    if(!cmbViajeStock.value){
        mostrarToast("Primero selecciona el Viaje.", "error");
        archivoStock.value = "";
        return;
    }

    const inputsCanal = Array.from(listaOcCanalStock.querySelectorAll(".input-canal-oc"));
    const ocsSinCanal = inputsCanal.filter(input => !input.value.trim()).map(input => input.dataset.oc);

    if(ocsSinCanal.length){
        mostrarToast(
            "No se subió nada: falta asignar el Canal a la OC " + ocsSinCanal.join(", ") +
            ". Todas las OC del viaje deben tener Canal antes de subir el archivo.",
            "error"
        );
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

        // Guarda lo que haya en los campos de Canal antes de usarlos para
        // identificar la OC de cada fila.
        await guardarCanalesActuales();

        const ocsDelViaje = ocsDelFormularioStock();

        const canalesActuales = await supabaseFetchTodo(
            "/oc_canal?select=oc,canal&oc=in.(" + ocsDelViaje.join(",") + ")"
        );

        const mapaCanalPorUbicacion = new Map();

        (canalesActuales || []).forEach(function(f){
            if(f.canal){
                mapaCanalPorUbicacion.set(sinTildes(f.canal).trim().toLowerCase(), f.oc);
            }
        });

        const cargadoPor = (sesion && (sesion.nombre_completo || sesion.usuario)) || "";

        const filasNormalizadas = filasCrudas
            .map(f => normalizarFilaStock(f, archivo.name, cargadoPor, viajeSeleccionado, mapaCanalPorUbicacion))
            .filter(f => f.producto && f.lote);

        if(!filasNormalizadas.length){
            mostrarToast("No se encontraron filas válidas en el archivo (revisa las columnas PRODUCTO y LOTE).", "error");
            nombreArchivoStock.textContent = "-";
            archivoStock.value = "";
            return;
        }

        const filasSinOc = filasNormalizadas.filter(f => f.oc === null);

        if(filasSinOc.length){

            const ubicacionesSinMatch = [...new Set(filasSinOc.map(f => f.ubicacion || "(vacío)"))];

            mostrarToast(
                "No se subió nada: " + filasSinOc.length + " fila(s) tienen una Ubicación que no " +
                "coincide con ningún Canal asignado (" + ubicacionesSinMatch.join(", ") + "). " +
                "Corrige el Canal de la OC correspondiente o la Ubicación del archivo y vuelve a subirlo.",
                "error"
            );
            nombreArchivoStock.textContent = "-";
            archivoStock.value = "";
            return;

        }

        const existentes = await supabaseFetch(
            "/stock_fisico_sap?viaje=eq." + viajeSeleccionado + "&select=id&limit=1"
        );

        if(existentes && existentes.length){

            const confirmado = confirm(
                "Ya hay stock físico cargado para el Viaje " + viajeSeleccionado +
                ". ¿Deseas reemplazarlo con este archivo (" + filasNormalizadas.length + " filas)?"
            );

            if(!confirmado){
                nombreArchivoStock.textContent = "-";
                archivoStock.value = "";
                return;
            }

            await supabaseFetch(
                "/stock_fisico_sap?viaje=eq." + viajeSeleccionado,
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
            "Stock físico cargado para Viaje " + viajeSeleccionado + ": " + filasNormalizadas.length + " filas.",
            "exito"
        );

        refrescarViajesParaStock();

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
                <td>${f.oc === null ? "-" : f.oc}</td>
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

// ========================================
// CRUCE DE INFORMACIÓN
// ========================================
// OC Portal Cliente (EAN) -> MARA Alicorp (código real + factor de
// conversión) -> comparar contra lo escaneado en Lecturas. Reusa
// mostrarToast, supabaseFetchTodo y formatearNumeroFarmacia
// (definidos arriba).

const cmbViajeCruce = document.getElementById("cmbViajeCruce");
const cmbOcCruce = document.getElementById("cmbOcCruce");

let _viajesCruceCargados = false;

async function cargarViajesParaCruce(){

    if(_viajesCruceCargados){
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
            cmbViajeCruce.appendChild(option);
        });

        _viajesCruceCargados = true;

    }catch(e){
        console.error(e);
    }

}

cmbViajeCruce.addEventListener("change", async function(){

    cmbOcCruce.innerHTML = `<option value="">Selecciona primero el viaje...</option>`;
    cmbOcCruce.disabled = true;

    document.getElementById("tblCruce").innerHTML =
        `<tr><td colspan="8" class="sin-datos">Selecciona el Viaje y la OC, y presiona "Calcular Cruce".</td></tr>`;

    if(!cmbViajeCruce.value){
        return;
    }

    try{

        const filas = await supabaseFetchTodo(
            "/farmacia_data?select=orden_compra&viaje=eq." + cmbViajeCruce.value
        );

        const ocs = [...new Set((filas || []).map(f => f.orden_compra))]
            .filter(v => v !== null && v !== undefined)
            .sort((a, b) => a - b);

        cmbOcCruce.innerHTML = `<option value="">Selecciona la OC...</option>`;

        ocs.forEach(function(oc){
            const option = document.createElement("option");
            option.value = String(oc);
            option.textContent = String(oc);
            cmbOcCruce.appendChild(option);
        });

        cmbOcCruce.disabled = false;

    }catch(e){
        console.error(e);
        mostrarToast("No se pudieron cargar las OC de ese viaje.", "error");
    }

});

async function calcularCruce(){

    const viaje = Number(cmbViajeCruce.value);
    const oc = Number(cmbOcCruce.value);

    const tbody = document.getElementById("tblCruce");

    if(!cmbViajeCruce.value || !cmbOcCruce.value){
        mostrarToast("Primero selecciona el Viaje y la OC.", "error");
        return;
    }

    tbody.innerHTML = `<tr><td colspan="8" class="sin-datos">Calculando cruce...</td></tr>`;

    try{

        const [ocPortalFilas, maraAlicorpFilas, lecturasFilas, dataFilas] = await Promise.all([
            supabaseFetchTodo(
                "/oc_portal_cliente?select=ean,codigo_proveedor,descripcion_producto,posicion,cantidad_sku_solicitada&oc=eq." + oc
            ),
            supabaseFetchTodo("/mara_alicorp?select=ean,codigo,descripcion,factor_unidad_alm"),
            supabaseFetchTodo(
                "/farmacia_lecturas?select=codigo,cantidad_cajas&viaje=eq." + viaje + "&oc=eq." + oc
            ),
            supabaseFetchTodo(
                "/farmacia_data?select=codigo&viaje=eq." + viaje + "&orden_compra=eq." + oc
            )
        ]);

        if(!ocPortalFilas || !ocPortalFilas.length){
            tbody.innerHTML = `<tr><td colspan="8" class="sin-datos">Esa OC todavía no tiene datos cargados en "3. OC Portal Cliente".</td></tr>`;
            return;
        }

        // Solo se cruzan los códigos que realmente se solicitaron en
        // SAP (lo que se sube primero en "1. Carga y Viajes"): la OC
        // Portal Cliente trae MUCHAS líneas que no son parte de este
        // envío puntual, y esas no deben aparecer en el cruce.
        const codigosSap = new Set((dataFilas || []).map(f => String(f.codigo || "").trim()).filter(Boolean));

        const maraPorEan = {};

        (maraAlicorpFilas || []).forEach(function(m){
            if(m.ean){
                maraPorEan[String(m.ean).trim()] = m;
            }
        });

        const escaneadoCajasPorCodigo = {};

        (lecturasFilas || []).forEach(function(l){
            if(!l.codigo){
                return;
            }
            escaneadoCajasPorCodigo[l.codigo] = (escaneadoCajasPorCodigo[l.codigo] || 0) + Number(l.cantidad_cajas || 0);
        });

        // La OC pide en UNIDADES; lo escaneado se registra en CAJAS.
        // Se convierte lo escaneado a unidades (cajas × factor) para
        // compararlo directo contra lo que pide la OC. El problema es
        // escanear MÁS unidades de las que pide la OC — si todavía
        // falta, solo está pendiente (no es un error).
        const filas = ocPortalFilas.filter(function(row){

            const ean = String(row.ean || "").trim();
            const mara = maraPorEan[ean] || null;
            const codigo = mara ? String(mara.codigo || "").trim() : null;

            return codigo && codigosSap.has(codigo);

        }).map(function(row){

            const ean = String(row.ean || "").trim();
            const mara = maraPorEan[ean] || null;
            const codigo = mara ? mara.codigo : null;
            const factor = mara ? Number(mara.factor_unidad_alm) : null;

            const solicitado = Number(row.cantidad_sku_solicitada || 0);
            const escaneadoCajas = codigo ? (escaneadoCajasPorCodigo[codigo] || 0) : 0;
            const escaneadoUnidades = (factor && factor > 0) ? Math.round(escaneadoCajas * factor) : null;

            let estadoTexto;
            let estadoClase;

            if(!codigo){
                estadoTexto = "Sin MARA Alicorp";
                estadoClase = "advertencia";
            }else if(escaneadoUnidades === null){
                estadoTexto = "Sin factor";
                estadoClase = "advertencia";
            }else{

                // No siempre lo solicitado es múltiplo exacto del factor
                // (ej: pide 2110 unidades con factor 84 → 25 cajas son
                // 2100, y 26 cajas ya son 2184, más de lo pedido). No
                // se puede escanear una caja "a medias", así que lo
                // máximo que se puede llegar sin pasarse es el múltiplo
                // entero de cajas más cercano por debajo — eso ya
                // cuenta como completo.
                const cajasMaxSinExceder = Math.floor(solicitado / factor);

                if(escaneadoCajas > cajasMaxSinExceder){
                    estadoTexto = "Excede lo solicitado";
                    estadoClase = "pendiente";
                }else{
                    // Escaneado <= solicitado: está bien (no importa
                    // si es justo lo solicitado o menos), cuenta como
                    // Completo. El único problema es exceder.
                    estadoTexto = "Completo";
                    estadoClase = "activado";
                }

            }

            return {
                ean: ean || "-",
                codigo: codigo || "-",
                descripcion: (mara && mara.descripcion) || row.descripcion_producto || "-",
                solicitado: solicitado,
                factor: factor,
                escaneadoCajas: escaneadoCajas,
                escaneadoUnidades: escaneadoUnidades,
                estadoTexto: estadoTexto,
                estadoClase: estadoClase
            };

        }).sort(function(a, b){

            const prioridad = { "pendiente": 0, "advertencia": 1, "disponible": 2, "activado": 3 };
            return prioridad[a.estadoClase] - prioridad[b.estadoClase];

        });

        tbody.innerHTML = "";

        if(!filas.length){
            tbody.innerHTML = `<tr><td colspan="8" class="sin-datos">Ninguna línea de la OC Portal coincide con los códigos solicitados en "1. Carga y Viajes" para este Viaje/OC.</td></tr>`;
            return;
        }

        filas.forEach(function(f){

            const tr = document.createElement("tr");

            tr.innerHTML = `
                <td>${f.ean}</td>
                <td>${f.codigo}</td>
                <td>${f.descripcion}</td>
                <td>${formatearNumeroFarmacia(f.solicitado)}</td>
                <td>${f.factor || "-"}</td>
                <td>${formatearNumeroFarmacia(f.escaneadoCajas)}</td>
                <td>${f.escaneadoUnidades === null ? "-" : formatearNumeroFarmacia(f.escaneadoUnidades)}</td>
                <td><span class="estado ${f.estadoClase}">${f.estadoTexto}</span></td>
            `;

            tbody.appendChild(tr);

        });

    }catch(e){

        console.error(e);
        tbody.innerHTML = `<tr><td colspan="8" class="sin-datos">No se pudo calcular el cruce.</td></tr>`;

    }

}

document.getElementById("btnCalcularCruce").addEventListener("click", calcularCruce);

// ========================================
// DATA FINAL
// ========================================
// Lo escaneado en Lecturas -> se resuelve el SKU real buscando el
// EAN en "4. MARA Alicorp" y con ese EAN se busca el "Código
// Inkafarma" (o "Inretail/QS") de esa misma OC en "3. OC Portal
// Cliente" -> se arma el reporte final agrupado por SKU y Lote.
// Reusa supabaseFetchTodo y mostrarToast (definidos arriba).

const cmbOcDataFinal = document.getElementById("cmbOcDataFinal");

let _ocsDataFinalCargadas = false;
let _viajePorOcDataFinal = {};
let _ultimaDataFinal = [];

// Solo se ofrecen las OC ya "completas": cruzadas exacto (ni exceden
// ni les falta, igual que "6. Cruce de Información") y sin ninguna
// observación por código (más de 3 lotes, vida útil <= mitad del
// TVU) — mismos criterios que Cruce y Resumen por Código, pero
// evaluados acá para decidir si la OC ya está lista para el reporte
// final.
async function cargarOcsCompletasParaDataFinal(){

    if(_ocsDataFinalCargadas){
        return;
    }

    _ocsDataFinalCargadas = true;

    cmbOcDataFinal.innerHTML = `<option value="">Cargando OC...</option>`;
    cmbOcDataFinal.disabled = true;

    try{

        const [dataFilas, ocPortalFilas, alicorpFilas, lecturasFilas] = await Promise.all([
            supabaseFetchTodo("/farmacia_data?select=viaje,orden_compra,codigo"),
            supabaseFetchTodo("/oc_portal_cliente?select=oc,ean,cantidad_sku_solicitada"),
            supabaseFetchTodo("/mara_alicorp?select=ean,codigo,factor_unidad_alm,tvu"),
            supabaseFetchTodo("/farmacia_lecturas?select=viaje,oc,codigo,lote,fv,cantidad_cajas")
        ]);

        const maraPorEan = {};
        const tvuPorCodigo = {};

        (alicorpFilas || []).forEach(function(m){
            if(m.ean){
                maraPorEan[String(m.ean).trim()] = m;
            }
            if(m.codigo && m.tvu){
                tvuPorCodigo[String(m.codigo).trim()] = Number(m.tvu);
            }
        });

        const infoPorOc = {};

        (dataFilas || []).forEach(function(f){
            if(f.orden_compra === null || f.orden_compra === undefined || !f.codigo){
                return;
            }
            if(!infoPorOc[f.orden_compra]){
                infoPorOc[f.orden_compra] = { viaje: f.viaje, codigosSap: new Set() };
            }
            infoPorOc[f.orden_compra].codigosSap.add(String(f.codigo).trim());
        });

        const lecturasPorOcCodigo = {};

        (lecturasFilas || []).forEach(function(l){
            if(l.oc === null || l.oc === undefined || !l.codigo){
                return;
            }
            const clave = l.oc + "|" + l.codigo;
            if(!lecturasPorOcCodigo[clave]){
                lecturasPorOcCodigo[clave] = { cajas: 0, lotes: [] };
            }
            lecturasPorOcCodigo[clave].cajas += Number(l.cantidad_cajas || 0);
            lecturasPorOcCodigo[clave].lotes.push(l);
        });

        const lineasPorOc = {};

        (ocPortalFilas || []).forEach(function(row){

            const info = infoPorOc[row.oc];
            if(!info){
                return;
            }

            const ean = String(row.ean || "").trim();
            const mara = maraPorEan[ean] || null;
            const codigo = mara ? String(mara.codigo || "").trim() : null;

            if(!codigo || !info.codigosSap.has(codigo)){
                return;
            }

            if(!lineasPorOc[row.oc]){
                lineasPorOc[row.oc] = [];
            }

            lineasPorOc[row.oc].push({
                codigo: codigo,
                solicitado: Number(row.cantidad_sku_solicitada || 0),
                factor: Number(mara.factor_unidad_alm) || null
            });

        });

        const hoy = new Date();
        _viajePorOcDataFinal = {};

        const ocsCompletas = Object.keys(lineasPorOc).filter(function(ocStr){

            const oc = Number(ocStr);
            const lineas = lineasPorOc[ocStr];

            const completa = lineas.length > 0 && lineas.every(function(linea){

                if(!linea.factor || linea.factor <= 0){
                    return false;
                }

                const datosLectura = lecturasPorOcCodigo[oc + "|" + linea.codigo] || { cajas: 0, lotes: [] };
                const cajasMaxSinExceder = Math.floor(linea.solicitado / linea.factor);

                if(datosLectura.cajas !== cajasMaxSinExceder){
                    return false;
                }

                const lotesUnicos = [...new Set(datosLectura.lotes.map(l => l.lote).filter(Boolean))];

                if(lotesUnicos.length > 3){
                    return false;
                }

                const tvu = tvuPorCodigo[linea.codigo];

                if(tvu){

                    const vidaInsuficiente = datosLectura.lotes.some(function(l){

                        const fv = completarFvConLote(l.fv, l.lote, tvu);
                        if(!fv){
                            return false;
                        }

                        const mesesRestantes = mesesEntre(hoy, new Date(fv + "T00:00:00"));
                        return mesesRestantes <= (tvu / 2);

                    });

                    if(vidaInsuficiente){
                        return false;
                    }

                }

                return true;

            });

            if(completa){
                _viajePorOcDataFinal[oc] = infoPorOc[oc].viaje;
            }

            return completa;

        }).map(Number).sort((a, b) => a - b);

        cmbOcDataFinal.innerHTML = `<option value="">Selecciona la OC...</option>`;

        ocsCompletas.forEach(function(oc){
            const option = document.createElement("option");
            option.value = String(oc);
            option.textContent = String(oc);
            cmbOcDataFinal.appendChild(option);
        });

        cmbOcDataFinal.disabled = false;

        if(!ocsCompletas.length){
            mostrarToast(
                "Todavía no hay ninguna OC completa (sin exceder/faltar y sin observaciones) para generar Data Final.",
                "info"
            );
        }

    }catch(e){

        console.error(e);
        cmbOcDataFinal.innerHTML = `<option value="">No se pudieron cargar las OC</option>`;
        _ocsDataFinalCargadas = false;

    }

}

async function generarDataFinal(){

    const oc = Number(cmbOcDataFinal.value);
    const viaje = _viajePorOcDataFinal[oc];

    const tbody = document.getElementById("tblDataFinal");

    if(!cmbOcDataFinal.value || !viaje){
        mostrarToast("Primero selecciona la OC.", "error");
        return;
    }

    tbody.innerHTML = `<tr><td colspan="5" class="sin-datos">Generando...</td></tr>`;

    try{

        const [lecturasFilas, alicorpFilas, ocPortalFilas] = await Promise.all([
            supabaseFetchTodo(
                "/farmacia_lecturas?select=codigo,lote,fv,cantidad_cajas&viaje=eq." + viaje + "&oc=eq." + oc
            ),
            supabaseFetchTodo("/mara_alicorp?select=codigo,ean,factor_unidad_alm"),
            supabaseFetchTodo("/oc_portal_cliente?select=ean,inretail_qs&oc=eq." + oc)
        ]);

        if(!lecturasFilas || !lecturasFilas.length){
            tbody.innerHTML = `<tr><td colspan="5" class="sin-datos">Esa OC todavía no tiene lecturas escaneadas.</td></tr>`;
            _ultimaDataFinal = [];
            return;
        }

        // Cadena de resolución del SKU final: nuestro código -> EAN
        // (vía "4. MARA Alicorp") -> "Código Inkafarma" (o
        // "Inretail/QS") de ese mismo EAN en "3. OC Portal Cliente".
        const eanPorCodigo = {};
        const factorPorCodigo = {};

        (alicorpFilas || []).forEach(function(a){
            const clave = String(a.codigo || "").trim();
            if(!clave){
                return;
            }
            if(a.ean && !eanPorCodigo[clave]){
                eanPorCodigo[clave] = String(a.ean).trim();
            }
            if(a.factor_unidad_alm && !factorPorCodigo[clave]){
                factorPorCodigo[clave] = Number(a.factor_unidad_alm);
            }
        });

        const skuPorEan = {};

        (ocPortalFilas || []).forEach(function(o){
            const clave = String(o.ean || "").trim();
            if(clave && !skuPorEan[clave]){
                skuPorEan[clave] = o.inretail_qs;
            }
        });

        const grupos = {};

        lecturasFilas.forEach(function(l){

            const codigo = String(l.codigo || "").trim();
            const ean = eanPorCodigo[codigo] || null;
            const sku = ean ? (skuPorEan[ean] || null) : null;
            const clave = l.codigo + "|" + (l.lote || "") + "|" + (l.fv || "");

            if(!grupos[clave]){
                grupos[clave] = {
                    codigo: codigo,
                    sku: sku,
                    lote: l.lote || "-",
                    fv: l.fv || "-",
                    cantidadCajas: 0
                };
            }

            grupos[clave].cantidadCajas += Number(l.cantidad_cajas || 0);

        });

        const filas = Object.values(grupos).sort(function(a, b){
            return String(a.sku).localeCompare(String(b.sku));
        });

        // La cantidad final va en UNIDADES (cajas × factor de "5. MARA
        // Alicorp"), no en cajas.
        _ultimaDataFinal = filas.map(function(f){

            const factor = factorPorCodigo[f.codigo] || null;
            const cantidadUnidades = (factor && factor > 0)
                ? Math.round(f.cantidadCajas * factor)
                : f.cantidadCajas;

            return {
                oc: oc,
                sku: f.sku || "Sin código",
                cantidad: cantidadUnidades,
                lote: f.lote,
                fv: f.fv
            };
        });

        tbody.innerHTML = "";

        _ultimaDataFinal.forEach(function(f){

            const tr = document.createElement("tr");

            tr.innerHTML = `
                <td>${f.oc}</td>
                <td>${f.sku}</td>
                <td>${formatearNumeroFarmacia(f.cantidad)}</td>
                <td>${f.lote}</td>
                <td>${f.fv}</td>
            `;

            tbody.appendChild(tr);

        });

    }catch(e){

        console.error(e);
        tbody.innerHTML = `<tr><td colspan="5" class="sin-datos">No se pudo generar la data final.</td></tr>`;
        _ultimaDataFinal = [];

    }

}

document.getElementById("btnGenerarDataFinal").addEventListener("click", generarDataFinal);

document.getElementById("btnExportarDataFinal").addEventListener("click", function(){

    if(!_ultimaDataFinal.length){
        mostrarToast("Genera la data final antes de exportar.", "error");
        return;
    }

    const encabezados = ["No. OC", "SKU", "Cantidad", "No. Lote", "Fecha Vto."];

    const filas = _ultimaDataFinal.map(function(f){
        return [f.oc, f.sku, f.cantidad, f.lote, f.fv];
    });

    const hoja = XLSX.utils.aoa_to_sheet([encabezados, ...filas]);
    const libro = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(libro, hoja, "DATA FINAL");

    XLSX.writeFile(libro, "DATA_FINAL_" + new Date().toISOString().slice(0, 10) + ".xlsx");

});

// ========================================
// MONITOR: CRUCE LOTES SAP VS FÍSICO
// ========================================
// Compara, por Código dentro de un Viaje, lo que registra SAP
// ("5. Stock Físico SAP", stock_fisico_sap.producto = codigo) contra
// lo realmente escaneado en "2. Lecturas y Evidencias"
// (farmacia_lecturas). Lo físico manda: si un Lote de SAP no aparece
// entre los Lotes escaneados de ese código, es el Lote a corregir en
// SAP. La cantidad se compara por código, sumando cajas de cada lado
// (cantidad_embalada en SAP, cantidad_cajas en lo escaneado).

const cmbViajeCruceLotes = document.getElementById("cmbViajeCruceLotes");
const filtroOcCruceLotes = document.getElementById("filtroOcCruceLotes");
const filtroEstadoCruceLotes = document.getElementById("filtroEstadoCruceLotes");

let _viajesCruceLotesCargados = false;

async function cargarViajesParaCruceLotes(){

    if(_viajesCruceLotesCargados){
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
            cmbViajeCruceLotes.appendChild(option);
        });

        _viajesCruceLotesCargados = true;

    }catch(e){
        console.error(e);
    }

}

cmbViajeCruceLotes.addEventListener("change", async function(){

    filtroOcCruceLotes.innerHTML = `<option value="">Todas</option>`;
    filtroOcCruceLotes.disabled = true;

    if(!cmbViajeCruceLotes.value){
        return;
    }

    try{

        const filas = await supabaseFetchTodo(
            "/stock_fisico_sap?select=oc&viaje=eq." + cmbViajeCruceLotes.value
        );

        const ocs = [...new Set((filas || []).map(f => f.oc))]
            .filter(v => v !== null && v !== undefined)
            .sort((a, b) => a - b);

        ocs.forEach(function(oc){
            const option = document.createElement("option");
            option.value = String(oc);
            option.textContent = String(oc);
            filtroOcCruceLotes.appendChild(option);
        });

        filtroOcCruceLotes.disabled = false;

    }catch(e){
        console.error(e);
    }

});

async function buscarCruceLotesSap(){

    const viaje = cmbViajeCruceLotes.value;
    const oc = filtroOcCruceLotes.value;
    const estadoFiltro = filtroEstadoCruceLotes.value;

    const tbody = document.getElementById("tblCruceLotesSap");

    if(!viaje){
        mostrarToast("Primero selecciona el Viaje.", "error");
        return;
    }

    tbody.innerHTML = `<tr><td colspan="8" class="sin-datos">Buscando...</td></tr>`;

    try{

        let rutaSap = "/stock_fisico_sap?select=viaje,oc,producto,descripcion_producto,ubicacion,lote,fecha_caducidad,cantidad_embalada&viaje=eq." + viaje;
        let rutaLecturas = "/farmacia_lecturas?select=viaje,oc,codigo,descripcion,lote,cantidad_cajas&viaje=eq." + viaje;

        if(oc){
            rutaSap += "&oc=eq." + oc;
            rutaLecturas += "&oc=eq." + oc;
        }

        const [sapFilas, lecturasFilas] = await Promise.all([
            supabaseFetchTodo(rutaSap),
            supabaseFetchTodo(rutaLecturas)
        ]);

        const porGrupo = {};

        function obtenerGrupo(viajeGrupo, ocGrupo, codigo, descripcion){

            const clave = viajeGrupo + "|" + ocGrupo + "|" + codigo;

            if(!porGrupo[clave]){
                porGrupo[clave] = {
                    viaje: viajeGrupo,
                    oc: ocGrupo,
                    codigo: codigo,
                    descripcion: descripcion || "",
                    ctdSap: 0,
                    ctdPistoleada: 0,
                    filasSap: [],
                    lotesPistoleados: []
                };
            }

            if(descripcion && !porGrupo[clave].descripcion){
                porGrupo[clave].descripcion = descripcion;
            }

            return porGrupo[clave];

        }

        (sapFilas || []).forEach(function(f){
            if(!f.producto){
                return;
            }
            const grupo = obtenerGrupo(f.viaje, f.oc, f.producto, f.descripcion_producto);
            grupo.ctdSap += Number(f.cantidad_embalada || 0);
            grupo.filasSap.push(f);
        });

        (lecturasFilas || []).forEach(function(f){
            if(!f.codigo){
                return;
            }
            const grupo = obtenerGrupo(f.viaje, f.oc, f.codigo, f.descripcion);
            grupo.ctdPistoleada += Number(f.cantidad_cajas || 0);
            if(f.lote){
                grupo.lotesPistoleados.push(f.lote);
            }
        });

        const filas = Object.values(porGrupo).filter(function(g){

            // Solo interesan los códigos que SAP realmente registró
            // (sin data de Stock Físico SAP no hay nada que cruzar).
            return g.filasSap.length > 0;

        }).map(function(g){

            const lotesPistoleadosSet = new Set(g.lotesPistoleados.map(l => String(l).trim()));

            const observaciones = [];

            const lotesConProblema = g.filasSap.filter(function(f){
                return f.lote && !lotesPistoleadosSet.has(String(f.lote).trim());
            });

            if(lotesConProblema.length){
                observaciones.push(lotesConProblema.length + " lote(s) de SAP no coinciden con lo escaneado");
            }

            if(g.ctdSap !== g.ctdPistoleada){
                observaciones.push("Cantidad no coincide (SAP " + g.ctdSap + " vs pistoleado " + g.ctdPistoleada + ")");
            }

            const lotesSapUnicos = [...new Set(g.filasSap.map(f => f.lote).filter(Boolean))];

            let estadoClase;
            let estadoTexto;

            if(observaciones.length){
                estadoClase = "advertencia";
                estadoTexto = "Con observaciones";
            }else{
                estadoClase = "activado";
                estadoTexto = "Completo";
            }

            return {
                viaje: g.viaje,
                oc: g.oc,
                codigo: g.codigo,
                descripcion: g.descripcion,
                ctdSap: g.ctdSap,
                ctdPistoleada: g.ctdPistoleada,
                lotesSapUnicos: lotesSapUnicos,
                filasSap: g.filasSap,
                lotesPistoleadosSet: lotesPistoleadosSet,
                observaciones: observaciones,
                estadoClase: estadoClase,
                estadoTexto: estadoTexto
            };

        }).filter(function(f){

            if(!estadoFiltro){
                return true;
            }

            const mapaFiltro = { completo: "activado", observaciones: "advertencia" };
            return f.estadoClase === mapaFiltro[estadoFiltro];

        }).sort(function(a, b){

            if(String(a.oc) !== String(b.oc)){
                return String(a.oc).localeCompare(String(b.oc));
            }
            return String(a.codigo).localeCompare(String(b.codigo));

        });

        tbody.innerHTML = "";

        if(!filas.length){
            tbody.innerHTML = `<tr><td colspan="8" class="sin-datos">No se encontró data de Stock Físico SAP para ese Viaje.</td></tr>`;
            return;
        }

        filas.forEach(function(f, indice){

            const trResumen = document.createElement("tr");
            trResumen.className = "fila-resumen-codigo";
            trResumen.dataset.indice = indice;

            const tituloObservaciones = f.observaciones.length ? f.observaciones.join(" · ") : "";

            trResumen.innerHTML = `
                <td>${f.viaje || "-"}</td>
                <td>${f.oc || "-"}</td>
                <td><span class="flecha-resumen">▸</span>${f.codigo}</td>
                <td>${f.descripcion || "-"}</td>
                <td>${formatearNumeroFarmacia(f.ctdSap)}</td>
                <td>${formatearNumeroFarmacia(f.ctdPistoleada)}</td>
                <td>${f.lotesSapUnicos.length}</td>
                <td>
                    <span class="estado ${f.estadoClase}">${f.estadoTexto}</span>
                    ${tituloObservaciones ? `<div class="detalle-observacion">${tituloObservaciones}</div>` : ""}
                </td>
            `;

            const trDetalle = document.createElement("tr");
            trDetalle.className = "fila-detalle-lotes oculto";

            const filasSapDetalle = f.filasSap.map(function(s){

                const noCoincide = s.lote && !f.lotesPistoleadosSet.has(String(s.lote).trim());

                return `
                    <tr>
                        <td>${s.ubicacion || "-"}</td>
                        <td class="${noCoincide ? "lote-a-cambiar" : ""}">${s.lote || "-"}</td>
                        <td>${formatearNumeroFarmacia(s.cantidad_embalada)}</td>
                        <td>${s.fecha_caducidad || "-"}</td>
                        <td>${noCoincide ? "No coincide con lo escaneado — cambiar en SAP" : "-"}</td>
                    </tr>
                `;

            }).join("");

            trDetalle.innerHTML = `
                <td colspan="8">
                    <table class="tabla-detalle-lotes">
                        <thead>
                            <tr>
                                <th>Ubicación</th>
                                <th>Lote (SAP)</th>
                                <th>Ctd. (Cajas)</th>
                                <th>F.V.</th>
                                <th>Observación</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${filasSapDetalle || '<tr><td colspan="5" class="sin-datos">Sin filas de Stock Físico SAP.</td></tr>'}
                        </tbody>
                    </table>
                </td>
            `;

            tbody.appendChild(trResumen);
            tbody.appendChild(trDetalle);

        });

    }catch(e){

        console.error(e);
        tbody.innerHTML = `<tr><td colspan="8" class="sin-datos">No se pudo calcular el cruce.</td></tr>`;

    }

}

document.getElementById("btnBuscarCruceLotes").addEventListener("click", buscarCruceLotesSap);

document.getElementById("tblCruceLotesSap").addEventListener("click", function(e){

    const fila = e.target.closest(".fila-resumen-codigo");

    if(!fila){
        return;
    }

    fila.classList.toggle("expandido");
    fila.nextElementSibling.classList.toggle("oculto");

});

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

    if(!tienePermiso(sesion, "toma-lote-farmacia")){
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

        if(link.dataset.tab === "tabBaseDatos"){
            buscarViajesGuardados();
        }

        if(link.dataset.tab === "tabAvance"){
            actualizarAvance();
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

// Todo código de la plantilla SAP tiene que existir en MARA Alicorp
// (de ahí sale su EAN para cruzarlo con la OC del cliente, su factor y
// su TVU). Si falta alguno, no se sube nada del archivo: se avisa qué
// códigos hay que registrar primero en "MARA Alicorp".
async function validarCodigosEnMara(filasNormalizadas){

    const codigosArchivo = [...new Set(filasNormalizadas.map(f => String(f.codigo || "").trim()).filter(Boolean))];

    const maraFilas = await supabaseFetchTodo("/mara_alicorp?select=codigo");
    const codigosMara = new Set((maraFilas || []).map(m => String(m.codigo || "").trim()));

    const faltantes = codigosArchivo.filter(c => !codigosMara.has(c)).sort();

    if(!faltantes.length){
        return true;
    }

    const descripcionPorCodigo = {};

    filasNormalizadas.forEach(function(f){
        const c = String(f.codigo || "").trim();
        if(c && !descripcionPorCodigo[c]){
            descripcionPorCodigo[c] = f.descripcion || "";
        }
    });

    await confirmarFarmacia({
        titulo: faltantes.length === 1
            ? "Falta 1 código en la MARA Alicorp"
            : "Faltan " + faltantes.length + " códigos en la MARA Alicorp",
        textoAceptar: "Entendido",
        soloAceptar: true,
        mensajeHtml:
            "No se subió nada del archivo. Estos códigos no están registrados en la MARA Alicorp:" +
            "<ul>" +
                faltantes.map(c =>
                    "<li><strong>" + escaparHtmlFarmacia(c) + "</strong>" +
                    (descripcionPorCodigo[c] ? " — " + escaparHtmlFarmacia(descripcionPorCodigo[c]) : "") +
                    "</li>"
                ).join("") +
            "</ul>" +
            "<div class=\"modal-confirmar-aviso\">" +
                "Regístralos primero en \"MARA Alicorp\" y vuelve a subir la plantilla." +
            "</div>"
    });

    return false;

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

        if(!(await validarCodigosEnMara(filasNormalizadas))){
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

        // Un viaje que ya se guardó en "Base de Datos" tampoco se
        // puede volver a cargar (su número ya está usado en el
        // histórico).
        const viajesYaGuardados = [];

        try{

            const guardados = await supabaseFetch(
                "/farmacia_viajes_guardados?select=viaje&viaje=in.(" +
                viajesEnArchivo.filter(v => v !== null && v !== undefined).join(",") + ")"
            );

            (guardados || []).forEach(g => viajesYaGuardados.push(g.viaje));

        }catch(errGuardados){
            // Si la tabla aún no existe (falta correr viajes-guardados.sql)
            // no se bloquea la carga.
            console.error(errGuardados);
        }

        if(viajesYaGuardados.length){

            mostrarToast(
                "No se puede cargar: el viaje " + viajesYaGuardados.join(", ") +
                " ya está guardado en la Base de Datos.",
                "error"
            );

            nombreArchivo.textContent = "-";
            archivoFarmacia.value = "";
            return;

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
        refrescarCachesViajesFarmacia();

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

        if(!(await validarCodigosEnMara(filasNormalizadas))){
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

        const confirmado = await confirmarFarmacia({
            titulo: "Reemplazar viaje " + viaje,
            textoAceptar: "Reemplazar",
            mensajeHtml:
                "Se reemplazará la plantilla de este viaje con el archivo:" +
                "<ul>" +
                    "<li><strong>" + escaparHtmlFarmacia(archivo.name) + "</strong></li>" +
                    "<li>" + filasNormalizadas.length + " códigos</li>" +
                "</ul>" +
                "<div class=\"modal-confirmar-aviso\">" +
                    "Los ajustes de Ctd. Atendida de este viaje se pierden. Las lecturas, la OC Portal y el Stock SAP se mantienen." +
                "</div>"
        });

        if(!confirmado){
            archivoReemplazarViaje.value = "";
            return;
        }

        await supabaseFetch("/farmacia_data?viaje=eq." + viaje, { method: "DELETE" });

        await guardarEnBloques("farmacia_data", filasNormalizadas);

        mostrarToast("Viaje " + viaje + " reemplazado: " + filasNormalizadas.length + " filas.", "exito");

        await cargarResumenExistente();
        refrescarCachesViajesFarmacia();

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

    const TEXTOS_ESTADO = {
        activo: "Activo", desactivado: "Desactivado", cerrado: "Cerrado", finalizado: "Finalizado"
    };
    const CLASES_ESTADO = {
        activo: "activado", desactivado: "advertencia", cerrado: "cerrado", finalizado: "disponible"
    };

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
                '<button class="btn-finalizar" data-viaje="' + v.viaje + '">Finalizar</button>' +
                '<button class="btn-eliminar" data-viaje="' + v.viaje + '">Eliminar</button>';
        }else if(estado === "activo" || estado === "cerrado"){
            // Bloqueado: mientras está Activo/Cerrado no se puede
            // Reemplazar ni Eliminar — primero hay que Desactivarlo.
            // "Cerrado" (todo pistoleado en cantidad, con o sin
            // observaciones) igual puede pasar a Finalizado si ya
            // cumple el resto de requisitos (OC Portal, Cruce, Stock
            // SAP, Cruce Lotes SAP, Data Final).
            items =
                '<button class="btn-desactivar" data-viaje="' + v.viaje + '">Desactivar</button>' +
                '<button class="btn-finalizar" data-viaje="' + v.viaje + '">Finalizar</button>';
        }else{
            items = '<button class="btn-guardar" data-viaje="' + v.viaje + '">Guardar en Base de Datos</button>';
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
        await guardarViajeEnBaseDatos(Number(botonGuardar.dataset.viaje), botonGuardar);
        return;
    }

    if(botonEliminar){

        const viaje = Number(botonEliminar.dataset.viaje);

        cerrarMenusAcciones(null);

        const confirmado = await confirmarFarmacia({
            titulo: "Eliminar viaje " + viaje,
            textoAceptar: "Eliminar viaje",
            mensajeHtml:
                "Se borrará todo lo del viaje en todas las pestañas:" +
                "<ul>" +
                    "<li>Plantilla, lecturas y estado</li>" +
                    "<li>OC Portal, canal y Data Final de sus OC</li>" +
                    "<li>Stock Físico SAP</li>" +
                "</ul>" +
                "<div class=\"modal-confirmar-aviso\">" +
                    "No se guarda en la Base de Datos y no se puede deshacer." +
                "</div>"
        });

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

            // Igual que "Guardar en Base de Datos": también se borran el
            // Canal de sus OC y el registro de Data Final generada. Si
            // quedaran, al volver a cargar esa OC en otro viaje parecería
            // que ya tiene su Data Final (y dejaría finalizar sin ella).
            if(ocsDelViaje.length){
                const listaOcs = ocsDelViaje.join(",");
                await supabaseFetch("/oc_portal_cliente?oc=in.(" + listaOcs + ")", { method: "DELETE" });
                await supabaseFetch("/oc_canal?oc=in.(" + listaOcs + ")", { method: "DELETE" });
                await supabaseFetch("/data_final_generada?oc=in.(" + listaOcs + ")", { method: "DELETE" });
            }

            await supabaseFetch("/farmacia_lecturas?viaje=eq." + viaje, { method: "DELETE" });
            await supabaseFetch("/stock_fisico_sap?viaje=eq." + viaje, { method: "DELETE" });
            await supabaseFetch("/farmacia_data?viaje=eq." + viaje, { method: "DELETE" });
            await supabaseFetch("/farmacia_viajes_activados?viaje=eq." + viaje, { method: "DELETE" });

            mostrarToast("Viaje " + viaje + " eliminado (junto con sus OC, lecturas y stock).", "exito");

            await cargarResumenExistente();
            refrescarCachesViajesFarmacia();

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

            const chequeo = await evaluarRequisitosViaje(viaje);

            if(!chequeo.listo){

                mostrarToast(
                    "No se puede finalizar, faltan " + chequeo.razones.length + " requisito(s): " +
                    chequeo.razones.join(" · "),
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

// "Cerrado" (a diferencia de "Finalizado") solo mira cantidad: que lo
// registrado en "Lecturas y Evidencias" sea >= la Ctd. Atendida en
// CADA código del viaje, sin importar si tiene observaciones (más de
// 3 lotes, vida útil, exceso). No revisa ningún otro módulo.
async function viajeCantidadCompleta(viaje){

    const [dataFilas, lecturasFilas] = await Promise.all([
        supabaseFetchTodo("/farmacia_data?select=codigo,cantidad,cantidad_atendida&viaje=eq." + viaje),
        supabaseFetchTodo("/farmacia_lecturas?select=codigo,cantidad_cajas&viaje=eq." + viaje)
    ]);

    const solicitadoPorCodigo = {};

    (dataFilas || []).forEach(function(f){
        if(!f.codigo){
            return;
        }
        solicitadoPorCodigo[f.codigo] = (solicitadoPorCodigo[f.codigo] || 0) + cantidadAtendida(f);
    });

    const escaneadoPorCodigo = {};

    (lecturasFilas || []).forEach(function(f){
        if(!f.codigo){
            return;
        }
        escaneadoPorCodigo[f.codigo] = (escaneadoPorCodigo[f.codigo] || 0) + Number(f.cantidad_cajas || 0);
    });

    const codigos = Object.keys(solicitadoPorCodigo);

    return codigos.length > 0 && codigos.every(function(codigo){
        const solicitado = solicitadoPorCodigo[codigo];
        const escaneado = escaneadoPorCodigo[codigo] || 0;
        return solicitado <= 0 || escaneado >= solicitado;
    });

}

// Devuelve un Map viaje -> estado ("activo" | "desactivado" | "cerrado" | "finalizado").
// Un viaje sin fila todavía (nunca tocado) se trata como "desactivado"
// donde se consulte (no bloquea reemplazo, permite Activar).
async function obtenerViajesActivadosFarmacia(){

    try{

        const [filas, dataFilas] = await Promise.all([
            supabaseFetch("/farmacia_viajes_activados?select=viaje,estado"),
            supabaseFetchTodo("/farmacia_data?select=viaje")
        ]);

        const estadosMap = new Map((filas || []).map(f => [f.viaje, f.estado || "desactivado"]));

        const viajes = [...new Set((dataFilas || []).map(f => f.viaje))]
            .filter(v => v !== null && v !== undefined);

        // Auto-transición, sin que nadie tenga que apretar ningún
        // botón: "Cerrado" aparece solo con la cantidad pistoleada
        // completa (con o sin observaciones); "Finalizado" aparece
        // solo cuando además se cumplen TODOS los requisitos de
        // evaluarRequisitosViaje (módulos cargados y sin ninguna
        // observación). Si un viaje ya Cerrado/Finalizado deja de
        // cumplir lo que lo sostiene, retrocede (a Cerrado si todavía
        // tiene la cantidad completa, o a Activo si ni eso).
        const cambios = [];

        for(const viaje of viajes){

            const estadoActual = estadosMap.get(viaje) || "desactivado";

            const cantidadCompleta = await viajeCantidadCompleta(viaje);
            const todoListo = cantidadCompleta ? (await evaluarRequisitosViaje(viaje)).listo : false;

            let nuevoEstado = null;

            if(todoListo){
                nuevoEstado = "finalizado";
            }else if(cantidadCompleta){
                nuevoEstado = "cerrado";
            }

            if(nuevoEstado && nuevoEstado !== estadoActual){
                cambios.push({ viaje: viaje, nuevoEstado: nuevoEstado });
            }else if(!nuevoEstado && (estadoActual === "cerrado" || estadoActual === "finalizado")){
                cambios.push({ viaje: viaje, nuevoEstado: "activo" });
            }

        }

        if(cambios.length){

            await Promise.all(cambios.map(function(c){
                return cambiarEstadoViaje(c.viaje, c.nuevoEstado).catch(function(e){ console.error(e); });
            }));

            cambios.forEach(function(c){
                estadosMap.set(c.viaje, c.nuevoEstado);
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
            // Ya no queda ningún viaje (se guardó o eliminó el
            // último): se limpia la tabla para que no quede el viejo.
            document.getElementById("totalRegistros").textContent = "0";
            document.getElementById("totalViajes").textContent = "0";
            cargarViajesReales([]);
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

// Rearma las opciones de un desplegable de Viaje: deja la primera
// opción fija (value="", "Todos"/"Selecciona..."), borra las demás y
// vuelve a poner solo los viajes que existen hoy. Así, al refrescar
// (después de guardar/eliminar/subir un viaje) no se duplican ni
// quedan viajes que ya no están. Si el viaje elegido sigue existiendo,
// se mantiene seleccionado.
function llenarSelectViajes(cmb, viajes){

    const seleccionadoAntes = cmb.value;

    cmb.querySelectorAll("option:not([value=''])").forEach(op => op.remove());

    viajes.forEach(function(v){
        const option = document.createElement("option");
        option.value = String(v);
        option.textContent = String(v);
        cmb.appendChild(option);
    });

    cmb.value = viajes.map(String).includes(seleccionadoAntes) ? seleccionadoAntes : "";

}

async function cargarViajesParaFiltro(){

    if(_viajesLecturasCargados){
        return;
    }

    _viajesLecturasCargados = true;

    try{

        const filas = await supabaseFetchTodo("/farmacia_data?select=viaje");

        const viajes = [...new Set((filas || []).map(f => f.viaje))]
            .filter(v => v !== null && v !== undefined)
            .sort((a, b) => a - b);

        llenarSelectViajes(document.getElementById("cmbViajeLecturas"), viajes);

    }catch(e){
        console.error(e);
        _viajesLecturasCargados = false;
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

// Ctd. Atendida = lo que realmente sale. Arranca igual a la Ctd.
// Programada (cantidad de SAP) y solo cambia si alguien la ajusta con
// el ✎ (por ejemplo, no hay stock y sale una caja menos). La Ctd.
// Registrada (lo que sube el auxiliar) se compara contra esta.
function cantidadAtendida(f){
    if(f.cantidad_atendida !== null && f.cantidad_atendida !== undefined){
        return Number(f.cantidad_atendida);
    }
    return Number(f.cantidad || 0);
}

// ========================================
// CRUCE SAP vs OC DEL CLIENTE (regla única)
// ========================================
// Para UNA OC: cada código programado en SAP (farmacia_data) se busca
// en la OC del cliente (oc_portal_cliente), vía el EAN de MARA
// Alicorp. La usan Cruce de Información, los requisitos de Finalizado,
// Data Final y el Excel de la Base de Datos, para que todos sigan la
// misma regla:
// - La OC puede pedir MÁS de lo que se manda (ej: OC 3000, se programa
//   1000 y se atiende 950): no es problema.
// - Lo único malo es PASARSE de la OC (no se puede mandar media caja,
//   así que el tope es el múltiplo entero de cajas que entra en la OC).
// - Códigos que la OC trae pero no se programaron en SAP: se ignoran.
// - Códigos programados en SAP que NO están en la OC: observación.
//
// dataFilasOc: filas de farmacia_data de esa OC.
// ocPortalFilasOc: filas de oc_portal_cliente de esa OC.
// maraFilas: mara_alicorp (ean, codigo, descripcion, factor_unidad_alm).
// cajasPorCodigo: { codigo: cajas registradas en esa OC }.
function cruzarCodigosSapConOc(dataFilasOc, ocPortalFilasOc, maraFilas, cajasPorCodigo){

    const maraPorEan = {};
    const maraPorCodigo = {};

    (maraFilas || []).forEach(function(m){
        if(m.ean){
            maraPorEan[String(m.ean).trim()] = m;
        }
        const c = String(m.codigo || "").trim();
        if(c && !maraPorCodigo[c]){
            maraPorCodigo[c] = m;
        }
    });

    const programados = {};

    (dataFilasOc || []).forEach(function(f){
        const c = String(f.codigo || "").trim();
        if(!c){
            return;
        }
        if(!programados[c]){
            programados[c] = { codigo: c, descripcion: f.descripcion || "", atendida: 0 };
        }
        programados[c].atendida += cantidadAtendida(f);
    });

    // Unidades que pide la OC por código (sumando sus líneas).
    const ocPorCodigo = {};

    (ocPortalFilasOc || []).forEach(function(row){
        const ean = String(row.ean || "").trim();
        const mara = maraPorEan[ean];
        if(!mara){
            return;
        }
        const c = String(mara.codigo || "").trim();
        if(!programados[c]){
            return; // está en la OC pero no se programó en SAP: se ignora
        }
        if(!ocPorCodigo[c]){
            ocPorCodigo[c] = { ean: ean, unidades: 0, descripcion: row.descripcion_producto || "" };
        }
        ocPorCodigo[c].unidades += Number(row.cantidad_sku_solicitada || 0);
    });

    return Object.values(programados).map(function(g){

        const mara = maraPorCodigo[g.codigo] || null;
        const enOc = ocPorCodigo[g.codigo] || null;
        const factor = mara ? (Number(mara.factor_unidad_alm) || null) : null;
        const cajas = Number((cajasPorCodigo || {})[g.codigo] || 0);
        const unidades = (factor && factor > 0) ? Math.round(cajas * factor) : null;

        let estadoTexto;
        let estadoClase;

        if(!mara){
            estadoTexto = "Sin MARA Alicorp";
            estadoClase = "advertencia";
        }else if(!enOc){
            estadoTexto = "No está en la OC del cliente";
            estadoClase = "advertencia";
        }else if(!factor || factor <= 0){
            estadoTexto = "Sin factor";
            estadoClase = "advertencia";
        }else if(cajas > Math.floor(enOc.unidades / factor)){
            estadoTexto = "Excede la OC";
            estadoClase = "pendiente";
        }else{
            estadoTexto = "Completo";
            estadoClase = "activado";
        }

        return {
            codigo: g.codigo,
            descripcion: (mara && mara.descripcion) || g.descripcion || (enOc && enOc.descripcion) || "",
            ean: enOc ? enOc.ean : (mara && mara.ean ? String(mara.ean).trim() : ""),
            solicitadoOc: enOc ? enOc.unidades : null,
            factor: factor,
            atendida: g.atendida,
            cajas: cajas,
            unidades: unidades,
            estadoTexto: estadoTexto,
            estadoClase: estadoClase,
            ok: estadoClase === "activado"
        };

    }).sort(function(a, b){
        return String(a.codigo).localeCompare(String(b.codigo));
    });

}

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

// ========================================
// REQUISITOS PARA "FINALIZADO"
// ========================================
// Un viaje solo puede llamarse Finalizado cuando TODO esto se cumple,
// para cada OC del viaje:
// - "2. Lecturas y Evidencias": todo pistoleado y sin ninguna
//   observación por código (más de 3 lotes, vida útil <= mitad del
//   TVU, se pistoleó más de lo solicitado).
// - "3. OC Portal Cliente" cargado.
// - "6. Cruce de Información" sin ninguna línea con problema (excede
//   lo solicitado, sin MARA Alicorp o sin factor).
// - "5. Stock Físico SAP" cargado para el viaje.
// - "Cruce Lotes SAP vs Físico" sin ninguna observación (lote o
//   cantidad que no coincide).
// - "7. Data Final" generada (exportada) al menos una vez.
// MARA Alicorp en sí no es "obligatorio" como módulo — su ausencia ya
// se refleja como observación dentro de Cruce (sin factor/EAN).
// Devuelve {listo, razones} — razones es la lista de motivos por los
// que el viaje NO está listo (vacía si listo=true).
async function evaluarRequisitosViaje(viaje){

    const razones = [];

    const dataFilas = await supabaseFetchTodo(
        "/farmacia_data?select=orden_compra,codigo,descripcion,cantidad,cantidad_atendida&viaje=eq." + viaje
    );

    const ocsDelViaje = [...new Set(
        (dataFilas || []).map(f => f.orden_compra).filter(v => v !== null && v !== undefined)
    )];

    if(!ocsDelViaje.length){
        return { listo: false, razones: ["El viaje no tiene OC cargadas."] };
    }

    // Solo las OC de este viaje (no toda la tabla), para que no se
    // vuelva lento a medida que se cargan más OC.
    const listaOcs = ocsDelViaje.join(",");

    const [lecturasFilas, ocPortalFilas, maraFilas, stockFilas, dataFinalFilas] = await Promise.all([
        supabaseFetchTodo("/farmacia_lecturas?select=oc,codigo,lote,fv,cantidad_cajas&viaje=eq." + viaje),
        supabaseFetchTodo("/oc_portal_cliente?select=oc,ean,cantidad_sku_solicitada,descripcion_producto&oc=in.(" + listaOcs + ")"),
        supabaseFetchTodo("/mara_alicorp?select=ean,codigo,descripcion,factor_unidad_alm,tvu"),
        supabaseFetchTodo("/stock_fisico_sap?select=oc,producto,lote,cantidad_embalada&viaje=eq." + viaje),
        supabaseFetchTodo("/data_final_generada?select=oc&oc=in.(" + listaOcs + ")")
    ]);

    const tvuPorCodigo = {};

    (maraFilas || []).forEach(function(m){
        if(m.codigo && m.tvu){
            tvuPorCodigo[String(m.codigo).trim()] = Number(m.tvu);
        }
    });

    // ---- 1. Lecturas y Evidencias: completo y sin observaciones ----

    const porCodigo = {};

    (dataFilas || []).forEach(function(f){
        if(!f.codigo){
            return;
        }
        if(!porCodigo[f.codigo]){
            porCodigo[f.codigo] = { solicitado: 0, escaneado: 0, lotes: [] };
        }
        porCodigo[f.codigo].solicitado += cantidadAtendida(f);
    });

    (lecturasFilas || []).forEach(function(f){
        if(!f.codigo || !porCodigo[f.codigo]){
            return;
        }
        porCodigo[f.codigo].escaneado += Number(f.cantidad_cajas || 0);
        porCodigo[f.codigo].lotes.push(f);
    });

    const hoy = new Date();

    Object.keys(porCodigo).forEach(function(codigo){

        const g = porCodigo[codigo];

        if(g.solicitado > 0 && g.escaneado < g.solicitado){
            razones.push("Código " + codigo + ": la Ctd. Registrada todavía no llega a la Ctd. Atendida.");
            return;
        }

        if(g.escaneado > g.solicitado){
            razones.push("Código " + codigo + ": la Ctd. Registrada supera la Ctd. Atendida.");
        }

        const lotesUnicos = [...new Set(g.lotes.map(l => l.lote).filter(Boolean))];

        if(lotesUnicos.length > 3){
            razones.push("Código " + codigo + ": más de 3 lotes.");
        }

        const tvu = tvuPorCodigo[String(codigo).trim()];

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
                razones.push("Código " + codigo + ": vida útil restante menor o igual a la mitad del TVU.");
            }

        }

    });

    // ---- 2. OC Portal Cliente cargado para cada OC ----

    const ocsConPortal = new Set((ocPortalFilas || []).map(f => f.oc));

    ocsDelViaje.forEach(function(oc){
        if(!ocsConPortal.has(oc)){
            razones.push("OC " + oc + ": falta cargar OC Portal Cliente.");
        }
    });

    // ---- 3. Cruce de Información sin problemas, por cada OC ----

    const escaneadoCajasPorOcCodigo = {};

    (lecturasFilas || []).forEach(function(l){
        if(!l.codigo || l.oc === null || l.oc === undefined){
            return;
        }
        const clave = l.oc + "|" + l.codigo;
        escaneadoCajasPorOcCodigo[clave] = (escaneadoCajasPorOcCodigo[clave] || 0) + Number(l.cantidad_cajas || 0);
    });

    ocsDelViaje.forEach(function(oc){

        if(!ocsConPortal.has(oc)){
            return; // ya se avisó en el punto 2
        }

        const cajasPorCodigo = {};

        Object.keys(escaneadoCajasPorOcCodigo).forEach(function(clave){
            const partes = clave.split("|");
            if(String(partes[0]) === String(oc)){
                cajasPorCodigo[partes[1]] = escaneadoCajasPorOcCodigo[clave];
            }
        });

        cruzarCodigosSapConOc(
            (dataFilas || []).filter(f => f.orden_compra === oc),
            (ocPortalFilas || []).filter(row => row.oc === oc),
            maraFilas,
            cajasPorCodigo
        ).forEach(function(c){
            if(!c.ok){
                razones.push("Cruce OC " + oc + " código " + c.codigo + ": " + c.estadoTexto + ".");
            }
        });

    });

    // ---- 4. Stock Físico SAP cargado para el viaje ----

    if(!stockFilas || !stockFilas.length){
        razones.push("Falta cargar Stock Físico SAP para este viaje.");
    }

    // ---- 5. Cruce Lotes SAP vs Físico sin observaciones ----

    const porGrupoSap = {};

    (stockFilas || []).forEach(function(f){
        if(!f.producto){
            return;
        }
        const clave = f.oc + "|" + f.producto;
        if(!porGrupoSap[clave]){
            porGrupoSap[clave] = { oc: f.oc, codigo: f.producto, ctdSap: 0, filas: [] };
        }
        porGrupoSap[clave].ctdSap += Number(f.cantidad_embalada || 0);
        porGrupoSap[clave].filas.push(f);
    });

    const lotesPorOcCodigo = {};

    (lecturasFilas || []).forEach(function(l){
        if(!l.codigo || l.oc === null || l.oc === undefined){
            return;
        }
        const clave = l.oc + "|" + l.codigo;
        if(!lotesPorOcCodigo[clave]){
            lotesPorOcCodigo[clave] = new Set();
        }
        if(l.lote){
            lotesPorOcCodigo[clave].add(String(l.lote).trim());
        }
    });

    Object.keys(porGrupoSap).forEach(function(clave){

        const g = porGrupoSap[clave];
        const lotesEscaneados = lotesPorOcCodigo[clave] || new Set();
        const ctdPistoleada = escaneadoCajasPorOcCodigo[clave] || 0;

        if(g.ctdSap !== ctdPistoleada){
            razones.push("Cruce Lotes SAP OC " + g.oc + " código " + g.codigo + ": la cantidad no coincide.");
        }

        const lotesSinCoincidir = g.filas.filter(f => f.lote && !lotesEscaneados.has(String(f.lote).trim()));

        if(lotesSinCoincidir.length){
            razones.push("Cruce Lotes SAP OC " + g.oc + " código " + g.codigo + ": hay un Lote que no coincide.");
        }

    });

    // ---- 6. Data Final generada para cada OC ----

    const ocsConDataFinal = new Set((dataFinalFilas || []).map(f => f.oc));

    ocsDelViaje.forEach(function(oc){
        if(!ocsConDataFinal.has(oc)){
            razones.push("OC " + oc + ": falta generar/descargar Data Final.");
        }
    });

    return { listo: razones.length === 0, razones: razones };

}

async function buscarResumenCodigo(){

    const viaje = document.getElementById("cmbViajeLecturas").value;
    const oc = document.getElementById("filtroOcLecturas").value.trim();
    const codigo = document.getElementById("filtroCodigo").value.trim();
    const lote = document.getElementById("filtroLote").value.trim();
    const estadoFiltro = document.getElementById("filtroEstadoResumen").value;

    const tbody = document.getElementById("tblResumenCodigo");
    tbody.innerHTML = `<tr><td colspan="9" class="sin-datos">Buscando...</td></tr>`;

    try{

        let rutaLecturas = "/farmacia_lecturas?select=id,viaje,oc,codigo,descripcion,lote,fv,cantidad_cajas,escaneado_por,foto_url,created_at&order=created_at.desc";
        let rutaData = "/farmacia_data?select=viaje,orden_compra,codigo,descripcion,cantidad,cantidad_atendida,observacion_atendida,atendida_por,atendida_en";

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
                    programada: 0,
                    atendida: 0,
                    registrada: 0,
                    ajuste: null,
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
            grupo.programada += Number(f.cantidad || 0);
            grupo.atendida += cantidadAtendida(f);
            if(f.observacion_atendida){
                grupo.ajuste = {
                    observacion: f.observacion_atendida,
                    por: f.atendida_por || "",
                    en: f.atendida_en || null
                };
            }
        });

        (lecturasFilas || []).forEach(function(f){
            if(!f.codigo){
                return;
            }
            const grupo = obtenerGrupo(f.viaje, f.oc, f.codigo, f.descripcion);
            grupo.registrada += Number(f.cantidad_cajas || 0);
            grupo.lotes.push(f);
        });

        const hoy = new Date();

        const filas = Object.values(porGrupo).map(function(g){

            const lotesUnicos = [...new Set(g.lotes.map(l => l.lote).filter(Boolean))];
            const observaciones = [];

            if(lotesUnicos.length > 3){
                observaciones.push("Más de 3 lotes");
            }

            if(g.registrada > g.atendida){
                observaciones.push("Diferencia de cantidad (la Ctd. Registrada supera la Ctd. Atendida)");
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
            }else if(g.registrada >= g.atendida && g.atendida > 0){
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
                programada: g.programada,
                atendida: g.atendida,
                registrada: g.registrada,
                ajuste: g.ajuste,
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
            tbody.innerHTML = `<tr><td colspan="9" class="sin-datos">No se encontraron códigos con esos filtros.</td></tr>`;
            return;
        }

        filas.forEach(function(f, indice){

            const trResumen = document.createElement("tr");
            trResumen.className = "fila-resumen-codigo";
            trResumen.dataset.indice = indice;

            const tituloObservaciones = f.observaciones.length ? f.observaciones.join(" · ") : "";

            const textoAjuste = f.ajuste
                ? "Ajuste: " + escaparHtmlFarmacia(f.ajuste.observacion) +
                  (f.ajuste.por ? " — " + escaparHtmlFarmacia(f.ajuste.por) : "") +
                  (f.ajuste.en ? " (" + formatearFechaHoraLecturas(f.ajuste.en) + ")" : "")
                : "";

            trResumen.innerHTML = `
                <td>${f.viaje || "-"}</td>
                <td>${f.oc || "-"}</td>
                <td><span class="flecha-resumen">▸</span>${f.codigo}</td>
                <td>${f.descripcion || "-"}</td>
                <td>${formatearNumeroFarmacia(f.programada)}</td>
                <td>
                    ${formatearNumeroFarmacia(f.atendida)}
                    <button class="btn-editar-atendida" data-indice="${indice}" title="Ajustar Ctd. Atendida">✎</button>
                    ${textoAjuste ? `<div class="detalle-ajuste">${textoAjuste}</div>` : ""}
                </td>
                <td>${formatearNumeroFarmacia(f.registrada)}</td>
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
                <td colspan="9">
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
        tbody.innerHTML = `<tr><td colspan="9" class="sin-datos">No se pudo cargar el resumen por código.</td></tr>`;

    }

}

document.getElementById("tblResumenCodigo").addEventListener("click", async function(e){

    const botonFoto = e.target.closest(".btn-ver-foto");

    if(botonFoto){
        document.getElementById("modalFotoImg").src = botonFoto.dataset.foto;
        document.getElementById("modalFoto").classList.remove("oculto");
        return;
    }

    const botonEditar = e.target.closest(".btn-editar-atendida");

    if(botonEditar){

        const fila = _ultimoResumenCodigo[Number(botonEditar.dataset.indice)];

        if(fila){
            abrirModalAjuste(fila);
        }

        return;

    }

    const botonEliminar = e.target.closest(".btn-eliminar-lectura");

    if(botonEliminar){

        const id = botonEliminar.dataset.id;
        const viaje = botonEliminar.dataset.viaje;

        // Detalle de la lectura desde su fila: Cantidad, Lote, F.V., Registrado por.
        const celdas = botonEliminar.closest("tr").cells;
        const detalleLectura = celdas.length >= 4
            ? "<ul>" +
                "<li>Lote: <strong>" + escaparHtmlFarmacia(celdas[1].textContent) + "</strong></li>" +
                "<li>Cajas: " + escaparHtmlFarmacia(celdas[0].textContent) + "</li>" +
                "<li>F.V.: " + escaparHtmlFarmacia(celdas[2].textContent) +
                " · Registrado por: " + escaparHtmlFarmacia(celdas[3].textContent) + "</li>" +
              "</ul>"
            : "";

        const confirmadoLectura = await confirmarFarmacia({
            titulo: "Eliminar lectura",
            textoAceptar: "Eliminar lectura",
            mensajeHtml:
                "Se eliminará esta lectura" + (viaje ? " del viaje " + escaparHtmlFarmacia(viaje) : "") + ":" +
                detalleLectura +
                "<div class=\"modal-confirmar-aviso\">" +
                    "No se puede deshacer. Si el viaje estaba Cerrado o Finalizado, puede volver a Activo." +
                "</div>"
        });

        if(!confirmadoLectura){
            return;
        }

        try{

            await supabaseFetch("/farmacia_lecturas?id=eq." + id, { method: "DELETE" });

            // Si el viaje ya estaba Cerrado o Finalizado y esta
            // lectura era parte de lo que lo sostenía, retrocede: a
            // Cerrado si la cantidad todavía está completa (pero ya
            // no cumple todos los requisitos de Finalizado), o a
            // Activo si ni siquiera la cantidad está completa (y así
            // reaparece en Centro de Proyectos).
            let mensaje = "Lectura eliminada.";

            if(viaje){

                const filaEstado = await supabaseFetch("/farmacia_viajes_activados?select=estado&viaje=eq." + viaje);
                const estadoActual = filaEstado && filaEstado[0] && filaEstado[0].estado;

                if(estadoActual === "cerrado" || estadoActual === "finalizado"){

                    const cantidadCompleta = await viajeCantidadCompleta(viaje);

                    if(!cantidadCompleta){
                        await cambiarEstadoViaje(Number(viaje), "activo");
                        mensaje = "Lectura eliminada. El viaje " + viaje + " volvió a Activo (ya no está completo).";
                    }else if(estadoActual === "finalizado"){

                        const chequeo = await evaluarRequisitosViaje(viaje);

                        if(!chequeo.listo){
                            await cambiarEstadoViaje(Number(viaje), "cerrado");
                            mensaje = "Lectura eliminada. El viaje " + viaje + " volvió a Cerrado (ya no cumple todos los requisitos).";
                        }

                    }

                }

            }

            mostrarToast(mensaje, "exito");
            buscarResumenCodigo();
            _ocsDataFinalCargadas = false;

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

// ========================================
// MODAL AJUSTAR CTD. ATENDIDA
// ========================================
// Todo ajuste de la Ctd. Atendida (distinta a la Programada de SAP)
// lleva un motivo obligatorio, y queda quién y cuándo lo hizo. Volver
// a poner la cantidad programada quita el ajuste (deja todo en NULL).

let _filaAjuste = null;

function escaparHtmlFarmacia(texto){
    return String(texto == null ? "" : texto)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

function mostrarErrorAjuste(mensaje){
    const caja = document.getElementById("ajusteError");
    caja.textContent = mensaje || "";
    caja.classList.toggle("oculto", !mensaje);
}

function abrirModalAjuste(fila){

    _filaAjuste = fila;

    document.getElementById("ajusteCodigo").textContent = fila.codigo;
    document.getElementById("ajusteViajeOc").textContent = (fila.viaje || "-") + " / " + (fila.oc || "-");
    document.getElementById("ajusteDescripcion").textContent = fila.descripcion || "";
    document.getElementById("ajusteProgramada").textContent = formatearNumeroFarmacia(fila.programada);
    document.getElementById("ajusteCantidad").value = fila.atendida;
    document.getElementById("ajusteObservacion").value = fila.ajuste ? fila.ajuste.observacion : "";
    mostrarErrorAjuste("");
    document.getElementById("btnGuardarAjuste").disabled = false;

    document.getElementById("modalAjuste").classList.remove("oculto");
    document.getElementById("ajusteCantidad").focus();
    document.getElementById("ajusteCantidad").select();

}

function cerrarModalAjuste(){
    document.getElementById("modalAjuste").classList.add("oculto");
    _filaAjuste = null;
}

async function guardarAjusteAtendida(){

    const fila = _filaAjuste;

    if(!fila){
        return;
    }

    const textoCantidad = document.getElementById("ajusteCantidad").value.trim();
    const observacion = document.getElementById("ajusteObservacion").value.trim();
    const nuevaCantidad = Number(textoCantidad);

    if(textoCantidad === "" || isNaN(nuevaCantidad) || nuevaCantidad < 0){
        mostrarErrorAjuste("Ingresa una cantidad numérica válida.");
        return;
    }

    if(nuevaCantidad > fila.programada){
        mostrarErrorAjuste("La Ctd. Atendida no puede ser mayor que la Ctd. Programada (" + formatearNumeroFarmacia(fila.programada) + ").");
        return;
    }

    const quitaAjuste = nuevaCantidad === fila.programada;

    if(!quitaAjuste && !observacion){
        mostrarErrorAjuste("Escribe el motivo del ajuste.");
        document.getElementById("ajusteObservacion").focus();
        return;
    }

    const cuerpo = quitaAjuste
        ? { cantidad_atendida: null, observacion_atendida: null, atendida_por: null, atendida_en: null }
        : {
            cantidad_atendida: nuevaCantidad,
            observacion_atendida: observacion,
            atendida_por: (sesion && (sesion.nombre_completo || sesion.usuario)) || "",
            atendida_en: new Date().toISOString()
        };

    const btnGuardar = document.getElementById("btnGuardarAjuste");
    btnGuardar.disabled = true;

    try{

        const respuesta = await supabaseFetch(
            "/farmacia_data?viaje=eq." + fila.viaje + "&orden_compra=eq." + fila.oc + "&codigo=eq." + encodeURIComponent(fila.codigo),
            {
                method: "PATCH",
                headers: { "Prefer": "return=representation" },
                body: JSON.stringify(cuerpo)
            }
        );

        if(!respuesta || !respuesta.length){
            mostrarErrorAjuste("No se encontró la fila de ese código/viaje/OC en la carga.");
            btnGuardar.disabled = false;
            return;
        }

        cerrarModalAjuste();
        mostrarToast(quitaAjuste ? "Ajuste quitado: Ctd. Atendida = Ctd. Programada." : "Ctd. Atendida ajustada.", "exito");
        buscarResumenCodigo();
        _ocsDataFinalCargadas = false;

    }catch(err){
        console.error(err);
        mostrarErrorAjuste("No se pudo guardar el ajuste.");
        btnGuardar.disabled = false;
    }

}

document.getElementById("btnGuardarAjuste").addEventListener("click", guardarAjusteAtendida);
document.getElementById("btnCancelarAjuste").addEventListener("click", cerrarModalAjuste);
document.getElementById("modalAjusteFondo").addEventListener("click", cerrarModalAjuste);

document.addEventListener("keydown", function(e){
    if(e.key === "Escape" && !document.getElementById("modalAjuste").classList.contains("oculto")){
        cerrarModalAjuste();
    }
});

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

            const confirmado = await confirmarFarmacia({
                titulo: "Reemplazar OC " + ocSeleccionada,
                textoAceptar: "Reemplazar",
                mensajeHtml:
                    "Esta OC ya tiene datos cargados. Se reemplazarán con el archivo:" +
                    "<ul>" +
                        "<li><strong>" + escaparHtmlFarmacia(archivo.name) + "</strong></li>" +
                        "<li>" + filasNormalizadas.length + " líneas</li>" +
                    "</ul>" +
                    "<div class=\"modal-confirmar-aviso\">Las líneas actuales de esta OC se borran.</div>"
            });

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
        _ocsDataFinalCargadas = false;

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
// resto del módulo. Ya no hay carga masiva: los códigos se registran
// y eliminan uno por uno. El EAN debe ser EAN-13 (13 dígitos) y no se
// puede repetir, porque es la llave para cruzar con la OC del cliente.

// ---- Registrar UN código en MARA Alicorp ----

function errorRegistrarMara(mensaje){
    const caja = document.getElementById("registrarMaraError");
    caja.textContent = mensaje || "";
    caja.classList.toggle("oculto", !mensaje);
}

function abrirModalRegistrarMara(){
    ["nuevoMaraCodigo", "nuevoMaraDescripcion", "nuevoMaraEan", "nuevoMaraFactor", "nuevoMaraTvu"]
        .forEach(id => document.getElementById(id).value = "");
    document.getElementById("nuevoMaraUnidad").value = "CJA";
    errorRegistrarMara("");
    document.getElementById("modalRegistrarMara").classList.remove("oculto");
    document.getElementById("nuevoMaraCodigo").focus();
}

function cerrarModalRegistrarMara(){
    document.getElementById("modalRegistrarMara").classList.add("oculto");
}

document.getElementById("btnAbrirRegistrarMara").addEventListener("click", abrirModalRegistrarMara);
document.getElementById("btnCancelarRegistrarMara").addEventListener("click", cerrarModalRegistrarMara);
document.getElementById("modalRegistrarMaraFondo").addEventListener("click", cerrarModalRegistrarMara);

document.getElementById("modalRegistrarMara").addEventListener("keydown", function(e){
    if(e.key === "Escape"){
        cerrarModalRegistrarMara();
    }
    if(e.key === "Enter"){
        agregarCodigoMara();
    }
});

async function agregarCodigoMara(){

    const boton = document.getElementById("btnAgregarMaraCodigo");

    if(boton.disabled){
        return;
    }

    const codigo = document.getElementById("nuevoMaraCodigo").value.trim();
    const descripcion = document.getElementById("nuevoMaraDescripcion").value.trim();
    const ean = document.getElementById("nuevoMaraEan").value.trim();
    const factor = Number(document.getElementById("nuevoMaraFactor").value);
    const unidad = document.getElementById("nuevoMaraUnidad").value.trim();
    const tvuTexto = document.getElementById("nuevoMaraTvu").value.trim();
    const tvu = tvuTexto === "" ? null : Number(tvuTexto);

    if(!codigo || !descripcion || !ean){
        errorRegistrarMara("Completa Código, Descripción y EAN/UPC.");
        return;
    }

    if(!/^\d{13}$/.test(ean)){
        errorRegistrarMara("El EAN debe tener exactamente 13 dígitos (tiene " + ean.length + ").");
        return;
    }

    if(!factor || factor <= 0 || !Number.isInteger(factor)){
        errorRegistrarMara("El Factor Unid. Alm. debe ser un número entero mayor a 0.");
        return;
    }

    if(tvu !== null && (!tvu || tvu <= 0)){
        errorRegistrarMara("El TVU debe ser un número mayor a 0 (o déjalo vacío).");
        return;
    }

    errorRegistrarMara("");
    boton.disabled = true;

    try{

        const [porCodigo, porEan] = await Promise.all([
            supabaseFetch("/mara_alicorp?select=codigo&codigo=eq." + encodeURIComponent(codigo) + "&limit=1"),
            supabaseFetch("/mara_alicorp?select=codigo&ean=eq." + encodeURIComponent(ean) + "&limit=1")
        ]);

        if(porCodigo && porCodigo.length){
            errorRegistrarMara("El código " + codigo + " ya está en la MARA Alicorp.");
            return;
        }

        if(porEan && porEan.length){
            errorRegistrarMara("El EAN " + ean + " ya está registrado con el código " + porEan[0].codigo + ".");
            return;
        }

        await supabaseFetch("/mara_alicorp", {
            method: "POST",
            body: JSON.stringify({
                codigo: codigo,
                descripcion: descripcion,
                ean: ean,
                factor_unidad_alm: factor,
                unidad_almacenamiento: unidad,
                tvu: tvu,
                archivo_origen: "Registro manual",
                cargado_por: (sesion && (sesion.nombre_completo || sesion.usuario)) || ""
            })
        });

        cerrarModalRegistrarMara();
        mostrarToast("Código " + codigo + " registrado en la MARA Alicorp.", "exito");

        document.getElementById("filtroCodigoAlicorp").value = codigo;
        document.getElementById("filtroDescripcionAlicorp").value = "";

        cargarResumenExistenteAlicorp();
        buscarAlicorp();
        _ocsDataFinalCargadas = false;

    }catch(err){
        console.error(err);
        errorRegistrarMara("No se pudo registrar el código: " + err.message);
    }finally{
        boton.disabled = false;
    }

}

document.getElementById("btnAgregarMaraCodigo").addEventListener("click", agregarCodigoMara);

async function cargarResumenExistenteAlicorp(){

    try{

        const filas = await supabaseFetchTodo("/mara_alicorp?select=id");

        document.getElementById("totalRegistrosAlicorp").textContent =
            (filas || []).length.toLocaleString("es-PE");

    }catch(e){
        console.error(e);
    }

}

async function buscarAlicorp(){

    const codigo = document.getElementById("filtroCodigoAlicorp").value.trim();
    const descripcion = document.getElementById("filtroDescripcionAlicorp").value.trim();

    const tbody = document.getElementById("tblAlicorp");
    tbody.innerHTML = `<tr><td colspan="7" class="sin-datos">Cargando...</td></tr>`;

    try{

        let ruta = "/mara_alicorp?select=id,codigo,descripcion,ean,factor_unidad_alm,unidad_almacenamiento,tvu&order=descripcion.asc";

        if(codigo){
            ruta += "&codigo=ilike.*" + encodeURIComponent(codigo) + "*";
        }

        if(descripcion){
            ruta += "&descripcion=ilike.*" + encodeURIComponent(descripcion) + "*";
        }

        const filas = await supabaseFetchTodo(ruta);

        tbody.innerHTML = "";

        if(!filas || !filas.length){
            tbody.innerHTML = `<tr><td colspan="7" class="sin-datos">No se encontraron materiales con esos filtros.</td></tr>`;
            return;
        }

        filas.forEach(function(f){

            const tr = document.createElement("tr");

            tr.innerHTML = `
                <td>${escaparHtmlFarmacia(f.codigo || "-")}</td>
                <td>${escaparHtmlFarmacia(f.descripcion || "-")}</td>
                <td>${escaparHtmlFarmacia(f.ean || "-")}</td>
                <td>${f.factor_unidad_alm || "-"}</td>
                <td>${escaparHtmlFarmacia(f.unidad_almacenamiento || "-")}</td>
                <td>${f.tvu || "-"}</td>
                <td><button class="btn-eliminar-mara" data-id="${f.id}" data-codigo="${escaparHtmlFarmacia(f.codigo || "")}" data-descripcion="${escaparHtmlFarmacia(f.descripcion || "")}">Eliminar</button></td>
            `;

            tbody.appendChild(tr);

        });

    }catch(e){

        console.error(e);
        tbody.innerHTML = `<tr><td colspan="7" class="sin-datos">No se pudo cargar el maestro Alicorp.</td></tr>`;

    }

}

document.getElementById("btnBuscarAlicorp").addEventListener("click", buscarAlicorp);

// ---- Eliminar UN código de MARA Alicorp ----
// No se deja eliminar un código que está en un viaje cargado: ese viaje
// quedaría sin EAN/factor/TVU y su cruce saldría "Sin MARA Alicorp".

document.getElementById("tblAlicorp").addEventListener("click", async function(e){

    const boton = e.target.closest(".btn-eliminar-mara");

    if(!boton){
        return;
    }

    const id = boton.dataset.id;
    const codigo = boton.dataset.codigo;
    const descripcion = boton.dataset.descripcion;

    boton.disabled = true;

    try{

        const usos = await supabaseFetchTodo(
            "/farmacia_data?select=viaje&codigo=eq." + encodeURIComponent(codigo)
        );

        const viajesQueLoUsan = [...new Set((usos || []).map(u => u.viaje))];

        if(viajesQueLoUsan.length){
            await confirmarFarmacia({
                titulo: "No se puede eliminar el código " + codigo,
                textoAceptar: "Entendido",
                soloAceptar: true,
                mensajeHtml:
                    "Este código está en " + (viajesQueLoUsan.length === 1 ? "el viaje" : "los viajes") +
                    " <strong>" + viajesQueLoUsan.map(v => escaparHtmlFarmacia(v)).join(", ") + "</strong>." +
                    "<div class=\"modal-confirmar-aviso\" style=\"margin-top:12px\">" +
                        "Primero guarda o elimina " + (viajesQueLoUsan.length === 1 ? "ese viaje" : "esos viajes") +
                        "; si no, se quedarían sin datos de MARA para el cruce." +
                    "</div>"
            });
            return;
        }

        const confirmado = await confirmarFarmacia({
            titulo: "Eliminar código " + codigo,
            textoAceptar: "Eliminar",
            mensajeHtml:
                "Se eliminará de la MARA Alicorp:" +
                "<ul><li><strong>" + escaparHtmlFarmacia(codigo) + "</strong>" +
                (descripcion ? " — " + escaparHtmlFarmacia(descripcion) : "") + "</li></ul>" +
                "<div class=\"modal-confirmar-aviso\">No se puede deshacer; para volver a usarlo hay que registrarlo de nuevo.</div>"
        });

        if(!confirmado){
            return;
        }

        await supabaseFetch("/mara_alicorp?id=eq." + id, { method: "DELETE" });

        mostrarToast("Código " + codigo + " eliminado de la MARA Alicorp.", "exito");

        cargarResumenExistenteAlicorp();
        buscarAlicorp();
        _ocsDataFinalCargadas = false;

    }catch(err){
        console.error(err);
        mostrarToast("No se pudo eliminar el código: " + err.message, "error");
    }finally{
        boton.disabled = false;
    }

});

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
                'placeholder="Ej: CNL-OUT-59" value="' + (mapaCanal.get(oc) || "") + '">';

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

            const confirmado = await confirmarFarmacia({
                titulo: "Reemplazar Stock SAP del viaje " + viajeSeleccionado,
                textoAceptar: "Reemplazar",
                mensajeHtml:
                    "Este viaje ya tiene Stock Físico SAP cargado. Se reemplazará con el archivo:" +
                    "<ul>" +
                        "<li><strong>" + escaparHtmlFarmacia(archivo.name) + "</strong></li>" +
                        "<li>" + filasNormalizadas.length + " filas</li>" +
                    "</ul>" +
                    "<div class=\"modal-confirmar-aviso\">El stock actual de este viaje se borra.</div>"
            });

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
        refrescarViajesParaCruceLotes();
        _viajesFiltroStockCargados = false;

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

    _viajesFiltroStockCargados = true;

    try{

        const filas = await supabaseFetchTodo("/stock_fisico_sap?select=viaje");

        const viajes = [...new Set((filas || []).map(f => f.viaje))]
            .filter(v => v !== null && v !== undefined)
            .sort((a, b) => a - b);

        llenarSelectViajes(cmbViajeFiltroStock, viajes);

    }catch(e){
        console.error(e);
        _viajesFiltroStockCargados = false;
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

    _viajesCruceCargados = true;

    try{

        const filas = await supabaseFetchTodo("/farmacia_data?select=viaje");

        const viajes = [...new Set((filas || []).map(f => f.viaje))]
            .filter(v => v !== null && v !== undefined)
            .sort((a, b) => a - b);

        llenarSelectViajes(cmbViajeCruce, viajes);

    }catch(e){
        console.error(e);
        _viajesCruceCargados = false;
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
                "/farmacia_data?select=codigo,descripcion,cantidad,cantidad_atendida&viaje=eq." + viaje + "&orden_compra=eq." + oc
            )
        ]);

        if(!ocPortalFilas || !ocPortalFilas.length){
            tbody.innerHTML = `<tr><td colspan="8" class="sin-datos">Esa OC todavía no tiene datos cargados en "OC Portal Cliente".</td></tr>`;
            return;
        }

        const escaneadoCajasPorCodigo = {};

        (lecturasFilas || []).forEach(function(l){
            if(!l.codigo){
                return;
            }
            escaneadoCajasPorCodigo[l.codigo] = (escaneadoCajasPorCodigo[l.codigo] || 0) + Number(l.cantidad_cajas || 0);
        });

        // Una fila por cada código programado en SAP para esta OC
        // (regla en cruzarCodigosSapConOc): los que la OC trae pero no
        // se programaron no aparecen; los programados que no están en
        // la OC salen como observación.
        const prioridad = { "pendiente": 0, "advertencia": 1, "disponible": 2, "activado": 3 };

        const filas = cruzarCodigosSapConOc(dataFilas, ocPortalFilas, maraAlicorpFilas, escaneadoCajasPorCodigo)
            .sort((a, b) => prioridad[a.estadoClase] - prioridad[b.estadoClase]);

        tbody.innerHTML = "";

        if(!filas.length){
            tbody.innerHTML = `<tr><td colspan="8" class="sin-datos">Este Viaje/OC no tiene códigos programados en "Carga y Viajes".</td></tr>`;
            return;
        }

        filas.forEach(function(f){

            const tr = document.createElement("tr");

            tr.innerHTML = `
                <td>${escaparHtmlFarmacia(f.ean || "-")}</td>
                <td>${escaparHtmlFarmacia(f.codigo)}</td>
                <td>${escaparHtmlFarmacia(f.descripcion || "-")}</td>
                <td>${f.solicitadoOc === null ? "-" : formatearNumeroFarmacia(f.solicitadoOc)}</td>
                <td>${f.factor || "-"}</td>
                <td>${formatearNumeroFarmacia(f.cajas)}</td>
                <td>${f.unidades === null ? "-" : formatearNumeroFarmacia(f.unidades)}</td>
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

// Solo se ofrecen las OC ya "completas" (ver regla dentro de la
// función): mismos criterios que Cruce de Información y Resumen por
// Código, evaluados acá para decidir si la OC ya está lista para el
// reporte final.
async function cargarOcsCompletasParaDataFinal(){

    if(_ocsDataFinalCargadas){
        return;
    }

    _ocsDataFinalCargadas = true;

    cmbOcDataFinal.innerHTML = `<option value="">Cargando OC...</option>`;
    cmbOcDataFinal.disabled = true;

    try{

        const [dataFilas, alicorpFilas, lecturasFilas] = await Promise.all([
            supabaseFetchTodo("/farmacia_data?select=viaje,orden_compra,codigo,descripcion,cantidad,cantidad_atendida"),
            supabaseFetchTodo("/mara_alicorp?select=ean,codigo,descripcion,factor_unidad_alm,tvu"),
            supabaseFetchTodo("/farmacia_lecturas?select=viaje,oc,codigo,lote,fv,cantidad_cajas")
        ]);

        const tvuPorCodigo = {};

        (alicorpFilas || []).forEach(function(m){
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
                infoPorOc[f.orden_compra] = { viaje: f.viaje, filas: [] };
            }
            infoPorOc[f.orden_compra].filas.push(f);
        });

        // Solo las líneas de OC Portal de las OC que hoy tienen viaje
        // cargado (no toda la tabla).
        const ocsConViaje = Object.keys(infoPorOc);

        const ocPortalFilas = ocsConViaje.length
            ? await supabaseFetchTodo(
                "/oc_portal_cliente?select=oc,ean,cantidad_sku_solicitada,descripcion_producto&oc=in.(" + ocsConViaje.join(",") + ")"
            )
            : [];

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

        const hoy = new Date();
        _viajePorOcDataFinal = {};

        // Una OC está lista para Data Final cuando, en CADA código
        // programado en SAP: el cruce con la OC del cliente está OK
        // (está en la OC y no se pasa de ella), la Ctd. Registrada es
        // igual a la Ctd. Atendida, y no tiene observaciones de lotes
        // (más de 3) ni de vida útil. La OC puede pedir más de lo que
        // se manda; eso no es problema.
        const ocsCompletas = ocsConViaje.filter(function(ocStr){

            const oc = Number(ocStr);
            const ocPortalDeOc = (ocPortalFilas || []).filter(row => String(row.oc) === ocStr);

            if(!ocPortalDeOc.length){
                return false;
            }

            const cajasPorCodigo = {};

            Object.keys(lecturasPorOcCodigo).forEach(function(clave){
                const partes = clave.split("|");
                if(partes[0] === ocStr){
                    cajasPorCodigo[partes[1]] = lecturasPorOcCodigo[clave].cajas;
                }
            });

            const cruce = cruzarCodigosSapConOc(infoPorOc[ocStr].filas, ocPortalDeOc, alicorpFilas, cajasPorCodigo);

            const completa = cruce.length > 0 && cruce.every(function(linea){

                if(!linea.ok || linea.cajas !== linea.atendida){
                    return false;
                }

                const datosLectura = lecturasPorOcCodigo[oc + "|" + linea.codigo] || { cajas: 0, lotes: [] };

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
            tbody.innerHTML = `<tr><td colspan="5" class="sin-datos">Esa OC todavía no tiene lecturas registradas.</td></tr>`;
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

document.getElementById("btnExportarDataFinal").addEventListener("click", async function(){

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

    // Queda registrado que esta OC ya tuvo su Data Final exportada —
    // es uno de los requisitos para que el viaje pase a Finalizado.
    const oc = Number(cmbOcDataFinal.value);
    const viaje = _viajePorOcDataFinal[oc];

    try{

        await supabaseFetch("/data_final_generada?on_conflict=oc", {
            method: "POST",
            headers: { "Prefer": "resolution=merge-duplicates" },
            body: JSON.stringify({
                oc: oc,
                viaje: viaje || null,
                generado_por: (sesion && (sesion.nombre_completo || sesion.usuario)) || ""
            })
        });

    }catch(e){
        console.error(e);
    }

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

    _viajesCruceLotesCargados = true;

    try{

        const viajeSeleccionadoAntes = cmbViajeCruceLotes.value;

        const filas = await supabaseFetchTodo("/stock_fisico_sap?select=viaje");

        const viajes = [...new Set((filas || []).map(f => f.viaje))]
            .filter(v => v !== null && v !== undefined)
            .sort((a, b) => a - b);

        cmbViajeCruceLotes.querySelectorAll("option[value]:not([value=''])").forEach(op => op.remove());

        viajes.forEach(function(v){
            const option = document.createElement("option");
            option.value = String(v);
            option.textContent = String(v);
            cmbViajeCruceLotes.appendChild(option);
        });

        cmbViajeCruceLotes.value = viajeSeleccionadoAntes;

    }catch(e){
        console.error(e);
        _viajesCruceLotesCargados = false;
    }

}

function refrescarViajesParaCruceLotes(){
    _viajesCruceLotesCargados = false;
    cargarViajesParaCruceLotes();
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

        let rutaSap = "/stock_fisico_sap?select=viaje,oc,producto,descripcion_producto,ubicacion,lote,cantidad_embalada&viaje=eq." + viaje;
        let rutaLecturas = "/farmacia_lecturas?select=viaje,oc,codigo,descripcion,lote,fv,cantidad_cajas&viaje=eq." + viaje;

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
                    lotesPistoleados: [],
                    fvPorLote: {}
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
                if(f.fv && !grupo.fvPorLote[String(f.lote).trim()]){
                    grupo.fvPorLote[String(f.lote).trim()] = f.fv;
                }
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
                observaciones.push(lotesConProblema.length + " lote(s) de SAP no coinciden con lo registrado");
            }

            if(g.ctdSap !== g.ctdPistoleada){
                observaciones.push("Cantidad no coincide (SAP " + g.ctdSap + " vs registrado " + g.ctdPistoleada + ")");
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
                fvPorLote: g.fvPorLote,
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

            const lotesFisicosTexto = f.lotesPistoleadosSet.size
                ? [...f.lotesPistoleadosSet].join(", ")
                : "Sin registros de este código";

            const filasSapDetalle = f.filasSap.map(function(s){

                const loteTexto = s.lote ? String(s.lote).trim() : "";
                const noCoincide = loteTexto && !f.lotesPistoleadosSet.has(loteTexto);

                // El F.V. sale de lo escaneado (Lecturas), no del export
                // de SAP — lo físico es lo que vale. Si ese Lote no se
                // escaneó, no hay F.V. de lo físico que mostrar.
                const fv = loteTexto ? (f.fvPorLote[loteTexto] || "-") : "-";

                return `
                    <tr>
                        <td>${s.ubicacion || "-"}</td>
                        <td class="${noCoincide ? "lote-a-cambiar" : ""}">${s.lote || "-"}</td>
                        <td>${lotesFisicosTexto}</td>
                        <td>${formatearNumeroFarmacia(s.cantidad_embalada)}</td>
                        <td>${fv}</td>
                        <td>${noCoincide ? "No coincide con lo registrado — cambiar en SAP" : "-"}</td>
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
                                <th>Lote Físico (registrado)</th>
                                <th>Ctd. (Cajas)</th>
                                <th>F.V.</th>
                                <th>Observación</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${filasSapDetalle || '<tr><td colspan="6" class="sin-datos">Sin filas de Stock Físico SAP.</td></tr>'}
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

// ========================================
// REFRESCO DE CACHÉS DE VIAJE/OC
// ========================================
// Los desplegables de Viaje/OC de varias pestañas se cargan una sola
// vez por sesión de página (para no repetir la consulta cada vez que
// se cambia de tab) — si el usuario entra a esa pestaña ANTES de que
// exista la data que muestran, quedan vacíos/desactualizados para
// siempre hasta refrescar toda la página. Esta función se llama justo
// después de cualquier acción que cambie esa data (subir/reemplazar/
// eliminar un viaje, subir OC Portal, subir MARA Alicorp, subir Stock
// Físico SAP, eliminar una lectura), para que la próxima vez que se
// visite cada pestaña, vuelva a consultar en vez de usar lo viejo.
function refrescarCachesViajesFarmacia(){

    _viajesLecturasCargados = false;
    _viajesCruceCargados = false;
    _viajesFiltroStockCargados = false;
    _ocsDataFinalCargadas = false;
    _viajesStockCargados = false;
    _viajesCruceLotesCargados = false;

}

// ========================================
// BASE DE DATOS (VIAJES GUARDADOS)
// ========================================
// Un viaje Finalizado se "Guarda" desde el menú ⋮ de Viajes Generados:
// se toma una foto de TODA su información (lo que se cargó y lo que se
// calcula en cada pestaña) y queda en farmacia_viajes_guardados, una
// fila por viaje, con las hojas del Excel ya armadas en "datos". Recién
// cuando esa fila quedó guardada se borra el viaje de las tablas de
// trabajo (igual que "Eliminar"), así nunca se pierde información. MARA
// Alicorp es un maestro compartido: se copia (solo los códigos del
// viaje) pero no se borra. Las fotos de evidencia quedan en el storage;
// en el Excel va su URL.

function hojaSnapshot(nombre, encabezados, filas){
    return { nombre: nombre, encabezados: encabezados, filas: filas };
}

function textoFechaHora(iso){
    return iso ? formatearFechaHoraLecturas(iso) : "";
}

function valorCelda(v){
    return (v === null || v === undefined) ? "" : v;
}

// Mismo cálculo que "Resumen por Código" (buscarResumenCodigo).
function calcularResumenCodigoSnapshot(dataFilas, lecturasFilas, tvuPorCodigo){

    const porGrupo = {};

    function grupo(oc, codigo, descripcion){
        const clave = oc + "|" + codigo;
        if(!porGrupo[clave]){
            porGrupo[clave] = {
                oc: oc, codigo: codigo, descripcion: descripcion || "",
                programada: 0, atendida: 0, registrada: 0, ajuste: "", lotes: []
            };
        }
        if(descripcion && !porGrupo[clave].descripcion){
            porGrupo[clave].descripcion = descripcion;
        }
        return porGrupo[clave];
    }

    dataFilas.forEach(function(f){
        if(!f.codigo){
            return;
        }
        const g = grupo(f.orden_compra, f.codigo, f.descripcion);
        g.programada += Number(f.cantidad || 0);
        g.atendida += cantidadAtendida(f);
        if(f.observacion_atendida){
            g.ajuste = f.observacion_atendida;
        }
    });

    lecturasFilas.forEach(function(f){
        if(!f.codigo){
            return;
        }
        const g = grupo(f.oc, f.codigo, f.descripcion);
        g.registrada += Number(f.cantidad_cajas || 0);
        g.lotes.push(f);
    });

    const hoy = new Date();

    return Object.values(porGrupo).map(function(g){

        const lotesUnicos = [...new Set(g.lotes.map(l => l.lote).filter(Boolean))];
        const observaciones = [];

        if(lotesUnicos.length > 3){
            observaciones.push("Más de 3 lotes");
        }

        if(g.registrada > g.atendida){
            observaciones.push("Diferencia de cantidad (la Ctd. Registrada supera la Ctd. Atendida)");
        }

        const tvu = tvuPorCodigo[String(g.codigo).trim()];

        if(tvu){
            const vidaInsuficiente = g.lotes.some(function(l){
                const fv = completarFvConLote(l.fv, l.lote, tvu);
                return fv ? mesesEntre(hoy, new Date(fv + "T00:00:00")) <= (tvu / 2) : false;
            });
            if(vidaInsuficiente){
                observaciones.push("Vida útil restante menor o igual a la mitad del TVU");
            }
        }

        let estado;
        if(observaciones.length){
            estado = "Con observaciones";
        }else if(g.registrada >= g.atendida && g.atendida > 0){
            estado = "Completo";
        }else{
            estado = "Pendiente";
        }

        return [
            g.oc, g.codigo, g.descripcion, g.programada, g.atendida, g.ajuste,
            g.registrada, lotesUnicos.length, lotesUnicos.join(", "), estado, observaciones.join(" · ")
        ];

    }).sort(function(a, b){
        return String(a[0]).localeCompare(String(b[0])) || String(a[1]).localeCompare(String(b[1]));
    });

}

// Mismo cálculo que "Cruce de Información" (calcularCruce), para
// todas las OC del viaje.
function calcularCruceSnapshot(ocs, dataFilas, lecturasFilas, ocPortalFilas, maraFilas){

    const filas = [];

    ocs.forEach(function(oc){

        const cajasPorCodigo = {};

        lecturasFilas.filter(l => l.oc === oc).forEach(function(l){
            if(l.codigo){
                cajasPorCodigo[l.codigo] = (cajasPorCodigo[l.codigo] || 0) + Number(l.cantidad_cajas || 0);
            }
        });

        cruzarCodigosSapConOc(
            dataFilas.filter(f => f.orden_compra === oc),
            ocPortalFilas.filter(r => r.oc === oc),
            maraFilas,
            cajasPorCodigo
        ).forEach(function(c){
            filas.push([
                oc, c.ean, c.codigo, c.descripcion,
                c.solicitadoOc === null ? "" : c.solicitadoOc, c.factor || "",
                c.cajas, c.unidades === null ? "" : c.unidades, c.estadoTexto
            ]);
        });

    });

    return filas;

}

// Mismo cálculo que "Data Final" (generarDataFinal), para todas las OC
// del viaje.
function calcularDataFinalSnapshot(ocs, lecturasFilas, ocPortalFilas, alicorpFilas){

    const eanPorCodigo = {};
    const factorPorCodigo = {};

    alicorpFilas.forEach(function(a){
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

    const filas = [];

    ocs.forEach(function(oc){

        const skuPorEan = {};

        ocPortalFilas.filter(o => o.oc === oc).forEach(function(o){
            const clave = String(o.ean || "").trim();
            if(clave && !skuPorEan[clave]){
                skuPorEan[clave] = o.inretail_qs;
            }
        });

        const grupos = {};

        lecturasFilas.filter(l => l.oc === oc).forEach(function(l){

            const codigo = String(l.codigo || "").trim();
            const ean = eanPorCodigo[codigo] || null;
            const clave = codigo + "|" + (l.lote || "") + "|" + (l.fv || "");

            if(!grupos[clave]){
                grupos[clave] = {
                    codigo: codigo,
                    sku: ean ? (skuPorEan[ean] || null) : null,
                    lote: l.lote || "",
                    fv: l.fv || "",
                    cajas: 0
                };
            }

            grupos[clave].cajas += Number(l.cantidad_cajas || 0);

        });

        Object.values(grupos).sort((a, b) => String(a.sku).localeCompare(String(b.sku))).forEach(function(g){
            const factor = factorPorCodigo[g.codigo] || null;
            const unidades = (factor && factor > 0) ? Math.round(g.cajas * factor) : g.cajas;
            filas.push([oc, g.sku || "Sin código", unidades, g.lote, g.fv]);
        });

    });

    return filas;

}

// Mismo cálculo que "Cruce Lotes SAP vs Físico" (buscarCruceLotesSap).
function calcularCruceLotesSnapshot(stockFilas, lecturasFilas){

    const porGrupo = {};

    function grupo(oc, codigo, descripcion){
        const clave = oc + "|" + codigo;
        if(!porGrupo[clave]){
            porGrupo[clave] = {
                oc: oc, codigo: codigo, descripcion: descripcion || "",
                ctdSap: 0, ctdFisico: 0, filasSap: [], lotesFisicos: new Set()
            };
        }
        if(descripcion && !porGrupo[clave].descripcion){
            porGrupo[clave].descripcion = descripcion;
        }
        return porGrupo[clave];
    }

    stockFilas.forEach(function(f){
        if(!f.producto){
            return;
        }
        const g = grupo(f.oc, f.producto, f.descripcion_producto);
        g.ctdSap += Number(f.cantidad_embalada || 0);
        g.filasSap.push(f);
    });

    lecturasFilas.forEach(function(f){
        if(!f.codigo){
            return;
        }
        const g = grupo(f.oc, f.codigo, f.descripcion);
        g.ctdFisico += Number(f.cantidad_cajas || 0);
        if(f.lote){
            g.lotesFisicos.add(String(f.lote).trim());
        }
    });

    return Object.values(porGrupo).filter(g => g.filasSap.length > 0).map(function(g){

        const observaciones = [];

        const lotesConProblema = g.filasSap.filter(f => f.lote && !g.lotesFisicos.has(String(f.lote).trim()));

        if(lotesConProblema.length){
            observaciones.push(lotesConProblema.length + " lote(s) de SAP no coinciden con lo registrado");
        }

        if(g.ctdSap !== g.ctdFisico){
            observaciones.push("Cantidad no coincide (SAP " + g.ctdSap + " vs registrado " + g.ctdFisico + ")");
        }

        const lotesSap = [...new Set(g.filasSap.map(f => f.lote).filter(Boolean))];

        return [
            g.oc, g.codigo, g.descripcion, g.ctdSap, g.ctdFisico,
            lotesSap.join(", "), [...g.lotesFisicos].join(", "),
            observaciones.length ? "Con observaciones" : "Completo", observaciones.join(" · ")
        ];

    }).sort(function(a, b){
        return String(a[0]).localeCompare(String(b[0])) || String(a[1]).localeCompare(String(b[1]));
    });

}

async function armarSnapshotViaje(viaje){

    const [dataFilas, estadoFilas, lecturasFilas, stockFilas, alicorpFilas] = await Promise.all([
        supabaseFetchTodo("/farmacia_data?select=*&viaje=eq." + viaje + "&order=orden_compra.asc,codigo.asc"),
        supabaseFetch("/farmacia_viajes_activados?select=*&viaje=eq." + viaje),
        supabaseFetchTodo("/farmacia_lecturas?select=*&viaje=eq." + viaje + "&order=created_at.asc"),
        supabaseFetchTodo("/stock_fisico_sap?select=*&viaje=eq." + viaje + "&order=oc.asc,producto.asc"),
        supabaseFetchTodo("/mara_alicorp?select=codigo,descripcion,ean,factor_unidad_alm,unidad_almacenamiento,tvu")
    ]);

    if(!dataFilas || !dataFilas.length){
        throw new Error("El viaje " + viaje + " no tiene datos cargados.");
    }

    const ocs = [...new Set(dataFilas.map(f => f.orden_compra))]
        .filter(v => v !== null && v !== undefined)
        .sort((a, b) => a - b);

    const listaOcs = ocs.join(",");

    const [ocPortalFilas, canalFilas, dataFinalFilas] = ocs.length
        ? await Promise.all([
            supabaseFetchTodo("/oc_portal_cliente?select=*&oc=in.(" + listaOcs + ")&order=oc.asc,posicion.asc"),
            supabaseFetchTodo("/oc_canal?select=*&oc=in.(" + listaOcs + ")"),
            supabaseFetchTodo("/data_final_generada?select=*&oc=in.(" + listaOcs + ")")
        ])
        : [[], [], []];

    const lecturas = lecturasFilas || [];
    const stock = stockFilas || [];
    const ocPortal = ocPortalFilas || [];
    const alicorp = alicorpFilas || [];

    const codigosViaje = new Set(dataFilas.map(f => String(f.codigo || "").trim()).filter(Boolean));

    const maraPorEan = {};
    const tvuPorCodigo = {};

    alicorp.forEach(function(m){
        if(m.ean){
            maraPorEan[String(m.ean).trim()] = m;
        }
        if(m.codigo && m.tvu){
            tvuPorCodigo[String(m.codigo).trim()] = Number(m.tvu);
        }
    });

    const estado = (estadoFilas && estadoFilas[0] && estadoFilas[0].estado) || "finalizado";
    const fechaCita = (dataFilas.find(f => f.fecha_cita) || {}).fecha_cita || null;

    const totalProgramada = dataFilas.reduce((s, f) => s + Number(f.cantidad || 0), 0);
    const totalAtendida = dataFilas.reduce((s, f) => s + cantidadAtendida(f), 0);
    const totalRegistrada = lecturas.reduce((s, f) => s + Number(f.cantidad_cajas || 0), 0);

    const guardadoPor = (sesion && (sesion.nombre_completo || sesion.usuario)) || "";
    const guardadoEn = new Date().toISOString();

    const canalPorOc = new Map((canalFilas || []).map(f => [f.oc, f.canal || ""]));
    const dataFinalPorOc = new Map((dataFinalFilas || []).map(f => [f.oc, f]));

    const hojas = [

        hojaSnapshot("Resumen", ["Dato", "Valor"], [
            ["Viaje", viaje],
            ["Fecha de cita", fechaCita || ""],
            ["Estado", estado],
            ["OC", ocs.join(", ")],
            ["Cantidad de OC", ocs.length],
            ["Códigos", dataFilas.length],
            ["Ctd. Programada", totalProgramada],
            ["Ctd. Atendida", totalAtendida],
            ["Ctd. Registrada", totalRegistrada],
            ["Lecturas registradas", lecturas.length],
            ["Guardado por", guardadoPor],
            ["Fecha guardado", textoFechaHora(guardadoEn)]
        ]),

        hojaSnapshot("OC del viaje",
            ["OC", "Canal", "Códigos", "Ctd. Programada", "Ctd. Atendida", "Data Final generada por", "Fecha Data Final"],
            ocs.map(function(oc){
                const filasOc = dataFilas.filter(f => f.orden_compra === oc);
                const df = dataFinalPorOc.get(oc);
                return [
                    oc, canalPorOc.get(oc) || "", filasOc.length,
                    filasOc.reduce((s, f) => s + Number(f.cantidad || 0), 0),
                    filasOc.reduce((s, f) => s + cantidadAtendida(f), 0),
                    df ? (df.generado_por || "") : "",
                    df ? textoFechaHora(df.generado_en || df.created_at) : ""
                ];
            })
        ),

        hojaSnapshot("Carga y Viajes",
            ["Fecha de cita", "Viaje", "OC", "Entrega", "Código", "Descripción", "UN",
             "Ctd. Programada", "Ctd. Atendida", "Motivo ajuste", "Ajustado por", "Fecha ajuste",
             "Archivo", "Cargado por", "Fecha carga"],
            dataFilas.map(f => [
                f.fecha_cita, f.viaje, f.orden_compra, f.entrega, f.codigo, f.descripcion, f.un,
                Number(f.cantidad || 0), cantidadAtendida(f), f.observacion_atendida,
                f.atendida_por, textoFechaHora(f.atendida_en),
                f.archivo_origen, f.cargado_por, textoFechaHora(f.created_at)
            ].map(valorCelda))
        ),

        hojaSnapshot("Resumen por Código",
            ["OC", "Código", "Descripción", "Ctd. Programada", "Ctd. Atendida", "Motivo ajuste",
             "Ctd. Registrada", "N° Lotes", "Lotes", "Estado", "Observaciones"],
            calcularResumenCodigoSnapshot(dataFilas, lecturas, tvuPorCodigo)
        ),

        hojaSnapshot("Lecturas y Evidencias",
            ["Viaje", "OC", "Código", "Descripción", "Lote", "F.V.", "Cantidad de Cajas",
             "Escaneado por", "Fecha", "URL Foto"],
            lecturas.map(f => [
                f.viaje, f.oc, f.codigo, f.descripcion, f.lote, f.fv,
                Number(f.cantidad_cajas || 0), f.escaneado_por, textoFechaHora(f.created_at), f.foto_url
            ].map(valorCelda))
        ),

        hojaSnapshot("OC Portal Cliente",
            ["OC", "Tipo OC", "Clase documento", "Cód. lugar entrega", "Lugar entrega", "Dirección entrega",
             "Fecha emisión", "Fecha vencimiento", "Posición", "Inretail/QS", "EAN", "Código proveedor",
             "Descripción producto", "Empaque", "SKU/Empaque", "Precio lista", "Desc. 1", "Desc. 2",
             "Desc. 3", "Desc. 4", "Desc. 5", "Desc. 6", "P. Final neto", "P. Final (con imp)",
             "Cód. local destino", "Local destino", "Ctdad. SKU solicitadas"],
            ocPortal.map(o => [
                o.oc, o.tipo_oc, o.clase_documento, o.cod_lugar_entrega, o.nombre_lugar_entrega,
                o.direccion_entrega, o.fecha_emision, o.fecha_vencimiento, o.posicion, o.inretail_qs,
                o.ean, o.codigo_proveedor, o.descripcion_producto, o.empaque, o.sku_empaque,
                o.precio_lista, o.desc_1, o.desc_2, o.desc_3, o.desc_4, o.desc_5, o.desc_6,
                o.precio_final_neto, o.precio_final_con_imp, o.codigo_local_destino,
                o.nombre_local_destino, o.cantidad_sku_solicitada
            ].map(valorCelda))
        ),

        hojaSnapshot("MARA Alicorp",
            ["Código", "Descripción", "EAN", "Factor unidad alm.", "Unidad almacenamiento", "TVU (meses)"],
            alicorp.filter(m => codigosViaje.has(String(m.codigo || "").trim())).map(m => [
                m.codigo, m.descripcion, m.ean, m.factor_unidad_alm, m.unidad_almacenamiento, m.tvu
            ].map(valorCelda))
        ),

        hojaSnapshot("Stock Físico SAP",
            ["Viaje", "OC", "Tipo almacén", "Ubicación", "Producto", "Descripción", "Lote",
             "Fecha caducidad", "Tipo stock", "Ctd. embalada", "UM alt.", "Cantidad", "Fecha EM"],
            stock.map(s => [
                s.viaje, s.oc, s.tipo_almacen, s.ubicacion, s.producto, s.descripcion_producto, s.lote,
                s.fecha_caducidad, s.tipo_stock, s.cantidad_embalada, s.unidad_medida_alt, s.cantidad, s.fecha_em
            ].map(valorCelda))
        ),

        hojaSnapshot("Cruce de Información",
            ["OC", "EAN", "Código", "Descripción", "Solicitado (Unidades)", "Factor",
             "Registrado (Cajas)", "Registrado (Unidades)", "Estado"],
            calcularCruceSnapshot(ocs, dataFilas, lecturas, ocPortal, alicorp)
        ),

        hojaSnapshot("Data Final",
            ["No. OC", "SKU", "Cantidad", "No. Lote", "Fecha Vto."],
            calcularDataFinalSnapshot(ocs, lecturas, ocPortal, alicorp)
        ),

        hojaSnapshot("Cruce Lotes SAP vs Físico",
            ["OC", "Código", "Descripción", "Ctd. SAP (Cajas)", "Ctd. Registrada (Cajas)",
             "Lotes SAP", "Lotes físicos", "Estado", "Observaciones"],
            calcularCruceLotesSnapshot(stock, lecturas)
        )

    ];

    return {
        fila: {
            viaje: viaje,
            fecha_cita: fechaCita,
            ocs: ocs.join(", "),
            total_ocs: ocs.length,
            total_codigos: dataFilas.length,
            cantidad_programada: totalProgramada,
            cantidad_atendida: totalAtendida,
            cantidad_registrada: totalRegistrada,
            total_lecturas: lecturas.length,
            guardado_por: guardadoPor,
            guardado_en: guardadoEn,
            datos: { version: 1, hojas: hojas }
        },
        ocs: ocs
    };

}

// Modal propio de confirmación (en vez del confirm() del navegador).
// Resuelve true si se acepta y false si se cancela (botón, fondo o Esc).
function confirmarFarmacia(opciones){

    const modal = document.getElementById("modalConfirmar");
    const btnAceptar = document.getElementById("btnConfirmarAceptar");
    const btnCancelar = document.getElementById("btnConfirmarCancelar");
    const fondo = document.getElementById("modalConfirmarFondo");

    document.getElementById("confirmarTitulo").textContent = opciones.titulo || "Confirmar";
    document.getElementById("confirmarMensaje").innerHTML = opciones.mensajeHtml || "";
    btnAceptar.textContent = opciones.textoAceptar || "Aceptar";

    // soloAceptar: aviso con un solo botón (sin Cancelar).
    btnCancelar.style.display = opciones.soloAceptar ? "none" : "";

    modal.classList.remove("oculto");
    setTimeout(function(){ (opciones.soloAceptar ? btnAceptar : btnCancelar).focus(); }, 50);

    return new Promise(function(resolve){

        function cerrar(valor){
            modal.classList.add("oculto");
            btnAceptar.removeEventListener("click", alAceptar);
            btnCancelar.removeEventListener("click", alCancelar);
            fondo.removeEventListener("click", alCancelar);
            document.removeEventListener("keydown", alTecla);
            resolve(valor);
        }

        function alAceptar(){ cerrar(true); }
        function alCancelar(){ cerrar(false); }
        function alTecla(e){
            if(e.key === "Escape"){ alCancelar(); }
        }

        btnAceptar.addEventListener("click", alAceptar);
        btnCancelar.addEventListener("click", alCancelar);
        fondo.addEventListener("click", alCancelar);
        document.addEventListener("keydown", alTecla);

    });

}

async function guardarViajeEnBaseDatos(viaje, boton){

    const confirmado = await confirmarFarmacia({
        titulo: "Guardar viaje " + viaje,
        textoAceptar: "Guardar en Base de Datos",
        mensajeHtml:
            "Se guardará toda la información del viaje:" +
            "<ul>" +
                "<li>Plantilla, lecturas y fotos</li>" +
                "<li>OC Portal, MARA y Stock SAP</li>" +
                "<li>Cruces y Data Final</li>" +
            "</ul>" +
            "<div class=\"modal-confirmar-aviso\">" +
                "Luego se borrará de todos los módulos y de Viajes Generados. " +
                "Solo se podrá consultar y descargar desde \"Base de Datos\"." +
            "</div>"
    });

    if(!confirmado){
        return;
    }

    const textoOriginal = boton ? boton.textContent : "";

    function avanceBoton(texto){
        if(boton){
            boton.disabled = true;
            boton.textContent = texto;
        }
    }

    function restaurarBoton(){
        if(boton){
            boton.disabled = false;
            boton.textContent = textoOriginal;
        }
    }

    // 1) Solo viajes que siguen cumpliendo todo para estar Finalizados.
    avanceBoton("Verificando...");

    try{

        const chequeo = await evaluarRequisitosViaje(viaje);

        if(!chequeo.listo){
            mostrarToast(
                "No se puede guardar: el viaje ya no cumple " + chequeo.razones.length + " requisito(s): " +
                chequeo.razones.join(" · "),
                "error"
            );
            restaurarBoton();
            return;
        }

    }catch(err){
        console.error(err);
        mostrarToast("No se pudo verificar el viaje: " + err.message, "error");
        restaurarBoton();
        return;
    }

    // 2) Foto completa del viaje + insert en la Base de Datos. Si algo
    // falla aquí, no se borra nada.
    let snapshot;

    avanceBoton("Guardando...");

    try{

        const yaGuardado = await supabaseFetch("/farmacia_viajes_guardados?select=viaje&viaje=eq." + viaje);

        if(yaGuardado && yaGuardado.length){
            mostrarToast("El viaje " + viaje + " ya está guardado en la Base de Datos.", "error");
            restaurarBoton();
            return;
        }

        snapshot = await armarSnapshotViaje(viaje);

        const respuesta = await supabaseFetch("/farmacia_viajes_guardados", {
            method: "POST",
            headers: { "Prefer": "return=representation" },
            body: JSON.stringify(snapshot.fila)
        });

        if(!respuesta || !respuesta.length){
            throw new Error("La Base de Datos no confirmó el guardado.");
        }

    }catch(err){
        console.error(err);
        mostrarToast("No se pudo guardar el viaje (no se borró nada): " + err.message, "error");
        restaurarBoton();
        return;
    }

    // 3) Ya está a salvo en la Base de Datos: se limpia de los módulos.
    avanceBoton("Limpiando...");

    try{

        if(snapshot.ocs.length){
            const listaOcs = snapshot.ocs.join(",");
            await supabaseFetch("/oc_portal_cliente?oc=in.(" + listaOcs + ")", { method: "DELETE" });
            await supabaseFetch("/oc_canal?oc=in.(" + listaOcs + ")", { method: "DELETE" });
            await supabaseFetch("/data_final_generada?oc=in.(" + listaOcs + ")", { method: "DELETE" });
        }

        await supabaseFetch("/farmacia_lecturas?viaje=eq." + viaje, { method: "DELETE" });
        await supabaseFetch("/stock_fisico_sap?viaje=eq." + viaje, { method: "DELETE" });
        await supabaseFetch("/farmacia_data?viaje=eq." + viaje, { method: "DELETE" });
        await supabaseFetch("/farmacia_viajes_activados?viaje=eq." + viaje, { method: "DELETE" });

        // Se quita la fila de inmediato; la tabla completa se recarga
        // abajo (eso tarda más porque recalcula el estado de cada viaje).
        const botonMenuViaje = document.querySelector('#tblViajes .btn-menu-acciones[data-viaje="' + viaje + '"]');
        if(botonMenuViaje){
            botonMenuViaje.closest("tr").remove();
        }

        mostrarToast("Viaje " + viaje + " guardado en la Base de Datos y retirado de los módulos.", "exito");

    }catch(err){
        console.error(err);
        mostrarToast(
            "El viaje " + viaje + " SÍ quedó guardado en la Base de Datos, pero no se pudo borrar todo de los módulos: " +
            err.message,
            "error"
        );
    }

    await cargarResumenExistente();
    refrescarCachesViajesFarmacia();

}

async function buscarViajesGuardados(){

    const tbody = document.getElementById("tblViajesGuardados");
    const viaje = document.getElementById("filtroViajeGuardado").value.trim();
    const desde = document.getElementById("filtroCitaDesdeGuardado").value;
    const hasta = document.getElementById("filtroCitaHastaGuardado").value;

    if(viaje && !/^\d+$/.test(viaje)){
        tbody.innerHTML = `<tr><td colspan="10" class="sin-datos">El viaje debe tener solo números.</td></tr>`;
        return;
    }

    tbody.innerHTML = `<tr><td colspan="10" class="sin-datos">Buscando...</td></tr>`;

    try{

        let ruta = "/farmacia_viajes_guardados?select=viaje,fecha_cita,ocs,total_ocs,total_codigos," +
            "cantidad_programada,cantidad_atendida,cantidad_registrada,guardado_por,guardado_en" +
            "&order=guardado_en.desc";

        if(viaje){
            ruta += "&viaje=eq." + viaje;
        }

        if(desde){
            ruta += "&fecha_cita=gte." + desde;
        }

        if(hasta){
            ruta += "&fecha_cita=lte." + hasta;
        }

        const filas = await supabaseFetchTodo(ruta);

        if(!filas || !filas.length){
            tbody.innerHTML = `<tr><td colspan="10" class="sin-datos">No hay viajes guardados con esos filtros.</td></tr>`;
            return;
        }

        tbody.innerHTML = filas.map(function(f){
            return `
                <tr>
                    <td>${f.viaje}</td>
                    <td>${f.fecha_cita || "-"}</td>
                    <td title="${escaparHtmlFarmacia(f.ocs || "")}">${f.total_ocs ?? "-"}</td>
                    <td>${f.total_codigos ?? "-"}</td>
                    <td>${formatearNumeroFarmacia(f.cantidad_programada)}</td>
                    <td>${formatearNumeroFarmacia(f.cantidad_atendida)}</td>
                    <td>${formatearNumeroFarmacia(f.cantidad_registrada)}</td>
                    <td>${escaparHtmlFarmacia(f.guardado_por || "-")}</td>
                    <td>${textoFechaHora(f.guardado_en) || "-"}</td>
                    <td><button class="btn-descargar-guardado" data-viaje="${f.viaje}">⬇ Descargar</button></td>
                </tr>
            `;
        }).join("");

    }catch(e){

        console.error(e);
        tbody.innerHTML = `<tr><td colspan="10" class="sin-datos">No se pudo cargar la Base de Datos. ¿Ya se corrió viajes-guardados.sql en Supabase?</td></tr>`;

    }

}

async function descargarViajeGuardado(viaje, boton){

    const textoOriginal = boton.textContent;
    boton.disabled = true;
    boton.textContent = "Descargando...";

    try{

        const filas = await supabaseFetch("/farmacia_viajes_guardados?select=viaje,datos&viaje=eq." + viaje);

        if(!filas || !filas.length || !filas[0].datos || !filas[0].datos.hojas){
            throw new Error("No se encontró el detalle de ese viaje.");
        }

        const libro = XLSX.utils.book_new();

        filas[0].datos.hojas.forEach(function(h){
            const hoja = XLSX.utils.aoa_to_sheet([h.encabezados, ...h.filas]);
            // Excel limita el nombre de la hoja a 31 caracteres.
            XLSX.utils.book_append_sheet(libro, hoja, String(h.nombre).slice(0, 31));
        });

        XLSX.writeFile(libro, "VIAJE_" + viaje + "_DETALLE_GENERAL.xlsx");

    }catch(e){
        console.error(e);
        mostrarToast("No se pudo descargar el viaje " + viaje + ": " + e.message, "error");
    }

    boton.disabled = false;
    boton.textContent = textoOriginal;

}

document.getElementById("btnBuscarGuardados").addEventListener("click", buscarViajesGuardados);

document.getElementById("filtroViajeGuardado").addEventListener("keydown", function(e){
    if(e.key === "Enter"){
        buscarViajesGuardados();
    }
});

document.getElementById("tblViajesGuardados").addEventListener("click", function(e){
    const boton = e.target.closest(".btn-descargar-guardado");
    if(boton){
        descargarViajeGuardado(boton.dataset.viaje, boton);
    }
});

// ========================================
// AVANCE DE VIAJES
// ========================================
// Dos resúmenes de los viajes cargados (los que todavía no se guardaron
// en la Base de Datos):
// - "Por viaje": matriz de semáforos con los 6 pasos de cada viaje.
// - "Por OC": la recolección de cada OC (Ctd. Registrada vs Atendida),
//   para poder cerrar una OC apenas termina sin esperar al resto.
// Se trae todo en una consulta por tabla (no viaje por viaje) y se
// calcula con las mismas reglas que el resto del módulo
// (cantidadAtendida, cruzarCodigosSapConOc, vida útil, lotes). Solo se
// actualiza al abrir la pestaña o con el botón "Actualizar".

const MINUTOS_OC_DETENIDA = 10;

const PASOS_AVANCE = [
    { clave: "registro", corto: "Registro", icono: "R" },
    { clave: "ocPortal", corto: "OC Portal", icono: "O" },
    { clave: "cruce", corto: "Cruce", icono: "C" },
    { clave: "stock", corto: "Stock SAP", icono: "S" },
    { clave: "lotes", corto: "Lotes", icono: "L" },
    { clave: "dataFinal", corto: "Data Final", icono: "D" }
];

const TEXTO_ESTADO_VIAJE = { activo: "Activo", desactivado: "Desactivado", cerrado: "Cerrado", finalizado: "Finalizado" };
const CLASE_ESTADO_VIAJE = { activo: "activado", desactivado: "advertencia", cerrado: "cerrado", finalizado: "disponible" };

const ESTADOS_OC_AVANCE = {
    cerrada: { texto: "Cerrada", clase: "activado" },
    lista: { texto: "Lista para cerrar", clase: "activado" },
    observacion: { texto: "Con observación", clase: "pendiente" },
    detenida: { texto: "Detenida", clase: "detenida" },
    recolectando: { texto: "Recolectando", clase: "recolectando" },
    sin_iniciar: { texto: "Sin iniciar", clase: "disponible" }
};

let _vistaAvance = "viaje";
let _avanceViajes = [];
let _viajesAvanceAbiertos = new Set();

function horaCorta(iso){
    return new Date(iso).toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" });
}

function combinarPasos(estados){
    if(estados.some(e => e === "ob")){
        return "ob";
    }
    return estados.length && estados.every(e => e === "ok") ? "ok" : "pe";
}

function calcularAvanceOc(viaje, oc, dataOc, lecturasOc, portalOc, stockOc, maraFilas, tvuPorCodigo, ocsConDataFinal, ahora){

    // ---- Recolección por código ----
    const porCodigo = {};

    dataOc.forEach(function(f){
        const c = String(f.codigo || "").trim();
        if(!c){
            return;
        }
        if(!porCodigo[c]){
            porCodigo[c] = { codigo: c, atendida: 0, registrada: 0, lotes: [] };
        }
        porCodigo[c].atendida += cantidadAtendida(f);
    });

    const cajasPorCodigo = {};

    lecturasOc.forEach(function(l){
        const c = String(l.codigo || "").trim();
        cajasPorCodigo[c] = (cajasPorCodigo[c] || 0) + Number(l.cantidad_cajas || 0);
        if(porCodigo[c]){
            porCodigo[c].registrada += Number(l.cantidad_cajas || 0);
            porCodigo[c].lotes.push(l);
        }
    });

    const codigos = Object.values(porCodigo);
    const observaciones = [];
    const faltantes = [];
    let atendidaTotal = 0;
    let registradaUtil = 0;
    let completos = 0;

    codigos.forEach(function(g){

        atendidaTotal += g.atendida;
        registradaUtil += Math.min(g.registrada, g.atendida);

        if(g.registrada >= g.atendida){
            completos++;
        }else{
            faltantes.push({ codigo: g.codigo, cajas: g.atendida - g.registrada });
        }

        if(g.registrada > g.atendida){
            observaciones.push(g.codigo + ": registrada (" + g.registrada + ") supera la atendida (" + g.atendida + ")");
        }

        const lotesUnicos = [...new Set(g.lotes.map(l => l.lote).filter(Boolean))];

        if(lotesUnicos.length > 3){
            observaciones.push(g.codigo + ": " + lotesUnicos.length + " lotes (máx. 3)");
        }

        const tvu = tvuPorCodigo[g.codigo];

        if(tvu && g.lotes.some(function(l){
            const fv = completarFvConLote(l.fv, l.lote, tvu);
            return fv ? mesesEntre(ahora, new Date(fv + "T00:00:00")) <= (tvu / 2) : false;
        })){
            observaciones.push(g.codigo + ": vida útil corta");
        }

    });

    let ultima = null;

    lecturasOc.forEach(function(l){
        if(l.created_at && (!ultima || l.created_at > ultima.created_at)){
            ultima = l;
        }
    });

    const pasos = {};

    pasos.registro = observaciones.length ? "ob" : (completos === codigos.length ? "ok" : "pe");
    pasos.ocPortal = portalOc.length ? "ok" : "pe";

    // ---- Cruce con la OC del cliente (misma regla que Cruce de Información) ----
    if(!portalOc.length){
        pasos.cruce = "pe";
    }else{
        const malos = cruzarCodigosSapConOc(dataOc, portalOc, maraFilas, cajasPorCodigo).filter(c => !c.ok);
        malos.forEach(c => observaciones.push(c.codigo + ": " + c.estadoTexto));
        pasos.cruce = malos.length ? "ob" : "ok";
    }

    // ---- Stock SAP y Cruce de Lotes de esta OC ----
    pasos.stock = stockOc.length ? "ok" : "pe";

    if(!stockOc.length){
        pasos.lotes = "pe";
    }else{

        const sapPorCodigo = {};

        stockOc.forEach(function(s){
            if(!s.producto){
                return;
            }
            if(!sapPorCodigo[s.producto]){
                sapPorCodigo[s.producto] = { cajas: 0, filas: [] };
            }
            sapPorCodigo[s.producto].cajas += Number(s.cantidad_embalada || 0);
            sapPorCodigo[s.producto].filas.push(s);
        });

        let hayProblema = false;

        Object.keys(sapPorCodigo).forEach(function(codigo){
            const g = sapPorCodigo[codigo];
            const lotesRegistrados = new Set(lecturasOc.filter(l => l.codigo === codigo && l.lote).map(l => String(l.lote).trim()));
            if(g.cajas !== (cajasPorCodigo[codigo] || 0)){
                hayProblema = true;
                observaciones.push(codigo + ": SAP " + g.cajas + " cj vs registrado " + (cajasPorCodigo[codigo] || 0));
            }
            if(g.filas.some(s => s.lote && !lotesRegistrados.has(String(s.lote).trim()))){
                hayProblema = true;
                observaciones.push(codigo + ": lote de SAP no coincide (cambiar en SAP)");
            }
        });

        pasos.lotes = hayProblema ? "ob" : "ok";

    }

    pasos.dataFinal = ocsConDataFinal.has(oc) ? "ok" : "pe";

    // ---- Estado de la OC ----
    let estado;

    if(PASOS_AVANCE.every(p => pasos[p.clave] === "ok")){
        estado = "cerrada";
    }else if(pasos.registro === "ok"){
        estado = "lista";
    }else if(pasos.registro === "ob"){
        estado = "observacion";
    }else if(!ultima){
        estado = "sin_iniciar";
    }else if((ahora - new Date(ultima.created_at)) / 60000 > MINUTOS_OC_DETENIDA){
        estado = "detenida";
    }else{
        estado = "recolectando";
    }

    return {
        viaje: viaje,
        oc: oc,
        codigos: codigos.length,
        completos: completos,
        atendida: atendidaTotal,
        registradaUtil: registradaUtil,
        pct: atendidaTotal > 0 ? Math.round(registradaUtil * 100 / atendidaTotal) : 100,
        ultima: ultima,
        minutosSinLectura: ultima ? Math.floor((ahora - new Date(ultima.created_at)) / 60000) : null,
        faltantes: faltantes.sort((a, b) => b.cajas - a.cajas),
        observaciones: observaciones,
        pasos: pasos,
        estado: estado
    };

}

async function cargarAvanceViajes(){

    const [dataFilas, estadosFilas, lecturasFilas, maraFilas, stockFilas] = await Promise.all([
        supabaseFetchTodo("/farmacia_data?select=viaje,orden_compra,codigo,descripcion,cantidad,cantidad_atendida,fecha_cita"),
        supabaseFetchTodo("/farmacia_viajes_activados?select=viaje,estado"),
        supabaseFetchTodo("/farmacia_lecturas?select=viaje,oc,codigo,lote,fv,cantidad_cajas,escaneado_por,created_at"),
        supabaseFetchTodo("/mara_alicorp?select=ean,codigo,descripcion,factor_unidad_alm,tvu"),
        supabaseFetchTodo("/stock_fisico_sap?select=viaje,oc,producto,lote,cantidad_embalada")
    ]);

    const todasOcs = [...new Set((dataFilas || []).map(f => f.orden_compra).filter(v => v !== null && v !== undefined))];

    const [portalFilas, dataFinalFilas] = todasOcs.length
        ? await Promise.all([
            supabaseFetchTodo("/oc_portal_cliente?select=oc,ean,cantidad_sku_solicitada,descripcion_producto&oc=in.(" + todasOcs.join(",") + ")"),
            supabaseFetchTodo("/data_final_generada?select=oc&oc=in.(" + todasOcs.join(",") + ")")
        ])
        : [[], []];

    const tvuPorCodigo = {};

    (maraFilas || []).forEach(function(m){
        if(m.codigo && m.tvu){
            tvuPorCodigo[String(m.codigo).trim()] = Number(m.tvu);
        }
    });

    const estadoPorViaje = new Map((estadosFilas || []).map(f => [f.viaje, f.estado || "desactivado"]));
    const ocsConDataFinal = new Set((dataFinalFilas || []).map(f => f.oc));
    const ahora = new Date();

    const viajes = [...new Set((dataFilas || []).map(f => f.viaje).filter(v => v !== null && v !== undefined))]
        .sort((a, b) => a - b);

    return viajes.map(function(viaje){

        const dataViaje = dataFilas.filter(f => f.viaje === viaje);
        const ocs = [...new Set(dataViaje.map(f => f.orden_compra).filter(v => v !== null && v !== undefined))].sort((a, b) => a - b);

        const ocsAvance = ocs.map(oc => calcularAvanceOc(
            viaje,
            oc,
            dataViaje.filter(f => f.orden_compra === oc),
            (lecturasFilas || []).filter(l => l.viaje === viaje && l.oc === oc),
            (portalFilas || []).filter(p => p.oc === oc),
            (stockFilas || []).filter(s => s.viaje === viaje && s.oc === oc),
            maraFilas,
            tvuPorCodigo,
            ocsConDataFinal,
            ahora
        ));

        const pasos = {};

        PASOS_AVANCE.forEach(function(p){
            pasos[p.clave] = combinarPasos(ocsAvance.map(o => o.pasos[p.clave]));
        });

        const atendida = ocsAvance.reduce((s, o) => s + o.atendida, 0);
        const registrada = ocsAvance.reduce((s, o) => s + o.registradaUtil, 0);

        // Lo que falta, en una línea por OC.
        const pendientes = [];

        ocsAvance.forEach(function(o){

            const partes = [];

            if(o.faltantes.length){
                partes.push("faltan " + o.faltantes.reduce((s, f) => s + f.cajas, 0) + " cajas (" + o.faltantes.length + " códigos)");
            }
            if(o.observaciones.length){
                partes.push(o.observaciones.join(" · "));
            }
            if(o.pasos.ocPortal === "pe"){
                partes.push("falta OC Portal");
            }
            if(o.pasos.stock === "pe" && o.pasos.registro === "ok"){
                partes.push("falta Stock SAP");
            }
            if(o.pasos.dataFinal === "pe" && o.estado === "lista"){
                partes.push("falta Data Final");
            }

            if(partes.length){
                pendientes.push("OC " + o.oc + ": " + partes.join(" · "));
            }

        });

        return {
            viaje: viaje,
            fechaCita: (dataViaje.find(f => f.fecha_cita) || {}).fecha_cita || null,
            estado: estadoPorViaje.get(viaje) || "desactivado",
            codigos: dataViaje.length,
            ocs: ocsAvance,
            pasos: pasos,
            pasosOk: PASOS_AVANCE.filter(p => pasos[p.clave] === "ok").length,
            pct: atendida > 0 ? Math.round(registrada * 100 / atendida) : 100,
            atendida: atendida,
            registrada: registrada,
            pendientes: pendientes,
            completo: ocsAvance.length > 0 && ocsAvance.every(o => o.estado === "cerrada")
        };

    });

}

function htmlPasoAvance(estado, textoPendiente){
    if(estado === "ok"){
        return '<span class="av-paso ok" title="Listo">✓</span>';
    }
    if(estado === "ob"){
        return '<span class="av-paso ob" title="Con observación">!</span>';
    }
    return textoPendiente
        ? '<span class="av-paso-pct">' + textoPendiente + '</span>'
        : '<span class="av-paso pe" title="Pendiente"></span>';
}

function htmlLeyendaAvance(){
    return '<div class="av-leyenda">' +
        '<span><span class="av-paso ok">✓</span>Listo</span>' +
        '<span><span class="av-paso ob">!</span>Con observación</span>' +
        '<span><span class="av-paso pe"></span>Pendiente</span>' +
    '</div>';
}

function renderAvancePorViaje(viajes){

    const filas = viajes.map(function(v){

        const colorBarra = v.pasosOk === PASOS_AVANCE.length ? "av-verde"
            : (PASOS_AVANCE.some(p => v.pasos[p.clave] === "ob") ? "av-rojo" : "av-azul");

        return `
            <tr class="av-fila-viaje" data-viaje="${v.viaje}" title="Ver sus OC">
                <td>
                    <strong>${v.viaje}</strong>
                    <div class="av-sub">Cita ${v.fechaCita || "-"} · ${v.ocs.length} OC · ${v.codigos} códigos</div>
                    <div class="av-barra"><i class="${colorBarra}" style="width:${Math.round(v.pasosOk * 100 / PASOS_AVANCE.length)}%"></i></div>
                </td>
                ${PASOS_AVANCE.map(p => "<td>" + htmlPasoAvance(
                    v.pasos[p.clave],
                    p.clave === "registro" && v.pasos.registro === "pe" ? v.pct + "%" : ""
                ) + "</td>").join("")}
                <td><span class="estado ${CLASE_ESTADO_VIAJE[v.estado] || "disponible"}">${TEXTO_ESTADO_VIAJE[v.estado] || v.estado}</span></td>
            </tr>
        `;

    }).join("");

    const conPendientes = viajes.filter(v => v.pendientes.length);

    const falta = conPendientes.length
        ? '<div class="av-falta"><strong>Qué falta</strong>' +
            conPendientes.map(v => "<div><b>" + v.viaje + "</b> · " + v.pendientes.map(escaparHtmlFarmacia).join(" | ") + "</div>").join("") +
          '</div>'
        : "";

    return `
        <table class="av-tabla">
            <thead>
                <tr>
                    <th>Viaje</th>
                    ${PASOS_AVANCE.map(p => "<th>" + p.corto + "</th>").join("")}
                    <th>Estado</th>
                </tr>
            </thead>
            <tbody>${filas}</tbody>
        </table>
        ${falta}
        ${htmlLeyendaAvance()}
    `;

}

function htmlOcAvance(o){

    const estado = ESTADOS_OC_AVANCE[o.estado];

    const colorBarra = o.estado === "cerrada" || o.estado === "lista" ? "av-verde"
        : (o.estado === "observacion" || o.estado === "detenida" ? "av-rojo" : "av-azul");

    let detalle = o.completos + "/" + o.codigos + " códigos · " +
        formatearNumeroFarmacia(o.registradaUtil) + "/" + formatearNumeroFarmacia(o.atendida) + " cajas";

    if(o.ultima){
        detalle += " · " + escaparHtmlFarmacia(o.ultima.escaneado_por || "-") + " · " + horaCorta(o.ultima.created_at);
        if(o.estado === "detenida"){
            detalle += " (hace " + o.minutosSinLectura + " min)";
        }
    }else{
        detalle += " · sin lecturas";
    }

    const faltan = o.faltantes.length
        ? '<div class="av-oc-faltan">Faltan: ' +
            o.faltantes.slice(0, 5).map(f => escaparHtmlFarmacia(f.codigo) + " (" + f.cajas + " cj)").join(" · ") +
            (o.faltantes.length > 5 ? " · y " + (o.faltantes.length - 5) + " más" : "") +
          '</div>'
        : "";

    const obs = o.observaciones.length
        ? '<div class="av-oc-obs">⚠ ' + o.observaciones.map(escaparHtmlFarmacia).join(" · ") + '</div>'
        : "";

    // Solo visual: cuando la recolección de la OC ya terminó se muestran
    // sus pasos de cierre y cuál es el siguiente pendiente (como texto;
    // esta pestaña no ejecuta ni abre nada).
    let acciones = "";

    if(o.estado === "lista" || o.estado === "cerrada"){

        acciones += '<div class="av-cierre">' +
            PASOS_AVANCE.slice(1).map(p => htmlPasoAvance(o.pasos[p.clave]).replace("<span ", '<span title="' + p.corto + '" ')).join("") +
        '</div>';

        const siguiente = PASOS_AVANCE.slice(1).find(p => o.pasos[p.clave] !== "ok");

        if(siguiente){
            acciones += '<div class="av-siguiente">Sigue: ' + siguiente.corto + '</div>';
        }

    }

    return `
        <div class="av-oc">
            <div>
                <div class="av-oc-nombre">OC ${o.oc}</div>
                <div class="av-sub">${o.codigos} códigos</div>
            </div>
            <div>
                <div class="av-progreso">
                    <div class="av-barra"><i class="${colorBarra}" style="width:${o.pct}%"></i></div>
                    <strong>${o.pct}%</strong>
                </div>
                <div class="av-oc-detalle">${detalle}</div>
                ${faltan}
                ${obs}
            </div>
            <div class="av-oc-acciones">
                <span class="estado ${estado.clase}">${estado.texto}</span>
                ${acciones}
            </div>
        </div>
    `;

}

function renderAvancePorOc(viajes){

    return viajes.map(function(v){

        const plegado = v.completo && !_viajesAvanceAbiertos.has(v.viaje);
        const cerradas = v.ocs.filter(o => o.estado === "cerrada").length;
        const colorBarra = v.pct === 100 ? "av-verde" : (v.ocs.some(o => o.estado === "observacion" || o.estado === "detenida") ? "av-rojo" : "av-azul");

        return `
            <div class="av-viaje" id="avViaje${v.viaje}">
                <div class="av-viaje-cab plegable" data-viaje="${v.viaje}">
                    <div>
                        <span class="av-viaje-titulo">Viaje ${v.viaje}</span>
                        <span class="av-sub"> · Cita ${v.fechaCita || "-"} · ${v.ocs.length} OC · ${v.codigos} códigos · ${cerradas} de ${v.ocs.length} OC cerradas</span>
                    </div>
                    <div>
                        <span class="estado ${CLASE_ESTADO_VIAJE[v.estado] || "disponible"}">${TEXTO_ESTADO_VIAJE[v.estado] || v.estado}</span>
                        <span class="av-sub">${plegado ? "▸" : "▾"}</span>
                    </div>
                </div>
                ${plegado ? "" : `
                    <div class="av-progreso">
                        <div class="av-barra"><i class="${colorBarra}" style="width:${v.pct}%"></i></div>
                        <strong>${v.pct}%</strong>
                        <span class="av-sub">${formatearNumeroFarmacia(v.registrada)} / ${formatearNumeroFarmacia(v.atendida)} cajas</span>
                    </div>
                    ${v.ocs.map(htmlOcAvance).join("")}
                `}
            </div>
        `;

    }).join("") + htmlLeyendaAvance();

}

function renderAvance(){

    const contenedor = document.getElementById("avanceContenido");

    document.querySelectorAll(".av-vista").forEach(b => b.classList.toggle("activo", b.dataset.vista === _vistaAvance));

    if(!_avanceViajes.length){
        contenedor.innerHTML = '<p class="sin-datos">No hay viajes cargados. Los viajes guardados se consultan en "Base de Datos".</p>';
        return;
    }

    contenedor.innerHTML = _vistaAvance === "viaje"
        ? renderAvancePorViaje(_avanceViajes)
        : renderAvancePorOc(_avanceViajes);

}

async function actualizarAvance(){

    const boton = document.getElementById("btnActualizarAvance");
    boton.disabled = true;

    if(!_avanceViajes.length){
        document.getElementById("avanceContenido").innerHTML = '<p class="sin-datos">Cargando avance...</p>';
    }

    try{
        _avanceViajes = await cargarAvanceViajes();
        renderAvance();
        document.getElementById("avanceActualizado").textContent =
            " Última actualización: " + horaCorta(new Date().toISOString());
    }catch(e){
        console.error(e);
        document.getElementById("avanceContenido").innerHTML = '<p class="sin-datos">No se pudo cargar el avance.</p>';
    }finally{
        boton.disabled = false;
    }

}

document.getElementById("btnActualizarAvance").addEventListener("click", actualizarAvance);

document.querySelectorAll(".av-vista").forEach(function(boton){
    boton.addEventListener("click", function(){
        _vistaAvance = boton.dataset.vista;
        renderAvance();
    });
});

document.getElementById("avanceContenido").addEventListener("click", function(e){

    // Clic en un viaje de la matriz: abre la vista "Por OC" en ese viaje.
    const filaViaje = e.target.closest(".av-fila-viaje");

    if(filaViaje){
        const viaje = Number(filaViaje.dataset.viaje);
        _vistaAvance = "oc";
        _viajesAvanceAbiertos.add(viaje);
        renderAvance();
        const tarjeta = document.getElementById("avViaje" + viaje);
        if(tarjeta){
            tarjeta.scrollIntoView({ behavior: "smooth", block: "start" });
        }
        return;
    }

    // Clic en la cabecera de un viaje (vista Por OC): plegar / desplegar.
    const cabecera = e.target.closest(".av-viaje-cab.plegable");

    if(cabecera){
        const viaje = Number(cabecera.dataset.viaje);
        const viajeDatos = _avanceViajes.find(v => v.viaje === viaje);
        const plegadoAhora = viajeDatos && viajeDatos.completo && !_viajesAvanceAbiertos.has(viaje);
        if(plegadoAhora){
            _viajesAvanceAbiertos.add(viaje);
        }else if(viajeDatos && viajeDatos.completo){
            _viajesAvanceAbiertos.delete(viaje);
        }
        renderAvance();
    }

});

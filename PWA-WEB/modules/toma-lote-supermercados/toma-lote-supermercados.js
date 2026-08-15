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

    });

});

// ========================================
// DATA MODULADO
// ========================================

const archivoDataModulado = document.getElementById("archivoDataModulado");
const nombreDataModulado = document.getElementById("nombreDataModulado");
const fechaDataModulado = document.getElementById("fechaDataModulado");

// Columnas mínimas que debe traer el Excel para aceptar el archivo
// (nombres tal cual vienen en la hoja "DATA MODULADO" del SAP EWM).
const COLUMNAS_ESPERADAS_DATA_MODULADO = [
    "entrega", "tienda", "unidad de transporte", "n° orden de compra",
    "ean o upc (ean 14 spsa)", "cantidad umb", "fo"
];

async function leerFilasDataModuladoExcel(archivo){

    const buffer = await archivo.arrayBuffer();
    const libro = XLSX.read(buffer, { type: "array" });

    const nombreHoja =
        libro.SheetNames.find(n => n.trim().toLowerCase() === "data modulado") ||
        libro.SheetNames[0];

    const hoja = libro.Sheets[nombreHoja];

    return XLSX.utils.sheet_to_json(hoja, { defval: "" });

}

function validarFormatoDataModulado(filasCrudas){

    if(!filasCrudas.length){
        return "El archivo está vacío.";
    }

    const columnasArchivo = Object.keys(filasCrudas[0]).map(c => c.trim().toLowerCase());

    const faltantes = COLUMNAS_ESPERADAS_DATA_MODULADO.filter(
        esperada => !columnasArchivo.includes(esperada)
    );

    if(faltantes.length){
        return "Este archivo no tiene el formato de Data Modulado. Faltan las columnas: " +
            faltantes.join(", ") + ".";
    }

    return null;

}

function normalizarFilaDataModulado(filaOriginal){

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
        numero_almacen: num("número de almacén"),
        entrega: num("entrega"),
        posicion_entrega: num("posición de entrega"),
        tienda: num("tienda"),
        descripcion_tienda: texto("descripción de tienda"),
        unidad_transporte: num("unidad de transporte"),
        tipo_oc: texto("tipo de oc"),
        tipo_proceso: texto("tipo de proceso"),
        pedido: num("pedido"),
        posicion_pedido: num("posición de pedido"),
        orden_compra: num("n° orden de compra"),
        ean_upc: texto("ean o upc (ean 14 spsa)"),
        numero_producto_cliente: num("número de producto cliente"),
        denominacion_producto_cliente: texto("denomin.producto cliente"),
        cantidad_umb: num("cantidad umb"),
        fo: num("fo")
    };

}

archivoDataModulado.addEventListener("change", async function(e){

    const archivo = e.target.files[0];

    if(!archivo){
        return;
    }

    nombreDataModulado.textContent = "Leyendo " + archivo.name + "...";

    try{

        const filasCrudas = await leerFilasDataModuladoExcel(archivo);

        const errorFormato = validarFormatoDataModulado(filasCrudas);

        if(errorFormato){
            alert(errorFormato);
            nombreDataModulado.textContent = "-";
            archivoDataModulado.value = "";
            return;
        }

        const filasNormalizadas = filasCrudas
            .map(normalizarFilaDataModulado)
            .filter(f => f.entrega !== null && f.fo !== null);

        if(!filasNormalizadas.length){
            alert("No se encontraron filas válidas en el archivo (revisa columnas ENTREGA y FO).");
            nombreDataModulado.textContent = "-";
            archivoDataModulado.value = "";
            return;
        }

        // Data Modulado es la base de trabajo actual: si ya hay datos
        // cargados, se reemplazan por completo (no se acumulan cargas
        // viejas mezcladas con la nueva).
        const existentes = await supabaseFetch("/data_modulado?select=id&limit=1");

        if(existentes && existentes.length){

            const confirmado = confirm(
                "Ya hay Data Modulado cargada. ¿Deseas reemplazarla con este archivo (" +
                filasNormalizadas.length + " filas)?"
            );

            if(!confirmado){
                nombreDataModulado.textContent = "-";
                archivoDataModulado.value = "";
                return;
            }

            await supabaseFetch("/data_modulado?id=gt.0", { method: "DELETE" });

        }

        nombreDataModulado.textContent = "Guardando " + archivo.name + "...";

        const cargadoPor = (sesion && (sesion.nombre_completo || sesion.usuario)) || "";

        const filasParaInsertar = filasNormalizadas.map(function(f){
            return Object.assign({}, f, {
                archivo_origen: archivo.name,
                cargado_por: cargadoPor
            });
        });

        // PostgREST no acepta lotes gigantes en una sola petición de
        // forma confiable: se envía en bloques de 200.
        const TAMANO_BLOQUE = 200;

        for(let i = 0; i < filasParaInsertar.length; i += TAMANO_BLOQUE){

            const bloque = filasParaInsertar.slice(i, i + TAMANO_BLOQUE);

            await supabaseFetch("/data_modulado", {
                method: "POST",
                body: JSON.stringify(bloque)
            });

        }

        nombreDataModulado.textContent = archivo.name;
        fechaDataModulado.textContent = new Date().toLocaleDateString("es-PE");

        document.getElementById("totalRegistros").textContent =
            filasNormalizadas.length.toLocaleString("es-PE");

        const viajesUnicos = [...new Set(filasNormalizadas.map(f => f.unidad_transporte))];

        document.getElementById("totalViajes").textContent =
            viajesUnicos.length.toLocaleString("es-PE");

        cargarViajesReales(filasNormalizadas);

    }catch(err){

        console.error(err);
        alert("No se pudo cargar el archivo: " + err.message);
        nombreDataModulado.textContent = "-";
        archivoDataModulado.value = "";

    }

});

// ========================================
// VIAJES (a partir de Data Modulado real)
// ========================================
// Modulación/Fase/Estado siguen siendo visuales por ahora (paso 2 en
// adelante todavía no está conectado a Supabase) — solo Viaje y
// Entregas/Registros vienen de datos reales.

function cargarViajesReales(filas){

    const porViaje = {};

    filas.forEach(function(f){

        const clave = f.unidad_transporte;
        if(clave === null || clave === undefined){
            return;
        }

        if(!porViaje[clave]){
            porViaje[clave] = { viaje: clave, entregas: new Set(), registros: 0 };
        }

        if(f.entrega !== null && f.entrega !== undefined){
            porViaje[clave].entregas.add(f.entrega);
        }

        porViaje[clave].registros++;

    });

    const viajes = Object.values(porViaje).sort((a, b) => a.viaje - b.viaje);

    const cmb = document.getElementById("cmbViaje");
    cmb.innerHTML = "";

    viajes.forEach(function(v){

        const option = document.createElement("option");
        option.value = String(v.viaje);
        option.textContent = v.viaje + " - " + v.entregas.size + " entrega(s)";
        cmb.appendChild(option);

    });

    const tbody = document.getElementById("tblViajes");
    tbody.innerHTML = "";

    viajes.forEach(function(v){

        const tr = document.createElement("tr");

        tr.innerHTML = `
            <td>${v.viaje}</td>
            <td>${v.entregas.size}</td>
            <td>${v.registros}</td>
            <td>Pendiente</td>
            <td>Pendiente</td>
            <td><span class="estado disponible">Disponible</span></td>
            <td>-</td>
            <td>Ver</td>
        `;

        tbody.appendChild(tr);

    });

}

// ========================================
// CARGAR RESUMEN YA EXISTENTE (al abrir la página)
// ========================================
// Si ya se cargó Data Modulado antes (en otra sesión), se muestra de
// una vez sin tener que volver a subir el archivo.

async function cargarResumenExistente(){

    try{

        const filas = await supabaseFetch(
            "/data_modulado?select=unidad_transporte,entrega,archivo_origen,created_at&order=created_at.desc"
        );

        if(!filas || !filas.length){
            return;
        }

        document.getElementById("totalRegistros").textContent =
            filas.length.toLocaleString("es-PE");

        const viajesUnicos = [...new Set(filas.map(f => f.unidad_transporte))];

        document.getElementById("totalViajes").textContent =
            viajesUnicos.length.toLocaleString("es-PE");

        nombreDataModulado.textContent = filas[0].archivo_origen || "-";
        fechaDataModulado.textContent =
            new Date(filas[0].created_at).toLocaleDateString("es-PE");

        cargarViajesReales(filas);

    }catch(e){
        console.error(e);
    }

}

cargarResumenExistente();

// ========================================
// PROCESAR VIAJE
// ========================================

document.getElementById(
    "btnProcesar"
).addEventListener(

    "click",

    function(){

        const viaje =
            document.getElementById(
                "cmbViaje"
            ).value;

        const modulacion =
            document.getElementById(
                "archivoModulacion"
            ).files[0];

        const fase =
            document.getElementById(
                "archivoFase"
            ).files[0];

        if(!viaje){

            alert(
                "Seleccione un viaje"
            );

            return;

        }

        if(!modulacion){

            alert(
                "Seleccione archivo de modulación"
            );

            return;

        }

        if(!fase){

            alert(
                "Seleccione archivo de fase"
            );

            return;

        }

        alert(
            "Viaje procesado correctamente"
        );

    }

);

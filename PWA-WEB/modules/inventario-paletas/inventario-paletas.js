// ========================================
// FETCH PAGINADO
// ========================================
// Supabase/PostgREST limita cada respuesta a 1000 filas por defecto
// sin importar el "limit" que se pida — con 14,000+ filas de saldo
// SAP hace falta pedirlo por páginas (header Range) hasta traer todo.

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

        if(link.dataset.tab === "tabCruce"){
            cargarCruce();
        }

    });

});

// ========================================
// SEMANA ISO (igual que en Centro de Proyectos)
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
const TOTAL_PASILLOS = 24;
const TOTAL_POSICIONES_POR_PASILLO = 832;

document.getElementById("semanaTextoAsignacion").textContent = SEMANA.split("-W")[1];

// ========================================
// UBICACIONES (mismas reglas que Centro de Proyectos)
// ========================================

const PREFIJOS_UBICACION = ["PP", "PA", "AA", "AP", "CH"];

function parsearCodigoUbicacion(texto){

    const patron = new RegExp("^(?:" + PREFIJOS_UBICACION.join("|") + ")-(\\d{1,2})-(\\d{1,3})(?:-(\\d+))?$");
    const m = String(texto).trim().toUpperCase().match(patron);

    if(!m){
        return null;
    }

    return {
        pasillo: Number(m[1]),
        posicion: Number(m[2]),
        nivel: m[3] ? Number(m[3]) : null
    };

}

function ladoDeUbicacion(numero){
    return (numero % 2 === 1) ? "impar" : "par";
}

// ========================================
// TAB 1: ASIGNACIÓN DE PASILLOS
// ========================================

async function cargarAsignacion(){

    const tbody = document.getElementById("tblAsignacion");
    tbody.innerHTML = `<tr><td colspan="5" class="sin-datos">Cargando pasillos...</td></tr>`;

    try{

        const [asignaciones, filasInventario] = await Promise.all([
            supabaseFetch("/inventario_asignaciones?select=pasillo,asignado_a&semana=eq." + SEMANA),
            supabaseFetchTodo("/inventario_paletas?select=pasillo,posiciones_totales&semana=eq." + SEMANA)
        ]);

        const asignadoPorPasillo = {};
        (asignaciones || []).forEach(function(a){ asignadoPorPasillo[a.pasillo] = a.asignado_a; });

        const registradoPorPasillo = {};
        (filasInventario || []).forEach(function(f){
            registradoPorPasillo[f.pasillo] = (registradoPorPasillo[f.pasillo] || 0) + Number(f.posiciones_totales || 0);
        });

        tbody.innerHTML = "";

        let asignados = 0;
        let completados = 0;
        let sumaPorcentajes = 0;

        for(let p = 1; p <= TOTAL_PASILLOS; p++){

            const asignadoA = asignadoPorPasillo[p] || "";
            const registrado = Math.min(registradoPorPasillo[p] || 0, TOTAL_POSICIONES_POR_PASILLO);
            const porcentaje = Math.round((registrado / TOTAL_POSICIONES_POR_PASILLO) * 100);

            sumaPorcentajes += porcentaje;

            let estado = "sin-asignar";
            let estadoTexto = "Sin asignar";

            if(porcentaje >= 100){
                estado = "completado";
                estadoTexto = "Completado";
                completados++;
            }else if(porcentaje > 0){
                estado = "en-proceso";
                estadoTexto = "En proceso";
            }else if(asignadoA){
                estado = "asignado";
                estadoTexto = "Asignado";
            }

            if(asignadoA){
                asignados++;
            }

            const tr = document.createElement("tr");
            tr.dataset.pasillo = p;

            tr.innerHTML = `
                <td><b>Pasillo ${String(p).padStart(2, "0")}</b></td>
                <td><input type="text" class="inputAsignado" placeholder="Nombre de la persona" value="${asignadoA.replace(/"/g, "&quot;")}"></td>
                <td>
                    <span class="barraAvanceMini"><span class="barraAvanceMiniRelleno" style="width:${porcentaje}%;"></span></span>
                    ${porcentaje}%
                </td>
                <td><span class="badge-estado-asig ${estado}">${estadoTexto}</span></td>
                <td><button class="btn-guardar-fila">Guardar</button></td>
            `;

            tbody.appendChild(tr);

        }

        document.getElementById("kpiAsignados").textContent = asignados + " / " + TOTAL_PASILLOS;
        document.getElementById("kpiCompletados").textContent = completados + " / " + TOTAL_PASILLOS;
        document.getElementById("kpiAvanceGeneral").textContent = Math.round(sumaPorcentajes / TOTAL_PASILLOS) + "%";

    }catch(e){

        console.error(e);
        tbody.innerHTML = `<tr><td colspan="5" class="sin-datos">No se pudo cargar la asignación de pasillos.</td></tr>`;

    }

}

document.getElementById("tblAsignacion").addEventListener("click", async function(e){

    const boton = e.target.closest(".btn-guardar-fila");
    if(!boton){
        return;
    }

    const tr = boton.closest("tr");
    const pasillo = Number(tr.dataset.pasillo);
    const asignadoA = tr.querySelector(".inputAsignado").value.trim();

    boton.disabled = true;
    boton.textContent = "...";

    try{

        await supabaseFetch("/inventario_asignaciones?on_conflict=pasillo,semana", {
            method: "POST",
            headers: { "Prefer": "resolution=merge-duplicates" },
            body: JSON.stringify({
                pasillo: pasillo,
                semana: SEMANA,
                asignado_a: asignadoA || null,
                asignado_por: (sesion && (sesion.nombre_completo || sesion.usuario)) || ""
            })
        });

        mostrarToast("Pasillo " + String(pasillo).padStart(2, "0") + " actualizado.", "exito");

        await cargarAsignacion();

    }catch(err){

        console.error(err);
        mostrarToast("No se pudo guardar: " + err.message, "error");
        boton.disabled = false;
        boton.textContent = "Guardar";

    }

});

document.getElementById("btnActualizarAsignacion").addEventListener("click", cargarAsignacion);

cargarAsignacion();

// ========================================
// TAB 2: CRUCE CON SAP
// ========================================

// Borra TODO el módulo — saldo SAP, lo auditado por los auxiliares
// (inventario_paletas) y las asignaciones de pasillo — para empezar
// de cero. Es destructivo y no se puede deshacer, así que además del
// confirm() pide escribir "BORRAR".
document.getElementById("btnBorrarSap").addEventListener("click", async function(){

    const btn = document.getElementById("btnBorrarSap");

    const confirmado = confirm(
        "Esto borra TODO el módulo de Inventario de Paletas:\n" +
        "• El saldo SAP cargado (todas las fechas)\n" +
        "• Todo lo auditado por los auxiliares en Centro de Proyectos (todas las semanas)\n" +
        "• Las asignaciones de pasillo\n\n" +
        "No se puede deshacer.\n\n¿Seguro que quieres continuar?"
    );

    if(!confirmado){
        return;
    }

    const escrito = prompt('Para confirmar, escribe BORRAR (en mayúsculas):');

    if(escrito !== "BORRAR"){
        mostrarToast("Cancelado: no se escribió BORRAR, no se borró nada.", "info");
        return;
    }

    btn.disabled = true;
    btn.textContent = "Borrando...";

    try{

        await supabaseFetch("/inventario_sap_saldo?id=gt.0", { method: "DELETE" });
        await supabaseFetch("/inventario_paletas?id=gt.0", { method: "DELETE" });
        await supabaseFetch("/inventario_asignaciones?id=gt.0", { method: "DELETE" });

        document.getElementById("estadoCargaSap").textContent = "";
        document.getElementById("fechaSaldoSap").value = "";

        mostrarToast("Todo borrado: saldo SAP, auditorías y asignaciones. Listo para empezar de nuevo.", "exito");

        await cargarCruce();
        await cargarAsignacion();

    }catch(err){

        console.error(err);
        mostrarToast("No se pudo borrar: " + err.message, "error");

    }finally{

        btn.disabled = false;
        btn.textContent = "🗑 Borrar Todo";

    }

});

document.getElementById("archivoSapSaldo").addEventListener("change", async function(e){

    const archivo = e.target.files[0];
    if(!archivo){
        return;
    }

    const fechaSaldo = document.getElementById("fechaSaldoSap").value || new Date().toISOString().slice(0, 10);
    const estadoEl = document.getElementById("estadoCargaSap");

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

        // Se identifica la columna de ubicación por nombre (puede venir
        // como "Ubicación" o variantes de mayúsculas/acentos).
        const columnas = Object.keys(filasCrudas[0]);
        const colUbicacion = columnas.find(c => c.trim().toLowerCase().replace("ó", "o") === "ubicacion");

        if(!colUbicacion){
            mostrarToast("No se encontró la columna \"Ubicación\" en el archivo.", "error");
            estadoEl.textContent = "";
            return;
        }

        const colProducto = columnas.find(c => c.trim().toLowerCase() === "producto");
        const colDescripcion = columnas.find(c => c.trim().toLowerCase().indexOf("descripción producto") !== -1 || c.trim().toLowerCase().indexOf("descripcion producto") !== -1);
        const colLote = columnas.find(c => c.trim().toLowerCase() === "lote");
        const colCtd = columnas.find(c => c.trim().toLowerCase() === "ctd." || c.trim().toLowerCase() === "ctd");

        // Deduplicado por ubicación: para este cruce solo interesa si
        // la posición está llena o no, no cuántas líneas de producto
        // tiene (el usuario confirmó que algunas ubicaciones se
        // repiten en el Excel de SAP).
        const vistos = new Set();
        const filasUnicas = [];

        filasCrudas.forEach(function(f){

            const ubicacionTexto = String(f[colUbicacion] || "").trim();
            if(!ubicacionTexto || vistos.has(ubicacionTexto)){
                return;
            }

            const parsed = parsearCodigoUbicacion(ubicacionTexto);
            if(!parsed){
                return;
            }

            vistos.add(ubicacionTexto);

            filasUnicas.push({
                fecha_saldo: fechaSaldo,
                ubicacion: ubicacionTexto,
                pasillo: parsed.pasillo,
                posicion: parsed.posicion,
                nivel: parsed.nivel,
                lado: ladoDeUbicacion(parsed.posicion),
                producto: colProducto ? String(f[colProducto] || "") : null,
                descripcion_producto: colDescripcion ? String(f[colDescripcion] || "") : null,
                lote: colLote ? String(f[colLote] || "") : null,
                ctd: colCtd ? (Number(f[colCtd]) || null) : null,
                archivo_origen: archivo.name,
                cargado_por: (sesion && (sesion.nombre_completo || sesion.usuario)) || ""
            });

        });

        if(!filasUnicas.length){
            mostrarToast("No se encontraron ubicaciones válidas (revisa el formato de la columna Ubicación).", "error");
            estadoEl.textContent = "";
            return;
        }

        estadoEl.textContent = "Guardando " + filasUnicas.length.toLocaleString("es-PE") +
            " ubicaciones únicas (de " + filasCrudas.length.toLocaleString("es-PE") + " filas leídas)...";

        const TAMANO_BLOQUE = 500;

        for(let i = 0; i < filasUnicas.length; i += TAMANO_BLOQUE){

            const bloque = filasUnicas.slice(i, i + TAMANO_BLOQUE);

            await supabaseFetch("/inventario_sap_saldo", {
                method: "POST",
                body: JSON.stringify(bloque)
            });

            estadoEl.textContent = "Guardando... " + Math.min(i + TAMANO_BLOQUE, filasUnicas.length).toLocaleString("es-PE") +
                " / " + filasUnicas.length.toLocaleString("es-PE");

        }

        estadoEl.textContent = "✓ Cargado: " + filasUnicas.length.toLocaleString("es-PE") + " ubicaciones únicas del " + fechaSaldo + ".";
        mostrarToast("Saldo SAP cargado: " + filasUnicas.length.toLocaleString("es-PE") + " ubicaciones.", "exito");

        document.getElementById("archivoSapSaldo").value = "";

        await cargarCruce();

    }catch(err){

        console.error(err);
        mostrarToast("No se pudo cargar el archivo: " + err.message, "error");
        estadoEl.textContent = "";

    }

});

async function cargarCruce(){

    const tbody = document.getElementById("tblCruce");
    tbody.innerHTML = `<tr><td colspan="6" class="sin-datos">Cargando comparativa...</td></tr>`;

    try{

        const [sapFilas, auditadoFilas] = await Promise.all([
            supabaseFetchTodo("/inventario_sap_saldo?select=pasillo,lado&order=fecha_saldo.desc"),
            supabaseFetchTodo("/inventario_paletas?select=pasillo,lado,llenas&semana=eq." + SEMANA)
        ]);

        if(!sapFilas || !sapFilas.length){
            tbody.innerHTML = `<tr><td colspan="6" class="sin-datos">Carga un saldo SAP para ver la comparativa.</td></tr>`;
            return;
        }

        const sapPorGrupo = {};
        (sapFilas || []).forEach(function(f){
            const clave = f.pasillo + "-" + f.lado;
            sapPorGrupo[clave] = (sapPorGrupo[clave] || 0) + 1;
        });

        const auditadoPorGrupo = {};
        (auditadoFilas || []).forEach(function(f){
            const clave = f.pasillo + "-" + f.lado;
            auditadoPorGrupo[clave] = (auditadoPorGrupo[clave] || 0) + Number(f.llenas || 0);
        });

        const filas = [];

        for(let p = 1; p <= TOTAL_PASILLOS; p++){
            ["impar", "par"].forEach(function(lado){

                const clave = p + "-" + lado;

                if(sapPorGrupo[clave] === undefined){
                    return; // sin dato SAP para este pasillo/lado, no se muestra
                }

                filas.push({
                    pasillo: p,
                    lado: lado,
                    sap: sapPorGrupo[clave] || 0,
                    auditado: auditadoPorGrupo[clave] || 0
                });

            });
        }

        if(!filas.length){
            tbody.innerHTML = `<tr><td colspan="6" class="sin-datos">No hay datos de SAP para comparar todavía.</td></tr>`;
            return;
        }

        tbody.innerHTML = "";

        filas.forEach(function(f){

            const diferencia = f.sap - f.auditado;
            const coincide = diferencia === 0 && f.auditado > 0;

            const tr = document.createElement("tr");

            tr.innerHTML = `
                <td><b>Pasillo ${String(f.pasillo).padStart(2, "0")}</b></td>
                <td>${f.lado === "impar" ? "Impar" : "Par"}</td>
                <td>${f.sap.toLocaleString("es-PE")}</td>
                <td>${f.auditado.toLocaleString("es-PE")}</td>
                <td class="${diferencia === 0 ? "diferencia-cero" : "diferencia-positiva"}">${diferencia > 0 ? "+" : ""}${diferencia}</td>
                <td><span class="badge-cruce ${coincide ? "ok" : "diff"}">${coincide ? "✓ Coincide" : (f.auditado === 0 ? "Sin auditar" : "⚠ Diferencia")}</span></td>
            `;

            tbody.appendChild(tr);

        });

    }catch(e){

        console.error(e);
        tbody.innerHTML = `<tr><td colspan="6" class="sin-datos">No se pudo cargar la comparativa.</td></tr>`;

    }

}

document.getElementById("btnActualizarCruce").addEventListener("click", cargarCruce);

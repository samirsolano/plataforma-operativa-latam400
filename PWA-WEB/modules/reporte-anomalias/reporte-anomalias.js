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
// FUENTE DE DATOS: GOOGLE SHEET (reporte de Anomalías)
// ========================================
// El registro de cada anomalía vive en el Sheet que llena Centro de
// Proyectos (vía Apps Script) — acá solo se LEE en vivo con el link
// de exportación CSV pública. El estado de gestión (Pendiente/En
// revisión/Atendido/Cerrado) es lo único que se guarda en Supabase,
// en la tabla anomalias_estado, para no tocar el flujo de envío.

const SHEET_ID = "1NKQmRv31HQsC5tu2sBUiCRmsS2OdWckOdlDGLWjHnBg";
const SHEET_GID = "0";
const SHEET_CSV_URL =
    "https://docs.google.com/spreadsheets/d/" + SHEET_ID + "/export?format=csv&gid=" + SHEET_GID;

// Parser de CSV que respeta comillas (campos con comas o saltos de
// línea adentro, como la descripción) — un split(",") simple rompe
// esos casos.
function parsearCSV(texto){

    const filas = [];
    let fila = [];
    let campo = "";
    let entreComillas = false;

    for(let i = 0; i < texto.length; i++){

        const c = texto[i];

        if(entreComillas){

            if(c === '"'){
                if(texto[i + 1] === '"'){ campo += '"'; i++; }
                else{ entreComillas = false; }
            }else{
                campo += c;
            }

        }else{

            if(c === '"'){
                entreComillas = true;
            }else if(c === ","){
                fila.push(campo);
                campo = "";
            }else if(c === "\r"){
                // ignorar
            }else if(c === "\n"){
                fila.push(campo);
                filas.push(fila);
                fila = [];
                campo = "";
            }else{
                campo += c;
            }

        }

    }

    if(campo.length || fila.length){
        fila.push(campo);
        filas.push(fila);
    }

    return filas;

}

function filasAObjetos(filas){

    if(!filas.length){
        return [];
    }

    const encabezados = filas[0].map(h => h.trim());

    return filas.slice(1)
        .filter(f => f.some(v => v.trim() !== ""))
        .map(function(f){

            const obj = {};

            encabezados.forEach(function(h, i){
                obj[h] = (f[i] || "").trim();
            });

            return obj;

        });

}

function normalizarReporte(fila){

    const fotos = [
        fila.FOTO_1, fila.FOTO_2, fila.FOTO_3, fila.FOTO_4, fila.FOTO_5
    ].filter(f => f);

    return {
        id: fila.ID || "",
        fecha: fila.FECHA || "",
        hora: fila.HORA || "",
        dni: fila.DNI || "",
        nombre: fila.NOMBRE || "",
        puesto: fila.PUESTO || "",
        jefeDirecto: fila.JEFE_DIRECTO || "",
        tipo: fila.TIPO_ANOMALIA || "Otra",
        zona: fila.ZONA || "",
        ubicacion: fila.UBICACION || "",
        descripcion: fila.DESCRIPCION || "",
        fotos: fotos,
        carpetaDrive: fila.CARPETA_DRIVE || ""
    };

}

// Google devuelve la fecha en fila.FECHA como DD/MM/AAAA — se arma
// una clave ordenable (AAAAMMDD + hora) para poder ordenar por fecha
// real y no alfabéticamente.
function claveOrdenFecha(reporte){

    const partes = (reporte.fecha || "").split("/");

    if(partes.length !== 3){
        return "";
    }

    return partes[2] + partes[1].padStart(2, "0") + partes[0].padStart(2, "0") + (reporte.hora || "");

}

// ========================================
// ESTADO EN SUPABASE
// ========================================

let _estadosPorId = {};

async function cargarEstados(){

    try{

        const filas = await supabaseFetch("/anomalias_estado?select=id_reporte,estado,observaciones");

        _estadosPorId = {};

        (filas || []).forEach(function(f){
            _estadosPorId[f.id_reporte] = f;
        });

    }catch(e){

        console.error(e);
        // Si la tabla todavía no existe (SQL no corrido), se sigue
        // funcionando con todo en "Pendiente" por defecto.
        _estadosPorId = {};

    }

}

function estadoDe(reporte){
    const e = _estadosPorId[reporte.id];
    return (e && e.estado) || "Pendiente";
}

function claseEstado(estado){
    return {
        "Pendiente": "pendiente",
        "En revisión": "en-revision",
        "Atendido": "atendido",
        "Cerrado": "cerrado"
    }[estado] || "pendiente";
}

// ========================================
// CARGA PRINCIPAL
// ========================================

let _todosLosReportes = [];
let _paginaActual = 1;
const FILAS_POR_PAGINA = 15;

async function cargarTodo(){

    document.getElementById("tblAnomalias").innerHTML =
        `<tr><td colspan="8" class="sin-datos">Cargando reportes...</td></tr>`;

    try{

        const [textoCsv] = await Promise.all([
            fetch(SHEET_CSV_URL).then(r => {
                if(!r.ok){ throw new Error("No se pudo leer el Google Sheet (¿sigue compartido como 'cualquiera con el link'?)."); }
                return r.text();
            }),
            cargarEstados()
        ]);

        const filas = parsearCSV(textoCsv);
        const objetos = filasAObjetos(filas);

        _todosLosReportes = objetos.map(normalizarReporte)
            .filter(r => r.id)
            .sort((a, b) => claveOrdenFecha(b).localeCompare(claveOrdenFecha(a)));

        poblarFiltroTipo();
        actualizarKpis();
        _paginaActual = 1;
        aplicarFiltrosYRenderizar();

    }catch(e){

        console.error(e);
        document.getElementById("tblAnomalias").innerHTML =
            `<tr><td colspan="8" class="sin-datos">No se pudo cargar el reporte de anomalías: ${e.message}</td></tr>`;

    }

}

function poblarFiltroTipo(){

    const select = document.getElementById("filtroTipo");
    const actual = select.value;

    const tipos = [...new Set(_todosLosReportes.map(r => r.tipo))].sort();

    select.innerHTML = '<option value="">Todos los tipos</option>' +
        tipos.map(t => `<option value="${t}">${t}</option>`).join("");

    select.value = actual;

}

function actualizarKpis(){

    const total = _todosLosReportes.length;
    let pendientes = 0, revision = 0, atendidas = 0, cerradas = 0;

    _todosLosReportes.forEach(function(r){

        const estado = estadoDe(r);

        if(estado === "Pendiente") pendientes++;
        else if(estado === "En revisión") revision++;
        else if(estado === "Atendido") atendidas++;
        else if(estado === "Cerrado") cerradas++;

    });

    document.getElementById("kpiTotal").textContent = total.toLocaleString("es-PE");
    document.getElementById("kpiPendientes").textContent = pendientes.toLocaleString("es-PE");
    document.getElementById("kpiRevision").textContent = revision.toLocaleString("es-PE");
    document.getElementById("kpiAtendidas").textContent = atendidas.toLocaleString("es-PE");
    document.getElementById("kpiCerradas").textContent = cerradas.toLocaleString("es-PE");

}

// ========================================
// FILTROS + TABLA + PAGINACIÓN
// ========================================

function reportesFiltrados(){

    const texto = document.getElementById("buscador").value.trim().toLowerCase();
    const estadoFiltro = document.getElementById("filtroEstado").value;
    const tipoFiltro = document.getElementById("filtroTipo").value;

    return _todosLosReportes.filter(function(r){

        if(estadoFiltro && estadoDe(r) !== estadoFiltro){
            return false;
        }

        if(tipoFiltro && r.tipo !== tipoFiltro){
            return false;
        }

        if(texto){

            const enTexto = (
                r.id + " " + r.nombre + " " + r.zona + " " + r.ubicacion + " " +
                r.descripcion + " " + r.tipo
            ).toLowerCase();

            if(enTexto.indexOf(texto) === -1){
                return false;
            }

        }

        return true;

    });

}

function aplicarFiltrosYRenderizar(){

    const filtrados = reportesFiltrados();

    const totalPaginas = Math.max(1, Math.ceil(filtrados.length / FILAS_POR_PAGINA));
    _paginaActual = Math.min(_paginaActual, totalPaginas);

    const inicio = (_paginaActual - 1) * FILAS_POR_PAGINA;
    const pagina = filtrados.slice(inicio, inicio + FILAS_POR_PAGINA);

    renderTabla(pagina, filtrados.length);
    renderPaginacion(totalPaginas);

}

function renderTabla(reportes, totalFiltrados){

    const tbody = document.getElementById("tblAnomalias");

    if(!totalFiltrados){
        tbody.innerHTML = `<tr><td colspan="8" class="sin-datos">No hay reportes que coincidan con el filtro.</td></tr>`;
        return;
    }

    tbody.innerHTML = "";

    reportes.forEach(function(r){

        const estado = estadoDe(r);
        const resumen = r.descripcion.length > 70 ? r.descripcion.slice(0, 70) + "…" : r.descripcion;

        const tr = document.createElement("tr");

        tr.innerHTML = `
            <td><b>${r.id}</b></td>
            <td>${r.fecha}</td>
            <td><span class="badge-tipo">${r.tipo}</span></td>
            <td>${resumen || "-"}</td>
            <td>${r.zona || "-"}</td>
            <td>${r.nombre || "-"}</td>
            <td><span class="badge-estado ${claseEstado(estado)}">${estado}</span></td>
            <td><button class="btn-ver-detalle" data-id="${r.id}">Ver detalle</button></td>
        `;

        tbody.appendChild(tr);

    });

}

function renderPaginacion(totalPaginas){

    const cont = document.getElementById("paginacion");
    cont.innerHTML = "";

    if(totalPaginas <= 1){
        return;
    }

    function boton(texto, pagina, deshabilitado, activo){

        const b = document.createElement("button");
        b.textContent = texto;
        b.disabled = !!deshabilitado;
        if(activo){ b.classList.add("activo"); }

        b.addEventListener("click", function(){
            _paginaActual = pagina;
            aplicarFiltrosYRenderizar();
        });

        cont.appendChild(b);

    }

    boton("‹", Math.max(1, _paginaActual - 1), _paginaActual === 1, false);

    for(let p = 1; p <= totalPaginas; p++){

        if(p === 1 || p === totalPaginas || Math.abs(p - _paginaActual) <= 1){
            boton(String(p), p, false, p === _paginaActual);
        }else if(p === 2 || p === totalPaginas - 1){
            const span = document.createElement("span");
            span.textContent = "…";
            span.style.padding = "0 6px";
            cont.appendChild(span);
        }

    }

    boton("›", Math.min(totalPaginas, _paginaActual + 1), _paginaActual === totalPaginas, false);

}

document.getElementById("buscador").addEventListener("input", function(){
    _paginaActual = 1;
    aplicarFiltrosYRenderizar();
});

document.getElementById("filtroEstado").addEventListener("change", function(){
    _paginaActual = 1;
    aplicarFiltrosYRenderizar();
});

document.getElementById("filtroTipo").addEventListener("change", function(){
    _paginaActual = 1;
    aplicarFiltrosYRenderizar();
});

document.getElementById("btnActualizar").addEventListener("click", cargarTodo);

// ========================================
// MODAL DETALLE
// ========================================

let _reporteAbierto = null;

function urlFotoDrive(fileId){
    return "https://drive.google.com/thumbnail?id=" + fileId + "&sz=w800";
}

document.getElementById("tblAnomalias").addEventListener("click", function(e){

    const boton = e.target.closest(".btn-ver-detalle");
    if(!boton){
        return;
    }

    const reporte = _todosLosReportes.find(r => r.id === boton.dataset.id);
    if(!reporte){
        return;
    }

    abrirDetalle(reporte);

});

function abrirDetalle(reporte){

    _reporteAbierto = reporte;

    const estado = estadoDe(reporte);
    const estadoInfo = _estadosPorId[reporte.id];

    document.getElementById("detalleCodigo").textContent = reporte.id;

    const badge = document.getElementById("detalleEstadoBadge");
    badge.textContent = estado;
    badge.className = "badge-estado " + claseEstado(estado);

    document.getElementById("detalleFecha").textContent = (reporte.fecha || "-") + " " + (reporte.hora || "");
    document.getElementById("detalleTipo").textContent = reporte.tipo || "-";
    document.getElementById("detalleZona").textContent = reporte.zona || "-";
    document.getElementById("detalleUbicacion").textContent = reporte.ubicacion || "-";
    document.getElementById("detalleRegistradoPor").textContent = (reporte.nombre || "-") + (reporte.puesto ? " — " + reporte.puesto : "");
    document.getElementById("detalleJefe").textContent = reporte.jefeDirecto || "-";
    document.getElementById("detalleDescripcion").textContent = reporte.descripcion || "-";

    const contFotos = document.getElementById("detalleFotos");
    contFotos.innerHTML = "";

    if(!reporte.fotos.length){
        contFotos.innerHTML = `<div class="sin-fotos">Este reporte no tiene fotos adjuntas.</div>`;
    }else{

        reporte.fotos.forEach(function(fileId){

            const img = document.createElement("img");
            img.src = urlFotoDrive(fileId);
            img.loading = "lazy";
            img.addEventListener("click", function(){
                window.open("https://drive.google.com/file/d/" + fileId + "/view", "_blank");
            });

            contFotos.appendChild(img);

        });

    }

    const linkDrive = document.getElementById("detalleLinkDrive");

    if(reporte.carpetaDrive){
        linkDrive.href = reporte.carpetaDrive;
        linkDrive.style.display = "inline-block";
    }else{
        linkDrive.style.display = "none";
    }

    document.getElementById("detalleSelectEstado").value = estado;
    document.getElementById("detalleObservaciones").value = (estadoInfo && estadoInfo.observaciones) || "";

    document.getElementById("modalDetalle").classList.remove("oculto");

}

function cerrarDetalle(){
    document.getElementById("modalDetalle").classList.add("oculto");
    _reporteAbierto = null;
}

document.getElementById("btnCerrarDetalle").addEventListener("click", cerrarDetalle);
document.getElementById("modalDetalleFondo").addEventListener("click", cerrarDetalle);

document.getElementById("btnGuardarEstado").addEventListener("click", async function(){

    if(!_reporteAbierto){
        return;
    }

    const btn = document.getElementById("btnGuardarEstado");
    const nuevoEstado = document.getElementById("detalleSelectEstado").value;
    const observaciones = document.getElementById("detalleObservaciones").value.trim();

    btn.disabled = true;
    btn.textContent = "Guardando...";

    try{

        await supabaseFetch("/anomalias_estado?on_conflict=id_reporte", {
            method: "POST",
            headers: { "Prefer": "resolution=merge-duplicates" },
            body: JSON.stringify({
                id_reporte: _reporteAbierto.id,
                estado: nuevoEstado,
                observaciones: observaciones || null,
                actualizado_por: (sesion && (sesion.nombre_completo || sesion.usuario)) || ""
            })
        });

        _estadosPorId[_reporteAbierto.id] = {
            id_reporte: _reporteAbierto.id,
            estado: nuevoEstado,
            observaciones: observaciones || null
        };

        mostrarToast(_reporteAbierto.id + " actualizado a \"" + nuevoEstado + "\".", "exito");

        const badge = document.getElementById("detalleEstadoBadge");
        badge.textContent = nuevoEstado;
        badge.className = "badge-estado " + claseEstado(nuevoEstado);

        actualizarKpis();
        aplicarFiltrosYRenderizar();

    }catch(err){

        console.error(err);
        mostrarToast("No se pudo guardar el estado: " + err.message, "error");

    }finally{

        btn.disabled = false;
        btn.textContent = "Guardar";

    }

});

cargarTodo();

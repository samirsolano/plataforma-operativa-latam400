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
// TABS (links del sidebar)
// ========================================

document.querySelectorAll(".tab-link").forEach(function(link){

    link.addEventListener("click", function(e){

        e.preventDefault();

        document.querySelectorAll(".tab-link").forEach(l => l.classList.remove("activo"));
        document.querySelectorAll(".tab-contenido").forEach(c => c.classList.add("oculto"));

        link.classList.add("activo");
        document.getElementById(link.dataset.tab).classList.remove("oculto");

    });

});

// ========================================
// PARSER DE CSV (respeta comillas: comas y saltos de línea
// adentro de un campo, como en la descripción)
// ========================================

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

function claveOrdenFecha(fecha, hora){

    const partes = (fecha || "").split("/");

    if(partes.length !== 3){
        return "";
    }

    return partes[2] + partes[1].padStart(2, "0") + partes[0].padStart(2, "0") + (hora || "");

}

function urlFotoDrive(fileId){
    return "https://drive.google.com/thumbnail?id=" + fileId + "&sz=w800";
}

// ========================================
// ESTADO EN SUPABASE (compartido entre Anomalías y Sugerencias,
// una sola tabla, la clave es el código del reporte)
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
// CONFIGURACIÓN POR FUENTE (Anomalías / Sugerencias)
// ========================================
// Cada fuente sabe leer su propio Sheet y cómo mostrarse — el resto
// del código (filtros, paginación, KPIs, modal de detalle, guardar
// estado) es genérico y funciona igual para las dos.

const FUENTES = {

    anomalias: {

        sheetGid: "0",

        normalizar(fila){

            const fotos = [fila.FOTO_1, fila.FOTO_2, fila.FOTO_3, fila.FOTO_4, fila.FOTO_5].filter(f => f);

            return {
                id: fila.ID || "",
                fecha: fila.FECHA || "",
                hora: fila.HORA || "",
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

        },

        filaTabla(r){
            const resumen = r.descripcion.length > 70 ? r.descripcion.slice(0, 70) + "…" : r.descripcion;
            return [r.id, r.fecha, `<span class="badge-tipo">${r.tipo}</span>`, resumen || "-", r.zona || "-", r.nombre || "-"];
        },

        textoBusqueda(r){
            return [r.id, r.nombre, r.zona, r.ubicacion, r.descripcion, r.tipo].join(" ").toLowerCase();
        },

        campoTipo(r){ return r.tipo; },

        camposGrid(r){
            return [
                { label: "Fecha y hora", valor: (r.fecha || "-") + " " + (r.hora || "") },
                { label: "Tipo de anomalía", valor: r.tipo || "-" },
                { label: "Zona", valor: r.zona || "-" },
                { label: "Ubicación", valor: r.ubicacion || "-" },
                { label: "Registrado por", valor: (r.nombre || "-") + (r.puesto ? " — " + r.puesto : "") },
                { label: "Jefe directo", valor: r.jefeDirecto || "-" }
            ];
        },

        camposLargos(r){
            return [
                { label: "Descripción", valor: r.descripcion || "-" }
            ];
        }

    },

    sugerencias: {

        sheetGid: "1257141144",

        normalizar(fila){

            const fotos = [fila.FOTO_1, fila.FOTO_2, fila.FOTO_3, fila.FOTO_4, fila.FOTO_5].filter(f => f);

            return {
                id: fila.CORRELATIVO || "",
                fecha: fila.FECHA || "",
                hora: fila.HORA || "",
                nombre: fila.NOMBRE || "",
                puesto: fila.PUESTO || "",
                jefeDirecto: fila.JEFE_DIRECTO || "",
                area: fila.AREA || "Otra",
                tipoMejora: fila.TIPO_MEJORA || "",
                situacionActual: fila.SITUACION_ACTUAL || "",
                propuestaMejora: fila.PROPUESTA_MEJORA || "",
                beneficios: fila.BENEFICIOS || "",
                fotos: fotos,
                carpetaDrive: fila.CARPETA_DRIVE || ""
            };

        },

        filaTabla(r){
            const resumen = r.propuestaMejora.length > 70 ? r.propuestaMejora.slice(0, 70) + "…" : r.propuestaMejora;
            return [r.id, r.fecha, `<span class="badge-tipo">${r.area}</span>`, resumen || "-", r.tipoMejora || "-", r.nombre || "-"];
        },

        textoBusqueda(r){
            return [r.id, r.nombre, r.area, r.tipoMejora, r.situacionActual, r.propuestaMejora].join(" ").toLowerCase();
        },

        campoTipo(r){ return r.area; },

        camposGrid(r){
            return [
                { label: "Fecha y hora", valor: (r.fecha || "-") + " " + (r.hora || "") },
                { label: "Área", valor: r.area || "-" },
                { label: "Tipo de mejora", valor: r.tipoMejora || "-" },
                { label: "Registrado por", valor: (r.nombre || "-") + (r.puesto ? " — " + r.puesto : "") },
                { label: "Jefe directo", valor: r.jefeDirecto || "-" }
            ];
        },

        camposLargos(r){
            return [
                { label: "Situación actual", valor: r.situacionActual || "-" },
                { label: "Propuesta de mejora", valor: r.propuestaMejora || "-" },
                { label: "Beneficios esperados", valor: r.beneficios || "-" }
            ];
        }

    }

};

Object.keys(FUENTES).forEach(function(key){
    FUENTES[key].key = key;
    FUENTES[key].datos = [];
    FUENTES[key].pagina = 1;
});

const FILAS_POR_PAGINA = 15;

// ========================================
// CARGA
// ========================================

async function cargarFuente(key){

    const fuente = FUENTES[key];
    const tbody = document.getElementById("tbl-" + key);

    tbody.innerHTML = `<tr><td colspan="8" class="sin-datos">Cargando reportes...</td></tr>`;

    try{

        const url = "https://docs.google.com/spreadsheets/d/1NKQmRv31HQsC5tu2sBUiCRmsS2OdWckOdlDGLWjHnBg/export?format=csv&gid=" + fuente.sheetGid;

        const [textoCsv] = await Promise.all([
            fetch(url).then(r => {
                if(!r.ok){ throw new Error("No se pudo leer el Google Sheet."); }
                return r.text();
            }),
            cargarEstados()
        ]);

        const objetos = filasAObjetos(parsearCSV(textoCsv));

        fuente.datos = objetos.map(f => fuente.normalizar(f))
            .filter(r => r.id)
            .sort((a, b) => claveOrdenFecha(b.fecha, b.hora).localeCompare(claveOrdenFecha(a.fecha, a.hora)));

        poblarFiltroTipo(key);
        actualizarKpis(key);
        fuente.pagina = 1;
        aplicarFiltrosYRenderizar(key);

    }catch(e){

        console.error(e);
        tbody.innerHTML = `<tr><td colspan="8" class="sin-datos">No se pudo cargar: ${e.message}</td></tr>`;

    }

}

function poblarFiltroTipo(key){

    const fuente = FUENTES[key];
    const select = document.getElementById("filtroTipo-" + key);
    const actual = select.value;

    const tipos = [...new Set(fuente.datos.map(r => fuente.campoTipo(r)))].filter(t => t).sort();

    const primeraOpcion = select.options[0];

    select.innerHTML = "";
    select.appendChild(primeraOpcion);

    tipos.forEach(function(t){
        const opt = document.createElement("option");
        opt.value = t;
        opt.textContent = t;
        select.appendChild(opt);
    });

    select.value = actual;

}

function actualizarKpis(key){

    const fuente = FUENTES[key];

    let pendientes = 0, revision = 0, atendidas = 0, cerradas = 0;

    fuente.datos.forEach(function(r){

        const estado = estadoDe(r);

        if(estado === "Pendiente") pendientes++;
        else if(estado === "En revisión") revision++;
        else if(estado === "Atendido") atendidas++;
        else if(estado === "Cerrado") cerradas++;

    });

    document.getElementById("kpiTotal-" + key).textContent = fuente.datos.length.toLocaleString("es-PE");
    document.getElementById("kpiPendientes-" + key).textContent = pendientes.toLocaleString("es-PE");
    document.getElementById("kpiRevision-" + key).textContent = revision.toLocaleString("es-PE");
    document.getElementById("kpiAtendidas-" + key).textContent = atendidas.toLocaleString("es-PE");
    document.getElementById("kpiCerradas-" + key).textContent = cerradas.toLocaleString("es-PE");

}

// ========================================
// FILTROS + TABLA + PAGINACIÓN
// ========================================

function reportesFiltrados(key){

    const fuente = FUENTES[key];

    const texto = document.getElementById("buscador-" + key).value.trim().toLowerCase();
    const estadoFiltro = document.getElementById("filtroEstado-" + key).value;
    const tipoFiltro = document.getElementById("filtroTipo-" + key).value;

    return fuente.datos.filter(function(r){

        if(estadoFiltro && estadoDe(r) !== estadoFiltro){
            return false;
        }

        if(tipoFiltro && fuente.campoTipo(r) !== tipoFiltro){
            return false;
        }

        if(texto && fuente.textoBusqueda(r).indexOf(texto) === -1){
            return false;
        }

        return true;

    });

}

function aplicarFiltrosYRenderizar(key){

    const fuente = FUENTES[key];
    const filtrados = reportesFiltrados(key);

    const totalPaginas = Math.max(1, Math.ceil(filtrados.length / FILAS_POR_PAGINA));
    fuente.pagina = Math.min(fuente.pagina, totalPaginas);

    const inicio = (fuente.pagina - 1) * FILAS_POR_PAGINA;
    const pagina = filtrados.slice(inicio, inicio + FILAS_POR_PAGINA);

    renderTabla(key, pagina, filtrados.length);
    renderPaginacion(key, totalPaginas);

}

function renderTabla(key, reportes, totalFiltrados){

    const fuente = FUENTES[key];
    const tbody = document.getElementById("tbl-" + key);

    if(!totalFiltrados){
        tbody.innerHTML = `<tr><td colspan="8" class="sin-datos">No hay reportes que coincidan con el filtro.</td></tr>`;
        return;
    }

    tbody.innerHTML = "";

    reportes.forEach(function(r){

        const estado = estadoDe(r);
        const celdas = fuente.filaTabla(r);

        const tr = document.createElement("tr");

        tr.innerHTML =
            `<td><b>${celdas[0]}</b></td>` +
            celdas.slice(1).map(c => `<td>${c}</td>`).join("") +
            `<td><span class="badge-estado ${claseEstado(estado)}">${estado}</span></td>` +
            `<td><button class="btn-ver-detalle" data-fuente="${key}" data-id="${r.id}">Ver detalle</button></td>`;

        tbody.appendChild(tr);

    });

}

function renderPaginacion(key, totalPaginas){

    const fuente = FUENTES[key];
    const cont = document.getElementById("paginacion-" + key);
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
            fuente.pagina = pagina;
            aplicarFiltrosYRenderizar(key);
        });

        cont.appendChild(b);

    }

    boton("‹", Math.max(1, fuente.pagina - 1), fuente.pagina === 1, false);

    for(let p = 1; p <= totalPaginas; p++){

        if(p === 1 || p === totalPaginas || Math.abs(p - fuente.pagina) <= 1){
            boton(String(p), p, false, p === fuente.pagina);
        }else if(p === 2 || p === totalPaginas - 1){
            const span = document.createElement("span");
            span.textContent = "…";
            span.style.padding = "0 6px";
            cont.appendChild(span);
        }

    }

    boton("›", Math.min(totalPaginas, fuente.pagina + 1), fuente.pagina === totalPaginas, false);

}

["anomalias", "sugerencias"].forEach(function(key){

    document.getElementById("buscador-" + key).addEventListener("input", function(){
        FUENTES[key].pagina = 1;
        aplicarFiltrosYRenderizar(key);
    });

    document.getElementById("filtroEstado-" + key).addEventListener("change", function(){
        FUENTES[key].pagina = 1;
        aplicarFiltrosYRenderizar(key);
    });

    document.getElementById("filtroTipo-" + key).addEventListener("change", function(){
        FUENTES[key].pagina = 1;
        aplicarFiltrosYRenderizar(key);
    });

    document.getElementById("tbl-" + key).addEventListener("click", function(e){

        const boton = e.target.closest(".btn-ver-detalle");
        if(!boton){
            return;
        }

        const reporte = FUENTES[key].datos.find(r => r.id === boton.dataset.id);
        if(reporte){
            abrirDetalle(key, reporte);
        }

    });

});

document.querySelectorAll(".btn-actualizar").forEach(function(btn){
    btn.addEventListener("click", function(){
        cargarFuente(btn.dataset.fuente);
    });
});

// ========================================
// MODAL DETALLE (genérico, se llena según la fuente)
// ========================================

let _fuenteAbierta = null;
let _reporteAbierto = null;

function abrirDetalle(key, reporte){

    const fuente = FUENTES[key];

    _fuenteAbierta = key;
    _reporteAbierto = reporte;

    const estado = estadoDe(reporte);
    const estadoInfo = _estadosPorId[reporte.id];

    document.getElementById("detalleCodigo").textContent = reporte.id;

    const badge = document.getElementById("detalleEstadoBadge");
    badge.textContent = estado;
    badge.className = "badge-estado " + claseEstado(estado);

    const grid = document.getElementById("detalleGrid");
    grid.innerHTML = fuente.camposGrid(reporte).map(function(c){
        return `<div class="detalle-campo"><label>${c.label}</label><div>${c.valor}</div></div>`;
    }).join("");

    const largos = document.getElementById("detalleCamposLargos");
    largos.innerHTML = fuente.camposLargos(reporte).map(function(c){
        return `<div class="detalle-campo detalle-campo-full"><label>${c.label}</label><div>${c.valor}</div></div>`;
    }).join("");

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
    _fuenteAbierta = null;
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

        if(_fuenteAbierta){
            actualizarKpis(_fuenteAbierta);
            aplicarFiltrosYRenderizar(_fuenteAbierta);
        }

    }catch(err){

        console.error(err);
        mostrarToast("No se pudo guardar el estado: " + err.message, "error");

    }finally{

        btn.disabled = false;
        btn.textContent = "Guardar";

    }

});

cargarFuente("anomalias");
cargarFuente("sugerencias");

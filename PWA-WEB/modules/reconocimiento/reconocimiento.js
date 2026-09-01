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
// ESTADO
// ========================================

let reconocimientosData = [];
let colaboradorSeleccionado = null;

function anioActual(){
    return new Date().getFullYear();
}

function poblarSelectAnio(select){

    const actual = anioActual();
    let html = "";

    for(let a = actual + 1; a >= actual - 3; a--){
        html += `<option value="${a}" ${a === actual ? "selected" : ""}>${a}</option>`;
    }

    select.innerHTML = html;

}

// ========================================
// VISTAS (Listado / Evaluar)
// ========================================

function mostrarListado(){
    document.getElementById("vistaEvaluar").classList.add("oculto");
    document.getElementById("vistaListado").classList.remove("oculto");
}

function mostrarFormularioEvaluar(){
    document.getElementById("vistaListado").classList.add("oculto");
    document.getElementById("vistaEvaluar").classList.remove("oculto");
}

// ========================================
// LISTADO
// ========================================

async function cargarListado(){

    const tbody = document.getElementById("tblReconocimiento");
    tbody.innerHTML = `<tr><td colspan="9" class="sin-datos">Cargando registros...</td></tr>`;

    const anio = document.getElementById("filtroAnio").value;
    const trimestre = document.getElementById("filtroTrimestre").value;

    try{

        reconocimientosData = await obtenerReconocimientos(anio, trimestre);
        renderTabla();

    }catch(error){

        console.error(error);
        tbody.innerHTML = `<tr><td colspan="9" class="sin-datos">Error al cargar: ${error.message}</td></tr>`;

    }

}

function filasFiltradas(){

    const texto = (document.getElementById("buscadorNombre").value || "").trim().toUpperCase();

    if(!texto){
        return reconocimientosData;
    }

    return reconocimientosData.filter(r =>
        (r.nombre_completo || "").toUpperCase().includes(texto) ||
        String(r.dni || "").toUpperCase().includes(texto)
    );

}

function formatearFechaHora(iso){

    if(!iso){
        return "-";
    }

    const d = new Date(iso);

    const fecha = String(d.getDate()).padStart(2, "0") + "-" +
        String(d.getMonth() + 1).padStart(2, "0") + "-" +
        d.getFullYear();

    const hora = String(d.getHours()).padStart(2, "0") + ":" +
        String(d.getMinutes()).padStart(2, "0") + ":" +
        String(d.getSeconds()).padStart(2, "0");

    return fecha + " " + hora;

}

function renderTabla(){

    const filas = filasFiltradas();
    const tbody = document.getElementById("tblReconocimiento");
    const barra = document.getElementById("barraActualizado");

    if(filas.length === 0){
        tbody.innerHTML = `<tr><td colspan="9" class="sin-datos">Sin registros para mostrar.</td></tr>`;
        barra.style.display = "none";
        return;
    }

    tbody.innerHTML = filas.map(function(item){

        const esReconocido = item.estado === "Reconocido";

        return `
            <tr>
                <td>${item.trimestre}</td>
                <td>${(item.jefe_inmediato || "").toUpperCase()}</td>
                <td>${formatearFechaHora(item.created_at)}</td>
                <td>${item.dni}</td>
                <td>${(item.nombre_completo || "").toUpperCase()}</td>
                <td><b>${Number(item.nota).toFixed(1)}</b></td>
                <td>
                    <input type="text" class="input-pe" value="${item.pe || ""}"
                        data-id="${item.id}" onchange="guardarPe(this)">
                </td>
                <td>
                    <span class="badge-estado ${esReconocido ? "reconocido" : "sin-reconocimiento"}">
                        ${esReconocido ? "🏆 Reconocido" : "Sin reconocimiento"}
                    </span>
                </td>
                <td>
                    <button class="btn-ver-detalle" onclick="abrirDetalle(${item.id})">👁 Ver</button>
                </td>
            </tr>
        `;

    }).join("");

    const masReciente = reconocimientosData[0];

    if(masReciente){
        barra.style.display = "block";
        barra.textContent = "Actualizado el " + formatearFechaHora(masReciente.created_at) +
            " por " + (masReciente.registrado_por || "-");
    }

}

async function guardarPe(input){

    const id = Number(input.dataset.id);
    const valor = input.value.trim();

    try{

        await actualizarPeReconocimiento(id, valor || null);

        const item = reconocimientosData.find(r => r.id === id);
        if(item){ item.pe = valor; }

        mostrarToast("✅ PE actualizado", "exito");

    }catch(error){

        console.error(error);
        mostrarToast("❌ No se pudo actualizar PE", "error");

    }

}

// ========================================
// EXPORTAR CSV
// ========================================

function exportarCSV(){

    const filas = filasFiltradas();

    if(filas.length === 0){
        mostrarToast("❌ No hay datos para exportar", "error");
        return;
    }

    const encabezados = ["Trimestre","Jefe Inmediato","Fecha","DNI","Nombre","Nota","PE","Estado"];

    const escaparCelda = valor => {
        const texto = String(valor === null || valor === undefined ? "" : valor);
        return `"${texto.replace(/"/g,'""')}"`;
    };

    let csv = encabezados.map(escaparCelda).join(";") + "\r\n";

    filas.forEach(function(item){

        csv += [
            item.trimestre,
            item.jefe_inmediato,
            formatearFechaHora(item.created_at),
            item.dni,
            (item.nombre_completo || "").toUpperCase(),
            Number(item.nota).toFixed(1),
            item.pe || "",
            item.estado
        ].map(escaparCelda).join(";") + "\r\n";

    });

    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });

    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "reconocimiento_" + document.getElementById("filtroAnio").value + ".csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    mostrarToast("⬇️ Archivo descargado", "exito");

}

// ========================================
// FORMULARIO: DATOS DEL PERSONAL
// ========================================

async function abrirFormularioEvaluar(){

    document.getElementById("evTrimestre").value = "";
    document.getElementById("evJefe").value = "";
    document.getElementById("evNombre").innerHTML = `<option value="">Selecciona un personal</option>`;
    document.getElementById("evNombre").disabled = true;

    document.getElementById("evFotoImg").style.display = "none";
    document.getElementById("evFotoPlaceholder").style.display = "block";

    colaboradorSeleccionado = null;

    renderGridCategorias();

    mostrarFormularioEvaluar();

    try{

        const jefes = await obtenerJefesInmediatos();

        document.getElementById("evJefe").innerHTML =
            `<option value="">Selecciona un jefe</option>` +
            jefes.map(j => `<option value="${j}">${j}</option>`).join("");

    }catch(error){

        console.error(error);
        mostrarToast("❌ No se pudieron cargar los jefes inmediatos", "error");

    }

}

document.getElementById("evJefe").addEventListener("change", async function(){

    const jefe = this.value;

    const selectNombre = document.getElementById("evNombre");
    selectNombre.innerHTML = `<option value="">Cargando...</option>`;
    selectNombre.disabled = true;

    colaboradorSeleccionado = null;
    document.getElementById("evFotoImg").style.display = "none";
    document.getElementById("evFotoPlaceholder").style.display = "block";

    if(!jefe){
        selectNombre.innerHTML = `<option value="">Selecciona un personal</option>`;
        return;
    }

    try{

        const colaboradores = await obtenerColaboradoresPorJefe(jefe);

        selectNombre.innerHTML = `<option value="">Selecciona un personal</option>` +
            colaboradores.map(c => `<option value="${c.id}">${(c.nombre_completo || "").toUpperCase()}</option>`).join("");

        selectNombre.disabled = false;

        window._colaboradoresJefe = colaboradores;

    }catch(error){

        console.error(error);
        mostrarToast("❌ No se pudo cargar el personal de ese jefe", "error");

    }

});

document.getElementById("evNombre").addEventListener("change", async function(){

    const id = Number(this.value);

    const imgFoto = document.getElementById("evFotoImg");
    const placeholder = document.getElementById("evFotoPlaceholder");

    if(!id){
        colaboradorSeleccionado = null;
        imgFoto.style.display = "none";
        placeholder.style.display = "block";
        return;
    }

    colaboradorSeleccionado = (window._colaboradoresJefe || []).find(c => c.id === id) || null;

    imgFoto.style.display = "none";
    placeholder.style.display = "block";

    if(colaboradorSeleccionado){

        try{

            const foto = await buscarFotoColaborador(colaboradorSeleccionado.dni);

            if(foto && foto.foto){
                imgFoto.src = foto.foto;
                imgFoto.style.display = "block";
                placeholder.style.display = "none";
            }

        }catch(error){
            console.error(error);
        }

    }

});

// ========================================
// FORMULARIO: CRITERIOS (generados desde CRITERIOS_RECONOCIMIENTO)
// ========================================

function renderGridCategorias(){

    const contenedor = document.getElementById("evGridCategorias");

    contenedor.innerHTML = Object.keys(CRITERIOS_RECONOCIMIENTO).map(function(claveCategoria){

        const categoria = CRITERIOS_RECONOCIMIENTO[claveCategoria];

        const criterios = Object.keys(categoria.campos).map(function(campo){

            const info = categoria.campos[campo];

            return `
                <div class="criterio">
                    <div class="criterio-grupo">${info.grupo}</div>
                    <div class="criterio-cuerpo">
                        <span>${info.etiqueta}</span>
                        <select id="campo_${campo}" data-campo="${campo}">
                            <option value="">-- Selecciona --</option>
                            ${info.opciones.map(o => `<option value="${o.valor}">${o.texto}</option>`).join("")}
                        </select>
                    </div>
                </div>
            `;

        }).join("");

        return `
            <div class="categoria-box">
                <div class="categoria-titulo">${categoria.titulo}</div>
                ${criterios}
            </div>
        `;

    }).join("");

}

function recolectarRespuestas(){

    const respuestas = {};
    let faltantes = 0;

    Object.keys(CRITERIOS_RECONOCIMIENTO).forEach(function(claveCategoria){

        Object.keys(CRITERIOS_RECONOCIMIENTO[claveCategoria].campos).forEach(function(campo){

            const select = document.getElementById("campo_" + campo);
            respuestas[campo] = select.value;

            if(!select.value){
                faltantes++;
            }

        });

    });

    return { respuestas, faltantes };

}

// ========================================
// GUARDAR EVALUACIÓN
// ========================================

document.getElementById("btnEvaluar").addEventListener("click", async function(){

    const anio = Number(document.getElementById("evAnio").value);
    const trimestre = document.getElementById("evTrimestre").value;
    const jefe = document.getElementById("evJefe").value;

    if(!trimestre){
        mostrarToast("❌ Selecciona un trimestre", "error");
        return;
    }

    if(!jefe){
        mostrarToast("❌ Selecciona un jefe inmediato", "error");
        return;
    }

    if(!colaboradorSeleccionado){
        mostrarToast("❌ Selecciona el personal a evaluar", "error");
        return;
    }

    const { respuestas, faltantes } = recolectarRespuestas();

    if(faltantes > 0){
        mostrarToast("❌ Completa los " + faltantes + " criterio(s) que faltan", "error");
        return;
    }

    const resultado = calcularNotaReconocimiento(respuestas);

    const registro = Object.assign(
        {
            anio: anio,
            trimestre: trimestre,
            colaborador_id: colaboradorSeleccionado.id,
            dni: colaboradorSeleccionado.dni,
            nombre_completo: colaboradorSeleccionado.nombre_completo,
            jefe_inmediato: jefe,
            foto: document.getElementById("evFotoImg").style.display === "block"
                ? document.getElementById("evFotoImg").src
                : null,
            registrado_por: (sesion && (sesion.nombre_completo || sesion.usuario)) || null
        },
        respuestas,
        resultado
    );

    const boton = document.getElementById("btnEvaluar");
    boton.disabled = true;
    boton.textContent = "Guardando...";

    try{

        await insertarReconocimiento(registro);

        mostrarToast("✅ Evaluación registrada", "exito");

        mostrarListado();
        cargarListado();

    }catch(error){

        console.error(error);
        mostrarToast("❌ Error al guardar la evaluación: " + error.message, "error");

    }finally{

        boton.disabled = false;
        boton.textContent = "Evaluar";

    }

});

// ========================================
// MODAL VER DETALLE
// ========================================

function abrirDetalle(id){

    const item = reconocimientosData.find(r => r.id === id);
    if(!item){ return; }

    document.getElementById("detNombre").textContent = (item.nombre_completo || "").toUpperCase();

    const badge = document.getElementById("detEstado");
    const esReconocido = item.estado === "Reconocido";
    badge.textContent = esReconocido ? "🏆 Reconocido" : "Sin reconocimiento";
    badge.className = "badge-estado " + (esReconocido ? "reconocido" : "sin-reconocimiento");

    document.getElementById("detGrid").innerHTML = [
        { label: "DNI", valor: item.dni },
        { label: "Jefe Inmediato", valor: item.jefe_inmediato },
        { label: "Año / Trimestre", valor: item.anio + " - " + item.trimestre },
        { label: "Fecha de evaluación", valor: formatearFechaHora(item.created_at) },
        { label: "Nota final", valor: Number(item.nota).toFixed(1) + " / 5.0" },
        { label: "Registrado por", valor: item.registrado_por || "-" }
    ].map(c => `<div class="detalle-campo"><label>${c.label}</label><div>${c.valor}</div></div>`).join("");

    const notasCategoria = {
        COMPROMISO: item.nota_compromiso,
        OPERACIONES: item.nota_operaciones,
        MEJORA_CONTINUA: item.nota_mejora_continua,
        SEGURIDAD: item.nota_seguridad,
        MEDIO_AMBIENTE: item.nota_medio_ambiente
    };

    document.getElementById("detCategorias").innerHTML = Object.keys(CRITERIOS_RECONOCIMIENTO).map(function(claveCategoria){

        const categoria = CRITERIOS_RECONOCIMIENTO[claveCategoria];

        const filas = Object.keys(categoria.campos).map(function(campo){
            return `<div class="det-criterio"><span>${categoria.campos[campo].etiqueta}</span><b>${etiquetaOpcion(campo, item[campo])}</b></div>`;
        }).join("");

        return `
            <div class="det-categoria-titulo">${categoria.titulo} — ${Number(notasCategoria[claveCategoria]).toFixed(2)} / 1.00</div>
            ${filas}
        `;

    }).join("");

    document.getElementById("modalDetalle").classList.remove("oculto");

}

function cerrarDetalle(){
    document.getElementById("modalDetalle").classList.add("oculto");
}

document.getElementById("btnCerrarDetalle").addEventListener("click", cerrarDetalle);
document.getElementById("modalDetalleFondo").addEventListener("click", cerrarDetalle);

// ========================================
// EVENTOS GENERALES
// ========================================

document.getElementById("btnAgregar").addEventListener("click", abrirFormularioEvaluar);
document.getElementById("btnVolver").addEventListener("click", mostrarListado);

document.getElementById("btnBuscar").addEventListener("click", renderTabla);
document.getElementById("buscadorNombre").addEventListener("input", renderTabla);

document.getElementById("filtroAnio").addEventListener("change", cargarListado);
document.getElementById("filtroTrimestre").addEventListener("change", cargarListado);

document.getElementById("btnExportar").addEventListener("click", exportarCSV);

// ========================================
// INICIO
// ========================================

poblarSelectAnio(document.getElementById("filtroAnio"));
poblarSelectAnio(document.getElementById("evAnio"));

cargarListado();

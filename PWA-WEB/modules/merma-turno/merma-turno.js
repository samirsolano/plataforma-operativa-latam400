// ========================================
// MERMA POR TURNO (F-LAT-012) — lado Plataforma Operativa
// ========================================
// El auxiliar registra la merma en Centro de Proyectos (app
// centro-proyectos-latam, módulo Merma por Turno) → tabla
// merma_registros. Acá:
//   - Merma registrada: lo del TURNO ABIERTO (cruce_id null). Al
//     terminar el turno, CERRAR MERMA (merma_cerrar_turno, no deja
//     cerrar con cambios pendientes) pasa todo a un CIERRE y el turno
//     de relevo sigue registrando en blanco.
//   - 1. Cruce con SAP: en el turno abierto, SIN cerrar: se pega el
//     stock físico de la unidad de manipulación de merma (p. ej.
//     MERMAPENDI30.10) → merma_sap (cruce_id null) y se compara
//     Registro vs SAP por código. Al cerrar, el SAP pasa al cierre.
//   - 2. Validación física: conteo ciego (código + cantidad) por
//     cierre → merma_validacion.
//   - 3. Cruce final: Físico vs SAP.
//   - 4. Monitor: el formato MONITOR del Excel, listo para pegar en un
//     correo (tabla con formato) o bajar en Excel.
//   - MARA Merma: maestro con la ubicación de picking que ve el
//     auxiliar al escanear (merma_mara).
//
// Todas las cantidades se comparan en la UMA de la MARA (unidad de
// venta: CJA/PQT), igual que la columna K de la hoja SAP del Excel.
// Estado igual que las hojas CRUCE/VALIDACION: diferencia > 0 SOBRA,
// < 0 FALTA, 0 OK.

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

const sesion = requerirSesion();

if(sesion){

    if(!tienePermiso(sesion, "merma-turno")){
        window.location.href = "../inicio/home.html";
    }

    document.getElementById("nombreUsuario").textContent = sesion.nombre_completo;
    document.getElementById("rolUsuario").textContent = sesion.rol;

}

const usuarioActual = (sesion && (sesion.nombre_completo || sesion.usuario)) || "";

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

function mostrarSeccion(id){

    document.querySelectorAll(".mt-seccion").forEach(function(sec){
        sec.classList.toggle("oculto", sec.id !== id);
    });

    document.querySelectorAll(".menu a[data-seccion]").forEach(function(l){
        l.classList.toggle("activo", l.dataset.seccion === id);
    });

    if(id === "secValidacion"){
        document.getElementById("valCodigo").focus();
    }

}

document.querySelectorAll(".menu a[data-seccion]").forEach(function(link){
    link.addEventListener("click", function(e){
        e.preventDefault();
        mostrarSeccion(link.dataset.seccion);
    });
});

// ========================================
// UTILIDADES
// ========================================

function texto(v){
    if(v === undefined || v === null){
        return "";
    }
    return String(v).replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
}

function escaparHtml(v){
    return texto(v)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

// Cantidades del stock físico de SAP: vienen con 3 decimales y punto
// decimal ("12.000" = 12, "2.000" = 2). Si traen coma, el separador
// que aparece último es el decimal ("1.234,500" / "1,234.500").
function numeroSap(v){

    let t = texto(v).replace(/\s/g, "");

    if(t === ""){
        return null;
    }

    const coma = t.lastIndexOf(","), punto = t.lastIndexOf(".");

    if(coma > -1 && punto > -1){
        t = coma > punto ? t.replace(/\./g, "").replace(",", ".") : t.replace(/,/g, "");
    }else if(coma > -1){
        t = t.replace(",", ".");
    }

    const n = Number(t);
    return isNaN(n) ? null : n;

}

function redondear(n){
    return Math.round((Number(n) || 0) * 1000) / 1000;
}

function formatoNumero(n){
    return (Number(n) || 0).toLocaleString("es-PE", { maximumFractionDigits: 3 });
}

function dosDigitos(n){
    return String(n).padStart(2, "0");
}

function fechaIso(d){
    return d.getFullYear() + "-" + dosDigitos(d.getMonth() + 1) + "-" + dosDigitos(d.getDate());
}

function fechaDmy(iso){
    return iso ? iso.slice(8, 10) + "/" + iso.slice(5, 7) + "/" + iso.slice(0, 4) : "";
}

const MESES = ["ENERO", "FEBRERO", "MARZO", "ABRIL", "MAYO", "JUNIO", "JULIO",
               "AGOSTO", "SETIEMBRE", "OCTUBRE", "NOVIEMBRE", "DICIEMBRE"];

// Igual que la función del módulo Inventario Picking: PostgREST
// devuelve como máximo 1000 filas por pedido.
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

function chipEstado(diferencia){

    if(Math.abs(diferencia) < 0.0005){
        return '<span class="mt-chip ok">OK</span>';
    }

    const etiqueta = diferencia > 0 ? "SOBRA" : "FALTA";

    return '<span class="mt-chip ' + (diferencia > 0 ? "alerta" : "error") + '">' +
        etiqueta + " " + formatoNumero(Math.abs(diferencia)) + "</span>";

}

function sumarPorCodigo(filas, campoCodigo, campoCantidad){

    const mapa = new Map();

    filas.forEach(function(f){
        const c = texto(f[campoCodigo]);
        mapa.set(c, redondear((mapa.get(c) || 0) + (Number(f[campoCantidad]) || 0)));
    });

    return mapa;

}

// ========================================
// ESTADO
// ========================================

let MARA = new Map();          // codigo -> fila merma_mara
let MARA_EAN = new Map();      // ean14/ean13 -> fila
let CRUCES = [];               // cierres de turno (merma_cruces)
let CRUCE = null;              // cierre elegido; null = turno abierto
let SAP = [];                  // merma_sap del cierre
let VALIDACION = [];           // merma_validacion del cierre
let REGISTROS = [];            // merma_registros del turno abierto o del cierre

function buscarProducto(valor){

    const v = texto(valor).replace(/\D/g, "");

    if(!v){
        return null;
    }

    return MARA_EAN.get(v) || MARA.get(v) || MARA.get(v.replace(/^0+/, "")) || null;

}

function descripcionDe(codigo){

    const p = MARA.get(codigo);

    if(p && p.descripcion){
        return p.descripcion;
    }

    const s = SAP.find(x => x.producto === codigo);
    return s ? s.descripcion : "";

}

function fechaHoraCorta(iso){
    if(!iso){ return ""; }
    const d = new Date(iso);
    return dosDigitos(d.getDate()) + "/" + dosDigitos(d.getMonth() + 1) + " " + dosDigitos(d.getHours()) + ":" + dosDigitos(d.getMinutes());
}

function nombreCierre(c){
    return "Cierre #" + c.id + " · " + fechaHoraCorta(c.cerrado_at || c.created_at) +
        (c.grupo ? " · " + c.grupo : "") +
        (c.lineas ? " · " + c.lineas + " lín." : "") +
        (c.unidad_manipulacion ? " · " + c.unidad_manipulacion : " · sin SAP");
}

// ========================================
// CARGA DE DATOS
// ========================================

async function cargarMara(){

    const filas = await supabaseFetchTodo("/merma_mara?select=*&order=codigo.asc");

    MARA = new Map();
    MARA_EAN = new Map();

    filas.forEach(function(f){
        MARA.set(f.codigo, f);
        if(f.ean14){ MARA_EAN.set(String(f.ean14), f); }
        if(f.ean13){ MARA_EAN.set(String(f.ean13), f); }
    });

    pintarMara();

}

async function cargarCruces(){

    CRUCES = await supabaseFetchTodo("/merma_cruces?select=*&order=cerrado_at.desc");

    const sel = document.getElementById("selCruce");
    const actual = CRUCE ? String(CRUCE.id) : (sessionStorage.getItem("merma_cruce_activo") || "");

    sel.innerHTML = '<option value="">TURNO ABIERTO — registrando ahora</option>' +
        CRUCES.map(c => '<option value="' + c.id + '">' + escaparHtml(nombreCierre(c)) + "</option>").join("");

    sel.value = CRUCES.some(c => String(c.id) === actual) ? actual : "";
    CRUCE = CRUCES.find(c => String(c.id) === sel.value) || null;

}

async function cargarRegistros(){

    REGISTROS = await supabaseFetchTodo(
        "/merma_registros?select=*&order=created_at.asc&cruce_id=" + (CRUCE ? "eq." + CRUCE.id : "is.null")
    );

}

async function cargarCruceActivo(){

    if(!CRUCE){
        // Turno abierto: el SAP pegado sin cerrar (cruce_id null).
        SAP = await supabaseFetchTodo("/merma_sap?select=*&cruce_id=is.null&order=id.asc");
        VALIDACION = [];
        return;
    }

    const resultado = await Promise.all([
        supabaseFetchTodo("/merma_sap?select=*&cruce_id=eq." + CRUCE.id + "&order=id.asc"),
        supabaseFetchTodo("/merma_validacion?select=*&cruce_id=eq." + CRUCE.id + "&order=created_at.desc")
    ]);

    SAP = resultado[0];
    VALIDACION = resultado[1];

}

async function actualizarTodo(){

    try{

        await cargarRegistros();
        await cargarCruceActivo();
        pintarTodo();

    }catch(err){

        console.error(err);
        mostrarToast("No se pudo cargar la merma. Revisa la conexión.", "error");

    }

}

// ========================================
// TURNO ABIERTO / CIERRE ELEGIDO
// ========================================

async function elegirCruce(id){

    CRUCE = CRUCES.find(c => String(c.id) === String(id)) || null;
    sessionStorage.setItem("merma_cruce_activo", CRUCE ? String(CRUCE.id) : "");
    document.getElementById("selCruce").value = CRUCE ? String(CRUCE.id) : "";

    await actualizarTodo();

}

document.getElementById("selCruce").addEventListener("change", function(e){
    elegirCruce(e.target.value);
});

document.getElementById("btnActualizar").addEventListener("click", async function(){
    await cargarMara().catch(console.error);
    await cargarCruces().catch(console.error);
    await actualizarTodo();
    mostrarToast("Datos actualizados.", "info");
});

// ========================================
// CERRAR MERMA (fin de turno)
// ========================================
// merma_cerrar_turno() (merma-cierre-turno.sql) revisa que no quede
// ningún cambio pendiente en la ruta de los auxiliares, crea el
// cierre y le pasa todas las líneas del turno abierto, todo o nada.
// El turno de relevo sigue registrando en blanco.

document.getElementById("btnCerrarMerma").addEventListener("click", async function(){

    const btn = this;

    if(CRUCE){
        return;
    }

    if(!REGISTROS.length){
        mostrarToast("No hay merma registrada en el turno abierto.", "error");
        return;
    }

    const pendientes = REGISTROS.filter(r => r.estado !== "HECHO");

    if(pendientes.length){
        const auxiliares = Array.from(new Set(pendientes.map(r => r.nombre || "DNI " + r.dni)));
        await mostrarAlerta(
            "No se puede cerrar la merma: hay " + pendientes.length + " cambio(s) pendiente(s) en la ruta de:\n" +
            auxiliares.join("\n") + "\n\nCuando hagan los cambios en sus ubicaciones, vuelve a intentar."
        );
        return;
    }

    const reg = sumarPorCodigo(REGISTROS, "codigo", "cantidad");
    const sap = sumarPorCodigo(SAP, "producto", "ctd_uma");
    const codigos = Array.from(new Set([...reg.keys(), ...sap.keys()]));
    const conDif = codigos.filter(c => redondear((reg.get(c) || 0) - (sap.get(c) || 0)) !== 0).length;
    const textoSap = !SAP.length
        ? "Aún no pegaste el SAP (el cruce con SAP también se puede hacer después, sobre el cierre)."
        : (conDif ? "Cruce con SAP: " + conDif + " código(s) con diferencia." : "Cruce con SAP: todo OK.");

    if(!(await mostrarConfirmacion(
        "¿Cerrar la merma del turno?\n" + REGISTROS.length + " línea(s) pasan al cierre para la validación física, " +
        "el cruce final y el Monitor. El turno de relevo empieza en blanco.\n\n" + textoSap
    ))){
        return;
    }

    btn.disabled = true;
    btn.textContent = "CERRANDO...";

    try{

        const cierre = await supabaseFetch("/rpc/merma_cerrar_turno", {
            method: "POST",
            body: JSON.stringify({ p_usuario: usuarioActual })
        });

        mostrarToast("Merma cerrada (Cierre #" + cierre.id + ", " + cierre.lineas + " líneas). El turno de relevo ya puede registrar.", "exito");

        sessionStorage.setItem("merma_cruce_activo", String(cierre.id));
        await cargarCruces();
        await elegirCruce(cierre.id);
        mostrarSeccion("secValidacion");

    }catch(err){

        console.error(err);
        const msg = String(err && err.message || "");
        const m = /PENDIENTES:(\d+)/.exec(msg);

        if(m){
            mostrarToast("No se cerró: aparecieron " + m[1] + " cambio(s) pendiente(s). Actualiza y revisa.", "error");
            await actualizarTodo();
        }else if(msg.includes("SIN_REGISTROS")){
            mostrarToast("No hay merma registrada en el turno abierto.", "error");
        }else{
            mostrarToast("No se pudo cerrar la merma. Revisa la conexión.", "error");
        }

    }finally{

        btn.disabled = false;
        btn.textContent = "CERRAR MERMA";

    }

});

// ========================================
// PINTAR
// ========================================

function pintarTodo(){

    const textoFiltro = document.getElementById("textoFiltro");

    textoFiltro.textContent = CRUCE
        ? nombreCierre(CRUCE) + " · cerrado por " + (CRUCE.cerrado_por || "-") + " · " +
          SAP.length + " línea(s) SAP, " + VALIDACION.length + " conteo(s) físicos."
        : "Turno abierto: " + REGISTROS.length + " línea(s) registradas, " +
          REGISTROS.filter(r => r.estado !== "HECHO").length + " por cambiar. Al terminar, pulsa CERRAR MERMA.";

    document.getElementById("btnCerrarMerma").classList.toggle("oculto", !!CRUCE);
    document.getElementById("tituloRegistros").textContent = CRUCE
        ? "MERMA DEL CIERRE #" + CRUCE.id
        : "MERMA DEL TURNO ABIERTO";

    pintarRegistros();
    pintarCruce1();
    pintarValidacion();
    pintarCruce2();
    pintarMonitor();

}

function pintarRegistros(){

    const tbody = document.getElementById("tblRegistros");
    const pendientes = REGISTROS.filter(r => r.estado !== "HECHO").length;
    const total = REGISTROS.reduce((a, r) => a + (Number(r.cantidad) || 0), 0);

    const estado = document.getElementById("estadoRegistros");
    estado.textContent = REGISTROS.length ? (pendientes ? pendientes + " por cambiar" : "Cambios al día") : "Sin registros";
    estado.className = "pl-estado " + (REGISTROS.length ? (pendientes ? "alerta" : "ok") : "");

    const porAuxiliar = {};
    REGISTROS.forEach(function(r){
        const k = (r.nombre || "DNI " + r.dni);
        porAuxiliar[k] = (porAuxiliar[k] || 0) + 1;
    });

    document.getElementById("resumenRegistros").innerHTML =
        '<span class="mt-chip">' + REGISTROS.length + " líneas</span>" +
        '<span class="mt-chip">Cantidad ' + formatoNumero(total) + "</span>" +
        Object.keys(porAuxiliar).map(k => '<span class="mt-chip">' + escaparHtml(k) + " · " + porAuxiliar[k] + "</span>").join("");

    if(!REGISTROS.length){
        tbody.innerHTML = '<tr><td colspan="9" class="sin-datos">' + (CRUCE ? "Este cierre no tiene líneas." : "Aún no hay merma registrada en este turno.") + '</td></tr>';
        return;
    }

    tbody.innerHTML = REGISTROS.slice().reverse().map(function(r){

        const estadoFila = r.estado === "HECHO"
            ? '<span class="mt-chip ok">CAMBIADO</span>'
            : '<span class="mt-chip alerta">POR CAMBIAR</span>';

        return "<tr>" +
            "<td>" + fechaDmy(r.fecha) + " " + escaparHtml(r.hora) + "<br><small>" + escaparHtml(r.turno) + " · " + escaparHtml(r.grupo) + "</small></td>" +
            "<td>" + escaparHtml(r.nombre || "-") + "<br><small>DNI " + escaparHtml(r.dni) + "</small></td>" +
            "<td>" + escaparHtml(r.codigo) + "</td>" +
            "<td>" + escaparHtml(r.descripcion) + "</td>" +
            "<td>" + escaparHtml(r.ubicacion) + "</td>" +
            "<td>" + escaparHtml(r.motivo_codigo) + " · " + escaparHtml(r.motivo) +
                (r.validacion === "REVISAR" ? ' <span class="mt-chip alerta">REVISAR</span>' : "") + "</td>" +
            '<td class="num">' + formatoNumero(r.cantidad) + "</td>" +
            "<td>" + escaparHtml(r.uma) + "</td>" +
            "<td>" + estadoFila + "</td>" +
            "</tr>";

    }).join("");

}

function pintarCruce1(){

    const tbody = document.getElementById("tblCruce1");
    const estado = document.getElementById("estadoCruce1");

    if(!SAP.length){
        tbody.innerHTML = '<tr><td colspan="6" class="sin-datos">Pega arriba el stock físico de SAP para cruzarlo con lo registrado.</td></tr>';
        estado.textContent = "Sin SAP";
        estado.className = "pl-estado";
        return;
    }

    const reg = sumarPorCodigo(REGISTROS, "codigo", "cantidad");
    const sap = sumarPorCodigo(SAP, "producto", "ctd_uma");
    const codigos = Array.from(new Set([...reg.keys(), ...sap.keys()])).sort();
    let ok = 0;

    tbody.innerHTML = codigos.map(function(c){

        const a = reg.get(c) || 0, b = sap.get(c) || 0, d = redondear(a - b);
        if(!d){ ok++; }

        return '<tr class="' + (d ? "mt-fila-dif" : "") + '">' +
            "<td>" + escaparHtml(c) + "</td>" +
            "<td>" + escaparHtml(descripcionDe(c)) + "</td>" +
            '<td class="num">' + formatoNumero(a) + "</td>" +
            '<td class="num">' + formatoNumero(b) + "</td>" +
            '<td class="num">' + formatoNumero(d) + "</td>" +
            "<td>" + chipEstado(d) + "</td>" +
            "</tr>";

    }).join("") || '<tr><td colspan="6" class="sin-datos">Sin datos.</td></tr>';

    estado.textContent = ok + " de " + codigos.length + " OK";
    estado.className = "pl-estado " + (ok === codigos.length ? "ok" : "alerta");

}

function pintarValidacion(){

    const tbody = document.getElementById("tblValidacion");
    const estado = document.getElementById("estadoValidacion");

    if(!CRUCE){
        tbody.innerHTML = '<tr><td colspan="7" class="sin-datos">Cierra la merma del turno o elige un cierre arriba para validar.</td></tr>';
        estado.textContent = "-";
        return;
    }

    estado.textContent = VALIDACION.length + " conteo(s)";

    tbody.innerHTML = VALIDACION.map(function(v){

        const hora = v.created_at ? new Date(v.created_at).toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" }) : "";

        return "<tr>" +
            "<td>" + hora + "</td>" +
            "<td>" + escaparHtml(v.codigo) + "</td>" +
            "<td>" + escaparHtml(v.descripcion) + "</td>" +
            '<td class="num">' + formatoNumero(v.cantidad) + "</td>" +
            "<td>" + escaparHtml(v.uma) + "</td>" +
            "<td>" + escaparHtml(v.usuario) + "</td>" +
            '<td><button class="btn-fila-mara" data-borrar-val="' + v.id + '">Borrar</button></td>' +
            "</tr>";

    }).join("") || '<tr><td colspan="7" class="sin-datos">Aún no hay conteos en este cruce.</td></tr>';

}

function pintarCruce2(){

    const tbody = document.getElementById("tblCruce2");
    const estado = document.getElementById("estadoCruce2");

    if(!CRUCE){
        tbody.innerHTML = '<tr><td colspan="7" class="sin-datos">Cierra la merma del turno o elige un cierre arriba.</td></tr>';
        estado.textContent = "-";
        estado.className = "pl-estado";
        return;
    }

    const sap = sumarPorCodigo(SAP, "producto", "ctd_uma");
    const fis = sumarPorCodigo(VALIDACION, "codigo", "cantidad");
    const reg = sumarPorCodigo(REGISTROS, "codigo", "cantidad");
    const codigos = Array.from(new Set([...sap.keys(), ...fis.keys()])).sort();
    let ok = 0;

    tbody.innerHTML = codigos.map(function(c){

        const s = sap.get(c) || 0, f = fis.get(c) || 0, d = redondear(f - s);
        if(!d){ ok++; }

        return '<tr class="' + (d ? "mt-fila-dif" : "") + '">' +
            "<td>" + escaparHtml(c) + "</td>" +
            "<td>" + escaparHtml(descripcionDe(c)) + "</td>" +
            '<td class="num">' + formatoNumero(s) + "</td>" +
            '<td class="num">' + formatoNumero(f) + "</td>" +
            '<td class="num">' + formatoNumero(reg.get(c) || 0) + "</td>" +
            '<td class="num">' + formatoNumero(d) + "</td>" +
            "<td>" + chipEstado(d) + "</td>" +
            "</tr>";

    }).join("") || '<tr><td colspan="7" class="sin-datos">Sin datos.</td></tr>';

    estado.textContent = ok + " de " + codigos.length + " OK";
    estado.className = "pl-estado " + (codigos.length && ok === codigos.length ? "ok" : "alerta");

}

// ========================================
// 1. CRUCE CON SAP — pegar stock físico
// ========================================

// Toma "MERMA" + grupo + dd.mm (MERMAJQ04.11, MERMAPENDI30.10).
function leerUnidadManipulacion(um){

    const m = /MERMA([A-ZÑ]*?)(\d{1,2})\.(\d{1,2})\s*$/i.exec(um || "");

    if(!m){
        return null;
    }

    const hoy = new Date();
    const mes = Number(m[3]), dia = Number(m[2]);
    let anio = hoy.getFullYear();

    // Un 30.12 pegado en enero es del año pasado.
    if(mes > hoy.getMonth() + 2){
        anio--;
    }

    return { grupo: m[1].toUpperCase(), fecha: anio + "-" + dosDigitos(mes) + "-" + dosDigitos(dia) };

}

// Cada fila: [Tp, Ubicación,] Producto, Descripción, Lote, FeCa, TS,
// CtdEmb, UM, Unidad manipulación, Ctd [, Fecha EM, ...]. Se ubica la
// columna Producto (código de la MARA o 7 dígitos) y se lee desde ahí.
function leerPegadoSap(contenido){

    const filas = [];
    let noLeidas = 0;

    String(contenido).split(/\r?\n/).forEach(function(linea){

        if(!linea.trim()){
            return;
        }

        const c = linea.split("\t").map(texto);

        let i = c.findIndex(x => /^\d{6,8}$/.test(x) && MARA.has(x));
        if(i < 0){ i = c.findIndex(x => /^\d{7}$/.test(x)); }

        if(i < 0 || c.length < i + 9){
            // Encabezados y la fila de totales no traen código: no son error.
            if(/[A-Za-z]/.test(linea) && /\d{6,}/.test(linea)){ noLeidas++; }
            return;
        }

        const codigo = c[i];
        const p = MARA.get(codigo);
        const ctdEmb = numeroSap(c[i + 5]);
        const um = c[i + 6].toUpperCase();
        const ctd = numeroSap(c[i + 8]);

        // Igual que SAP!K del Excel: si la UM de SAP ya es la UMA, va
        // tal cual; si no, Ctd (unidad base) / conversión de la MARA.
        let ctdUma = ctd || 0;
        if(p){
            if(um && um === texto(p.unidad_venta).toUpperCase() && ctdEmb !== null){
                ctdUma = ctdEmb;
            }else if(Number(p.conversion) > 0){
                ctdUma = ctdUma / Number(p.conversion);
            }
        }

        filas.push({
            producto: codigo,
            descripcion: c[i + 1] || (p ? p.descripcion : ""),
            lote: c[i + 2],
            fecha_caducidad: c[i + 3],
            tipo_stock: c[i + 4],
            ctd_embalada: ctdEmb,
            unidad_medida: um,
            unidad_manipulacion: c[i + 7],
            ctd: ctd,
            ctd_uma: redondear(ctdUma),
            _uma: p ? p.unidad_venta : um,
            _enMara: !!p
        });

    });

    return { filas: filas, noLeidas: noLeidas };

}

let pegadoSap = null;

document.getElementById("pegarSap").addEventListener("input", function(e){

    const previa = document.getElementById("previaSap");
    const btn = document.getElementById("btnGuardarCruce");
    const contenido = e.target.value;

    if(!contenido.trim()){
        pegadoSap = null;
        previa.innerHTML = "";
        btn.disabled = true;
        return;
    }

    pegadoSap = leerPegadoSap(contenido);
    const filas = pegadoSap.filas;

    if(!filas.length){
        previa.innerHTML = '<div class="pl-advertencias">No se encontraron filas de SAP. Copia desde la columna Producto hasta Ctd (con tabulaciones).</div>';
        btn.disabled = true;
        return;
    }

    const um = filas[0].unidad_manipulacion;
    const info = leerUnidadManipulacion(um);
    const existe = SAP.length > 0;
    const unidades = Array.from(new Set(filas.map(f => f.unidad_manipulacion)));
    const avisos = [];

    if(existe){ avisos.push((CRUCE ? "Este cierre" : "El turno abierto") + " ya tiene SAP pegado: al guardar se reemplaza (los conteos físicos se mantienen)."); }
    if(unidades.length > 1){ avisos.push("Hay varias unidades de manipulación (" + unidades.join(", ") + "): se guardan todas juntas."); }
    if(filas.some(f => !f._enMara)){ avisos.push("Hay códigos que no están en la MARA Merma: su cantidad no se pudo convertir a UMA."); }
    if(pegadoSap.noLeidas){ avisos.push(pegadoSap.noLeidas + " fila(s) no se pudieron leer."); }

    previa.innerHTML =
        '<div class="mt-resumen">' +
            '<span class="mt-chip">' + filas.length + " líneas</span>" +
            '<span class="mt-chip">U. manipulación ' + escaparHtml(um) + "</span>" +
            (info ? '<span class="mt-chip">Grupo ' + escaparHtml(info.grupo || "-") + '</span><span class="mt-chip">Fecha ' + fechaDmy(info.fecha) + "</span>" : "") +
        "</div>" +
        (avisos.length ? '<div class="pl-advertencias"><ul>' + avisos.map(a => "<li>" + escaparHtml(a) + "</li>").join("") + "</ul></div>" : "") +
        '<div class="pl-tabla-scroll"><table><thead><tr><th>Producto</th><th>Descripción</th><th>Lote</th><th>F.V.</th><th class="num">Ctd SAP</th><th class="num">En UMA</th></tr></thead><tbody>' +
        filas.map(f =>
            "<tr><td>" + escaparHtml(f.producto) + "</td><td>" + escaparHtml(f.descripcion) + "</td><td>" + escaparHtml(f.lote) +
            "</td><td>" + escaparHtml(f.fecha_caducidad) + '</td><td class="num">' + formatoNumero(f.ctd) +
            '</td><td class="num">' + formatoNumero(f.ctd_uma) + " " + escaparHtml(f._uma) + "</td></tr>"
        ).join("") +
        "</tbody></table></div>";

    btn.disabled = false;

});

document.getElementById("btnGuardarCruce").addEventListener("click", async function(){

    if(!pegadoSap || !pegadoSap.filas.length){
        return;
    }

    const btn = this;
    const filas = pegadoSap.filas;
    const um = filas[0].unidad_manipulacion || null;
    const otro = um ? CRUCES.find(c => c.unidad_manipulacion === um && (!CRUCE || c.id !== CRUCE.id)) : null;

    if(otro && !(await mostrarConfirmacion(
        "La unidad de manipulación " + um + " ya está en el Cierre #" + otro.id + ". ¿Guardar igual este SAP en " +
        (CRUCE ? "el Cierre #" + CRUCE.id : "el turno abierto") + "?"
    ))){
        return;
    }

    btn.disabled = true;
    btn.textContent = "GUARDANDO...";

    try{

        // Sin cerrar, el SAP va al turno abierto (cruce_id null) y al
        // CERRAR MERMA pasa al cierre. Si hay un cierre elegido, se
        // reemplaza el SAP de ese cierre.
        const cruce = CRUCE;

        if(cruce && um && !otro){
            await supabaseFetch("/merma_cruces?id=eq." + cruce.id, {
                method: "PATCH",
                body: JSON.stringify({ unidad_manipulacion: um, cargado_por: usuarioActual })
            });
            cruce.unidad_manipulacion = um;
        }

        await supabaseFetch("/merma_sap?cruce_id=" + (cruce ? "eq." + cruce.id : "is.null"), { method: "DELETE" });

        await supabaseFetch("/merma_sap", {
            method: "POST",
            body: JSON.stringify(filas.map(function(f){
                return {
                    cruce_id: cruce ? cruce.id : null,
                    producto: f.producto,
                    descripcion: f.descripcion,
                    lote: f.lote,
                    fecha_caducidad: f.fecha_caducidad,
                    tipo_stock: f.tipo_stock,
                    ctd_embalada: f.ctd_embalada,
                    unidad_medida: f.unidad_medida,
                    unidad_manipulacion: f.unidad_manipulacion,
                    ctd: f.ctd,
                    ctd_uma: f.ctd_uma
                };
            }))
        });

        mostrarToast("SAP guardado en " + (cruce ? "el Cierre #" + cruce.id : "el turno abierto") + " (" + filas.length + " líneas).", "exito");

        document.getElementById("pegarSap").value = "";
        document.getElementById("previaSap").innerHTML = "";
        pegadoSap = null;

        await cargarCruces();
        await actualizarTodo();

    }catch(err){

        console.error(err);
        mostrarToast("No se pudo guardar el cruce.", "error");
        btn.disabled = false;

    }finally{

        btn.textContent = "GUARDAR CRUCE";

    }

});

// ========================================
// 2. VALIDACIÓN FÍSICA
// ========================================

const valCodigo = document.getElementById("valCodigo");
const valCantidad = document.getElementById("valCantidad");
let productoValidacion = null;

function pintarProductoValidacion(){

    const caja = document.getElementById("valProducto");
    const v = texto(valCodigo.value);
    productoValidacion = buscarProducto(v);

    document.getElementById("valUma").textContent = productoValidacion ? "(" + productoValidacion.unidad_venta + ")" : "";

    if(!v){
        caja.innerHTML = "";
    }else if(productoValidacion){
        caja.innerHTML = "<b>" + escaparHtml(productoValidacion.codigo) + "</b> · " + escaparHtml(productoValidacion.descripcion);
    }else{
        caja.innerHTML = '<span class="mt-chip error">Código no encontrado en la MARA Merma</span>';
    }

}

valCodigo.addEventListener("input", pintarProductoValidacion);

// El lector manda Enter al final: salta a la cantidad.
valCodigo.addEventListener("keydown", function(e){
    if(e.key === "Enter"){
        e.preventDefault();
        pintarProductoValidacion();
        if(productoValidacion){ valCantidad.focus(); }
    }
});

document.getElementById("formValidacion").addEventListener("submit", async function(e){

    e.preventDefault();

    const cantidad = numeroSap(valCantidad.value);

    if(!CRUCE){ mostrarToast("Elige un cierre arriba (o cierra la merma del turno).", "error"); return; }
    if(!productoValidacion){ mostrarToast("Escanea un código válido.", "error"); valCodigo.focus(); return; }
    if(!(cantidad > 0)){ mostrarToast("La cantidad debe ser mayor que 0.", "error"); valCantidad.focus(); return; }

    try{

        await supabaseFetch("/merma_validacion", {
            method: "POST",
            body: JSON.stringify({
                cruce_id: CRUCE.id,
                codigo: productoValidacion.codigo,
                ean: texto(valCodigo.value),
                descripcion: productoValidacion.descripcion,
                uma: productoValidacion.unidad_venta,
                cantidad: cantidad,
                usuario: usuarioActual
            })
        });

        mostrarToast("Contado " + productoValidacion.codigo + " · " + formatoNumero(cantidad) + " " + (productoValidacion.unidad_venta || ""), "exito");

        valCodigo.value = "";
        valCantidad.value = "";
        pintarProductoValidacion();
        valCodigo.focus();

        await actualizarTodo();

    }catch(err){

        console.error(err);
        mostrarToast("No se pudo guardar el conteo.", "error");

    }

});

document.getElementById("tblValidacion").addEventListener("click", async function(e){

    const boton = e.target.closest("[data-borrar-val]");

    if(!boton){
        return;
    }

    if(!(await mostrarConfirmacion("¿Borrar este conteo?"))){
        return;
    }

    try{
        await supabaseFetch("/merma_validacion?id=eq." + boton.dataset.borrarVal, { method: "DELETE" });
        await actualizarTodo();
    }catch(err){
        console.error(err);
        mostrarToast("No se pudo borrar el conteo.", "error");
    }

});

// ========================================
// 4. MONITOR — formato para correo
// ========================================

const COLUMNAS_MONITOR = ["numero", "MES", "FECHA", "TURNO - GRUPO DE SUPERVISOR", "CÓDIGO",
    "DESCRIPCIÓN DE PRODUCTO", "CANTIDAD", "UM", "MARCA", "ORIGEN DE MERMA", "MOTIVO DE MERMA",
    "LOTE", "F.V.", "PROCESO"];

let FILAS_MONITOR = [];

function armarFilasMonitor(){

    // Lote y F.V. de la merma salen del cruce con SAP (como la hoja
    // CONSOLIDADO, que los buscaba en SAP por código).
    const lotes = new Map();

    SAP.forEach(function(s){
        const o = lotes.get(s.producto) || { lote: new Set(), fv: new Set() };
        if(s.lote){ o.lote.add(s.lote); }
        if(s.fecha_caducidad){ o.fv.add(s.fecha_caducidad); }
        lotes.set(s.producto, o);
    });

    return REGISTROS.map(function(r, i){

        const l = lotes.get(r.codigo);
        const p = MARA.get(r.codigo);

        return [
            i + 1,
            MESES[Number(String(r.fecha).slice(5, 7)) - 1] || "",
            fechaDmy(r.fecha),
            r.grupo || "",
            r.codigo,
            r.descripcion || "",
            Number(r.cantidad) || 0,
            r.uma || "",
            r.marca || (p ? p.marca : "") || "",
            r.origen || "",
            r.motivo || "",
            l ? Array.from(l.lote).join(" / ") : "",
            l ? Array.from(l.fv).join(" / ") : "",
            r.proceso || "OUT"
        ];

    });

}

// HTML con estilos en línea: es lo que se conserva al pegar en
// Outlook/Gmail.
function htmlMonitor(){

    const celda = "border:1px solid #9aa3b5;padding:3px 6px;font-family:Calibri,Arial,sans-serif;font-size:11pt;";
    const cab = celda + "background:#1f2a5a;color:#ffffff;font-weight:bold;text-align:center;";
    const alDerecha = [0, 4, 6, 11];

    let html = '<table style="border-collapse:collapse;">' +
        '<tr><td colspan="' + COLUMNAS_MONITOR.length + '" style="' + cab + 'font-size:12pt;">MONITOR</td></tr>' +
        "<tr>" + COLUMNAS_MONITOR.map(c => '<td style="' + cab + '">' + escaparHtml(c) + "</td>").join("") + "</tr>";

    if(!FILAS_MONITOR.length){
        html += '<tr><td colspan="' + COLUMNAS_MONITOR.length + '" style="' + celda + 'text-align:center;color:#555555;">Sin merma en este turno.</td></tr>';
    }

    FILAS_MONITOR.forEach(function(fila){
        html += "<tr>" + fila.map(function(v, j){
            const alinear = alDerecha.includes(j) ? "text-align:right;" : (j === 10 ? "text-align:center;" : "");
            return '<td style="' + celda + "color:#111111;background:#ffffff;" + alinear + '">' + escaparHtml(j === 6 ? formatoNumero(v) : v) + "</td>";
        }).join("") + "</tr>";
    });

    return html + "</table>";

}

function pintarMonitor(){

    FILAS_MONITOR = armarFilasMonitor();
    document.getElementById("vistaMonitor").innerHTML = htmlMonitor();

    const estado = document.getElementById("estadoMonitor");
    estado.textContent = FILAS_MONITOR.length + " línea(s)";
    estado.className = "pl-estado " + (FILAS_MONITOR.length ? "ok" : "");

}

function textoMonitor(){
    return [COLUMNAS_MONITOR].concat(FILAS_MONITOR)
        .map(f => f.map(v => String(v).replace(/[\t\n]/g, " ")).join("\t"))
        .join("\n");
}

document.getElementById("btnCopiarMonitor").addEventListener("click", async function(){

    const html = htmlMonitor();

    try{

        await navigator.clipboard.write([
            new ClipboardItem({
                "text/html": new Blob([html], { type: "text/html" }),
                "text/plain": new Blob([textoMonitor()], { type: "text/plain" })
            })
        ]);

        mostrarToast("Monitor copiado. Pégalo en el correo.", "exito");

    }catch(err){

        // Navegadores sin ClipboardItem: se selecciona la tabla y se
        // copia como selección (también conserva el formato).
        const vista = document.getElementById("vistaMonitor");
        const rango = document.createRange();
        rango.selectNodeContents(vista);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(rango);

        let ok = false;
        try{ ok = document.execCommand("copy"); }catch(e){}

        mostrarToast(ok ? "Monitor copiado. Pégalo en el correo." : "Tabla seleccionada: pulsa Ctrl+C para copiar.", ok ? "exito" : "info");

    }

});

document.getElementById("btnExcelMonitor").addEventListener("click", function(){

    const hoja = XLSX.utils.aoa_to_sheet([["MONITOR"], COLUMNAS_MONITOR].concat(FILAS_MONITOR));
    hoja["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: COLUMNAS_MONITOR.length - 1 } }];

    const libro = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(libro, hoja, "MONITOR");

    const nombre = "MONITOR_MERMA_" + (CRUCE ? (CRUCE.unidad_manipulacion || "CIERRE_" + CRUCE.id) : "TURNO_ABIERTO_" + fechaIso(new Date())) + ".xlsx";
    XLSX.writeFile(libro, nombre.replace(/[^A-Za-z0-9_.-]/g, "_"));

});

// ========================================
// MARA MERMA
// ========================================

const FORMATO_UBICACION = /^[A-Z]{1,4}-\d{1,3}-\d{1,3}(-\d{1,2})?$/i;
const FILAS_POR_PAGINA_MARA = 100;

function pintarMara(){

    const busqueda = texto(document.getElementById("buscadorMara").value).toLowerCase();
    const todas = Array.from(MARA.values());

    const filas = busqueda
        ? todas.filter(f => [f.codigo, f.ean14, f.ean13, f.descripcion, f.ubicacion_picking]
            .some(v => texto(v).toLowerCase().includes(busqueda)))
        : todas;

    const estado = document.getElementById("estadoMara");
    estado.textContent = todas.length + " códigos";
    estado.className = "pl-estado " + (todas.length ? "ok" : "alerta");

    document.getElementById("tblMara").innerHTML = filas.slice(0, FILAS_POR_PAGINA_MARA).map(f =>
        "<tr>" +
        "<td>" + escaparHtml(f.codigo) + "</td>" +
        "<td>" + escaparHtml(f.descripcion) + "</td>" +
        "<td><b>" + escaparHtml(f.ubicacion_picking || "-") + "</b></td>" +
        "<td>" + escaparHtml(f.unidad_venta) + "</td>" +
        '<td class="num">' + escaparHtml(f.conversion) + "</td>" +
        "<td>" + escaparHtml(f.ean14) + "</td>" +
        "<td>" + escaparHtml(f.ean13) + "</td>" +
        "<td>" + escaparHtml(f.base) + "</td>" +
        "<td>" + escaparHtml(f.categoria) + "</td>" +
        '<td><button class="btn-fila-mara" data-editar-ubicacion="' + escaparHtml(f.codigo) + '">Ubicación</button></td>' +
        "</tr>"
    ).join("") || '<tr><td colspan="10" class="sin-datos">' +
        (todas.length ? "Ningún código coincide con la búsqueda." : "La MARA Merma está vacía: importa el Excel F-LAT-012 o corre merma-mara-datos.sql.") +
        "</td></tr>";

    document.getElementById("paginaMara").textContent = filas.length > FILAS_POR_PAGINA_MARA
        ? "Mostrando " + FILAS_POR_PAGINA_MARA + " de " + filas.length + ". Usa el buscador para encontrar el resto."
        : "";

}

document.getElementById("buscadorMara").addEventListener("input", pintarMara);

document.getElementById("tblMara").addEventListener("click", async function(e){

    const boton = e.target.closest("[data-editar-ubicacion]");

    if(!boton){
        return;
    }

    const codigo = boton.dataset.editarUbicacion;
    const fila = MARA.get(codigo);
    const nueva = await pedirTexto("Nueva ubicación de picking para " + codigo + "\n" + (fila ? fila.descripcion : ""), fila ? fila.ubicacion_picking || "" : "");

    if(nueva === null){
        return;
    }

    const ubicacion = texto(nueva).toUpperCase();

    if(!FORMATO_UBICACION.test(ubicacion)){
        mostrarToast("Ubicación no válida. Formato: PP-15-009-1", "error");
        return;
    }

    try{

        await supabaseFetch("/merma_mara?codigo=eq." + encodeURIComponent(codigo), {
            method: "PATCH",
            body: JSON.stringify({ ubicacion_picking: ubicacion, actualizado_por: usuarioActual, updated_at: new Date().toISOString() })
        });

        mostrarToast(codigo + " ahora en " + ubicacion + ".", "exito");
        await cargarMara();

    }catch(err){

        console.error(err);
        mostrarToast("No se pudo guardar la ubicación.", "error");

    }

});

// --- Pegar Código · Ubicación ---

let cambiosUbicacion = [];

document.getElementById("pegarUbicaciones").addEventListener("input", function(e){

    const previa = document.getElementById("previaUbicaciones");
    const btn = document.getElementById("btnGuardarUbicaciones");
    const errores = [];
    cambiosUbicacion = [];

    String(e.target.value).split(/\r?\n/).forEach(function(linea){

        if(!linea.trim()){
            return;
        }

        const c = linea.split("\t").map(texto);
        const codigo = c.find(x => /^\d{6,8}$/.test(x));
        const ubicacion = c.find(x => FORMATO_UBICACION.test(x));

        if(!codigo || !ubicacion){ errores.push(linea + "  ← falta código o ubicación"); return; }
        if(!MARA.has(codigo)){ errores.push(linea + "  ← el código no está en la MARA (impórtalo con el Excel)"); return; }

        const antes = MARA.get(codigo).ubicacion_picking || "";
        if(antes !== ubicacion.toUpperCase()){
            cambiosUbicacion.push({ codigo: codigo, antes: antes, despues: ubicacion.toUpperCase() });
        }

    });

    previa.innerHTML = !e.target.value.trim() ? "" :
        '<div class="mt-resumen"><span class="mt-chip ok">' + cambiosUbicacion.length + " ubicación(es) cambian</span>" +
        (errores.length ? '<span class="mt-chip error">' + errores.length + " fila(s) con error</span>" : "") + "</div>" +
        (cambiosUbicacion.length ? '<div class="pl-tabla-scroll"><table><thead><tr><th>Código</th><th>Antes</th><th>Después</th></tr></thead><tbody>' +
            cambiosUbicacion.slice(0, 50).map(x => "<tr><td>" + escaparHtml(x.codigo) + "</td><td>" + escaparHtml(x.antes || "-") + "</td><td><b>" + escaparHtml(x.despues) + "</b></td></tr>").join("") +
            "</tbody></table></div>" : "") +
        (errores.length ? '<div class="pl-advertencias"><ul>' + errores.slice(0, 10).map(x => "<li>" + escaparHtml(x) + "</li>").join("") + "</ul></div>" : "");

    btn.disabled = !cambiosUbicacion.length;

});

document.getElementById("btnGuardarUbicaciones").addEventListener("click", async function(){

    if(!cambiosUbicacion.length){
        return;
    }

    const btn = this;
    btn.disabled = true;
    btn.textContent = "GUARDANDO...";

    try{

        const ahora = new Date().toISOString();

        await supabaseFetch("/merma_mara?on_conflict=codigo", {
            method: "POST",
            headers: { "Prefer": "resolution=merge-duplicates" },
            body: JSON.stringify(cambiosUbicacion.map(function(x){
                const f = MARA.get(x.codigo);
                return Object.assign({}, f, { ubicacion_picking: x.despues, actualizado_por: usuarioActual, updated_at: ahora });
            }))
        });

        mostrarToast(cambiosUbicacion.length + " ubicación(es) actualizada(s).", "exito");

        document.getElementById("pegarUbicaciones").value = "";
        document.getElementById("previaUbicaciones").innerHTML = "";
        cambiosUbicacion = [];

        await cargarMara();

    }catch(err){

        console.error(err);
        mostrarToast("No se pudieron actualizar las ubicaciones.", "error");
        btn.disabled = false;

    }finally{

        btn.textContent = "ACTUALIZAR UBICACIONES";

    }

});

// --- Importar Excel F-LAT-012 (hojas MARA y BASES) ---

function normalizarEncabezado(t){
    return String(t || "")
        .replace(/\u00a0/g, " ")
        .trim()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .replace(/\s+/g, " ");
}

function valorCelda(v){
    if(v === null || v === undefined || v === 0 || v === "0"){
        return null;
    }
    if(typeof v === "number" && Number.isInteger(v)){
        return String(v);
    }
    const t = texto(v);
    return t || null;
}

document.getElementById("btnImportarMara").addEventListener("click", async function(){

    const archivo = document.getElementById("archivoMara").files[0];

    if(!archivo){
        mostrarToast("Elige el Excel F-LAT-012 primero.", "error");
        return;
    }

    const btn = this;
    btn.disabled = true;
    btn.textContent = "Importando...";

    try{

        const libro = XLSX.read(await archivo.arrayBuffer(), { type: "array" });
        const nombreMara = libro.SheetNames.find(n => normalizarEncabezado(n) === "mara");

        if(!nombreMara){
            mostrarToast("El archivo no tiene una hoja llamada MARA.", "error");
            return;
        }

        // Hoja BASES (CODIGO · DESCRIPCION · BASE): sin fila = REGULAR.
        const bases = new Map();
        const nombreBases = libro.SheetNames.find(n => normalizarEncabezado(n) === "bases");

        if(nombreBases){
            XLSX.utils.sheet_to_json(libro.Sheets[nombreBases], { header: 1, defval: "" }).slice(1).forEach(function(f){
                const c = valorCelda(f[0]);
                if(c){ bases.set(c, texto(f[2]) || "REGULAR"); }
            });
        }

        // MARA: por posición, igual que la hoja del Excel (A EAN14,
        // B EAN13, C Material EWM, D Descripción, E U. venta, F U. base,
        // G Conversión, J Ubicación de picking, K fami, L cat).
        const filas = XLSX.utils.sheet_to_json(libro.Sheets[nombreMara], { header: 1, defval: "" }).slice(1);
        const ahora = new Date().toISOString();
        const registros = new Map();

        filas.forEach(function(f){

            const codigo = valorCelda(f[2]);

            if(!codigo || !/^\d{5,10}$/.test(codigo)){
                return;
            }

            let categoria = texto(valorCelda(f[11])).toUpperCase();
            if(categoria.startsWith("DETERGENTE")){ categoria = "DETERGENTES"; }

            const marca = texto(valorCelda(f[10]));
            const conversion = Number(f[6]);

            registros.set(codigo, {
                codigo: codigo,
                ean14: valorCelda(f[0]),
                ean13: valorCelda(f[1]),
                descripcion: valorCelda(f[3]),
                unidad_venta: valorCelda(f[4]),
                unidad_base: valorCelda(f[5]),
                conversion: conversion > 0 ? conversion : null,
                ubicacion_picking: valorCelda(f[9]),
                marca: marca ? marca.charAt(0).toUpperCase() + marca.slice(1).toLowerCase() : null,
                categoria: categoria || null,
                base: bases.get(codigo) || "REGULAR",
                actualizado_por: usuarioActual,
                updated_at: ahora
            });

        });

        const lista = Array.from(registros.values());

        if(!lista.length){
            mostrarToast("No se encontraron materiales en la hoja MARA.", "error");
            return;
        }

        if(!(await mostrarConfirmacion("Se cargarán/actualizarán " + lista.length + " materiales en la MARA Merma. ¿Continuar?"))){
            return;
        }

        for(let i = 0; i < lista.length; i += 500){
            await supabaseFetch("/merma_mara?on_conflict=codigo", {
                method: "POST",
                headers: { "Prefer": "resolution=merge-duplicates" },
                body: JSON.stringify(lista.slice(i, i + 500))
            });
        }

        mostrarToast(lista.length + " material(es) cargado(s)/actualizado(s).", "exito");
        document.getElementById("archivoMara").value = "";
        await cargarMara();

    }catch(err){

        console.error(err);
        mostrarToast("No se pudo importar el archivo.", "error");

    }finally{

        btn.disabled = false;
        btn.textContent = "Importar Excel";

    }

});

// ========================================
// INICIO
// ========================================

(async function iniciar(){

    try{

        await cargarMara();
        await cargarCruces();

        const guardado = document.getElementById("selCruce").value;

        if(guardado){
            await elegirCruce(guardado);
        }else{
            await actualizarTodo();
        }

    }catch(err){

        console.error(err);
        mostrarToast("No se pudo cargar el módulo de merma.", "error");

    }

})();

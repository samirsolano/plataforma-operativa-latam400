// ========================================
// PL MASS — Packing List CD MASS CALLAO
// ========================================
// Flujo (todo en memoria, en esta pestaña del navegador):
//   1. Distribución (programación): F.O, RÓTULO, PEDIDO, O/C, ENTREGAS.
//   2. VL06F: Entrega, Posición, Material, Cantidad entrega,
//      Un.medida venta, Documento compras.
//   3. Viajes (F.O) de la Distribución -> se selecciona uno y se le
//      sube su Fase (export EWM con un HU por paleta: Producto, Lote,
//      FeCaduc/FePreferCons, UMp destino, Ctd.real dest.UMB).
//   4. Generar PL: una fila por HU (LPN), con O/C, Pedido, local,
//      SKU SPSA (de MARA MASS), cantidad, lote y fecha de vencimiento.
//
// Reglas (verificadas contra la plantilla Excel y contra el PL real
// 1000182095_CD_MASS_CALLAO.xlsx):
//   - Entrega VL06F -> F.O y Rótulo de la Distribución; Documento
//     compras -> O/C (Pedido de la Distribución).
//   - Unidades = cantidad VL06F (si viene en Unidad base) o cantidad x
//     Conversión (si viene en Unidad de venta). Si el rótulo es
//     ALMACENAJE se redondea hacia abajo a paletas completas (igual que
//     la hoja FORMATO); el resto se informa como AJUSTE.
//   - Cada línea toma HU de la Fase del mismo material (primero el que
//     vence antes) hasta completar sus unidades.
//   - LPN = "500000" + O/C + correlativo de 4 dígitos, en el orden del
//     PL (entrega, posición).

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

    if(!tienePermiso(sesion, "pl-mass")){
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

// Menú lateral: solo resalta el paso (los pasos están todos en la
// misma página, el href="#pasoN" hace el scroll).
document.querySelectorAll(".menu a").forEach(function(link){
    link.addEventListener("click", function(){
        document.querySelectorAll(".menu a").forEach(l => l.classList.remove("activo"));
        link.classList.add("activo");
    });
});

// ========================================
// UTILIDADES
// ========================================

function texto(v){
    if(v === undefined || v === null){
        return "";
    }
    if(typeof v === "number" && Number.isInteger(v)){
        return String(v);
    }
    return String(v).replace(/ /g, " ").replace(/\s+/g, " ").trim();
}

function escaparHtml(v){
    return texto(v)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

// Números de SAP/Excel: 400 / 400.0 / "400,000" / "1.248" / "1,248.5".
function numero(v){

    if(typeof v === "number"){
        return v;
    }

    let t = texto(v).replace(/\s/g, "");

    if(t === ""){
        return null;
    }

    if(t.includes(",") && t.includes(".")){
        // El separador que aparece último es el decimal.
        t = t.lastIndexOf(",") > t.lastIndexOf(".")
            ? t.replace(/\./g, "").replace(",", ".")
            : t.replace(/,/g, "");
    }else if(t.includes(",")){
        // "1,248" (miles) vs "400,5" (decimal): 3 dígitos tras la coma = miles.
        t = /,\d{3}$/.test(t) && !/^0,/.test(t) ? t.replace(/,/g, "") : t.replace(",", ".");
    }else if(/^\d{1,3}(\.\d{3})+$/.test(t)){
        // "1.248" en formato es-PE = mil doscientos cuarenta y ocho.
        t = t.replace(/\./g, "");
    }

    const n = Number(t);

    return isNaN(n) ? null : n;

}

// Solo dígitos -> número (así sale en el PL real: OC, Pedido, SKU,
// lote); cualquier otra cosa se deja como texto.
function numeroSiEsEntero(v){
    const t = texto(v);
    return /^\d+$/.test(t) && t.length <= 15 ? Number(t) : t;
}

function normalizarEncabezado(t){
    return String(t || "")
        .replace(/ /g, " ")
        .trim()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .replace(/\s+/g, " ");
}

function mapearEncabezados(filas, aliasPorCampo){

    const encabezados = filas.length ? Object.keys(filas[0]) : [];
    const mapa = {};

    Object.keys(aliasPorCampo).forEach(function(campo){
        mapa[campo] = encabezados.find(h => aliasPorCampo[campo].includes(normalizarEncabezado(h))) || null;
    });

    return mapa;

}

function camposFaltantes(mapa){
    return Object.keys(mapa).filter(c => !mapa[c]);
}

// Fecha -> {y, m, d} sin pasar por la zona horaria del navegador.
// Acepta serial de Excel, Date, "20.10.2029", "20/10/2029", "2029-10-20".
function leerFecha(v){

    if(v === "" || v === null || v === undefined){
        return null;
    }

    if(typeof v === "number"){
        const ms = Date.UTC(1899, 11, 30) + Math.round(v) * 86400000;
        const d = new Date(ms);
        return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate() };
    }

    if(v instanceof Date){
        return { y: v.getFullYear(), m: v.getMonth() + 1, d: v.getDate() };
    }

    const t = texto(v);
    let m = t.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})/);

    if(m){
        return { y: Number(m[3]), m: Number(m[2]), d: Number(m[1]) };
    }

    m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);

    if(m){
        return { y: Number(m[1]), m: Number(m[2]), d: Number(m[3]) };
    }

    return null;

}

function fechaASerialExcel(f){
    return Math.round((Date.UTC(f.y, f.m - 1, f.d) - Date.UTC(1899, 11, 30)) / 86400000);
}

function fechaATexto(f){
    return f ? String(f.d).padStart(2, "0") + "/" + String(f.m).padStart(2, "0") + "/" + f.y : "-";
}

function claveFecha(f){
    return f ? f.y * 10000 + f.m * 100 + f.d : 99999999;
}

function formatoNumero(n){
    return Number(n || 0).toLocaleString("es-PE");
}

// ========================================
// FUENTES: archivo o pegado (TSV copiado de Excel / correo)
// ========================================

document.querySelectorAll(".lpn-fuente-tab").forEach(function(tab){

    tab.addEventListener("click", function(){

        const fuente = tab.dataset.fuente;
        const modo = tab.dataset.modo;

        document.querySelectorAll('.lpn-fuente-tab[data-fuente="' + fuente + '"]').forEach(function(t){
            t.classList.toggle("activo", t === tab);
        });

        document.getElementById("archivo-" + fuente).classList.toggle("oculto", modo === "pegar");
        document.getElementById("pegar-" + fuente).classList.toggle("oculto", modo !== "pegar");

    });

});

function parsearPegado(t){

    const lineas = t.replace(/\r/g, "").split("\n").filter(l => l.trim() !== "");

    if(!lineas.length){
        return [];
    }

    const encabezados = lineas[0].split("\t").map(h => h.trim());

    return lineas.slice(1).map(function(linea){
        const valores = linea.split("\t");
        const fila = {};
        encabezados.forEach(function(h, i){
            fila[h] = valores[i] !== undefined ? valores[i].trim() : "";
        });
        return fila;
    });

}

// Hoja a leer: la que se llame como `hojaPreferida` (si existe) o la primera.
async function leerArchivo(archivo, hojaPreferida){

    const libro = XLSX.read(await archivo.arrayBuffer(), { type: "array" });

    const nombreHoja = (hojaPreferida && libro.SheetNames.find(n => n.trim().toUpperCase() === hojaPreferida))
        || libro.SheetNames[0];

    return XLSX.utils.sheet_to_json(libro.Sheets[nombreHoja], { defval: "" });

}

async function obtenerFilas(fuente){

    const modo = document.querySelector('.lpn-fuente-tab.activo[data-fuente="' + fuente + '"]').dataset.modo;

    if(modo === "pegar"){
        const filas = parsearPegado(document.getElementById("pegar-" + fuente).value);
        return filas.length ? filas : null;
    }

    const archivo = document.getElementById("archivo-" + fuente).files[0];

    return archivo ? await leerArchivo(archivo) : null;

}

// ========================================
// ESTADO
// ========================================

let _distribucion = [];      // [{fo, rotulo, pedido, oc, entrega}]
let _vl06f = [];             // [{entrega, posicion, sku, cantidad, um, docCompra}]
let _fasePorViaje = {};      // { fo: [{sku, lote, fecha, hu, cantidad}] }
let _mara = {};              // { sku: fila mara_mass }
let _viajeSeleccionado = null;
let _ultimoPl = null;        // { fo, filas, siguiente }

function marcarEstado(id, txt, clase){
    const el = document.getElementById(id);
    el.textContent = txt;
    el.className = "pl-estado" + (clase ? " " + clase : "");
}

function viajes(){
    return [...new Set(_distribucion.map(d => d.fo))].sort();
}

// ========================================
// PASO 1: DISTRIBUCIÓN
// ========================================

const ALIAS_DISTRIBUCION = {
    fo: ["f.o", "fo", "f.o.", "viaje", "unidad de transporte"],
    rotulo: ["rotulo", "tipo oc", "tipo de oc"],
    pedido: ["pedido", "pedidos"],
    oc: ["o/c", "oc", "orden de compra", "n° orden de compra", "no. oc"],
    entrega: ["entregas", "entrega"]
};

document.getElementById("btnCargarDistribucion").addEventListener("click", async function(){

    try{

        const filas = await obtenerFilas("distribucion");

        if(!filas){
            mostrarToast("Sube o pega la Distribución.", "error");
            return;
        }

        const mapa = mapearEncabezados(filas, ALIAS_DISTRIBUCION);
        const faltan = camposFaltantes(mapa);

        if(faltan.length){
            mostrarToast("A la Distribución le faltan columnas: " + faltan.join(", ") +
                ". Encabezados esperados: F.O, RÓTULO, PEDIDO, O/C, ENTREGAS.", "error");
            return;
        }

        const vistos = new Set();

        _distribucion = filas
            .map(f => ({
                fo: texto(f[mapa.fo]),
                rotulo: texto(f[mapa.rotulo]),
                pedido: texto(f[mapa.pedido]),
                oc: texto(f[mapa.oc]),
                entrega: texto(f[mapa.entrega])
            }))
            .filter(d => d.fo && d.entrega && !vistos.has(d.entrega) && vistos.add(d.entrega));

        if(!_distribucion.length){
            mostrarToast("La Distribución no tiene filas con F.O y Entrega.", "error");
            return;
        }

        _fasePorViaje = {};
        _ultimoPl = null;
        document.getElementById("bloqueResultadoPl").classList.add("oculto");

        document.getElementById("tblDistribucion").innerHTML = _distribucion.map(d => `
            <tr>
                <td>${escaparHtml(d.fo)}</td>
                <td>${escaparHtml(d.rotulo)}</td>
                <td>${escaparHtml(d.pedido)}</td>
                <td>${escaparHtml(d.oc)}</td>
                <td>${escaparHtml(d.entrega)}</td>
            </tr>
        `).join("");

        document.getElementById("bloqueDistribucion").classList.remove("oculto");

        marcarEstado("estadoDistribucion",
            "✓ " + _distribucion.length + " entrega(s) · " + viajes().length + " viaje(s)", "ok");

        pintarViajes();
        mostrarToast("Distribución cargada.", "exito");

    }catch(err){

        console.error(err);
        mostrarToast("No se pudo leer la Distribución: " + err.message, "error");

    }

});

// ========================================
// PASO 2: VL06F
// ========================================

const ALIAS_VL06F = {
    entrega: ["entrega"],
    posicion: ["posicion", "posicion de entrega", "pos.", "pos. entrega"],
    sku: ["material", "sku"],
    cantidad: ["cantidad entrega", "ctd entrega de salida", "ctd. entrega de salida", "cantidad"],
    um: ["un.medida venta", "un. medida venta", "unidad medida venta", "um entrega de salida", "um"],
    docCompra: ["documento compras", "documento de compra", "doc. compras", "documento compra"]
};

document.getElementById("btnCargarVl06f").addEventListener("click", async function(){

    try{

        const filas = await obtenerFilas("vl06f");

        if(!filas){
            mostrarToast("Sube o pega la VL06F.", "error");
            return;
        }

        const mapa = mapearEncabezados(filas, ALIAS_VL06F);
        const faltan = camposFaltantes(mapa);

        if(faltan.length){
            mostrarToast("A la VL06F le faltan columnas: " + faltan.join(", "), "error");
            return;
        }

        _vl06f = filas
            .map(f => ({
                entrega: texto(f[mapa.entrega]),
                posicion: texto(f[mapa.posicion]),
                sku: texto(f[mapa.sku]).replace(/^0+(?=\d)/, ""),
                cantidad: numero(f[mapa.cantidad]),
                um: texto(f[mapa.um]).toUpperCase(),
                docCompra: texto(f[mapa.docCompra])
            }))
            .filter(v => v.entrega && v.sku);

        _ultimoPl = null;
        document.getElementById("bloqueResultadoPl").classList.add("oculto");

        const entregasDistribucion = new Set(_distribucion.map(d => d.entrega));
        const usadas = _vl06f.filter(v => entregasDistribucion.has(v.entrega)).length;

        marcarEstado("estadoVl06f",
            "✓ " + _vl06f.length + " línea(s)" + (_distribucion.length ? " · " + usadas + " de la Distribución" : ""),
            _distribucion.length && usadas === 0 ? "alerta" : "ok");

        pintarViajes();
        mostrarToast("VL06F cargada: " + _vl06f.length + " línea(s).", "exito");

    }catch(err){

        console.error(err);
        mostrarToast("No se pudo leer la VL06F: " + err.message, "error");

    }

});

// ========================================
// CÁLCULO POR VIAJE (Distribución + VL06F + MARA MASS)
// ========================================

function calcularLineasViaje(fo){

    const porEntrega = {};
    const porPedido = {};

    _distribucion.forEach(function(d){
        porEntrega[d.entrega] = d;
        if(d.pedido) porPedido[d.pedido] = d;
    });

    const lineas = [];
    const advertencias = [];

    _vl06f
        .filter(v => porEntrega[v.entrega] && porEntrega[v.entrega].fo === fo)
        .sort((a, b) => Number(a.entrega) - Number(b.entrega) || Number(a.posicion) - Number(b.posicion))
        .forEach(function(v){

            const ref = "Entrega " + v.entrega + " pos. " + v.posicion + " (" + v.sku + ")";
            const dist = porPedido[v.docCompra] || porEntrega[v.entrega];

            if(!porPedido[v.docCompra]){
                advertencias.push(ref + ": el documento de compra " + v.docCompra +
                    " no está en la Distribución; se usa la O/C de la entrega.");
            }

            const m = _mara[v.sku];

            if(!m){
                advertencias.push(ref + ": el material no está en MARA MASS.");
                return;
            }

            let unidades;

            if(v.um === texto(m.unidad_base).toUpperCase()){
                unidades = v.cantidad;
            }else if(v.um === texto(m.unidad_venta).toUpperCase()){
                unidades = v.cantidad * Number(m.conversion || 0);
            }else{
                advertencias.push(ref + ": la unidad " + v.um + " no coincide con la unidad base (" +
                    m.unidad_base + ") ni la de venta (" + m.unidad_venta + ") de MARA MASS.");
                return;
            }

            if(!unidades){
                advertencias.push(ref + ": cantidad 0 o vacía.");
                return;
            }

            const almacenaje = porEntrega[v.entrega].rotulo.charAt(0).toUpperCase() === "A";
            const palet = Number(m.ctd_por_palet || 0);
            let paletas = null;

            if(almacenaje){

                if(!palet){
                    advertencias.push(ref + ": es Almacenaje pero no tiene Ctd por palet en MARA MASS.");
                    return;
                }

                paletas = Math.floor(unidades / palet);
                const resto = unidades - paletas * palet;

                if(resto){
                    advertencias.push(ref + ": AJUSTE — " + formatoNumero(unidades) + " und no es múltiplo de la paleta (" +
                        formatoNumero(palet) + "); van " + paletas + " paleta(s) y sobran " + formatoNumero(resto) + " und.");
                }

                unidades = paletas * palet;

            }

            lineas.push({
                entrega: v.entrega,
                posicion: v.posicion,
                sku: v.sku,
                oc: dist.oc,
                pedido: dist.pedido || v.docCompra,
                codigoSpsa: texto(m.codigo_spsa),
                unidades: unidades,
                paletas: paletas
            });

        });

    return { lineas, advertencias };

}

// ========================================
// PASO 3: VIAJES + FASE
// ========================================

function pintarViajes(){

    const tbody = document.getElementById("tblViajes");
    const cmb = document.getElementById("cmbViajePl");
    const lista = viajes();

    if(!lista.length){
        tbody.innerHTML = `<tr><td colspan="6" class="sin-datos">Carga la Distribución para ver los viajes.</td></tr>`;
        cmb.innerHTML = `<option value="">Seleccione viaje</option>`;
        return;
    }

    tbody.innerHTML = lista.map(function(fo){

        const entregas = _distribucion.filter(d => d.fo === fo).length;
        const { lineas } = calcularLineasViaje(fo);
        const paletas = lineas.reduce((s, l) => s + (l.paletas || 0), 0);
        const fase = _fasePorViaje[fo];

        const chip = fase
            ? `<span class="chip-fase ${fase.length === paletas ? "ok" : "alerta"}">✓ ${fase.length} HU</span>`
            : `<span class="chip-fase pendiente">Pendiente</span>`;

        return `
            <tr data-fo="${escaparHtml(fo)}" class="${fo === _viajeSeleccionado ? "fila-seleccionada" : ""}">
                <td>${escaparHtml(fo)}</td>
                <td>${entregas}</td>
                <td>${_vl06f.length ? lineas.length : "-"}</td>
                <td>${_vl06f.length ? paletas : "-"}</td>
                <td>${chip}</td>
                <td><button class="btn-secundario btn-sel-viaje" data-fo="${escaparHtml(fo)}">${fase ? "Cambiar Fase" : "Subir Fase"}</button></td>
            </tr>
        `;

    }).join("");

    const anterior = cmb.value;

    cmb.innerHTML = `<option value="">Seleccione viaje</option>` +
        lista.map(fo => `<option value="${escaparHtml(fo)}">${escaparHtml(fo)}${_fasePorViaje[fo] ? "" : " (sin Fase)"}</option>`).join("");

    if(lista.includes(anterior)){
        cmb.value = anterior;
    }

}

document.getElementById("tblViajes").addEventListener("click", function(e){

    const btn = e.target.closest(".btn-sel-viaje");

    if(!btn){
        return;
    }

    _viajeSeleccionado = btn.dataset.fo;
    document.getElementById("faseViajeSeleccionado").textContent = _viajeSeleccionado;
    document.getElementById("bloqueFase").classList.remove("oculto");
    document.getElementById("archivo-fase").value = "";
    document.getElementById("pegar-fase").value = "";

    pintarViajes();

    document.getElementById("bloqueFase").scrollIntoView({ behavior: "smooth", block: "center" });

});

const ALIAS_FASE = {
    sku: ["producto", "material"],
    lote: ["lote"],
    fecha: ["fecaduc/feprefercons", "fecaduc", "fecha vto.", "fecha vto", "fecha de vencimiento", "fecha caducidad"],
    hu: ["ump destino", "ump", "hu", "unidad de manipulacion", "unidad manipulacion"],
    cantidad: ["ctd.real dest.umb", "ctd. real dest. umb", "ctd real dest umb", "cantidad umb", "ctd.umb"]
};

document.getElementById("btnCargarFase").addEventListener("click", async function(){

    const fo = _viajeSeleccionado;

    if(!fo){
        mostrarToast("Selecciona un viaje en la tabla.", "error");
        return;
    }

    try{

        const filas = await obtenerFilas("fase");

        if(!filas){
            mostrarToast("Sube o pega la Fase del viaje " + fo + ".", "error");
            return;
        }

        const mapa = mapearEncabezados(filas, ALIAS_FASE);
        const faltan = camposFaltantes(mapa);

        if(faltan.length){
            mostrarToast("A la Fase le faltan columnas: " + faltan.join(", "), "error");
            return;
        }

        // Se descartan filas sin HU o sin cantidad (p. ej. la fila de
        // total "(24)" que trae el export de EWM al final).
        const hus = filas
            .map(f => ({
                sku: texto(f[mapa.sku]).replace(/^0+(?=\d)/, ""),
                lote: texto(f[mapa.lote]),
                fecha: leerFecha(f[mapa.fecha]),
                hu: texto(f[mapa.hu]),
                cantidad: numero(f[mapa.cantidad])
            }))
            .filter(h => h.sku && h.hu && h.cantidad > 0);

        if(!hus.length){
            mostrarToast("La Fase no tiene HU con cantidad.", "error");
            return;
        }

        _fasePorViaje[fo] = hus;
        _ultimoPl = null;

        pintarViajes();

        document.getElementById("cmbViajePl").value = fo;
        mostrarToast("Fase del viaje " + fo + " cargada: " + hus.length + " HU.", "exito");

    }catch(err){

        console.error(err);
        mostrarToast("No se pudo leer la Fase: " + err.message, "error");

    }

});

// ========================================
// PASO 4: GENERAR PL
// ========================================

const CLAVE_CORRELATIVO = "plMass.siguienteCorrelativo";

function leerCorrelativoGuardado(){
    try{
        const v = localStorage.getItem(CLAVE_CORRELATIVO);
        return v === null ? "" : v;
    }catch(e){
        return "";
    }
}

function guardarCorrelativo(n){
    try{
        localStorage.setItem(CLAVE_CORRELATIVO, String(n));
    }catch(e){
        // Sin almacenamiento (modo privado): el usuario lo escribe a mano.
    }
}

document.getElementById("txtCorrelativo").value = leerCorrelativoGuardado();

function generarPl(fo, correlativoInicial, local){

    const { lineas, advertencias } = calcularLineasViaje(fo);
    const fase = _fasePorViaje[fo] || [];

    // HU disponibles por material, primero el que vence antes.
    const disponibles = {};

    fase.forEach(function(h, i){
        (disponibles[h.sku] = disponibles[h.sku] || []).push(Object.assign({ orden: i }, h));
    });

    Object.values(disponibles).forEach(function(lista){
        lista.sort((a, b) => claveFecha(a.fecha) - claveFecha(b.fecha) || a.orden - b.orden);
    });

    const filas = [];
    let correlativo = correlativoInicial;

    lineas.forEach(function(l){

        const ref = "Entrega " + l.entrega + " pos. " + l.posicion + " (" + l.sku + ")";
        const pool = disponibles[l.sku] || [];
        let pendiente = l.unidades;

        while(pendiente > 0 && pool.length){

            if(pool[0].cantidad > pendiente){
                advertencias.push(ref + ": el HU " + pool[0].hu + " tiene " + formatoNumero(pool[0].cantidad) +
                    " und pero solo faltan " + formatoNumero(pendiente) + " und para esta línea.");
                break;
            }

            const hu = pool.shift();
            pendiente -= hu.cantidad;

            filas.push({
                oc: l.oc,
                pedido: l.pedido,
                lpn: "500000" + l.oc + String(correlativo).padStart(4, "0"),
                local: local,
                sku: l.codigoSpsa,
                cantidad: hu.cantidad,
                lote: hu.lote,
                fecha: hu.fecha,
                hu: hu.hu
            });

            correlativo++;

        }

        if(pendiente > 0){
            advertencias.push(ref + ": faltan " + formatoNumero(pendiente) + " und en la Fase (pedido " +
                formatoNumero(l.unidades) + " und).");
        }

    });

    Object.keys(disponibles).forEach(function(sku){
        disponibles[sku].forEach(function(h){
            advertencias.push("HU " + h.hu + " (" + sku + ", " + formatoNumero(h.cantidad) +
                " und) está en la Fase pero no en la VL06F de este viaje.");
        });
    });

    if(correlativo - 1 > 9999){
        advertencias.unshift("El correlativo pasa de 9999 (llega a " + (correlativo - 1) +
            "): revisa el correlativo inicial, el LPN quedaría con más de 4 dígitos.");
    }

    filas.forEach(function(f){
        if(!f.fecha) advertencias.push("HU " + f.hu + ": sin fecha de vencimiento en la Fase.");
        if(!f.sku) advertencias.push("HU " + f.hu + ": el material no tiene Código SPSA en MARA MASS.");
    });

    return { filas, advertencias, siguiente: correlativo };

}

document.getElementById("btnGenerarPl").addEventListener("click", function(){

    const fo = document.getElementById("cmbViajePl").value;
    const textoCorrelativo = document.getElementById("txtCorrelativo").value.trim();
    const local = texto(document.getElementById("txtLocal").value);

    if(!_distribucion.length || !_vl06f.length){
        mostrarToast("Primero carga la Distribución y la VL06F.", "error");
        return;
    }

    if(!fo){
        mostrarToast("Selecciona el viaje.", "error");
        return;
    }

    if(!_fasePorViaje[fo]){
        mostrarToast("El viaje " + fo + " todavía no tiene Fase cargada.", "error");
        return;
    }

    if(!/^\d{1,4}$/.test(textoCorrelativo)){
        mostrarToast("Escribe el correlativo inicial (0 a 9999).", "error");
        return;
    }

    if(!Object.keys(_mara).length){
        mostrarToast("MARA MASS está vacía: impórtala abajo antes de generar.", "error");
        return;
    }

    const resultado = generarPl(fo, Number(textoCorrelativo), local);

    _ultimoPl = Object.assign({ fo: fo }, resultado);

    document.getElementById("bloqueResultadoPl").classList.remove("oculto");
    document.getElementById("plTotalLpn").textContent = resultado.filas.length;
    document.getElementById("plTotalUnidades").textContent =
        formatoNumero(resultado.filas.reduce((s, f) => s + f.cantidad, 0));
    document.getElementById("plSiguiente").textContent = resultado.siguiente;

    const bloqueAdv = document.getElementById("bloqueAdvertenciasPl");

    bloqueAdv.classList.toggle("oculto", !resultado.advertencias.length);
    document.getElementById("lstAdvertenciasPl").innerHTML =
        resultado.advertencias.map(a => `<li>${escaparHtml(a)}</li>`).join("");

    document.getElementById("tblPl").innerHTML = resultado.filas.map(f => `
        <tr>
            <td>${escaparHtml(f.oc)}</td>
            <td>${escaparHtml(f.pedido)}</td>
            <td>${escaparHtml(f.lpn)}</td>
            <td>${escaparHtml(f.local)}</td>
            <td>${escaparHtml(f.sku)}</td>
            <td>${formatoNumero(f.cantidad)}</td>
            <td>${escaparHtml(f.lote)}</td>
            <td>${fechaATexto(f.fecha)}</td>
            <td></td>
        </tr>
    `).join("");

    document.getElementById("btnDescargarPl").disabled = !resultado.filas.length;

    mostrarToast(
        resultado.filas.length + " LPN generado(s)" +
        (resultado.advertencias.length ? " con " + resultado.advertencias.length + " observación(es)." : "."),
        resultado.advertencias.length ? "info" : "exito"
    );

});

// Mismo formato que el PL real (1000182095_CD_MASS_CALLAO.xlsx): hoja
// FORMATO; OC, Pedido, SKU, Cantidad y Lote como número; LPN y Local
// como texto; Fecha Vto. como fecha real; COSTO vacío.
document.getElementById("btnDescargarPl").addEventListener("click", function(){

    if(!_ultimoPl || !_ultimoPl.filas.length){
        return;
    }

    const encabezados = ["No. OC", "No. Fact.", "LPN", "LOCAL DESTINO", "SKU", "CANTIDAD", "No. Lote", "Fecha Vto.", "COSTO"];
    const hoja = XLSX.utils.aoa_to_sheet([encabezados]);

    _ultimoPl.filas.forEach(function(f, i){

        const r = i + 1;

        function poner(c, celda){
            hoja[XLSX.utils.encode_cell({ r: r, c: c })] = celda;
        }

        function numOTexto(v){
            const x = numeroSiEsEntero(v);
            return typeof x === "number" ? { t: "n", v: x } : { t: "s", v: x };
        }

        poner(0, numOTexto(f.oc));
        poner(1, numOTexto(f.pedido));
        poner(2, { t: "s", v: f.lpn });
        poner(3, { t: "s", v: f.local });
        poner(4, numOTexto(f.sku));
        poner(5, { t: "n", v: f.cantidad });
        poner(6, numOTexto(f.lote));

        if(f.fecha){
            poner(7, { t: "n", v: fechaASerialExcel(f.fecha), z: "dd/mm/yyyy" });
        }

    });

    hoja["!ref"] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: _ultimoPl.filas.length, c: 8 } });
    hoja["!cols"] = [12, 12, 22, 14, 12, 11, 13, 12, 8].map(w => ({ wch: w }));

    const libro = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(libro, hoja, "FORMATO");
    XLSX.writeFile(libro, _ultimoPl.fo + "_CD_MASS_CALLAO.xlsx");

    // El siguiente PL arranca donde terminó este.
    guardarCorrelativo(_ultimoPl.siguiente);
    document.getElementById("txtCorrelativo").value = _ultimoPl.siguiente;

});

// ========================================
// MARA MASS (tabla mara_mass en WMS Dashboard)
// ========================================

let _maraLista = [];

// PostgREST devuelve máximo 1000 filas por pedido: se pagina con Range.
async function traerTodo(ruta){

    const TAMANO = 1000;
    let desde = 0;
    let todas = [];

    while(true){

        const pagina = await supabaseFetch(ruta, {
            headers: { "Range": desde + "-" + (desde + TAMANO - 1) }
        });

        if(!pagina || !pagina.length){
            break;
        }

        todas = todas.concat(pagina);

        if(pagina.length < TAMANO){
            break;
        }

        desde += TAMANO;

    }

    return todas;

}

async function cargarMara(){

    try{

        _maraLista = await traerTodo("/mara_mass?select=*&order=sku.asc");
        _mara = {};
        _maraLista.forEach(m => { _mara[texto(m.sku)] = m; });

        marcarEstado("estadoMara", _maraLista.length ? "✓ " + _maraLista.length + " material(es)" : "Vacía",
            _maraLista.length ? "ok" : "alerta");

        pintarMara();
        pintarViajes();

    }catch(err){

        console.error(err);
        marcarEstado("estadoMara", "Sin conexión", "alerta");
        document.getElementById("tblMara").innerHTML =
            `<tr><td colspan="9" class="sin-datos">No se pudo leer mara_mass. ¿Ya se corrió mara-mass.sql en Supabase?</td></tr>`;

    }

}

function pintarMara(){

    const filtro = normalizarEncabezado(document.getElementById("buscadorMara").value);

    const filas = _maraLista.filter(function(m){
        if(!filtro) return true;
        return normalizarEncabezado([m.sku, m.codigo_spsa, m.descripcion, m.ean14, m.ean13].join(" ")).includes(filtro);
    });

    const MAX = 200;

    document.getElementById("tblMara").innerHTML = filas.length
        ? filas.slice(0, MAX).map(m => `
            <tr>
                <td>${escaparHtml(m.sku)}</td>
                <td>${escaparHtml(m.descripcion)}</td>
                <td>${escaparHtml(m.codigo_spsa)}</td>
                <td>${escaparHtml(m.unidad_venta)}</td>
                <td>${escaparHtml(m.unidad_base)}</td>
                <td>${escaparHtml(m.conversion)}</td>
                <td>${escaparHtml(m.ean14)}</td>
                <td>${escaparHtml(m.ean13)}</td>
                <td>${m.ctd_por_palet ? formatoNumero(m.ctd_por_palet) : "<b>falta</b>"}</td>
            </tr>
        `).join("") + (filas.length > MAX
            ? `<tr><td colspan="9" class="sin-datos">Mostrando ${MAX} de ${filas.length}. Usa el buscador.</td></tr>` : "")
        : `<tr><td colspan="9" class="sin-datos">${_maraLista.length ? "Sin resultados." : "MARA MASS está vacía."}</td></tr>`;

}

document.getElementById("buscadorMara").addEventListener("input", pintarMara);

const ALIAS_MARA = {
    material_ewm: ["material ewm"],
    sku: ["material s4h", "material", "sku"],
    descripcion: ["des. de material", "descripcion", "descripcion de material", "denominacion"],
    codigo_spsa: ["codigo spsa", "cod. spsa", "codigo cliente"],
    unidad_venta: ["unidad de venta", "unidad venta"],
    unidad_base: ["unidad base", "unidad de medida base"],
    conversion: ["conversion por und", "conversion", "factor conversion"],
    ean14: ["ean14", "ean 14"],
    ean13: ["ean13", "ean 13"],
    ctd_por_palet: ["ctd por palet", "ctd x palet", "cantidad por palet"]
};

document.getElementById("btnImportarMara").addEventListener("click", async function(){

    const archivo = document.getElementById("archivoMara").files[0];
    const boton = this;

    if(!archivo){
        mostrarToast("Selecciona la plantilla .xlsm o el Excel de la MARA.", "error");
        return;
    }

    boton.disabled = true;
    boton.textContent = "Importando...";

    try{

        const filas = await leerArchivo(archivo, "MARA");
        const mapa = mapearEncabezados(filas, ALIAS_MARA);
        const faltan = camposFaltantes(mapa).filter(c => c !== "material_ewm");

        if(faltan.length){
            mostrarToast("Al archivo le faltan columnas de MARA: " + faltan.join(", "), "error");
            return;
        }

        const cargadoPor = (sesion && (sesion.nombre_completo || sesion.usuario)) || "";
        const porSku = {};

        filas.forEach(function(f){

            const sku = texto(f[mapa.sku]);

            // Primera aparición gana (igual que BUSCARV en la plantilla).
            if(!sku || porSku[sku]){
                return;
            }

            const valor = c => { const t = mapa[c] ? texto(f[mapa[c]]) : ""; return t === "" || t.startsWith("#") ? null : t; };

            porSku[sku] = {
                sku: sku,
                material_ewm: valor("material_ewm") && valor("material_ewm").toUpperCase(),
                descripcion: valor("descripcion"),
                codigo_spsa: valor("codigo_spsa"),
                unidad_venta: valor("unidad_venta") && valor("unidad_venta").toUpperCase(),
                unidad_base: valor("unidad_base") && valor("unidad_base").toUpperCase(),
                conversion: numero(valor("conversion")),
                ean14: valor("ean14"),
                ean13: valor("ean13"),
                ctd_por_palet: numero(valor("ctd_por_palet")),
                archivo_origen: archivo.name,
                cargado_por: cargadoPor
            };

        });

        const registros = Object.values(porSku);

        if(!registros.length){
            mostrarToast("El archivo no tiene materiales.", "error");
            return;
        }

        const BLOQUE = 200;

        for(let i = 0; i < registros.length; i += BLOQUE){

            await supabaseFetch("/mara_mass?on_conflict=sku", {
                method: "POST",
                headers: { "Prefer": "resolution=merge-duplicates,return=minimal" },
                body: JSON.stringify(registros.slice(i, i + BLOQUE))
            });

        }

        mostrarToast("MARA MASS actualizada: " + registros.length + " material(es).", "exito");
        document.getElementById("archivoMara").value = "";

        await cargarMara();

    }catch(err){

        console.error(err);
        mostrarToast("No se pudo importar la MARA: " + err.message, "error");

    }finally{

        boton.disabled = false;
        boton.textContent = "Importar MARA";

    }

});

// ========================================
// REINICIAR
// ========================================

document.getElementById("btnReiniciar").addEventListener("click", function(){

    if(!confirm("¿Borrar la Distribución, la VL06F y las Fases cargadas en esta pantalla? (MARA MASS no se toca)")){
        return;
    }

    _distribucion = [];
    _vl06f = [];
    _fasePorViaje = {};
    _viajeSeleccionado = null;
    _ultimoPl = null;

    ["archivo-distribucion", "archivo-vl06f", "archivo-fase"].forEach(id => { document.getElementById(id).value = ""; });
    ["pegar-distribucion", "pegar-vl06f", "pegar-fase"].forEach(id => { document.getElementById(id).value = ""; });

    document.getElementById("bloqueDistribucion").classList.add("oculto");
    document.getElementById("bloqueFase").classList.add("oculto");
    document.getElementById("bloqueResultadoPl").classList.add("oculto");

    marcarEstado("estadoDistribucion", "Pendiente");
    marcarEstado("estadoVl06f", "Pendiente");

    pintarViajes();

});

cargarMara();

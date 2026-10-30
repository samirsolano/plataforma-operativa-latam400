// ========================================
// PROCESAR CLIENTE (Canal Moderno)
// ========================================
// "⚙️ Procesar cliente" en Cargar Viaje abre este panel con el cliente
// como encabezado y todos sus viajes. Pide los datos que necesita ese
// cliente (para SUPERMERCADOS PERUANOS: el VA05 y el detalle del
// correo) y con eso arma el detalle de distribución (hoja FExport de
// la "Plantilla Carga LPN Supermercados"). Cada cliente tiene su
// configuración en CONFIG_PROCESAR_CLIENTE: mismo panel, distinta
// información. El cálculo del detalle todavía falta: se arma cuando
// tengamos ejemplos reales del VA05 y del correo.

const procesarCliente = {
    cliente: null,
    gestion: null,
    viajes: [],
    config: null,
    entradas: {}   // id → { nombre, filas: [[...], ...] }
};

// Columnas del detalle de distribución (hoja FExport de la plantilla).
const COLUMNAS_DISTRIBUCION_SPSA = [
    "Número de almacén", "Entrega", "Posición de entrega", "Tienda", "Descripción de Tienda",
    "Unidad de Transporte", "Tipo de OC", "Tipo de Proceso", "Pedido", "Posición de Pedido",
    "N° Orden de Compra", "EAN o UPC (EAN 14 SPSA)", "Número de producto CLIENTE",
    "Denomin.producto CLIENTE", "Cantidad UMB"
];

const CONFIG_PROCESAR_CLIENTE = {
    "SUPERMERCADOS PERUANOS S.A.": {
        entradas: [
            {
                id: "va05",
                titulo: "Detalle de pedido y orden de compra",
                etiqueta: "VA05",
                ayuda: "Exporta el VA05 de SAP con los pedidos de estos viajes y súbelo, o cópialo y pégalo."
            },
            {
                id: "correo",
                titulo: "Detalle de correo",
                etiqueta: "Correo del cliente",
                ayuda: "Pega la tabla del correo (FO, tipo de OC, pedido, OC, entrega) o sube el Excel."
            }
        ],
        salida: {
            titulo: "Detalle de distribución",
            columnas: COLUMNAS_DISTRIBUCION_SPSA
        }
    }
};

// Los clientes sin configuración propia abren el mismo panel (con su
// encabezado y viajes), pero todavía sin datos que pedir.
const CONFIG_PROCESAR_POR_DEFECTO = { entradas: [], salida: null };

function abrirProcesarCliente(gestion, cliente){

    const resultado = cargaViaje.resultado;

    procesarCliente.cliente = cliente;
    procesarCliente.gestion = gestion;
    procesarCliente.config = CONFIG_PROCESAR_CLIENTE[cliente] || CONFIG_PROCESAR_POR_DEFECTO;
    procesarCliente.entradas = {};
    procesarCliente.viajes = resultado ? resultado.viajes.filter(function(v){
        return v.accion === "PROCESAR" && v.gestion === gestion && (v.cliente || "SIN CLIENTE") === cliente;
    }) : [];

    const viajes = procesarCliente.viajes;
    const peso = viajes.reduce(function(s, v){ return s + v.peso_tn; }, 0);
    const skus = viajes.reduce(function(s, v){ return s + (v.cantidad_skus || 0); }, 0);

    // Encabezado: el cliente y sus viajes.
    document.getElementById("pcCliente").textContent = cliente;
    document.getElementById("pcResumen").innerHTML =
        '<span class="pc-chip">' + escaparHtml(gestion) + '</span>' +
        '<span class="pc-chip">' + textoCantidadViajes(viajes.length) + '</span>' +
        '<span class="pc-chip">' + redondear(peso, 2).toFixed(2) + ' TN</span>' +
        '<span class="pc-chip">' + skus + ' SKU\'s</span>';
    document.getElementById("pcViajes").innerHTML = viajes.map(function(v){
        return '<span class="pc-viaje">' + escaparHtml(v.fo) + ' <small>' + v.peso_tn.toFixed(2) + ' TN</small></span>';
    }).join("");

    const definido = procesarCliente.config.entradas.length > 0;

    document.getElementById("pcSinDefinir").style.display = definido ? "none" : "block";
    document.getElementById("pcSalidaBloque").style.display = definido ? "block" : "none";
    document.getElementById("pcAcciones").style.display = definido ? "flex" : "none";

    // Un paso por cada dato que pide este cliente.
    document.getElementById("pcEntradas").innerHTML = procesarCliente.config.entradas.map(function(e, i){
        return (
            '<div class="pc-entrada" id="pcEntrada_' + e.id + '">' +
                '<div class="cv-paso-numero">' + (i + 1) + '</div>' +
                '<h3>' + escaparHtml(e.titulo) + ' <span class="pc-etiqueta">' + escaparHtml(e.etiqueta) + '</span></h3>' +
                '<p>' + escaparHtml(e.ayuda) + '</p>' +
                '<div class="pc-botones">' +
                    '<label class="cv-btn-subir">📤 Subir Excel' +
                        '<input type="file" accept=".xlsx,.xls,.csv" onchange="leerEntradaArchivo(this, \'' + e.id + '\')">' +
                    '</label>' +
                    '<button class="cv-btn-secundario" onclick="alternarPegado(\'' + e.id + '\')">📋 Pegar</button>' +
                '</div>' +
                '<textarea class="pc-pegar" id="pcPegar_' + e.id + '" style="display:none;" ' +
                    'placeholder="Pega aquí lo copiado de SAP o del correo (con encabezados)" ' +
                    'onchange="leerEntradaPegada(\'' + e.id + '\')"></textarea>' +
                '<span class="cv-archivo" id="pcEstado_' + e.id + '">Todavía no se cargó</span>' +
            '</div>'
        );
    }).join("");

    if(!definido){
        document.getElementById("pcModal").style.display = "flex";
        return;
    }

    // Detalle de distribución: encabezados listos, vacío hasta generar.
    const columnas = procesarCliente.config.salida.columnas;
    document.getElementById("pcSalidaTitulo").textContent = "📦 " + procesarCliente.config.salida.titulo;
    document.getElementById("pcSalida").innerHTML =
        '<div class="sp-contenedor"><table class="sp-tabla"><thead><tr>' +
            columnas.map(function(c){ return '<th>' + escaparHtml(c) + '</th>'; }).join("") +
        '</tr></thead><tbody><tr><td class="pc-vacio" colspan="' + columnas.length + '">' +
            'Carga los ' + procesarCliente.config.entradas.length + ' datos de arriba y toca <b>Generar</b>: ' +
            'aquí sale el detalle de distribución de los ' + textoCantidadViajes(viajes.length) + '.' +
        '</td></tr></tbody></table></div>';

    actualizarBotonGenerar();
    document.getElementById("pcModal").style.display = "flex";

}

function cerrarProcesarCliente(){
    document.getElementById("pcModal").style.display = "none";
}

function alternarPegado(id){
    const area = document.getElementById("pcPegar_" + id);
    area.style.display = area.style.display === "none" ? "block" : "none";
    if(area.style.display === "block") area.focus();
}

function marcarEntrada(id, nombre, filas){

    const estado = document.getElementById("pcEstado_" + id);
    const datos = filas.length > 1;   // encabezado + al menos una fila

    procesarCliente.entradas[id] = datos ? { nombre: nombre, filas: filas } : null;

    estado.className = "cv-archivo " + (datos ? "cv-ok" : "cv-error");
    estado.textContent = datos
        ? "✅ " + nombre + " · " + (filas.length - 1) + " filas"
        : "❌ " + nombre + ": no tiene filas (¿falta el encabezado?)";

    document.getElementById("pcEntrada_" + id).classList.toggle("pc-lista", datos);
    actualizarBotonGenerar();

}

async function leerEntradaArchivo(input, id){

    const archivo = input.files && input.files[0];
    if(!archivo) return;

    try{
        const buffer = await archivo.arrayBuffer();
        const libro = XLSX.read(buffer, { type: "array" });
        const hoja = libro.Sheets[libro.SheetNames[0]];
        marcarEntrada(id, archivo.name, XLSX.utils.sheet_to_json(hoja, { header: 1, defval: null, raw: true }));
    }catch(error){
        console.error(error);
        marcarEntrada(id, archivo.name, []);
    }

}

// Lo copiado de SAP o de un correo llega separado por tabulaciones.
function leerEntradaPegada(id){

    const filas = document.getElementById("pcPegar_" + id).value
        .split(/\r?\n/)
        .filter(function(l){ return l.trim() !== ""; })
        .map(function(l){ return l.split("\t"); });

    marcarEntrada(id, "Pegado", filas);

}

function actualizarBotonGenerar(){

    const faltan = procesarCliente.config.entradas.filter(function(e){
        return !procesarCliente.entradas[e.id];
    });

    document.getElementById("pcBtnGenerar").disabled = faltan.length > 0;
    document.getElementById("pcFalta").textContent = faltan.length
        ? "Falta: " + faltan.map(function(e){ return e.titulo; }).join(" y ") + "."
        : "Listo para generar.";

}

function generarDetalleDistribucion(){
    alert("El cálculo del detalle de distribución de " + procesarCliente.cliente +
        " se arma cuando tengamos ejemplos reales del VA05 y del correo.");
}

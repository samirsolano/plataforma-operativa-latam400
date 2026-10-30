// ========================================
// PROCESAR CLIENTE (Canal Moderno)
// ========================================
// "⚙️ Procesar cliente" en Cargar Viaje abre este panel con el cliente
// como encabezado y todos sus viajes. Para SUPERMERCADOS PERUANOS hay un
// solo paso: pegar (Ctrl + V) la tabla del correo del cliente, como
// foto (la lee Gemini, gemini-correo.js) o copiada como tabla (se lee
// directo). Cada fila trae PEDIDO → OC → TIPO OC; el pedido se cruza con
// el "Documento modelo" de las entregas (md_entregas) para saber a qué
// viaje va. Con eso sale solo la programación para responder el correo:
// una fila por entrega (F.O, RÓTULO, PEDIDO, O/C, ENTREGAS), que se
// copia con formato y se pega en el correo.
// Cada cliente tiene su configuración en CONFIG_PROCESAR_CLIENTE: mismo
// panel, distinta información.

const procesarCliente = {
    cliente: null,
    gestion: null,
    viajes: [],
    config: null,
    correo: null,       // { titulo, filas: [...] } ya cruzadas con los viajes
    entregas: [],       // md_entregas de los viajes (fo, entrega, documento_modelo)
    programacion: []    // filas de la programación para el correo
};

const CONFIG_PROCESAR_CLIENTE = {
    "SUPERMERCADOS PERUANOS S.A.": {
        pegado: {
            titulo: "Detalle del correo",
            ayuda: "Copia la tabla del correo de SPSA (o una captura de ella) y pégala aquí con Ctrl + V."
        },
        salida: {
            titulo: "Programación para el correo",
            columnas: ["F.O", "RÓTULO", "PEDIDO", "O/C", "ENTREGAS"]
        }
    }
};

// Rótulo de la programación según el tipo de OC.
const ROTULOS_TIPO_OC = {
    "FLUJO": "Flujo Continuo",
    "ALMACENAJE": "Almacenaje",
    "JOKER": "Joker"
};

// Encabezados de la tabla del correo → clave de cada fila.
const COLUMNAS_CORREO = {
    "TIPO": "tipo",
    "LOCAL DE ENTREGA": "local_entrega",
    "TIPO OC": "tipo_oc",
    "OC": "oc",
    "PEDIDO": "pedido",
    "FECHA DE ENTREGA": "fecha_entrega",
    "CENTRO": "centro",
    "TM'S": "tm",
    "PEN": "pen",
    "UCO'S": "ucos"
};

// Ctrl + V en cualquier parte del panel.
document.getElementById("pcModal").addEventListener("paste", function(evento){

    if(!procesarCliente.config || !procesarCliente.config.pegado){
        return;
    }

    const items = Array.from((evento.clipboardData && evento.clipboardData.items) || []);
    const imagen = items.find(function(i){ return i.type.indexOf("image/") === 0; });

    if(imagen){
        evento.preventDefault();
        leerImagenCorreo(imagen.getAsFile());
        return;
    }

    const texto = evento.clipboardData.getData("text/plain");

    if(texto){
        evento.preventDefault();
        leerTextoCorreo(texto);
    }

});

function abrirProcesarCliente(gestion, cliente){

    const resultado = cargaViaje.resultado;

    procesarCliente.cliente = cliente;
    procesarCliente.gestion = gestion;
    procesarCliente.config = CONFIG_PROCESAR_CLIENTE[cliente] || null;
    procesarCliente.correo = null;
    procesarCliente.entregas = [];
    procesarCliente.programacion = [];
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
    pintarViajesCliente();

    const definido = !!procesarCliente.config;

    document.getElementById("pcSinDefinir").style.display = definido ? "none" : "block";
    document.getElementById("pcEntradas").style.display = definido ? "block" : "none";
    document.getElementById("pcSalidaBloque").style.display = definido ? "block" : "none";

    if(definido){

        const pegado = procesarCliente.config.pegado;

        document.getElementById("pcEntradas").innerHTML =
            '<div class="pc-zona" id="pcZona" tabindex="0">' +
                '<div class="pc-zona-icono">📋</div>' +
                '<h3>' + escaparHtml(pegado.titulo) + '</h3>' +
                '<p>' + escaparHtml(pegado.ayuda) + '</p>' +
                '<label class="pc-zona-subir">o sube la imagen' +
                    '<input type="file" accept="image/*" onchange="if(this.files[0]) leerImagenCorreo(this.files[0])">' +
                '</label>' +
            '</div>' +
            '<span class="cv-archivo" id="pcEstado"></span>' +
            '<div id="pcLeido"></div>';

        const columnas = procesarCliente.config.salida.columnas;

        document.getElementById("pcSalidaTitulo").textContent = "📦 " + procesarCliente.config.salida.titulo;
        document.getElementById("pcSalida").innerHTML =
            '<div class="sp-contenedor"><table class="sp-tabla"><thead><tr>' +
                columnas.map(function(c){ return '<th>' + escaparHtml(c) + '</th>'; }).join("") +
            '</tr></thead><tbody><tr><td class="pc-vacio" colspan="' + columnas.length + '">' +
                'Pega la tabla del correo: aquí sale la programación de los ' +
                textoCantidadViajes(viajes.length) + '.' +
            '</td></tr></tbody></table></div>';

        document.getElementById("pcBtnCopiar").disabled = true;

    }

    document.getElementById("pcModal").style.display = "flex";

    if(definido){
        document.getElementById("pcZona").focus();
    }

}

function cerrarProcesarCliente(){
    document.getElementById("pcModal").style.display = "none";
}

// Los viajes del encabezado; si ya se leyó el correo, en verde los que
// tienen pedidos en él y en rojo los que no.
function pintarViajesCliente(){

    const conPedido = new Set();

    if(procesarCliente.correo){
        procesarCliente.correo.filas.forEach(function(f){
            f.viajes.forEach(function(fo){ conPedido.add(fo); });
        });
    }

    document.getElementById("pcViajes").innerHTML = procesarCliente.viajes.map(function(v){
        const clase = !procesarCliente.correo ? "" : conPedido.has(v.fo) ? " pc-viaje-ok" : " pc-viaje-falta";
        return '<span class="pc-viaje' + clase + '">' + escaparHtml(v.fo) +
            ' <small>' + v.peso_tn.toFixed(2) + ' TN</small></span>';
    }).join("");

}

function estadoCorreo(clase, texto){
    const estado = document.getElementById("pcEstado");
    estado.className = "cv-archivo " + clase;
    estado.textContent = texto;
}

// ----- Foto: la lee Gemini -----

function leerImagenCorreo(archivo){

    const lector = new FileReader();

    lector.onload = async function(){

        const dataUrl = lector.result;
        const base64 = dataUrl.split(",")[1];

        document.getElementById("pcZona").classList.add("pc-zona-leyendo");
        document.getElementById("pcLeido").innerHTML =
            '<img class="pc-miniatura" src="' + dataUrl + '" alt="Tabla del correo">';
        estadoCorreo("", "⏳ Leyendo la imagen... (puede tardar unos segundos)");

        try{
            const datos = await leerTablaCorreoConGemini(base64, archivo.type || "image/png");
            await cargarCorreo(datos.titulo, datos.filas, "la imagen");
        }catch(error){
            console.error(error);
            estadoCorreo("cv-error", "❌ No se pudo leer: " + (error.message || error) +
                " También puedes copiar la tabla del correo como texto y pegarla.");
        }finally{
            document.getElementById("pcZona").classList.remove("pc-zona-leyendo");
        }

    };

    lector.readAsDataURL(archivo);

}

// ----- Tabla copiada como texto (columnas separadas por tabulación) -----

function leerTextoCorreo(texto){

    const lineas = texto.split(/\r?\n/).map(function(l){ return l.split("\t"); });

    const iEncabezado = lineas.findIndex(function(celdas){
        const limpias = celdas.map(limpiarTexto);
        return limpias.indexOf("PEDIDO") !== -1 && limpias.indexOf("OC") !== -1;
    });

    if(iEncabezado === -1){
        estadoCorreo("cv-error", "❌ No se encontró la tabla: lo pegado debe incluir los encabezados (PEDIDO, OC...).");
        return;
    }

    const claves = lineas[iEncabezado].map(function(c){ return COLUMNAS_CORREO[limpiarTexto(c)] || null; });
    const titulo = lineas.slice(0, iEncabezado)
        .map(function(c){ return c.join(" ").trim(); })
        .filter(function(t){ return t; })
        .pop() || "";

    const filas = lineas.slice(iEncabezado + 1)
        .filter(function(celdas){
            const primera = limpiarTexto(celdas[0]);
            return celdas.join("").trim() !== "" && primera.indexOf("TOTAL") !== 0;
        })
        .map(function(celdas){
            const fila = {};
            claves.forEach(function(clave, i){ if(clave) fila[clave] = (celdas[i] || "").trim(); });
            return fila;
        });

    cargarCorreo(titulo, filas, "la tabla pegada");

}

// ----- Cruce con los viajes del cliente -----

function soloDigitos(valor){
    return String(valor || "").replace(/\D/g, "");
}

function numeroCorreo(valor){
    return Number(String(valor || "").replace(/,/g, "")) || 0;
}

// Misma regla que la plantilla: A → ALMACENAJE, J → JOKER, lo demás FLUJO.
function tipoOcPlataforma(tipoOc){
    const letra = limpiarTexto(tipoOc).charAt(0);
    return letra === "A" ? "ALMACENAJE" : letra === "J" ? "JOKER" : "FLUJO";
}

async function cargarCorreo(titulo, filasLeidas, origen){

    const filas = (filasLeidas || []).map(function(f){
        return {
            tipo: String(f.tipo || "").trim(),
            local_entrega: String(f.local_entrega || "").trim(),
            tipo_oc: String(f.tipo_oc || "").trim(),
            tipo_oc_plataforma: tipoOcPlataforma(f.tipo_oc),
            oc: soloDigitos(f.oc),
            pedido: soloDigitos(f.pedido),
            fecha_entrega: String(f.fecha_entrega || "").trim(),
            centro: String(f.centro || "").trim(),
            tm: numeroCorreo(f.tm),
            pen: numeroCorreo(f.pen),
            ucos: numeroCorreo(f.ucos),
            viajes: []
        };
    }).filter(function(f){ return f.pedido; });

    if(filas.length === 0){
        estadoCorreo("cv-error", "❌ En " + origen + " no se encontraron pedidos.");
        return;
    }

    estadoCorreo("", "⏳ Cruzando los pedidos con los viajes...");

    // Pedido (Documento modelo de la entrega) → viajes del cliente.
    try{

        const fos = procesarCliente.viajes.map(function(v){ return '"' + v.fo + '"'; }).join(",");
        const entregas = fos ? await supabaseFetch(
            "/md_entregas?fo=in.(" + encodeURIComponent(fos) + ")&select=fo,entrega,documento_modelo&order=fo,entrega"
        ) : [];

        const viajesPorPedido = {};

        (entregas || []).forEach(function(e){
            const pedido = soloDigitos(e.documento_modelo);
            if(!pedido) return;
            viajesPorPedido[pedido] = viajesPorPedido[pedido] || [];
            if(viajesPorPedido[pedido].indexOf(e.fo) === -1) viajesPorPedido[pedido].push(e.fo);
        });

        filas.forEach(function(f){ f.viajes = viajesPorPedido[f.pedido] || []; });
        procesarCliente.entregas = entregas || [];

    }catch(error){
        console.error(error);
        estadoCorreo("cv-error", "❌ Se leyó el correo, pero no se pudo cruzar con los viajes: " + (error.message || error));
        return;
    }

    procesarCliente.correo = { titulo: titulo || "", filas: filas };

    const cruzan = filas.filter(function(f){ return f.viajes.length; }).length;

    estadoCorreo(cruzan === filas.length ? "cv-ok" : "cv-error",
        (cruzan === filas.length ? "✅ " : "⚠️ ") + "Se leyeron " + filas.length + " pedidos de " + origen +
        " · " + cruzan + " están en los viajes de este cliente" +
        (cruzan < filas.length ? " · " + (filas.length - cruzan) + " no" : "") + ".");

    document.getElementById("pcZona").classList.add("pc-zona-lista");
    pintarCorreoLeido();
    pintarViajesCliente();
    generarProgramacion();

}

function pintarCorreoLeido(){

    const correo = procesarCliente.correo;
    const miniatura = document.querySelector("#pcLeido .pc-miniatura");
    const totalTm = correo.filas.reduce(function(s, f){ return s + f.tm; }, 0);
    const totalUcos = correo.filas.reduce(function(s, f){ return s + f.ucos; }, 0);

    const conPedido = new Set();
    correo.filas.forEach(function(f){ f.viajes.forEach(function(fo){ conPedido.add(fo); }); });
    const sinPedido = procesarCliente.viajes.filter(function(v){ return !conPedido.has(v.fo); });

    let html =
        '<div class="pc-leido-header">' +
            '<h3>📨 ' + escaparHtml(correo.titulo || "Detalle del correo") + '</h3>' +
            '<span>Revisa que coincida con el correo: total leído <b>' + totalTm.toFixed(2) + ' TM</b> · <b>' +
                totalUcos.toLocaleString("es-PE") + ' UCO\'s</b></span>' +
        '</div>' +
        '<div class="sp-contenedor pc-leido"><table class="sp-tabla"><thead><tr>' +
            '<th>TIPO</th><th>LOCAL DE ENTREGA</th><th>TIPO OC</th><th>OC</th><th>PEDIDO</th>' +
            '<th>FECHA DE ENTREGA</th><th>TM\'s</th><th>UCO\'s</th><th>VIAJE</th>' +
        '</tr></thead><tbody>';

    correo.filas.forEach(function(f){
        html +=
            '<tr' + (f.viajes.length ? '' : ' class="pc-sin-viaje"') + '>' +
                '<td class="sp-izq">' + escaparHtml(f.tipo) + '</td>' +
                '<td class="sp-izq">' + escaparHtml(f.local_entrega) + '</td>' +
                '<td>' + escaparHtml(f.tipo_oc) + ' <small class="pc-tipo-' + f.tipo_oc_plataforma.toLowerCase() + '">' + f.tipo_oc_plataforma + '</small></td>' +
                '<td>' + escaparHtml(f.oc) + '</td>' +
                '<td>' + escaparHtml(f.pedido) + '</td>' +
                '<td>' + escaparHtml(f.fecha_entrega) + '</td>' +
                '<td class="sp-num">' + f.tm.toFixed(2) + '</td>' +
                '<td class="sp-num">' + f.ucos.toLocaleString("es-PE") + '</td>' +
                '<td>' + (f.viajes.length ? f.viajes.map(escaparHtml).join(", ") : '⚠️ no está en estos viajes') + '</td>' +
            '</tr>';
    });

    html += '</tbody></table></div>';

    if(sinPedido.length){
        html += '<div class="cv-aviso">' + (sinPedido.length === 1 ? "El viaje " : "Los viajes ") +
            '<b>' + sinPedido.map(function(v){ return escaparHtml(v.fo); }).join(", ") + '</b> no ' +
            (sinPedido.length === 1 ? "tiene" : "tienen") + ' ningún pedido en este correo.</div>';
    }

    document.getElementById("pcLeido").innerHTML = html;

    if(miniatura){
        document.getElementById("pcLeido").insertBefore(miniatura, document.getElementById("pcLeido").firstChild);
    }

}

// ----- Programación para el correo -----
// Una fila por entrega de los viajes: F.O, RÓTULO (tipo de OC), PEDIDO
// (Documento modelo de la entrega), O/C y ENTREGAS. El rótulo y la O/C
// salen de la fila del correo con ese pedido.

function generarProgramacion(){

    const porPedido = {};
    procesarCliente.correo.filas.forEach(function(f){ porPedido[f.pedido] = f; });

    procesarCliente.programacion = procesarCliente.entregas.map(function(e){
        const pedido = soloDigitos(e.documento_modelo);
        const delCorreo = porPedido[pedido];
        return {
            fo: e.fo,
            rotulo: delCorreo ? ROTULOS_TIPO_OC[delCorreo.tipo_oc_plataforma] : "",
            pedido: pedido,
            oc: delCorreo ? delCorreo.oc : "",
            entrega: e.entrega
        };
    }).sort(function(a, b){
        return a.fo.localeCompare(b.fo) || a.pedido.localeCompare(b.pedido) || a.entrega.localeCompare(b.entrega);
    });

    const filas = procesarCliente.programacion;
    const sinOc = filas.filter(function(f){ return !f.oc; });

    let html =
        '<div class="sp-contenedor pc-programacion"><table class="sp-tabla"><thead><tr>' +
            procesarCliente.config.salida.columnas.map(function(c){ return '<th>' + c + '</th>'; }).join("") +
        '</tr></thead><tbody>';

    filas.forEach(function(f){
        html +=
            '<tr' + (f.oc ? '' : ' class="pc-sin-viaje"') + '>' +
                '<td><b>' + escaparHtml(f.fo) + '</b></td>' +
                '<td><b>' + (f.rotulo ? escaparHtml(f.rotulo) : '⚠️ no está en el correo') + '</b></td>' +
                '<td>' + escaparHtml(f.pedido) + '</td>' +
                '<td><b>' + escaparHtml(f.oc) + '</b></td>' +
                '<td>' + escaparHtml(f.entrega) + '</td>' +
            '</tr>';
    });

    html += '</tbody></table></div>';

    if(sinOc.length){
        html = '<div class="cv-aviso">⚠️ <b>' + sinOc.length + (sinOc.length === 1 ? ' entrega' : ' entregas') +
            '</b> tienen un pedido que no está en el correo (sin rótulo ni O/C). Revisa el correo antes de copiar.</div>' + html;
    }

    document.getElementById("pcSalidaTitulo").textContent = "📦 " + procesarCliente.config.salida.titulo +
        " · " + filas.length + (filas.length === 1 ? " entrega" : " entregas");
    document.getElementById("pcSalida").innerHTML = html;
    document.getElementById("pcBtnCopiar").disabled = filas.length === 0;

}

// Copia la programación con el formato del correo (encabezado azul,
// F.O y O/C en negrita), lista para pegar en Outlook; también como
// texto con tabulaciones por si se pega en Excel.
function copiarProgramacion(){

    const filas = procesarCliente.programacion;
    const boton = document.getElementById("pcBtnCopiar");
    const columnas = procesarCliente.config.salida.columnas;

    const th = 'style="background:#1f3864;color:#ffffff;font-weight:bold;padding:3px 14px;border:1px solid #ffffff;font-family:Calibri,Arial,sans-serif;font-size:11pt;text-align:center"';
    const td = function(negrita){
        return 'style="padding:1px 14px;border:1px solid #d9d9d9;font-family:Calibri,Arial,sans-serif;font-size:11pt;text-align:center' +
            (negrita ? ';font-weight:bold' : '') + '"';
    };

    const html =
        '<p style="font-family:Calibri,Arial,sans-serif;font-size:11pt;margin:0 0 4px">Considerar la siguiente programación:</p>' +
        '<table style="border-collapse:collapse"><thead><tr>' +
            columnas.map(function(c){ return '<th ' + th + '>' + c + '</th>'; }).join("") +
        '</tr></thead><tbody>' +
        filas.map(function(f){
            return '<tr>' +
                '<td ' + td(true) + '>' + escaparHtml(f.fo) + '</td>' +
                '<td ' + td(true) + '>' + escaparHtml(f.rotulo) + '</td>' +
                '<td ' + td(false) + '>' + escaparHtml(f.pedido) + '</td>' +
                '<td ' + td(true) + '>' + escaparHtml(f.oc) + '</td>' +
                '<td ' + td(false) + '>' + escaparHtml(f.entrega) + '</td>' +
            '</tr>';
        }).join("") +
        '</tbody></table>';

    const texto = "Considerar la siguiente programación:\n" + columnas.join("\t") + "\n" +
        filas.map(function(f){ return [f.fo, f.rotulo, f.pedido, f.oc, f.entrega].join("\t"); }).join("\n");

    function avisarCopiado(){
        boton.textContent = "✅ Copiado: pégalo en el correo";
        setTimeout(function(){ boton.textContent = "📋 Copiar para correo"; }, 3000);
    }

    // Si el portapapeles con formato no está disponible, se copia
    // seleccionando la tabla armada en un bloque temporal.
    function copiarConSeleccion(){
        const bloque = document.createElement("div");
        bloque.innerHTML = html;
        bloque.style.position = "fixed";
        bloque.style.left = "-9999px";
        document.body.appendChild(bloque);
        const rango = document.createRange();
        rango.selectNodeContents(bloque);
        const seleccion = window.getSelection();
        seleccion.removeAllRanges();
        seleccion.addRange(rango);
        const ok = document.execCommand("copy");
        seleccion.removeAllRanges();
        document.body.removeChild(bloque);
        if(ok) avisarCopiado();
        else alert("No se pudo copiar la programación.");
    }

    if(navigator.clipboard && window.ClipboardItem){
        navigator.clipboard.write([new ClipboardItem({
            "text/html": new Blob([html], { type: "text/html" }),
            "text/plain": new Blob([texto], { type: "text/plain" })
        })]).then(avisarCopiado).catch(copiarConSeleccion);
    }else{
        copiarConSeleccion();
    }

}

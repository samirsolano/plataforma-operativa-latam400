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
        },
        // Al subir, el cliente del viaje lleva su tipo de OC, como en el
        // Drive: SUPERMERCADOS PERUANOS S.A. (ALMACENAJE) / (FC).
        sufijos: {
            FLUJO: "(FC)",
            ALMACENAJE: "(ALMACENAJE)",
            JOKER: "(JOKER)"
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
        document.getElementById("pcSubir").innerHTML = "";

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
        estadoCorreo("", "⏳ Leyendo la imagen... (puede tardar unos segundos)");

        try{
            const datos = await leerTablaCorreoConGemini(base64, archivo.type || "image/png");
            await cargarCorreo(datos.titulo, datos.filas, "imagen", dataUrl);
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

    cargarCorreo(titulo, filas, "tabla", null);

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

// Se pueden pegar varios correos (fotos o tablas), uno tras otro: cada
// uno suma sus pedidos a los anteriores, por si a uno le falta un
// pedido que vino en otro correo. Un pedido que ya estaba no se repite.
async function cargarCorreo(titulo, filasLeidas, origen, miniatura){

    const numero = procesarCliente.correo ? procesarCliente.correo.pegados.length + 1 : 1;

    const leidas = (filasLeidas || []).map(function(f){
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
            correo: numero,
            viajes: []
        };
    }).filter(function(f){ return f.pedido; });

    if(leidas.length === 0){
        estadoCorreo("cv-error", "❌ En la " + origen + " no se encontraron pedidos.");
        return;
    }

    estadoCorreo("", "⏳ Cruzando los pedidos con los viajes...");

    // Las entregas de los viajes se leen una sola vez (al primer correo).
    if(!procesarCliente.correo){
        try{
            const fos = procesarCliente.viajes.map(function(v){ return '"' + v.fo + '"'; }).join(",");
            procesarCliente.entregas = (fos ? await supabaseFetch(
                "/md_entregas?fo=in.(" + encodeURIComponent(fos) + ")&select=fo,entrega,documento_modelo&order=fo,entrega"
            ) : []) || [];
        }catch(error){
            console.error(error);
            estadoCorreo("cv-error", "❌ Se leyó el correo, pero no se pudo cruzar con los viajes: " + (error.message || error));
            return;
        }
        procesarCliente.correo = { filas: [], pegados: [] };
    }

    // Se suman los pedidos nuevos; los que ya estaban no se repiten.
    const correo = procesarCliente.correo;
    const yaEstaban = new Set(correo.filas.map(function(f){ return f.pedido; }));
    const nuevas = leidas.filter(function(f){
        if(yaEstaban.has(f.pedido)) return false;
        yaEstaban.add(f.pedido);
        return true;
    });

    correo.filas = correo.filas.concat(nuevas);
    correo.pegados.push({
        numero: numero,
        origen: origen,
        titulo: titulo || "",
        leidos: leidas.length,
        nuevos: nuevas.length,
        miniatura: miniatura
    });

    // Pedido (Documento modelo de la entrega) → viajes del cliente.
    const viajesPorPedido = {};

    procesarCliente.entregas.forEach(function(e){
        const pedido = soloDigitos(e.documento_modelo);
        if(!pedido) return;
        viajesPorPedido[pedido] = viajesPorPedido[pedido] || [];
        if(viajesPorPedido[pedido].indexOf(e.fo) === -1) viajesPorPedido[pedido].push(e.fo);
    });

    correo.filas.forEach(function(f){ f.viajes = viajesPorPedido[f.pedido] || []; });

    const repetidos = leidas.length - nuevas.length;
    const cruzan = correo.filas.filter(function(f){ return f.viajes.length; }).length;

    estadoCorreo(cruzan === correo.filas.length ? "cv-ok" : "cv-error",
        (cruzan === correo.filas.length ? "✅ " : "⚠️ ") +
        "Correo " + numero + " (" + origen + "): " + leidas.length + " pedidos" +
        (numero > 1 ? ", " + nuevas.length + (nuevas.length === 1 ? " nuevo" : " nuevos") +
            (repetidos ? ", " + repetidos + (repetidos === 1 ? " ya estaba" : " ya estaban") : "") : "") +
        " · Total " + correo.filas.length + " pedidos, " + cruzan + " en los viajes de este cliente" +
        (cruzan < correo.filas.length ? " (" + (correo.filas.length - cruzan) + " no)" : "") + ".");

    const zona = document.getElementById("pcZona");
    zona.classList.add("pc-zona-lista");
    zona.querySelector("h3").textContent = "➕ ¿Falta algún pedido? Pega otro correo aquí (Ctrl + V)";

    pintarCorreoLeido();
    pintarViajesCliente();
    generarProgramacion();

}

// Borra los correos pegados para empezar de nuevo.
function reiniciarCorreos(){

    procesarCliente.correo = null;
    procesarCliente.programacion = [];

    abrirProcesarCliente(procesarCliente.gestion, procesarCliente.cliente);

}

function pintarCorreoLeido(){

    const correo = procesarCliente.correo;
    const varios = correo.pegados.length > 1;

    const conPedido = new Set();
    correo.filas.forEach(function(f){ f.viajes.forEach(function(fo){ conPedido.add(fo); }); });
    const sinPedido = procesarCliente.viajes.filter(function(v){ return !conPedido.has(v.fo); });

    // Los correos pegados, cada uno con su miniatura (si fue foto) y el
    // total leído, para compararlo con el total del correo.
    let html =
        '<div class="pc-pegados">' +
            correo.pegados.map(function(p){
                const filas = correo.filas.filter(function(f){ return f.correo === p.numero; });
                const tm = filas.reduce(function(s, f){ return s + f.tm; }, 0);
                const ucos = filas.reduce(function(s, f){ return s + f.ucos; }, 0);
                return (
                    '<div class="pc-pegado">' +
                        (p.miniatura ? '<img src="' + p.miniatura + '" alt="Correo ' + p.numero + '">' : '<div class="pc-pegado-texto">📋</div>') +
                        '<div>' +
                            '<b>Correo ' + p.numero + '</b> · ' + p.origen +
                            (p.titulo ? '<br><span>' + escaparHtml(p.titulo) + '</span>' : '') +
                            '<br><span>' + p.leidos + ' pedidos' +
                                (p.numero > 1 ? ' (' + p.nuevos + (p.nuevos === 1 ? ' nuevo' : ' nuevos') + ')' : '') +
                                ' · ' + tm.toFixed(2) + ' TM · ' + ucos.toLocaleString("es-PE") + ' UCO\'s</span>' +
                        '</div>' +
                    '</div>'
                );
            }).join("") +
            '<button class="cv-btn-secundario" onclick="reiniciarCorreos()">↺ Empezar de nuevo</button>' +
        '</div>';

    if(sinPedido.length){
        html += '<div class="cv-aviso">' + (sinPedido.length === 1 ? "El viaje " : "Los viajes ") +
            '<b>' + sinPedido.map(function(v){ return escaparHtml(v.fo); }).join(", ") + '</b> no ' +
            (sinPedido.length === 1 ? "tiene" : "tienen") + ' ningún pedido en ' +
            (varios ? 'estos correos' : 'este correo') + '.</div>';
    }

    // Pedidos del correo que no van en ninguno de estos viajes.
    const ajenos = correo.filas.filter(function(f){ return !f.viajes.length; });

    if(ajenos.length){
        html += '<div class="cv-aviso">' + (ajenos.length === 1 ? "El pedido " : "Los pedidos ") +
            '<b>' + ajenos.map(function(f){ return escaparHtml(f.pedido); }).join(", ") + '</b> del correo no ' +
            (ajenos.length === 1 ? "está" : "están") + ' en ninguno de estos viajes.</div>';
    }

    document.getElementById("pcLeido").innerHTML = html;

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
            tipo: delCorreo ? delCorreo.tipo_oc_plataforma : "",
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
            '</b> tienen un pedido que no está en los correos pegados (sin rótulo ni O/C). Si viene en otro correo, pégalo arriba y se completan solas.</div>' + html;
    }

    document.getElementById("pcSalidaTitulo").textContent = "📦 " + procesarCliente.config.salida.titulo +
        " · " + filas.length + (filas.length === 1 ? " entrega" : " entregas");
    document.getElementById("pcSalida").innerHTML = html;
    document.getElementById("pcBtnCopiar").disabled = filas.length === 0;
    pintarSubida();

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

// ----- Subir a Status Pendiente -----
// Con el correo ya se sabe el tipo de OC de cada viaje: al subirlo, el
// cliente queda con su sufijo, como en el Drive (ej. SUPERMERCADOS
// PERUANOS S.A. (ALMACENAJE) / (FC)). Un viaje con entregas de dos
// tipos distintos no se sube: hay que revisarlo.

function subidaPorViaje(){

    const sufijos = procesarCliente.config.sufijos || {};

    return procesarCliente.viajes.map(function(v){

        const filas = procesarCliente.programacion.filter(function(f){ return f.fo === v.fo; });
        const tipos = Array.from(new Set(filas.map(function(f){ return f.tipo; }).filter(function(t){ return t; })));
        const sinOc = filas.filter(function(f){ return !f.oc; }).length;
        const base = procesarCliente.cliente;

        const item = { viaje: v, tipos: tipos, sinOc: sinOc, entregas: filas.length, nombre: null, problema: null };

        if(v.estado === "SUBIDO"){
            item.problema = "subido";
        }else if(tipos.length === 0){
            item.problema = "Ninguna entrega está en los correos pegados.";
        }else if(tipos.length > 1){
            item.problema = "Tiene entregas de " + tipos.map(function(t){ return ROTULOS_TIPO_OC[t]; }).join(" y ") + ": revísalo.";
        }else{
            item.nombre = base + (sufijos[tipos[0]] ? " " + sufijos[tipos[0]] : "");
        }

        return item;

    });

}

function pintarSubida(){

    const items = subidaPorViaje();
    const listos = items.filter(function(i){ return i.nombre; });

    let html =
        '<div class="pc-salida-header">' +
            '<h3>☁️ Subir a Status Pendiente</h3>' +
            '<button class="cv-btn-procesar-todo" id="pcBtnSubir" ' + (listos.length ? '' : 'disabled ') +
                'onclick="subirViajesCliente()">☁️ Subir ' + textoCantidadViajes(listos.length) + '</button>' +
        '</div>' +
        '<div class="sp-contenedor"><table class="sp-tabla"><thead><tr>' +
            '<th>VIAJE</th><th>RÓTULO</th><th>CLIENTE AL SUBIR</th><th>ENTREGAS</th><th></th>' +
        '</tr></thead><tbody>';

    items.forEach(function(i){
        html +=
            '<tr' + (i.problema && i.problema !== "subido" ? ' class="pc-sin-viaje"' : '') + '>' +
                '<td><b>' + escaparHtml(i.viaje.fo) + '</b></td>' +
                '<td>' + (i.tipos.map(function(t){ return ROTULOS_TIPO_OC[t]; }).join(" / ") || "-") + '</td>' +
                '<td class="sp-izq"><b>' + escaparHtml(i.problema === "subido" ? i.viaje.cliente : (i.nombre || "-")) + '</b></td>' +
                '<td>' + i.entregas + (i.sinOc ? ' <span class="pc-falta-oc">(' + i.sinOc + ' sin O/C)</span>' : '') + '</td>' +
                '<td class="sp-izq">' +
                    (i.problema === "subido" ? '✅ Subido'
                        : i.problema ? '⚠️ ' + escaparHtml(i.problema)
                        : 'Listo') +
                '</td>' +
            '</tr>';
    });

    html += '</tbody></table></div>';

    document.getElementById("pcSubir").innerHTML = html;

}

async function subirViajesCliente(){

    const listos = subidaPorViaje().filter(function(i){ return i.nombre; });
    const conFaltas = listos.filter(function(i){ return i.sinOc; });

    if(listos.length === 0){
        return;
    }

    if(conFaltas.length && !confirm(
        (conFaltas.length === 1 ? "El viaje " + conFaltas[0].viaje.fo + " tiene" : conFaltas.length + " viajes tienen") +
        " entregas sin O/C (su pedido no está en los correos pegados). ¿Subir igual?"
    )){
        return;
    }

    const boton = document.getElementById("pcBtnSubir");
    boton.disabled = true;
    boton.textContent = "⏳ Subiendo...";

    // Un pedido por cada nombre de cliente (ALMACENAJE, FC...).
    const porNombre = {};
    listos.forEach(function(i){ (porNombre[i.nombre] = porNombre[i.nombre] || []).push(i.viaje); });

    const ahora = new Date().toISOString();
    const confirmados = {};

    try{

        for(const nombre of Object.keys(porNombre)){

            const lista = porNombre[nombre].map(function(v){ return '"' + v.fo + '"'; }).join(",");

            const subidos = await supabaseFetch(
                "/md_viajes?fo=in.(" + encodeURIComponent(lista) + ")&estado=neq.SUBIDO",
                {
                    method: "PATCH",
                    headers: { "Prefer": "return=representation" },
                    body: JSON.stringify({
                        cliente: nombre,
                        estado: "SUBIDO",
                        fecha_subida: ahora,
                        subido_por: sesion ? sesion.nombre_completo : null,
                        status: "POR LANZAR",
                        status_modulado: "PENDIENTE",
                        status_despacho: "PENDIENTE",
                        status_ut: "PENDIENTE",
                        actualizado_en: ahora
                    })
                }
            );

            (subidos || []).forEach(function(v){ confirmados[v.fo] = nombre; });

            await supabaseFetch("/md_entregas?fo=in.(" + encodeURIComponent(lista) + ")", {
                method: "PATCH",
                headers: { "Prefer": "return=minimal" },
                body: JSON.stringify({ cliente_nombre: nombre, actualizado_en: ahora })
            });

        }

    }catch(error){

        console.error(error);
        alert("No se pudo subir: " + (error.message || error));

    }

    // Los viajes del panel son los mismos de Cargar Viaje: se actualizan
    // ahí también (cliente nuevo y SUBIDO).
    procesarCliente.viajes.forEach(function(v){
        if(confirmados[v.fo]){
            v.cliente = confirmados[v.fo];
            v.estado = "SUBIDO";
        }
    });

    pintarSubida();

    if(cargaViaje.resultado){
        pintarViajesProcesados(cargaViaje.resultado, true);
        buscarSinSubir();
    }

    const cuantos = Object.keys(confirmados).length;

    if(cuantos < listos.length){
        alert("Se subieron " + cuantos + " de " + listos.length +
            " viajes. Los demás ya estaban subidos o no se encontraron: revisa Status Pendiente.");
    }

}

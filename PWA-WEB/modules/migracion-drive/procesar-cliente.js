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
// Cada cliente tiene su configuración (configDeCliente): mismo panel,
// distinta información.
//   columnas: encabezado de la tabla del correo (normalizado, ver
//             normalizarEncabezado) → dato. Los que importan son pedido
//             y oc; el resto es para el resumen.
//   modo:     qué sale después de pegar el correo:
//     "programacion" (SPSA): la programación para responder el correo
//                    y subir con el cliente (ALMACENAJE) / (FC).
//     "lineas" (Tottus): las líneas del viaje (negocio × rótulo × peso)
//                    como en el Drive; el negocio sale del correo y el
//                    rótulo de md_entregas_rotulo (calculado al procesar).
//
// TOTTUS: además de los dos pasos de arriba, la plantilla F-LAT-058
// arma el ASN (packing list) y la validación de picking; eso queda
// para después.

const procesarCliente = {
    cliente: null,
    gestion: null,
    viajes: [],
    config: null,
    correo: null,       // { filas: [...], pegados: [...] } ya cruzadas con los viajes
    entregas: [],       // md_entregas de los viajes (fo, entrega, documento_modelo)
    programacion: [],   // modo "programacion": filas para el correo
    lineas: []          // modo "lineas": líneas del viaje (fo, cliente, rotulo, peso_kg)
};

const CONFIG_SPSA = {
    modo: "programacion",
    pegado: {
        titulo: "Detalle del correo",
        ayuda: "Copia la tabla del correo de SPSA (o una captura de ella) y pégala aquí con Ctrl + V."
    },
    columnas: {
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
};

// Correo de Tottus (hoja CORREO de la plantilla F-LAT-058).
const CONFIG_TOTTUS = {
    modo: "lineas",
    pegado: {
        titulo: "Detalle del correo",
        ayuda: "Copia la tabla del correo de Tottus (o una captura de ella) y pégala aquí con Ctrl + V."
    },
    // En el correo real la columna del negocio se llama "Portafolio"
    // (en la plantilla, "Negocio"): se aceptan las dos.
    columnas: {
        "NEGOCIO": "negocio",
        "PORTAFOLIO": "negocio",
        "TIENDAS": "local_entrega",
        "TIPO": "tipo_oc",
        "REFERENCIA DE CLIENTE": "oc",
        "DOCUMENTO DE VENTAS": "pedido",
        "FEC PREF ENTREGA": "fecha_entrega",
        "STATUS PEDIDO": "status_pedido",
        "CENTRO": "centro",
        "PESO KG": "kg",
        "VALOR NETOS": "pen",
        "CANTIDAD EAN14": "ucos"
    },
    salida: {
        titulo: "Líneas del viaje (como en el Drive)",
        columnas: ["F.O", "CLIENTE", "RÓTULO", "PESO KG", "PESO TN"]
    }
};

const CONFIG_PROCESAR_CLIENTE = {
    "SUPERMERCADOS PERUANOS S.A.": CONFIG_SPSA
};

// Config del cliente: por nombre exacto, o Tottus para cualquier
// cliente con TOTTUS en el nombre (tiene varios: TOTTUS - HUACHIPA
// (SECOS), TOTTUS ORIENTE..., TOTTUS ALICORP LIMPIEZA...).
function configDeCliente(cliente){
    if(CONFIG_PROCESAR_CLIENTE[cliente]) return CONFIG_PROCESAR_CLIENTE[cliente];
    if(limpiarTexto(cliente).indexOf("TOTTUS") !== -1) return CONFIG_TOTTUS;
    return null;
}

// Rótulo de la programación de SPSA según el tipo de OC.
const ROTULOS_TIPO_OC = {
    "FLUJO": "Flujo Continuo",
    "ALMACENAJE": "Almacenaje",
    "JOKER": "Joker"
};

// Encabezados comparables: sin tildes ni símbolos (Nº → N, Fec.Pref. →
// FEC PREF), en mayúsculas y con el apóstrofo recto (UCO’s → UCO'S).
function normalizarEncabezado(texto){
    return String(texto || "")
        .normalize("NFD").replace(/[̀-ͯ]/g, "")
        .replace(/[’`´]/g, "'")
        .toUpperCase()
        .replace(/[^A-Z0-9' ]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

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
    procesarCliente.config = configDeCliente(cliente);
    procesarCliente.correo = null;
    procesarCliente.entregas = [];
    procesarCliente.programacion = [];
    procesarCliente.lineas = [];

    // Tottus junta todos sus viajes (sus nombres varían: TOTTUS -
    // HUACHIPA, TOTTUS ORIENTE...); los demás, solo los de ese cliente.
    const porLineas = procesarCliente.config && procesarCliente.config.modo === "lineas";

    procesarCliente.viajes = resultado ? resultado.viajes.filter(function(v){
        if(v.accion !== "PROCESAR" || v.gestion !== gestion || v.estado === "SUBIDO") return false;
        return porLineas
            ? configDeCliente(v.cliente || "") === procesarCliente.config
            : (v.cliente || "SIN CLIENTE") === cliente;
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
                'Pega la tabla del correo: aquí sale ' + (procesarCliente.config.modo === "lineas" ? 'el detalle de líneas' : 'la programación') + ' de los ' +
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
            await leerTablaCorreo(datos.titulo, [datos.encabezados].concat(datos.filas), "imagen", dataUrl);
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
    leerTablaCorreo("", lineas, "tabla", null);
}

// La tabla del correo (de la foto o pegada), como filas de celdas: busca
// la fila de encabezados con las columnas de este cliente (al menos
// pedido y OC), lee las filas de abajo y salta la de totales. Lo que
// haya arriba del encabezado es el título (ej. CENTRO 1054 - PUNTA NEGRA).
function leerTablaCorreo(titulo, lineas, origen, miniatura){

    const columnas = procesarCliente.config.columnas;
    const claveDe = function(celda){ return columnas[normalizarEncabezado(celda)] || null; };

    const iEncabezado = lineas.findIndex(function(celdas){
        const claves = (celdas || []).map(claveDe);
        return claves.indexOf("pedido") !== -1 && claves.indexOf("oc") !== -1;
    });

    if(iEncabezado === -1){
        estadoCorreo("cv-error", "❌ No se encontró la tabla del correo: tiene que verse con sus encabezados (" +
            Object.keys(columnas).slice(0, 5).join(", ") + "...).");
        return;
    }

    const claves = lineas[iEncabezado].map(claveDe);

    titulo = titulo || lineas.slice(0, iEncabezado)
        .map(function(c){ return c.join(" ").trim(); })
        .filter(function(t){ return t; })
        .pop() || "";

    const filas = lineas.slice(iEncabezado + 1)
        .filter(function(celdas){
            return (celdas || []).join("").trim() !== "" && limpiarTexto(celdas[0]).indexOf("TOTAL") !== 0;
        })
        .map(function(celdas){
            const fila = {};
            claves.forEach(function(clave, i){ if(clave) fila[clave] = String(celdas[i] == null ? "" : celdas[i]).trim(); });
            return fila;
        });

    return cargarCorreo(titulo, filas, origen, miniatura);

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
            negocio: limpiarTexto(f.negocio),
            local_entrega: String(f.local_entrega || "").trim(),
            tipo_oc: String(f.tipo_oc || "").trim(),
            tipo_oc_plataforma: tipoOcPlataforma(f.tipo_oc),
            oc: soloDigitos(f.oc),
            pedido: soloDigitos(f.pedido),
            fecha_entrega: String(f.fecha_entrega || "").trim(),
            centro: String(f.centro || "").trim(),
            // El peso viene en TM (SPSA) o en KG (Tottus, Cencosud).
            tm: f.tm ? numeroCorreo(f.tm) : numeroCorreo(f.kg) / 1000,
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
            // Tottus: el peso de cada entrega por rótulo (calculado al procesar).
            procesarCliente.rotulos = procesarCliente.config.modo === "lineas" && fos
                ? (await supabaseFetch(
                    "/md_entregas_rotulo?fo=in.(" + encodeURIComponent(fos) + ")&select=fo,entrega,rotulo,peso_kg"
                  ) || [])
                : [];
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
    if(procesarCliente.config.modo === "lineas"){
        generarLineas();
    }else{
        generarProgramacion();
    }

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

// Copia una tabla con el formato del correo (encabezado azul y las
// columnas de "negritas" en negrita), lista para pegar en Outlook; también
// como texto con tabulaciones por si se pega en Excel.
function copiarTablaCorreo(boton, textoBoton, intro, columnas, filas, negritas){

    const th = 'style="background:#1f3864;color:#ffffff;font-weight:bold;padding:3px 14px;border:1px solid #ffffff;font-family:Calibri,Arial,sans-serif;font-size:11pt;text-align:center"';
    const td = function(negrita){
        return 'style="padding:1px 14px;border:1px solid #d9d9d9;font-family:Calibri,Arial,sans-serif;font-size:11pt;text-align:center' +
            (negrita ? ';font-weight:bold' : '') + '"';
    };

    const html =
        '<p style="font-family:Calibri,Arial,sans-serif;font-size:11pt;margin:0 0 4px">' + escaparHtml(intro) + '</p>' +
        '<table style="border-collapse:collapse"><thead><tr>' +
            columnas.map(function(c){ return '<th ' + th + '>' + c + '</th>'; }).join("") +
        '</tr></thead><tbody>' +
        filas.map(function(f){
            return '<tr>' + f.map(function(valor, i){
                return '<td ' + td(negritas.indexOf(i) !== -1) + '>' + escaparHtml(valor) + '</td>';
            }).join("") + '</tr>';
        }).join("") +
        '</tbody></table>';

    const texto = intro + "\n" + columnas.join("\t") + "\n" +
        filas.map(function(f){ return f.join("\t"); }).join("\n");

    function avisarCopiado(){
        boton.textContent = "✅ Copiado: pégalo en el correo";
        setTimeout(function(){ boton.textContent = textoBoton; }, 3000);
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
        else alert("No se pudo copiar la tabla.");
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

// SPSA: la programación (F.O, RÓTULO, PEDIDO, O/C, ENTREGAS).
function copiarProgramacion(){
    copiarTablaCorreo(
        document.getElementById("pcBtnCopiar"), "📋 Copiar",
        "Considerar la siguiente programación:",
        procesarCliente.config.salida.columnas,
        procesarCliente.programacion.map(function(f){ return [f.fo, f.rotulo, f.pedido, f.oc, f.entrega]; }),
        [0, 1, 3]
    );
}

// Tottus: el resumen por entrega (FO, ROTULO, PEDIDO, ENTREGA, TIENDA),
// como la tabla dinámica de la plantilla.
function copiarResumenTottus(){
    copiarTablaCorreo(
        document.getElementById("pcBtnCopiarResumen"), "📋 Copiar para correo",
        "Considerar la siguiente programación:",
        ["FO", "ROTULO", "PEDIDO", "ENTREGA", "TIENDA"],
        (procesarCliente.resumen || []).map(function(r){ return [r.fo, r.rotulo, r.pedido, r.entrega, r.tienda]; }),
        [0, 1, 3]
    );
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

    await marcarPendientePackingList(procesarCliente.viajes.filter(function(v){ return confirmados[v.fo]; }));

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

// ========================================
// TOTTUS: LÍNEAS DEL VIAJE (modo "lineas")
// ========================================
// Como en el Drive: cada viaje se parte por NEGOCIO × RÓTULO con su
// peso. El rótulo de cada entrega (y su peso) viene de
// md_entregas_rotulo (calculado al procesar con la MARA); el negocio,
// del correo de Tottus por pedido (Documento modelo de la entrega).
// Al subir, las líneas se guardan en md_viaje_lineas: cada una lleva su
// propia fase, canales y status en el Monitor.

const SIN_NEGOCIO = "SIN NEGOCIO";

function generarLineas(){

    const negocioDePedido = {};
    procesarCliente.correo.filas.forEach(function(f){ if(f.negocio) negocioDePedido[f.pedido] = f.negocio; });

    const pedidoDeEntrega = {};
    procesarCliente.entregas.forEach(function(e){ pedidoDeEntrega[e.entrega] = soloDigitos(e.documento_modelo); });

    const suma = {};

    (procesarCliente.rotulos || []).forEach(function(r){
        const negocio = negocioDePedido[pedidoDeEntrega[r.entrega]] || SIN_NEGOCIO;
        const clave = r.fo + "|" + negocio + "|" + r.rotulo;
        if(!suma[clave]) suma[clave] = { fo: r.fo, cliente: negocio, rotulo: r.rotulo, peso_kg: 0 };
        suma[clave].peso_kg += Number(r.peso_kg) || 0;
    });

    procesarCliente.lineas = Object.keys(suma).map(function(k){ return suma[k]; }).sort(function(a, b){
        return a.fo.localeCompare(b.fo) || a.cliente.localeCompare(b.cliente) || a.rotulo.localeCompare(b.rotulo);
    });

    // Resumen para el correo (tabla dinámica de la plantilla): una fila
    // por entrega y rótulo, ordenada por FO, rótulo y entrega.
    procesarCliente.resumen = (procesarCliente.rotulos || []).map(function(r){
        const pedido = pedidoDeEntrega[r.entrega] || "";
        return { fo: r.fo, rotulo: r.rotulo, pedido: pedido, entrega: r.entrega, tienda: negocioDePedido[pedido] || SIN_NEGOCIO };
    }).sort(function(a, b){
        return a.fo.localeCompare(b.fo) || a.rotulo.localeCompare(b.rotulo) || a.entrega.localeCompare(b.entrega);
    });

    pintarLineas();
    pintarSubidaLineas();

}

function pintarLineas(){

    const lineas = procesarCliente.lineas;
    const conLineas = new Set(lineas.map(function(l){ return l.fo; }));
    const sinRotulos = procesarCliente.viajes.filter(function(v){ return !conLineas.has(v.fo); });
    const sinNegocio = lineas.filter(function(l){ return l.cliente === SIN_NEGOCIO; }).length;

    let html = "";

    if(sinRotulos.length){
        html += '<div class="cv-aviso">⚠️ ' + (sinRotulos.length === 1 ? "El viaje " : "Los viajes ") + "<b>" +
            sinRotulos.map(function(v){ return escaparHtml(v.fo); }).join(", ") + "</b> no " +
            (sinRotulos.length === 1 ? "tiene" : "tienen") + " rótulos: se procesaron antes de este cambio. " +
            "Vuelve a cruzarlos y procesarlos con su VL06F.</div>";
    }

    if(sinNegocio){
        html += '<div class="cv-aviso">⚠️ ' + sinNegocio + (sinNegocio === 1 ? " línea queda" : " líneas quedan") +
            " <b>SIN NEGOCIO</b>: su pedido no está en los correos pegados. Si viene en otro correo, pégalo arriba.</div>";
    }

    if(lineas.length){
        html +=
            '<div class="pc-picking">' +
                '<span>📄 Lista de validación de picking (una hoja por línea):</span>' +
                '<button class="cv-btn-secundario" onclick="imprimirPicking(this)">🖨️ Imprimir</button>' +
                '<button class="cv-btn-secundario" onclick="exportarPicking(this)">📥 Exportar Excel</button>' +
            '</div>';
    }

    html += '<div class="sp-contenedor pc-programacion"><table class="sp-tabla"><thead><tr>' +
        procesarCliente.config.salida.columnas.map(function(c){ return "<th>" + c + "</th>"; }).join("") +
    "</tr></thead><tbody>";

    let foAnterior = null;

    lineas.forEach(function(l){
        html +=
            "<tr" + (l.cliente === SIN_NEGOCIO || l.rotulo === SIN_ROTULO ? ' class="pc-sin-viaje"' : "") + ">" +
                "<td><b>" + (l.fo !== foAnterior ? escaparHtml(l.fo) : "") + "</b></td>" +
                '<td class="sp-izq"><b>' + escaparHtml(l.cliente) + "</b></td>" +
                '<td class="sp-izq">' + escaparHtml(l.rotulo) + "</td>" +
                '<td class="sp-num">' + l.peso_kg.toLocaleString("es-PE", { minimumFractionDigits: 3, maximumFractionDigits: 3 }) + "</td>" +
                '<td class="sp-num">' + (l.peso_kg / 1000).toFixed(3) + "</td>" +
            "</tr>";
        foAnterior = l.fo;
    });

    html += "</tbody></table></div>";

    // Resumen para mandar por correo.
    const resumen = procesarCliente.resumen || [];

    if(resumen.length){
        html +=
            '<div class="pc-salida-header">' +
                "<h3>📧 Resumen para el correo · " + resumen.length + (resumen.length === 1 ? " entrega" : " entregas") + "</h3>" +
                '<button class="cv-btn-procesar-todo" id="pcBtnCopiarResumen" onclick="copiarResumenTottus()">📋 Copiar para correo</button>' +
            "</div>" +
            '<div class="sp-contenedor pc-programacion"><table class="sp-tabla"><thead><tr>' +
                "<th>FO</th><th>ROTULO</th><th>PEDIDO</th><th>ENTREGA</th><th>TIENDA</th>" +
            "</tr></thead><tbody>" +
            resumen.map(function(r){
                return "<tr" + (r.tienda === SIN_NEGOCIO || r.rotulo === SIN_ROTULO ? ' class="pc-sin-viaje"' : "") + ">" +
                    "<td><b>" + escaparHtml(r.fo) + "</b></td>" +
                    "<td><b>" + escaparHtml(r.rotulo) + "</b></td>" +
                    "<td>" + escaparHtml(r.pedido) + "</td>" +
                    "<td><b>" + escaparHtml(r.entrega) + "</b></td>" +
                    "<td>" + escaparHtml(r.tienda) + "</td>" +
                "</tr>";
            }).join("") +
            "</tbody></table></div>";
    }

    document.getElementById("pcSalidaTitulo").textContent = "📦 " + procesarCliente.config.salida.titulo +
        " · " + lineas.length + (lineas.length === 1 ? " línea" : " líneas");
    document.getElementById("pcSalida").innerHTML = html;
    document.getElementById("pcBtnCopiar").disabled = lineas.length === 0;

}

// Copia lo que se ve en "📦": la programación (SPSA) o las líneas (Tottus).
function copiarSalida(){

    if(procesarCliente.config.modo !== "lineas"){
        copiarProgramacion();
        return;
    }

    const boton = document.getElementById("pcBtnCopiar");
    const columnas = procesarCliente.config.salida.columnas;
    const filas = procesarCliente.lineas.map(function(l){
        return [l.fo, l.cliente, l.rotulo, l.peso_kg.toFixed(3), (l.peso_kg / 1000).toFixed(3)];
    });
    const texto = [columnas].concat(filas).map(function(f){ return f.join("\t"); }).join("\n");

    (navigator.clipboard ? navigator.clipboard.writeText(texto) : Promise.reject()).then(function(){
        boton.textContent = "✅ Copiado";
        setTimeout(function(){ boton.textContent = "📋 Copiar"; }, 2500);
    }).catch(function(){
        alert("No se pudo copiar las líneas.");
    });

}

function pintarSubidaLineas(){

    const viajes = procesarCliente.viajes.map(function(v){
        const lineas = procesarCliente.lineas.filter(function(l){ return l.fo === v.fo; });
        const falta = lineas.filter(function(l){ return l.cliente === SIN_NEGOCIO || l.rotulo === SIN_ROTULO; }).length;
        return { viaje: v, lineas: lineas, falta: falta };
    });

    const listos = viajes.filter(function(i){ return i.viaje.estado !== "SUBIDO" && i.lineas.length; });

    let html =
        '<div class="pc-salida-header">' +
            "<h3>☁️ Subir a Status Pendiente</h3>" +
            '<button class="cv-btn-procesar-todo" id="pcBtnSubir" ' + (listos.length ? "" : "disabled ") +
                'onclick="subirViajesConLineas()">☁️ Subir ' + textoCantidadViajes(listos.length) + "</button>" +
        "</div>" +
        '<div class="sp-contenedor"><table class="sp-tabla"><thead><tr>' +
            "<th>VIAJE</th><th>LÍNEAS</th><th>PESO TN</th><th></th>" +
        "</tr></thead><tbody>";

    viajes.forEach(function(i){
        html +=
            "<tr" + (!i.lineas.length || i.falta ? ' class="pc-sin-viaje"' : "") + ">" +
                "<td><b>" + escaparHtml(i.viaje.fo) + "</b></td>" +
                "<td>" + i.lineas.length + "</td>" +
                '<td class="sp-num">' + i.viaje.peso_tn.toFixed(3) + "</td>" +
                '<td class="sp-izq">' +
                    (i.viaje.estado === "SUBIDO" ? "✅ Subido"
                        : !i.lineas.length ? "⚠️ Sin rótulos: vuelve a procesarlo"
                        : i.falta ? "⚠️ " + i.falta + (i.falta === 1 ? " línea" : " líneas") + " sin negocio o sin rótulo"
                        : "Listo") +
                "</td>" +
            "</tr>";
    });

    html += "</tbody></table></div>";

    document.getElementById("pcSubir").innerHTML = html;

}

// Sube los viajes (como "Subir viaje") y guarda sus líneas en
// md_viaje_lineas, que es lo que muestran Status Pendiente y el Monitor.
async function subirViajesConLineas(){

    const listos = procesarCliente.viajes.filter(function(v){
        return v.estado !== "SUBIDO" && procesarCliente.lineas.some(function(l){ return l.fo === v.fo; });
    });
    const conFaltas = procesarCliente.lineas.filter(function(l){
        return listos.some(function(v){ return v.fo === l.fo; }) && (l.cliente === SIN_NEGOCIO || l.rotulo === SIN_ROTULO);
    });

    if(listos.length === 0){
        return;
    }

    if(conFaltas.length && !confirm(
        conFaltas.length + (conFaltas.length === 1 ? " línea queda" : " líneas quedan") +
        " SIN NEGOCIO o SIN RÓTULO. ¿Subir igual?"
    )){
        return;
    }

    const boton = document.getElementById("pcBtnSubir");
    boton.disabled = true;
    boton.textContent = "⏳ Subiendo...";

    const ahora = new Date().toISOString();
    const lista = listos.map(function(v){ return '"' + v.fo + '"'; }).join(",");
    let confirmados = new Set();

    try{

        const subidos = await supabaseFetch("/md_viajes?fo=in.(" + encodeURIComponent(lista) + ")&estado=neq.SUBIDO", {
            method: "PATCH",
            headers: { "Prefer": "return=representation" },
            body: JSON.stringify({
                estado: "SUBIDO",
                fecha_subida: ahora,
                subido_por: sesion ? sesion.nombre_completo : null,
                status: "POR LANZAR",
                status_modulado: "PENDIENTE",
                status_despacho: "PENDIENTE",
                status_ut: "PENDIENTE",
                actualizado_en: ahora
            })
        });

        confirmados = new Set((subidos || []).map(function(v){ return v.fo; }));
        const fos = Array.from(confirmados);

        if(fos.length){

            const listaSubidos = fos.map(function(fo){ return '"' + fo + '"'; }).join(",");

            await supabaseFetch("/md_viaje_lineas?fo=in.(" + encodeURIComponent(listaSubidos) + ")", {
                method: "DELETE",
                headers: { "Prefer": "return=minimal" }
            });

            const filas = [];
            fos.forEach(function(fo){
                procesarCliente.lineas.filter(function(l){ return l.fo === fo; }).forEach(function(l, i){
                    filas.push({
                        fo: fo,
                        linea: i + 1,
                        cliente: l.cliente,
                        rotulo: l.rotulo,
                        peso_kg: redondear(l.peso_kg, 3),
                        status: "POR LANZAR",
                        actualizado_en: ahora
                    });
                });
            });

            await guardarEnLotes("md_viaje_lineas", "fo,linea", filas);

        }

    }catch(error){

        console.error(error);
        alert("No se pudo subir: " + (error.message || error));

    }

    procesarCliente.viajes.forEach(function(v){ if(confirmados.has(v.fo)) v.estado = "SUBIDO"; });

    await marcarPendientePackingList(procesarCliente.viajes.filter(function(v){ return confirmados.has(v.fo); }));

    pintarSubidaLineas();

    if(cargaViaje.resultado){
        pintarViajesProcesados(cargaViaje.resultado, true);
        buscarSinSubir();
    }

    if(confirmados.size < listos.length){
        alert("Se subieron " + confirmados.size + " de " + listos.length +
            " viajes. Los demás ya estaban subidos o no se encontraron: revisa Status Pendiente.");
    }

}

// ========================================
// TOTTUS: LISTA DE VALIDACIÓN DE PICKING
// ========================================
// Como las hojas "1000181352 (1 de 4)" de la plantilla F-LAT-058: una
// hoja por línea del viaje (FO × negocio × rótulo) con los materiales y
// cantidades del VL06F (md_entregas_material, guardado al procesar),
// para imprimir o exportar a Excel. CANTIDAD PALETAS queda en blanco
// (se llena a mano).

// Las hojas de picking de los viajes del panel.
async function armarHojasPicking(){

    const fos = procesarCliente.viajes.map(function(v){ return '"' + v.fo + '"'; }).join(",");
    const detalle = fos ? (await supabaseFetch(
        "/md_entregas_material?fo=in.(" + encodeURIComponent(fos) + ")" +
        "&select=fo,entrega,material,descripcion,um,cantidad,rotulo&order=material"
    ) || []) : [];

    const negocioDePedido = {};
    const fechaDePedido = {};
    procesarCliente.correo.filas.forEach(function(f){
        if(f.negocio) negocioDePedido[f.pedido] = f.negocio;
        if(f.fecha_entrega) fechaDePedido[f.pedido] = f.fecha_entrega;
    });

    const pedidoDeEntrega = {};
    procesarCliente.entregas.forEach(function(e){ pedidoDeEntrega[e.entrega] = soloDigitos(e.documento_modelo); });

    // línea (fo|negocio|rótulo) → material|um → cantidad
    const porLinea = {};

    detalle.forEach(function(d){
        const pedido = pedidoDeEntrega[d.entrega];
        const negocio = negocioDePedido[pedido] || SIN_NEGOCIO;
        const clave = d.fo + "|" + negocio + "|" + (d.rotulo || SIN_ROTULO);
        const linea = porLinea[clave] = porLinea[clave] || { materiales: {}, fecha: fechaDePedido[pedido] || "" };
        const mat = d.material + "|" + (d.um || "");
        linea.materiales[mat] = linea.materiales[mat] || { material: d.material, descripcion: d.descripcion, um: d.um, cantidad: 0 };
        linea.materiales[mat].cantidad += Number(d.cantidad) || 0;
    });

    const hojas = [];

    procesarCliente.viajes.forEach(function(v){

        const lineas = procesarCliente.lineas.filter(function(l){ return l.fo === v.fo; });

        lineas.forEach(function(l, i){
            const datos = porLinea[l.fo + "|" + l.cliente + "|" + l.rotulo] || { materiales: {}, fecha: "" };
            const materiales = Object.keys(datos.materiales).map(function(k){ return datos.materiales[k]; })
                .sort(function(a, b){ return a.material.localeCompare(b.material); });
            hojas.push({
                fo: l.fo,
                numero: i + 1,
                de: lineas.length,
                cliente: l.cliente,
                rotulo: l.rotulo,
                cita: datos.fecha || fechaHoyPicking(),
                materiales: materiales,
                total: materiales.reduce(function(s, m){ return s + m.cantidad; }, 0)
            });
        });

    });

    return hojas;

}

function fechaHoyPicking(){
    const d = new Date();
    return String(d.getDate()).padStart(2, "0") + "/" + String(d.getMonth() + 1).padStart(2, "0") + "/" + d.getFullYear();
}

function nombreHojaPicking(h){
    return h.fo + " (" + h.numero + " de " + h.de + ")";
}

async function conHojasPicking(boton, accion){

    const texto = boton.textContent;
    boton.disabled = true;
    boton.textContent = "⏳";

    try{

        const hojas = await armarHojasPicking();
        const sinDetalle = hojas.filter(function(h){ return h.materiales.length === 0; });

        if(hojas.length === 0){
            alert("No hay líneas para armar la lista de picking.");
        }else if(sinDetalle.length === hojas.length){
            alert("Estos viajes no tienen el detalle por material: se procesaron antes de este cambio. " +
                "Vuelve a cruzarlos y procesarlos con su VL06F.");
        }else{
            if(sinDetalle.length){
                alert(sinDetalle.length + " de " + hojas.length + " hojas salen sin materiales (" +
                    sinDetalle.map(nombreHojaPicking).join(", ") + "): vuelve a procesar esos viajes con su VL06F.");
            }
            accion(hojas);
        }

    }catch(error){
        console.error(error);
        alert("No se pudo armar la lista de picking: " + (error.message || error));
    }finally{
        boton.disabled = false;
        boton.textContent = texto;
    }

}

// ----- Diseño de la hoja de picking (igual que la plantilla F-LAT-058) -----
// Azul #002060 con letra blanca para las etiquetas y el título, amarillo
// en PEDIDO, naranja en OC, rojo en los encabezados del detalle, Calibri
// 12 y el logo de CEVA arriba a la derecha.

const PICKING_COLORES = { azul: "002060", amarillo: "FFFF00", naranja: "FFC000", rojo: "FF0000" };
const PICKING_LOGO = "../../shared/assets/ceva-logo.png";

// Una página A4 por línea, con el diseño de la plantilla.
function imprimirPicking(boton){

    conHojasPicking(boton, function(hojas){

        const logo = new URL(PICKING_LOGO, location.href).href;

        const paginas = hojas.map(function(h){
            return (
                '<section class="hoja"><table>' +
                    '<colgroup><col style="width:13%"><col style="width:15%"><col style="width:40%"><col style="width:9%"><col style="width:11%"><col style="width:12%"></colgroup>' +
                    '<tr><td class="az">FO</td><td class="az">' + escaparHtml(h.fo) + '</td><td class="b">TIENDA</td>' +
                        '<td class="logo" colspan="2" rowspan="2"><img src="' + logo + '" alt="CEVA"></td><td class="az">CANTIDAD PALETAS</td></tr>' +
                    '<tr><td class="az">PEDIDO</td><td class="am"></td><td class="b">' + escaparHtml(h.cliente) + '</td><td class="pal" rowspan="3"></td></tr>' +
                    '<tr><td class="az">OC</td><td class="na"></td><td class="az" colspan="3">1° LISTA DE VALIDACIÓN DE PICKING</td></tr>' +
                    '<tr><td class="az">ROTULO</td><td class="az"></td><td class="az">' + escaparHtml(h.rotulo) + '</td><td class="az">Cita:</td><td class="az">' + escaparHtml(h.cita) + '</td></tr>' +
                    '<tr><td class="sin"></td><td class="ro">CÓDIGO</td><td class="ro">DENOMINACIÓN</td><td class="ro">UM</td><td class="ro">CANTIDAD</td><td class="sin"></td></tr>' +
                    h.materiales.map(function(m){
                        return '<tr><td class="sin"></td><td>' + escaparHtml(m.material) + '</td><td>' + escaparHtml(m.descripcion || "") +
                            '</td><td>' + escaparHtml(m.um || "") + '</td><td>' + m.cantidad.toLocaleString("es-PE") + '</td><td class="sin"></td></tr>';
                    }).join("") +
                    '<tr><td class="sin"></td><td></td><td></td><td class="b">TOTAL</td><td class="b">' + h.total.toLocaleString("es-PE") + '</td><td class="sin"></td></tr>' +
                '</table><div class="pie">' + escaparHtml(nombreHojaPicking(h)) + '</div></section>'
            );
        }).join("");

        const ventana = window.open("", "_blank");

        if(!ventana){
            alert("El navegador bloqueó la ventana de impresión: permite las ventanas emergentes para esta página.");
            return;
        }

        ventana.document.write(
            '<!doctype html><html><head><meta charset="utf-8"><title>Lista de validación de picking</title><style>' +
                '@page{size:A4 portrait;margin:10mm}' +
                '*{-webkit-print-color-adjust:exact;print-color-adjust:exact}' +
                'body{font-family:Calibri,Arial,sans-serif;font-size:12pt;color:#000;margin:0}' +
                '.hoja{page-break-after:always}.hoja:last-child{page-break-after:auto}' +
                'table{border-collapse:collapse;width:100%;table-layout:fixed}' +
                'td{border:1px solid #000;padding:2px 4px;text-align:center;height:20px}' +
                '.az{background:#' + PICKING_COLORES.azul + ';color:#fff;font-weight:bold}' +
                '.am{background:#' + PICKING_COLORES.amarillo + '}.na{background:#' + PICKING_COLORES.naranja + '}' +
                '.ro{background:#' + PICKING_COLORES.rojo + ';color:#fff;font-weight:bold}' +
                '.b{font-weight:bold}.sin{border:none}' +
                '.logo{border:none}.logo img{height:34px}' +
                '.pie{margin-top:6px;font-size:9pt;color:#555;text-align:right}' +
            '</style></head><body>' + paginas +
            '<script>window.onload=function(){window.print();};<\/script></body></html>'
        );
        ventana.document.close();

    });

}

// Carga un script de una CDN una sola vez (ExcelJS, solo al exportar).
function cargarScriptUnaVez(url){
    return new Promise(function(resolve, reject){
        if(document.querySelector('script[src="' + url + '"]')) return resolve();
        const s = document.createElement("script");
        s.src = url;
        s.onload = resolve;
        s.onerror = function(){ reject(new Error("no se pudo cargar " + url)); };
        document.head.appendChild(s);
    });
}

async function logoBase64(){
    const blob = await fetch(PICKING_LOGO).then(function(r){ return r.blob(); });
    return new Promise(function(resolve){
        const lector = new FileReader();
        lector.onload = function(){ resolve(lector.result); };
        lector.readAsDataURL(blob);
    });
}

// Un Excel con una pestaña por línea ("1000181352 (1 de 4)") y el
// diseño de la plantilla. Se arma con ExcelJS (SheetJS no guarda
// colores ni imágenes).
function exportarPicking(boton){

    conHojasPicking(boton, async function(hojas){

        try{

            await cargarScriptUnaVez("https://cdn.jsdelivr.net/npm/exceljs@4.4.0/dist/exceljs.min.js");

            const libro = new ExcelJS.Workbook();
            const logo = libro.addImage({ base64: await logoBase64(), extension: "png" });

            const fuente = function(negrita, blanca){
                return { name: "Calibri", size: 12, bold: !!negrita, color: { argb: blanca ? "FFFFFFFF" : "FF000000" } };
            };
            const relleno = function(color){
                return { type: "pattern", pattern: "solid", fgColor: { argb: "FF" + color } };
            };
            const borde = { top: { style: "thin" }, left: { style: "thin" }, bottom: { style: "thin" }, right: { style: "thin" } };
            const centro = { horizontal: "center", vertical: "middle", wrapText: true };

            // Escribe una celda con su estilo.
            function celda(hoja, ref, valor, estilo){
                const c = hoja.getCell(ref);
                c.value = valor;
                c.font = fuente(estilo.negrita, estilo.blanca);
                c.alignment = centro;
                c.border = borde;
                if(estilo.color) c.fill = relleno(estilo.color);
            }

            const AZUL = { negrita: true, blanca: true, color: PICKING_COLORES.azul };
            const ROJO = { negrita: true, blanca: true, color: PICKING_COLORES.rojo };

            hojas.forEach(function(h){

                const hoja = libro.addWorksheet(nombreHojaPicking(h).slice(0, 31), {
                    pageSetup: { paperSize: 9, orientation: "portrait", fitToPage: true, fitToWidth: 1, fitToHeight: 0 }
                });

                hoja.columns = [{ width: 20 }, { width: 23 }, { width: 67 }, { width: 13.3 }, { width: 15 }, { width: 18.3 }];

                // Cabecera (filas 1 a 4)
                celda(hoja, "A1", "FO", AZUL);
                celda(hoja, "B1", Number(h.fo) || h.fo, AZUL);
                celda(hoja, "C1", "TIENDA", { negrita: true });
                celda(hoja, "F1", "CANTIDAD PALETAS", AZUL);

                celda(hoja, "A2", "PEDIDO", AZUL);
                celda(hoja, "B2", "", { color: PICKING_COLORES.amarillo });
                celda(hoja, "C2", h.cliente, { negrita: true });
                hoja.mergeCells("F2:F4");
                celda(hoja, "F2", "", {});

                celda(hoja, "A3", "OC", AZUL);
                celda(hoja, "B3", "", { color: PICKING_COLORES.naranja });
                hoja.mergeCells("C3:E3");
                celda(hoja, "C3", "1° LISTA DE VALIDACIÓN DE PICKING", AZUL);

                celda(hoja, "A4", "ROTULO", AZUL);
                celda(hoja, "B4", "", AZUL);
                celda(hoja, "C4", h.rotulo, AZUL);
                celda(hoja, "D4", "Cita:", AZUL);
                celda(hoja, "E4", h.cita, AZUL);

                // Detalle
                ["CÓDIGO", "DENOMINACIÓN", "UM", "CANTIDAD"].forEach(function(t, i){
                    celda(hoja, ["B", "C", "D", "E"][i] + "5", t, ROJO);
                });

                let fila = 6;
                h.materiales.forEach(function(m){
                    celda(hoja, "B" + fila, Number(m.material) || m.material, {});
                    celda(hoja, "C" + fila, m.descripcion || "", {});
                    celda(hoja, "D" + fila, m.um || "", {});
                    celda(hoja, "E" + fila, m.cantidad, {});
                    fila++;
                });

                celda(hoja, "B" + fila, "", {});
                celda(hoja, "C" + fila, "", {});
                celda(hoja, "D" + fila, "TOTAL", { negrita: true });
                celda(hoja, "E" + fila, h.total, { negrita: true });

                // Logo de CEVA arriba, entre D y E (como en la plantilla).
                hoja.addImage(logo, { tl: { col: 3.55, row: 0.1 }, ext: { width: 100, height: 36 } });

            });

            const buffer = await libro.xlsx.writeBuffer();
            const fos = Array.from(new Set(hojas.map(function(h){ return h.fo; })));
            const enlace = document.createElement("a");
            enlace.href = URL.createObjectURL(new Blob([buffer], {
                type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            }));
            enlace.download = "Picking Tottus " + (fos.length === 1 ? fos[0] : fos.length + " viajes") + ".xlsx";
            document.body.appendChild(enlace);
            enlace.click();
            document.body.removeChild(enlace);
            setTimeout(function(){ URL.revokeObjectURL(enlace.href); }, 5000);

        }catch(error){
            console.error(error);
            alert("No se pudo exportar el Excel: " + (error.message || error));
        }

    });

}

// ========================================
// TOTTUS: GENERAR ASN (en 📦 Pendiente de Packing List)
// ========================================
// El portal de Tottus da, por cita, un ASN previo (pre-ASN, archivo eASN)
// con todo lo de la OC: Cita | Nro OC | Bodega | SKU | Nro Tienda | Unidades a
// despachar | LPN | Guía | Tipo Bulto. Hay que ajustarlo a lo que tenemos
// programado:
//   programado (cita, OC, SKU) = Σ cantidad del VL06F × conversión,
//     de las entregas del FO × tienda de esa cita (md_citas_tottus),
//     con su OC (md_entregas.oc) y el SKU Tottus y la conversión del
//     material (md_materiales, Maestro de la plantilla F-LAT-058).
//   Las líneas del pre-ASN sin programar se quitan; las programadas
//   llevan lo programado. Nunca más que el pre-ASN: una misma OC × SKU
//   puede repartirse entre dos citas (dos FO), así que el tope se
//   revisa sumando todas las citas cargadas.

const asnTottus = { citas: [] };

// Encabezados del eASN → dato.
const COLUMNAS_EASN = {
    "CITA": "cita",
    "NRO OC": "oc",
    "BODEGA": "bodega",
    "SKU": "sku",
    "NRO TIENDA": "tienda",
    "UNIDADES A DESPACHAR": "unidades"
};

function listaIn(valores){
    return encodeURIComponent(valores.map(function(v){ return '"' + v + '"'; }).join(","));
}

// Pide una tabla filtrando por una lista larga, en lotes.
async function traerEnLotes(tabla, campo, valores, select){
    const filas = [];
    for(let i = 0; i < valores.length; i += 150){
        const lote = await supabaseFetch("/" + tabla + "?" + campo + "=in.(" + listaIn(valores.slice(i, i + 150)) + ")&select=" + select);
        Array.prototype.push.apply(filas, lote || []);
    }
    return filas;
}

async function leerArchivoEasn(archivo){

    const libro = XLSX.read(await archivo.arrayBuffer(), { type: "array" });
    const hoja = libro.Sheets[libro.SheetNames[0]];
    const filas = XLSX.utils.sheet_to_json(hoja, { header: 1, defval: "", raw: true });
    const encabezado = filas[0] || [];
    const indice = {};

    encabezado.forEach(function(c, i){
        const clave = COLUMNAS_EASN[normalizarEncabezado(c)];
        if(clave) indice[clave] = i;
    });

    if(indice.cita === undefined || indice.oc === undefined || indice.sku === undefined || indice.unidades === undefined){
        throw new Error(archivo.name + " no parece un eASN de Tottus (faltan Cita, Nro OC, SKU o Unidades a despachar).");
    }

    return {
        archivo: archivo.name,
        encabezado: encabezado,
        indice: indice,
        lineas: filas.slice(1).filter(function(f){ return String(f[indice.oc] || "").trim(); }).map(function(f){
            return {
                fila: f,
                cita: textoCodigo(f[indice.cita]),
                oc: textoCodigo(f[indice.oc]),
                sku: textoCodigo(f[indice.sku]),
                preAsn: Number(f[indice.unidades]) || 0
            };
        })
    };

}

async function generarAsnTottus(input){

    const archivos = Array.from(input.files || []);
    const caja = document.getElementById("cvAsnResultado");

    input.value = "";

    if(!archivos.length){
        return;
    }

    caja.innerHTML = '<div class="cv-vacio">⏳ Leyendo ' + archivos.length + (archivos.length === 1 ? " eASN" : " eASN") + " y cruzando con lo programado...</div>";

    try{

        const easns = [];
        for(const a of archivos){ easns.push(await leerArchivoEasn(a)); }

        const lineas = [];
        easns.forEach(function(e){ e.lineas.forEach(function(l){ l.easn = e; lineas.push(l); }); });

        const citas = Array.from(new Set(lineas.map(function(l){ return l.cita; })));

        // Cita → FO × tienda (cuadro de citas).
        const registradas = await traerEnLotes("md_citas_tottus", "cita", citas, "fo,tienda,cita");
        const deCita = {};
        registradas.forEach(function(r){ (deCita[r.cita] = deCita[r.cita] || []).push(r); });

        // Entregas de esos FO (con su tienda y OC) y su detalle por material.
        const fos = Array.from(new Set(registradas.map(function(r){ return r.fo; })));
        const entregas = fos.length ? await traerEnLotes("md_entregas", "fo", fos, "entrega,fo,destinatario_nombre,oc") : [];
        const detalle = entregas.length
            ? await traerEnLotes("md_entregas_material", "entrega", entregas.map(function(e){ return e.entrega; }), "entrega,material,cantidad")
            : [];
        const materiales = Array.from(new Set(detalle.map(function(d){ return d.material; })));
        const maestro = materiales.length ? await traerEnLotes("md_materiales", "material", materiales, "material,descripcion,sku_tottus,conversion_tottus") : [];
        const deMaterial = {};
        maestro.forEach(function(m){ deMaterial[m.material] = m; });

        const entregaInfo = {};
        entregas.forEach(function(e){ entregaInfo[e.entrega] = e; });

        // Programado por cita|OC|SKU
        const programado = {};
        const sinMaestro = {};
        const sinOc = {};

        citas.forEach(function(cita){
            (deCita[cita] || []).forEach(function(r){
                entregas.filter(function(e){ return e.fo === r.fo && limpiarTexto(e.destinatario_nombre) === r.tienda; })
                    .forEach(function(e){
                        if(!e.oc){ sinOc[e.entrega] = e.fo; return; }
                        detalle.filter(function(d){ return d.entrega === e.entrega; }).forEach(function(d){
                            const m = deMaterial[d.material];
                            if(!m || !m.sku_tottus || !m.conversion_tottus){ sinMaestro[d.material] = (m && m.descripcion) || ""; return; }
                            const clave = cita + "|" + e.oc + "|" + m.sku_tottus;
                            programado[clave] = (programado[clave] || 0) + (Number(d.cantidad) || 0) * Number(m.conversion_tottus);
                        });
                    });
            });
        });

        // Unidades del pre-ASN por OC|SKU (las mismas en todas las citas donde aparece) y
        // reparto del tope entre citas.
        const preAsn = {};
        lineas.forEach(function(l){ preAsn[l.oc + "|" + l.sku] = Math.max(preAsn[l.oc + "|" + l.sku] || 0, l.preAsn); });
        const usado = {};
        const excesos = [];

        asnTottus.citas = citas.map(function(cita){

            const delPreAsn = lineas.filter(function(l){ return l.cita === cita; });
            const filasAsn = [];
            const avisos = [];

            delPreAsn.forEach(function(l){
                const prog = Math.round(programado[cita + "|" + l.oc + "|" + l.sku] || 0);
                if(!prog) return;
                const clave = l.oc + "|" + l.sku;
                const disponible = Math.max(preAsn[clave] - (usado[clave] || 0), 0);
                const unidades = Math.min(prog, disponible);
                if(prog > disponible){
                    excesos.push("Cita " + cita + " · OC " + l.oc + " · SKU " + l.sku + ": programado " + prog + ", disponible en el pre-ASN " + disponible);
                }
                usado[clave] = (usado[clave] || 0) + unidades;
                if(unidades > 0){
                    const fila = l.fila.slice();
                    fila[l.easn.indice.unidades] = unidades;
                    filasAsn.push(fila);
                }
            });

            // Programado que no está en el pre-ASN de esta cita.
            Object.keys(programado).forEach(function(k){
                const partes = k.split("|");
                if(partes[0] !== cita) return;
                if(!delPreAsn.some(function(l){ return l.oc === partes[1] && l.sku === partes[2]; })){
                    avisos.push("OC " + partes[1] + " · SKU " + partes[2] + ": programado " + Math.round(programado[k]) + " pero no está en el pre-ASN (no va en el ASN)");
                }
            });

            const asignada = deCita[cita] || [];
            if(!asignada.length) avisos.push("La cita no está en el cuadro de citas: escríbela arriba en su FO y tienda.");

            return {
                cita: cita,
                fo: asignada.map(function(r){ return r.fo; }).join(", "),
                tienda: asignada.map(function(r){ return r.tienda; }).join(", "),
                easn: delPreAsn.length ? delPreAsn[0].easn : null,
                lineasPreAsn: delPreAsn.length,
                filas: filasAsn,
                unidades: filasAsn.reduce(function(s, f){ return s + (Number(f[delPreAsn[0].easn.indice.unidades]) || 0); }, 0),
                avisos: avisos
            };

        });

        pintarAsnTottus(excesos, sinMaestro, sinOc);

    }catch(error){
        console.error(error);
        caja.innerHTML = '<div class="cv-aviso">❌ ' + escaparHtml(error.message || error) + "</div>";
    }

}

function pintarAsnTottus(excesos, sinMaestro, sinOc){

    const caja = document.getElementById("cvAsnResultado");
    let html = "";

    if(excesos.length){
        html += '<div class="cv-aviso">⚠️ <b>Programado más que el pre-ASN</b> (en el ASN va solo hasta lo que trae el pre-ASN):<br>' +
            excesos.map(escaparHtml).join("<br>") + "</div>";
    }

    const materiales = Object.keys(sinMaestro);
    if(materiales.length){
        html += '<div class="cv-aviso">⚠️ <b>' + materiales.length + (materiales.length === 1 ? " material" : " materiales") +
            " sin SKU Tottus o sin conversión</b> (no entran al ASN; complétalos en 📚 MARAs › MARA Tottus): " +
            materiales.map(function(m){ return escaparHtml(m + (sinMaestro[m] ? " " + sinMaestro[m] : "")); }).join(", ") + "</div>";
    }

    const entregasSinOc = Object.keys(sinOc);
    if(entregasSinOc.length){
        html += '<div class="cv-aviso">⚠️ ' + entregasSinOc.length + " entregas sin OC guardada (viajes subidos sin pegar el correo en Procesar cliente): " +
            entregasSinOc.map(escaparHtml).join(", ") + "</div>";
    }

    html += '<div class="cv-tabla-contenedor cv-citas"><table class="cv-tabla"><thead><tr>' +
        "<th>CITA</th><th>FO</th><th>TIENDA</th><th>LÍNEAS PRE-ASN</th><th>LÍNEAS ASN</th><th>UNIDADES ASN</th><th></th>" +
    "</tr></thead><tbody>" +
    asnTottus.citas.map(function(c, i){
        return "<tr>" +
            "<td><b>" + escaparHtml(c.cita) + "</b></td>" +
            "<td>" + escaparHtml(c.fo || "-") + "</td>" +
            "<td>" + escaparHtml(c.tienda || "-") + "</td>" +
            "<td>" + c.lineasPreAsn + "</td>" +
            "<td><b>" + c.filas.length + "</b></td>" +
            "<td><b>" + c.unidades.toLocaleString("es-PE") + "</b></td>" +
            "<td>" + (c.filas.length
                ? '<button class="cv-btn-drive-fila" onclick="descargarAsnTottus(' + i + ')">📥 Descargar ASN</button>'
                : "—") + "</td>" +
        "</tr>" +
        (c.avisos.length ? '<tr><td colspan="7" class="cv-asn-aviso">' + c.avisos.map(escaparHtml).join("<br>") + "</td></tr>" : "");
    }).join("") +
    "</tbody></table></div>";

    caja.innerHTML = html;

}

// El eASN de la cita con solo lo programado, en el mismo formato del
// portal (mismas columnas y hoja), listo para cargar.
function descargarAsnTottus(indice){

    const c = asnTottus.citas[indice];
    const hoja = XLSX.utils.aoa_to_sheet([c.easn.encabezado].concat(c.filas));
    const libro = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(libro, hoja, "Sheet0");
    XLSX.writeFile(libro, "eASN_" + c.cita + "_programado.xlsx");

}

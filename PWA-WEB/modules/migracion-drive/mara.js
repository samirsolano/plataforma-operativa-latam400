// ========================================
// MARAs › MARA TOTTUS
// ========================================
// md_materiales: el rótulo Tottus de cada material (columna "TIENDA
// TOTTUS" de la MARA de la plantilla F-LAT-058: T.LIMPIEZA /
// T.HUACHIPA). Al procesar (cargar-viaje.js, guardarRotulosTottus) cada
// material de una entrega de Tottus toma su rótulo de aquí; los que no
// están quedan SIN RÓTULO. Desde esta vista se busca, se cambia el
// rótulo y se agregan materiales nuevos.

const maraTottus = { materiales: [] };
const ROTULOS_MARA_TOTTUS = ["T.LIMPIEZA", "T.HUACHIPA"];

// La API devuelve como mucho 1000 filas por pedido: se piden de a 1000.
async function cargarMaraTottus(){

    const contenido = document.getElementById("mtContenido");

    contenido.className = "cv-vacio";
    contenido.textContent = "Cargando...";

    try{

        const todos = [];

        for(let desde = 0; ; desde += 1000){
            const lote = await supabaseFetch(
                "/md_materiales?select=material,descripcion,rotulo_tottus,actualizado_en&order=material" +
                "&limit=1000&offset=" + desde
            ) || [];
            Array.prototype.push.apply(todos, lote);
            if(lote.length < 1000) break;
        }

        maraTottus.materiales = todos;
        pintarMaraTottus();

    }catch(error){

        console.error(error);
        contenido.textContent = "No se pudo cargar la MARA Tottus: " + (error.message || error);

    }

}

function pintarMaraTottus(){

    const contenido = document.getElementById("mtContenido");
    const texto = limpiarTexto(document.getElementById("mtBuscar").value);
    const rotulo = document.getElementById("mtRotulo").value;
    const todos = maraTottus.materiales;

    const materiales = todos.filter(function(m){
        if(rotulo === "SIN" && m.rotulo_tottus) return false;
        if(rotulo && rotulo !== "SIN" && m.rotulo_tottus !== rotulo) return false;
        if(!texto) return true;
        return limpiarTexto(m.material).indexOf(texto) !== -1 || limpiarTexto(m.descripcion).indexOf(texto) !== -1;
    });

    if(materiales.length === 0){
        contenido.className = "cv-vacio";
        contenido.textContent = todos.length
            ? "Ningún material coincide con la búsqueda."
            : "La MARA Tottus está vacía. Agrega materiales con el formulario de arriba.";
        return;
    }

    const cuenta = function(r){ return todos.filter(function(m){ return m.rotulo_tottus === r; }).length; };

    // Para no hacer pesada la pantalla se muestran los primeros 500; con
    // el buscador se llega a cualquiera.
    const MAXIMO = 500;
    const visibles = materiales.slice(0, MAXIMO);

    contenido.className = "";
    contenido.innerHTML =
        '<div class="sp-resumen">' + todos.length + " materiales · " +
            cuenta("T.LIMPIEZA") + " T.LIMPIEZA · " + cuenta("T.HUACHIPA") + " T.HUACHIPA" +
            (materiales.length !== todos.length ? " · " + materiales.length + " con este filtro" : "") +
            (materiales.length > MAXIMO ? " · se muestran los primeros " + MAXIMO + ", usa el buscador" : "") +
            " · el rótulo se guarda solo al cambiarlo" +
        "</div>" +
        '<div class="sp-contenedor mt-tabla"><table class="sp-tabla"><thead><tr>' +
            "<th>MATERIAL</th><th>DESCRIPCIÓN</th><th>RÓTULO TOTTUS</th>" +
        "</tr></thead><tbody>" +
        visibles.map(function(m){
            const material = escaparHtml(JSON.stringify(m.material));
            return "<tr>" +
                "<td><b>" + escaparHtml(m.material) + "</b></td>" +
                '<td class="sp-izq">' + escaparHtml(m.descripcion || "-") + "</td>" +
                "<td>" +
                    '<select class="mn-input" onchange="cambiarRotuloMaterial(this, ' + material + ')">' +
                        (m.rotulo_tottus ? "" : '<option value="" selected>— sin rótulo —</option>') +
                        ROTULOS_MARA_TOTTUS.map(function(r){
                            return '<option value="' + r + '"' + (r === m.rotulo_tottus ? " selected" : "") + ">" + r + "</option>";
                        }).join("") +
                    "</select>" +
                "</td>" +
            "</tr>";
        }).join("") +
        "</tbody></table></div>";

}

async function cambiarRotuloMaterial(control, material){

    const fila = maraTottus.materiales.find(function(m){ return m.material === material; });
    const anterior = fila ? fila.rotulo_tottus : "";

    control.classList.remove("mn-guardado", "mn-error");
    control.classList.add("mn-guardando");

    try{

        await supabaseFetch("/md_materiales?material=eq." + encodeURIComponent(material), {
            method: "PATCH",
            headers: { "Prefer": "return=minimal" },
            body: JSON.stringify({ rotulo_tottus: control.value || null, actualizado_en: new Date().toISOString() })
        });

        if(fila) fila.rotulo_tottus = control.value || null;

        control.classList.remove("mn-guardando");
        control.classList.add("mn-guardado");
        setTimeout(function(){ control.classList.remove("mn-guardado"); }, 1500);

    }catch(error){

        console.error(error);
        control.value = anterior || "";
        control.classList.remove("mn-guardando");
        control.classList.add("mn-error");
        alert("No se pudo cambiar el rótulo del material " + material + ": " + (error.message || error));

    }

}

// Agrega un material nuevo, o actualiza su descripción y rótulo si ya
// estaba.
async function agregarMaterialTottus(){

    const material = textoCodigo(document.getElementById("mtMaterial").value);
    const descripcion = String(document.getElementById("mtDescripcion").value || "").trim().toUpperCase();
    const rotulo = document.getElementById("mtNuevoRotulo").value;
    const boton = document.getElementById("mtBtnAgregar");

    if(!material){
        alert("Escribe el código del material.");
        return;
    }

    const existente = maraTottus.materiales.find(function(m){ return m.material === material; });

    if(existente && !confirm(
        "El material " + material + " ya está en la MARA (" + (existente.descripcion || "sin descripción") +
        ", " + (existente.rotulo_tottus || "sin rótulo") + "). ¿Actualizarlo?"
    )){
        return;
    }

    boton.disabled = true;

    try{

        const fila = { material: material, rotulo_tottus: rotulo, actualizado_en: new Date().toISOString() };
        if(descripcion || !existente) fila.descripcion = descripcion || null;

        await supabaseFetch("/md_materiales?on_conflict=material", {
            method: "POST",
            headers: { "Prefer": "resolution=merge-duplicates,return=minimal" },
            body: JSON.stringify([fila])
        });

        document.getElementById("mtMaterial").value = "";
        document.getElementById("mtDescripcion").value = "";
        document.getElementById("mtBuscar").value = material;
        await cargarMaraTottus();

    }catch(error){

        console.error(error);
        alert("No se pudo guardar el material: " + (error.message || error));

    }finally{

        boton.disabled = false;

    }

}

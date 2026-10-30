// ========================================
// CLIENTES (mapeo por código de destinatario)
// ========================================
// Las reglas DESTINATARIO de md_reglas_gestion: el código de
// destinatario del VL06F → nombre que se muestra como cliente, gestión
// y acción. Sirve para los clientes que tienen varios CD con el mismo
// nombre en SAP (ej. COMPAÑIA HARD DISCOUNT → CD MASS PUNTA HERMOSA /
// CD MASS CALLAO) o un nombre que no dice nada (plantas de Alicorp
// como "Prd Terminado 01"). Se aplican al procesar los viajes en Cargar
// Viaje y mandan sobre las reglas por nombre (ver calcularGestion).

const clientes = { reglas: [] };

const ACCIONES_CLIENTE = [
    { valor: "SUBIR", texto: "Subir viaje" },
    { valor: "PROCESAR", texto: "Procesar viaje" }
];

// Opciones de gestión: las conocidas y, si la regla tiene otra, también.
function opcionesGestion(actual){

    const gestiones = ORDEN_GESTIONES.slice();

    if(actual && gestiones.indexOf(actual) === -1){
        gestiones.push(actual);
    }

    return gestiones.map(function(g){
        return '<option value="' + escaparHtml(g) + '"' + (g === actual ? " selected" : "") + '>' + escaparHtml(g) + '</option>';
    }).join("");

}

function opcionesAccion(actual){
    return ACCIONES_CLIENTE.map(function(a){
        return '<option value="' + a.valor + '"' + (a.valor === actual ? " selected" : "") + '>' + a.texto + '</option>';
    }).join("");
}

(function iniciarFormularioClientes(){
    document.getElementById("clGestion").innerHTML = opcionesGestion("CANAL MODERNO");
})();

async function cargarClientes(){

    const contenido = document.getElementById("clContenido");

    contenido.className = "cv-vacio";
    contenido.textContent = "Cargando...";

    try{

        clientes.reglas = await supabaseFetch(
            "/md_reglas_gestion?tipo_regla=eq.DESTINATARIO" +
            "&select=id,destinatario_codigo,nombre,gestion,accion,actualizado_en" +
            "&order=gestion.asc,nombre.asc"
        ) || [];

        pintarClientes();

    }catch(error){

        console.error(error);
        contenido.textContent = "No se pudieron cargar los clientes: " + (error.message || error);

    }

}

function pintarClientes(){

    const contenido = document.getElementById("clContenido");
    const texto = limpiarTexto(document.getElementById("clBuscar").value);

    const reglas = clientes.reglas.filter(function(r){
        if(!texto) return true;
        return [r.destinatario_codigo, r.nombre, r.gestion].some(function(c){
            return limpiarTexto(c).indexOf(texto) !== -1;
        });
    });

    if(reglas.length === 0){
        contenido.className = "cv-vacio";
        contenido.textContent = clientes.reglas.length
            ? "Ningún cliente coincide con la búsqueda."
            : "Todavía no hay clientes mapeados. Agrégalos con el formulario de arriba.";
        return;
    }

    let html =
        '<div class="sp-resumen">' + reglas.length + (reglas.length === 1 ? " cliente" : " clientes") +
            ' · los cambios se guardan solos al salir de la celda</div>' +
        '<div class="sp-contenedor"><table class="sp-tabla cl-tabla"><thead><tr>' +
            '<th>DESTINATARIO DE MERCANCÍAS</th><th>NOMBRE QUE SE MUESTRA</th><th>GESTIÓN</th><th>ACCIÓN</th><th></th>' +
        '</tr></thead><tbody>';

    reglas.forEach(function(r){

        html +=
            '<tr>' +
                '<td><input type="text" class="mn-input" value="' + escaparHtml(r.destinatario_codigo) + '" onchange="guardarCliente(this, ' + r.id + ', \'destinatario_codigo\')"></td>' +
                '<td><input type="text" class="mn-input cl-nombre" value="' + escaparHtml(r.nombre) + '" onchange="guardarCliente(this, ' + r.id + ', \'nombre\')"></td>' +
                '<td><select class="mn-input" onchange="guardarCliente(this, ' + r.id + ', \'gestion\')">' + opcionesGestion(r.gestion) + '</select></td>' +
                '<td><select class="mn-input" onchange="guardarCliente(this, ' + r.id + ', \'accion\')">' + opcionesAccion(r.accion) + '</select></td>' +
                '<td><button class="cl-btn-quitar" title="Quitar" onclick="quitarCliente(' + r.id + ')">🗑️</button></td>' +
            '</tr>';

    });

    html += '</tbody></table></div>';

    contenido.className = "";
    contenido.innerHTML = html;

}

// Los textos se guardan "limpios" (mayúsculas, sin espacios de más),
// igual que las demás reglas, así cruzan siempre igual.
function valorCliente(campo, valor){
    if(campo === "destinatario_codigo") return textoCodigo(valor);
    if(campo === "nombre") return limpiarTexto(valor);
    return valor;
}

function mensajeErrorCliente(error){
    const texto = String(error && error.message || error);
    return /duplicate|unique|23505|409/i.test(texto)
        ? "Ese código de destinatario ya está mapeado."
        : texto;
}

// Al escribir el código, muestra cómo viene ese destinatario de
// mercancías en los viajes ya cargados (nombre y lugar del VL06F), para
// confirmar que es el CD correcto antes de agregarlo.
async function buscarDestinatario(){

    const codigo = valorCliente("destinatario_codigo", document.getElementById("clCodigo").value);
    const encontrado = document.getElementById("clEncontrado");

    encontrado.className = "cl-encontrado";
    encontrado.textContent = "";

    if(!codigo){
        return;
    }

    const yaMapeado = clientes.reglas.find(function(r){ return r.destinatario_codigo === codigo; });

    if(yaMapeado){
        encontrado.className = "cl-encontrado cl-aviso";
        encontrado.textContent = "⚠️ Ya está mapeado como " + yaMapeado.nombre + ".";
        return;
    }

    encontrado.textContent = "Buscando...";

    try{

        const filas = await supabaseFetch(
            "/md_entregas?destinatario_codigo=eq." + encodeURIComponent(codigo) +
            "&select=fo,destinatario_nombre,lugar_destinatario&order=actualizado_en.desc&limit=1"
        );

        const e = filas && filas[0];

        encontrado.textContent = e
            ? "En SAP: " + (e.destinatario_nombre || "-") + " · " + (e.lugar_destinatario || "-") + " (viaje " + e.fo + ")"
            : "Este código todavía no aparece en ningún viaje cargado.";

    }catch(error){
        console.error(error);
        encontrado.textContent = "";
    }

}

async function agregarCliente(){

    const codigo = valorCliente("destinatario_codigo", document.getElementById("clCodigo").value);
    const nombre = valorCliente("nombre", document.getElementById("clNombre").value);
    const boton = document.getElementById("clBtnAgregar");

    if(!codigo || !nombre){
        alert("Escribe el código de destinatario y el nombre que se muestra.");
        return;
    }

    boton.disabled = true;

    try{

        await supabaseFetch("/md_reglas_gestion", {
            method: "POST",
            headers: { "Prefer": "return=minimal" },
            body: JSON.stringify({
                tipo_regla: "DESTINATARIO",
                destinatario_codigo: codigo,
                nombre: nombre,
                gestion: document.getElementById("clGestion").value,
                accion: document.getElementById("clAccion").value
            })
        });

        document.getElementById("clCodigo").value = "";
        document.getElementById("clNombre").value = "";
        document.getElementById("clEncontrado").textContent = "";
        document.getElementById("clCodigo").focus();

        await cargarClientes();

    }catch(error){

        console.error(error);
        alert("No se pudo agregar el cliente: " + mensajeErrorCliente(error));

    }finally{

        boton.disabled = false;

    }

}

// Guarda un solo campo. Si falla, la celda vuelve a su valor.
async function guardarCliente(control, id, campo){

    const regla = clientes.reglas.find(function(r){ return r.id === id; });
    const anterior = regla ? regla[campo] : "";
    const valor = valorCliente(campo, control.value);

    if(!valor){
        alert("Este campo no puede quedar vacío.");
        control.value = anterior || "";
        return;
    }

    const cambios = { actualizado_en: new Date().toISOString() };
    cambios[campo] = valor;

    control.classList.remove("mn-guardado", "mn-error");
    control.classList.add("mn-guardando");

    try{

        await supabaseFetch("/md_reglas_gestion?id=eq." + id, {
            method: "PATCH",
            headers: { "Prefer": "return=minimal" },
            body: JSON.stringify(cambios)
        });

        if(regla) regla[campo] = valor;
        control.value = valor;

        control.classList.remove("mn-guardando");
        control.classList.add("mn-guardado");
        setTimeout(function(){ control.classList.remove("mn-guardado"); }, 1500);

    }catch(error){

        console.error(error);

        control.value = anterior || "";
        control.classList.remove("mn-guardando");
        control.classList.add("mn-error");

        alert("No se pudo guardar el cambio: " + mensajeErrorCliente(error));

    }

}

async function quitarCliente(id){

    const regla = clientes.reglas.find(function(r){ return r.id === id; });

    if(!regla || !confirm(
        "¿Quitar " + regla.nombre + " (código " + regla.destinatario_codigo + ")?\n\n" +
        "Los viajes que ya se procesaron no cambian; los siguientes tomarán la gestión por las demás reglas."
    )){
        return;
    }

    try{

        await supabaseFetch("/md_reglas_gestion?id=eq." + id + "&tipo_regla=eq.DESTINATARIO", {
            method: "DELETE",
            headers: { "Prefer": "return=minimal" }
        });

        await cargarClientes();

    }catch(error){

        console.error(error);
        alert("No se pudo quitar el cliente: " + (error.message || error));

    }

}

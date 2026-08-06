// ========================================
// SESIÓN Y PERMISOS
// ========================================

const sesion = requerirSesion();

if(sesion && sesion.rol !== "Administrador" && sesion.rol !== "Supervisor"){
    window.location.href = "../inicio/home.html";
}

const esAdministrador = sesion && sesion.rol === "Administrador";

// ========================================
// ELEMENTOS
// ========================================

const selectorMes = document.getElementById("selectorMes");
const archivoExcel = document.getElementById("archivoExcel");
const btnCargarArchivo = document.getElementById("btnCargarArchivo");
const btnActivarMes = document.getElementById("btnActivarMes");
const mensajeErrorCarga = document.getElementById("mensajeErrorCarga");
const tblMensual = document.getElementById("tblMensual");
const mensajeVacio = document.getElementById("mensajeVacio");
const chipDia = document.getElementById("chipDia");
const chipNoche = document.getElementById("chipNoche");
const chipIntermedio = document.getElementById("chipIntermedio");

let mensualCargado = [];
let temporizadorMes = null;

if(!esAdministrador){
    btnActivarMes.style.display = "none";
}

function mesActual(){
    return selectorMes.value.trim();
}

// ========================================
// LEER Y NORMALIZAR EL EXCEL
// ========================================

async function leerFilasExcel(archivo){

    const buffer = await archivo.arrayBuffer();
    const libro = XLSX.read(buffer, { type: "array" });
    const hoja = libro.Sheets[libro.SheetNames[0]];

    return XLSX.utils.sheet_to_json(hoja, { defval: "" });

}

function buscarEnFila(mapaFila, ...claves){

    for(const clave of claves){

        const valor = mapaFila[clave];

        if(valor !== undefined && valor !== null && String(valor).trim() !== ""){
            return String(valor).trim();
        }

    }

    return "";

}

function normalizarFilaExcel(filaOriginal){

    const mapaFila = {};

    Object.keys(filaOriginal).forEach(function(clave){
        mapaFila[clave.trim().toLowerCase()] = filaOriginal[clave];
    });

    const dniCrudo = buscarEnFila(mapaFila, "dni");
    const dni = dniCrudo ? dniCrudo.replace(/\D/g, "").padStart(8, "0") : "";

    return {
        supervisor: buscarEnFila(mapaFila, "supervisor"),
        turno: buscarEnFila(mapaFila, "turno").toUpperCase(),
        zona: buscarEnFila(mapaFila, "zona").toUpperCase(),
        pasillo: buscarEnFila(mapaFila, "zona de check list 5s", "pasillo"),
        dni: dni,
        nombre: buscarEnFila(mapaFila, "nombre")
    };

}

// ========================================
// CARGAR ARCHIVO
// ========================================

btnCargarArchivo.addEventListener("click", async function(){

    mensajeErrorCarga.textContent = "";

    const mes = mesActual();
    const archivo = archivoExcel.files[0];

    if(!mes){
        mensajeErrorCarga.textContent = "Escribe primero el mes (ej: Agosto 2026).";
        return;
    }

    if(!archivo){
        mensajeErrorCarga.textContent = "Selecciona el archivo Excel.";
        return;
    }

    btnCargarArchivo.disabled = true;
    btnCargarArchivo.textContent = "Leyendo archivo...";

    try{

        const filasCrudas = await leerFilasExcel(archivo);
        const filasNormalizadas = filasCrudas
            .map(normalizarFilaExcel)
            .filter(f => f.dni.length === 8 && f.nombre);

        if(!filasNormalizadas.length){
            mensajeErrorCarga.textContent = "No se encontraron filas válidas en el archivo (revisa las columnas DNI y NOMBRE).";
            return;
        }

        // ¿Ya existe carga para este mes?
        const existentes = await supabaseFetch(
            "/colaboradores_mensual?mes=eq." + encodeURIComponent(mes) + "&select=id"
        );

        if(existentes && existentes.length){

            const confirmado = confirm(
                "Ya existe una carga de " + existentes.length + " colaboradores para \"" + mes + "\". " +
                "¿Deseas reemplazarla con este archivo (" + filasNormalizadas.length + " filas)?"
            );

            if(!confirmado){
                return;
            }

            await supabaseFetch(
                "/colaboradores_mensual?mes=eq." + encodeURIComponent(mes),
                { method: "DELETE" }
            );

        }

        btnCargarArchivo.textContent = "Buscando fotos...";

        // Trae de una sola vez las fotos ya guardadas para los DNI del archivo.
        const dnis = filasNormalizadas.map(f => f.dni);
        const fotosPorDni = {};

        const listaDnis = "(" + dnis.join(",") + ")";

        const fotosEncontradas = await supabaseFetch(
            "/fotos_colaboradores?dni=in." + listaDnis + "&select=dni,foto"
        );

        (fotosEncontradas || []).forEach(function(f){
            fotosPorDni[f.dni] = f.foto;
        });

        const filasParaInsertar = filasNormalizadas.map(function(f){

            return {
                dni: f.dni,
                nombre: f.nombre,
                zona: f.zona,
                pasillo: f.pasillo,
                turno: f.turno,
                supervisor: f.supervisor,
                foto: fotosPorDni[f.dni] || null,
                mes: mes
            };

        });

        btnCargarArchivo.textContent = "Guardando...";

        // Supabase/PostgREST no acepta lotes gigantes en una sola petición
        // de forma confiable; se envía en bloques de 200.
        const TAMANO_BLOQUE = 200;

        for(let i = 0; i < filasParaInsertar.length; i += TAMANO_BLOQUE){

            const bloque = filasParaInsertar.slice(i, i + TAMANO_BLOQUE);

            await supabaseFetch(
                "/colaboradores_mensual",
                {
                    method: "POST",
                    body: JSON.stringify(bloque)
                }
            );

        }

        archivoExcel.value = "";
        cargarMensual();

    }catch(e){

        console.error(e);
        mensajeErrorCarga.textContent = "No se pudo cargar el archivo. Revisa el formato e intenta de nuevo.";

    }finally{

        btnCargarArchivo.disabled = false;
        btnCargarArchivo.textContent = "Cargar archivo";

    }

});

// ========================================
// LISTAR MES
// ========================================

async function cargarMensual(){

    const mes = mesActual();

    tblMensual.innerHTML = "";
    mensajeVacio.style.display = "none";
    actualizarChips([]);

    if(!mes){
        mensajeVacio.textContent = "Escribe un mes para ver su lista.";
        mensajeVacio.style.display = "block";
        return;
    }

    try{

        mensualCargado = await supabaseFetch(
            "/colaboradores_mensual?select=id,dni,nombre,zona,pasillo,turno,supervisor,foto&mes=eq." +
            encodeURIComponent(mes) +
            "&order=turno.asc,nombre.asc"
        );

        renderizarMensual(mensualCargado);
        actualizarChips(mensualCargado);

    }catch(e){

        console.error(e);
        mensajeVacio.textContent = "No se pudo cargar la lista mensual.";
        mensajeVacio.style.display = "block";

    }

}

function renderizarMensual(lista){

    tblMensual.innerHTML = "";
    mensajeVacio.style.display = "none";

    if(!lista || !lista.length){
        mensajeVacio.textContent = "Todavía no hay colaboradores cargados para este mes.";
        mensajeVacio.style.display = "block";
        return;
    }

    lista.forEach(function(c){

        const tr = document.createElement("tr");

        tr.innerHTML = `
            <td>
                <img class="foto-mini" src="${c.foto || ""}" alt="">
            </td>
            <td>${c.dni}</td>
            <td>${c.nombre}</td>
            <td>${c.zona || "-"}</td>
            <td>${c.pasillo || "-"}</td>
            <td>${c.turno || "-"}</td>
            <td>${c.supervisor || "-"}</td>
            <td>
                <button class="btn-eliminar" data-id="${c.id}" data-dni="${c.dni}">
                    Eliminar
                </button>
            </td>
        `;

        tblMensual.appendChild(tr);

    });

}

function actualizarChips(lista){

    const turnosPresentes = new Set(
        (lista || []).map(c => c.turno).filter(Boolean)
    );

    chipDia.classList.toggle("cargado", turnosPresentes.has("DIA"));
    chipNoche.classList.toggle("cargado", turnosPresentes.has("NOCHE"));
    chipIntermedio.classList.toggle("cargado", turnosPresentes.has("INTERMEDIO"));

}

selectorMes.addEventListener("input", function(){

    clearTimeout(temporizadorMes);
    temporizadorMes = setTimeout(cargarMensual, 500);

});

tblMensual.addEventListener("click", async function(e){

    const boton = e.target.closest(".btn-eliminar");

    if(!boton){
        return;
    }

    const id = boton.dataset.id;
    const dni = boton.dataset.dni;

    const confirmado = confirm(
        "¿Eliminar de la carga mensual al colaborador con DNI \"" + dni + "\"?"
    );

    if(!confirmado){
        return;
    }

    boton.disabled = true;
    boton.textContent = "Eliminando...";

    try{

        await supabaseFetch(
            "/colaboradores_mensual?id=eq." + encodeURIComponent(id),
            { method: "DELETE" }
        );

        cargarMensual();

    }catch(e){

        console.error(e);
        alert("No se pudo eliminar.");
        boton.disabled = false;
        boton.textContent = "Eliminar";

    }

});

// ========================================
// ACTIVAR MES
// ========================================

btnActivarMes.addEventListener("click", async function(){

    if(!esAdministrador){
        return;
    }

    const mes = mesActual();

    if(!mes){
        alert("Escribe primero el mes que quieres activar.");
        return;
    }

    if(!mensualCargado.length){
        alert("No hay colaboradores cargados para \"" + mes + "\".");
        return;
    }

    const confirmado = confirm(
        "Esto va a REEMPLAZAR toda la lista de Colaboradores Activos (la que usa el Checklist 5S) " +
        "con los " + mensualCargado.length + " colaboradores cargados para \"" + mes + "\". " +
        "¿Continuar?"
    );

    if(!confirmado){
        return;
    }

    btnActivarMes.disabled = true;
    btnActivarMes.textContent = "Activando...";

    try{

        // Vacía la tabla de activos (id > 0 siempre es verdadero: borra todo).
        await supabaseFetch(
            "/colaboradores_activos?id=gt.0",
            { method: "DELETE" }
        );

        const nuevosActivos = mensualCargado.map(function(c){

            return {
                dni: c.dni,
                nombre: c.nombre,
                zona: c.zona,
                pasillo: c.pasillo,
                turno: c.turno,
                supervisor: c.supervisor,
                foto: c.foto,
                activo: true
            };

        });

        const TAMANO_BLOQUE = 200;

        for(let i = 0; i < nuevosActivos.length; i += TAMANO_BLOQUE){

            const bloque = nuevosActivos.slice(i, i + TAMANO_BLOQUE);

            await supabaseFetch(
                "/colaboradores_activos",
                {
                    method: "POST",
                    body: JSON.stringify(bloque)
                }
            );

        }

        await supabaseFetch(
            "/colaboradores_mensual?mes=eq." + encodeURIComponent(mes),
            {
                method: "PATCH",
                body: JSON.stringify({ aplicado: true })
            }
        );

        alert("\"" + mes + "\" quedó activado. El Checklist 5S ya usa esta lista.");

    }catch(e){

        console.error(e);
        alert("No se pudo activar el mes. Intenta nuevamente.");

    }finally{

        btnActivarMes.disabled = false;
        btnActivarMes.textContent = "✓ Activar este mes";

    }

});

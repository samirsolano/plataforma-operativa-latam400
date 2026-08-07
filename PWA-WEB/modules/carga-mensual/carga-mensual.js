// ========================================
// SESIÓN Y PERMISOS
// ========================================

const sesion = requerirSesion();

if(sesion && sesion.rol !== "Administrador" && sesion.rol !== "Supervisor"){
    window.location.href = "../inicio/home.html";
}

const esAdministrador = sesion && sesion.rol === "Administrador";

if(sesion){
    document.getElementById("nombreUsuario").textContent = sesion.nombre_completo;
    document.getElementById("rolUsuario").textContent = sesion.rol;
}

const btnPerfil = document.getElementById("btnPerfil");
const menuUsuario = document.getElementById("menuUsuario");

btnPerfil.addEventListener("click", function(e){

    e.stopPropagation();

    if(menuUsuario.style.display === "block"){
        menuUsuario.style.display = "none";
    }else{
        menuUsuario.style.display = "block";
    }

});

document.addEventListener("click", function(){
    menuUsuario.style.display = "none";
});

document.getElementById("btnCerrarSesion").addEventListener("click", function(e){

    e.preventDefault();
    e.stopPropagation();
    cerrarSesion();

});

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
const resumenCargas = document.getElementById("resumenCargas");

let mensualCargado = [];
let turnoFiltrado = null;

if(!esAdministrador){
    btnActivarMes.style.display = "none";
}

function mesActual(){
    return selectorMes.value;
}

// ========================================
// LISTA DE MESES (desplegable)
// ========================================

const NOMBRES_MES = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
];

(function llenarSelectorMeses(){

    const hoy = new Date();
    const anioActual = hoy.getFullYear();

    // Ofrece los 12 meses del año actual y del siguiente,
    // para poder cargar el mes en curso y planificar el que sigue.
    [anioActual, anioActual + 1].forEach(function(anio){

        NOMBRES_MES.forEach(function(nombreMes, indice){

            const etiqueta = nombreMes + " " + anio;

            const opcion = document.createElement("option");
            opcion.value = etiqueta;
            opcion.textContent = etiqueta;

            if(anio === anioActual && indice === hoy.getMonth()){
                opcion.selected = true;
            }

            selectorMes.appendChild(opcion);

        });

    });

})();

// ========================================
// LEER Y NORMALIZAR EL EXCEL
// ========================================

async function leerFilasExcel(archivo){

    const buffer = await archivo.arrayBuffer();
    const libro = XLSX.read(buffer, { type: "array" });

    // La plantilla oficial trae una hoja auxiliar oculta ("Listas") con
    // las opciones de los desplegables, además de la hoja con los datos
    // ("Carga 5S"). No siempre es la primera hoja del archivo, así que
    // se busca por nombre y solo se usa la primera como último recurso.
    const nombreHoja =
        libro.SheetNames.find(n => n.trim().toLowerCase() === "carga 5s") ||
        libro.SheetNames.find(n => n.trim().toLowerCase() !== "listas") ||
        libro.SheetNames[0];

    const hoja = libro.Sheets[nombreHoja];

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

// La plantilla oficial siempre trae estas 6 columnas. Si el archivo no las
// tiene todas, no es la plantilla correcta y se rechaza antes de guardar nada.
const COLUMNAS_ESPERADAS = [
    "supervisor", "turno", "zona", "zona de check list 5s", "dni", "nombre"
];

function validarFormatoPlantilla(filasCrudas){

    if(!filasCrudas.length){
        return "El archivo está vacío.";
    }

    const columnasArchivo = Object.keys(filasCrudas[0]).map(c => c.trim().toLowerCase());

    const faltantes = COLUMNAS_ESPERADAS.filter(
        esperada => !columnasArchivo.includes(esperada)
    );

    if(faltantes.length){
        return "Este archivo no tiene el formato de la plantilla oficial. " +
            "Faltan las columnas: " + faltantes.join(", ") +
            ". Descarga la plantilla arriba y vuelve a intentarlo.";
    }

    return null;

}

// ========================================
// CARGAR ARCHIVO
// ========================================

btnCargarArchivo.addEventListener("click", async function(){

    mensajeErrorCarga.textContent = "";

    const mes = mesActual();
    const archivo = archivoExcel.files[0];

    if(!mes){
        mensajeErrorCarga.textContent = "Selecciona primero el mes.";
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

        const errorFormato = validarFormatoPlantilla(filasCrudas);

        if(errorFormato){
            mensajeErrorCarga.textContent = errorFormato;
            return;
        }

        const todasLasFilas = filasCrudas.map(normalizarFilaExcel);

        const filasNormalizadas = todasLasFilas.filter(
            f => f.dni.length === 8 && f.nombre
        );

        const filasIncompletas = todasLasFilas.filter(
            f => !(f.dni.length === 8 && f.nombre)
        );

        if(!filasNormalizadas.length){
            mensajeErrorCarga.textContent = "No se encontraron filas completas en el archivo (revisa DNI y NOMBRE).";
            return;
        }

        // Todas las zonas a auditar deben tener un auditor asignado:
        // no se acepta una carga parcial.
        if(filasIncompletas.length){

            const pasillosFaltantes = filasIncompletas
                .map(f => f.pasillo || "(sin pasillo)")
                .join(", ");

            mensajeErrorCarga.textContent = "Faltan " + filasIncompletas.length +
                " zona(s) sin auditor asignado: " + pasillosFaltantes +
                ". Completa DNI y NOMBRE en todas las filas antes de subir.";

            return;

        }

        // La plantilla es de un turno a la vez: todas las filas completas
        // deben compartir el mismo turno.
        const turnosEnArchivo = new Set(
            filasNormalizadas.map(f => f.turno).filter(Boolean)
        );

        if(turnosEnArchivo.size === 0){
            mensajeErrorCarga.textContent = "Selecciona el Turno en el Excel (columna TURNO) antes de subirlo.";
            return;
        }

        if(turnosEnArchivo.size > 1){
            mensajeErrorCarga.textContent = "El archivo mezcla más de un turno (" +
                Array.from(turnosEnArchivo).join(", ") +
                "). Sube un archivo por turno.";
            return;
        }

        const turno = Array.from(turnosEnArchivo)[0];

        // ¿Ya existe carga para este mes + turno?
        const existentes = await checklistFetch(
            "/colaboradores_mensual?mes=eq." + encodeURIComponent(mes) +
            "&turno=eq." + encodeURIComponent(turno) + "&select=id"
        );

        if(existentes && existentes.length){

            const confirmado = confirm(
                "Ya existe una carga de " + existentes.length + " colaboradores para \"" + mes +
                "\", turno " + turno + ". ¿Deseas reemplazarla con este archivo (" +
                filasNormalizadas.length + " filas)?"
            );

            if(!confirmado){
                return;
            }

            await checklistFetch(
                "/colaboradores_mensual?mes=eq." + encodeURIComponent(mes) +
                "&turno=eq." + encodeURIComponent(turno),
                { method: "DELETE" }
            );

        }

        btnCargarArchivo.textContent = "Buscando fotos...";

        // Trae de una sola vez las fotos ya guardadas para los DNI del archivo.
        const dnis = filasNormalizadas.map(f => f.dni);
        const fotosPorDni = {};

        const listaDnis = "(" + dnis.join(",") + ")";

        const fotosEncontradas = await checklistFetch(
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
                mes: mes,
                cargado_por: sesion.nombre_completo || sesion.usuario || ""
            };

        });

        btnCargarArchivo.textContent = "Guardando...";

        // Supabase/PostgREST no acepta lotes gigantes en una sola petición
        // de forma confiable; se envía en bloques de 200.
        const TAMANO_BLOQUE = 200;

        for(let i = 0; i < filasParaInsertar.length; i += TAMANO_BLOQUE){

            const bloque = filasParaInsertar.slice(i, i + TAMANO_BLOQUE);

            await checklistFetch(
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

    turnoFiltrado = null;
    tblMensual.innerHTML = "";
    mensajeVacio.style.display = "none";
    actualizarChips([]);
    renderizarResumen([]);

    if(!mes){
        mensajeVacio.textContent = "Selecciona un mes para ver su lista.";
        mensajeVacio.style.display = "block";
        return;
    }

    try{

        mensualCargado = await checklistFetch(
            "/colaboradores_mensual?select=id,dni,nombre,zona,pasillo,turno,supervisor,foto,cargado_por,created_at&mes=eq." +
            encodeURIComponent(mes) +
            "&order=turno.asc,nombre.asc"
        );

        renderizarConFiltro();
        actualizarChips(mensualCargado);
        renderizarResumen(mensualCargado);

    }catch(e){

        console.error(e);
        mensajeVacio.textContent = "No se pudo cargar la lista mensual.";
        mensajeVacio.style.display = "block";

    }

}

function formatearFechaHora(iso){

    if(!iso){
        return "-";
    }

    const fecha = new Date(iso);

    return fecha.toLocaleDateString("es-PE") + " " +
        fecha.toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" });

}

function renderizarResumen(lista){

    resumenCargas.innerHTML = "";

    if(!lista || !lista.length){
        return;
    }

    const porTurno = {};

    lista.forEach(function(c){

        const turno = c.turno || "SIN TURNO";

        if(!porTurno[turno]){
            porTurno[turno] = {
                cantidad: 0,
                supervisor: c.supervisor || "-",
                cargadoPor: c.cargado_por || "-",
                fecha: c.created_at
            };
        }

        porTurno[turno].cantidad++;

        // Se queda con la carga más reciente de ese turno.
        if(c.created_at && (!porTurno[turno].fecha || c.created_at > porTurno[turno].fecha)){
            porTurno[turno].fecha = c.created_at;
            porTurno[turno].cargadoPor = c.cargado_por || "-";
            porTurno[turno].supervisor = c.supervisor || "-";
        }

    });

    Object.keys(porTurno).forEach(function(turno){

        const info = porTurno[turno];

        const div = document.createElement("div");
        div.className = "resumen-item";

        div.innerHTML = `
            <div class="resumen-item-turno">Turno ${turno}</div>
            <div class="resumen-item-linea">Supervisor: <b>${info.supervisor}</b></div>
            <div class="resumen-item-linea">Colaboradores: <b>${info.cantidad}</b></div>
            <div class="resumen-item-linea">Subido por: <b>${info.cargadoPor}</b></div>
            <div class="resumen-item-linea">Fecha: <b>${formatearFechaHora(info.fecha)}</b></div>
        `;

        resumenCargas.appendChild(div);

    });

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
            <td>${c.dni}</td>
            <td>${c.nombre}</td>
            <td>${c.zona || "-"}</td>
            <td>${c.pasillo || "-"}</td>
            <td>${c.turno || "-"}</td>
            <td>${c.supervisor || "-"}</td>
        `;

        tblMensual.appendChild(tr);

    });

}

// ========================================
// CHIPS: ESTADO + FILTRO
// ========================================

function renderizarConFiltro(){

    const lista = turnoFiltrado
        ? mensualCargado.filter(c => c.turno === turnoFiltrado)
        : mensualCargado;

    renderizarMensual(lista);

}

[chipDia, chipNoche, chipIntermedio].forEach(function(chip){

    chip.addEventListener("click", function(){

        const turno = chip.dataset.turno;

        turnoFiltrado = (turnoFiltrado === turno) ? null : turno;

        renderizarConFiltro();
        actualizarChips(mensualCargado);

    });

});

function actualizarChips(lista){

    const turnosPresentes = new Set(
        (lista || []).map(c => c.turno).filter(Boolean)
    );

    chipDia.classList.toggle("cargado", turnosPresentes.has("DIA"));
    chipNoche.classList.toggle("cargado", turnosPresentes.has("NOCHE"));
    chipIntermedio.classList.toggle("cargado", turnosPresentes.has("INTERMEDIO"));

    [chipDia, chipNoche, chipIntermedio].forEach(function(chip){
        chip.classList.toggle("seleccionado", chip.dataset.turno === turnoFiltrado);
    });

    actualizarBotonActivar(turnosPresentes);

}

// El botón "Activar mes" solo tiene sentido (y solo se habilita) cuando
// ese mes ya tiene carga de los 3 turnos. El botón ya está oculto por
// completo para quien no es Administrador.
function actualizarBotonActivar(turnosPresentes){

    if(!esAdministrador){
        return;
    }

    const completo =
        turnosPresentes.has("DIA") &&
        turnosPresentes.has("NOCHE") &&
        turnosPresentes.has("INTERMEDIO");

    btnActivarMes.disabled = !completo;

    btnActivarMes.title = completo
        ? ""
        : "Faltan turnos por cargar para este mes (DIA, NOCHE e INTERMEDIO).";

}

selectorMes.addEventListener("change", cargarMensual);

// El selector ya trae el mes actual preseleccionado.
cargarMensual();

// ========================================
// ACTIVAR MES
// ========================================

btnActivarMes.addEventListener("click", async function(){

    if(!esAdministrador){
        return;
    }

    const mes = mesActual();

    if(!mes){
        alert("Selecciona primero el mes que quieres activar.");
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
        await checklistFetch(
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

            await checklistFetch(
                "/colaboradores_activos",
                {
                    method: "POST",
                    body: JSON.stringify(bloque)
                }
            );

        }

        await checklistFetch(
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

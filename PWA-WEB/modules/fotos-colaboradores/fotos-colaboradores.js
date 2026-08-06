// ========================================
// SESIÓN Y PERMISOS
// ========================================

const sesion = requerirSesion();

if(sesion && sesion.rol !== "Administrador" && sesion.rol !== "Supervisor"){
    window.location.href = "../inicio/home.html";
}

// ========================================
// LISTAR
// ========================================

const tblFotos = document.getElementById("tblFotos");
const mensajeVacio = document.getElementById("mensajeVacio");
const buscador = document.getElementById("buscador");

let fotosCargadas = [];

async function cargarFotos(){

    tblFotos.innerHTML = "";
    mensajeVacio.style.display = "none";

    try{

        fotosCargadas = await supabaseFetch(
            "/fotos_colaboradores?select=dni,nombre,foto,updated_at&order=updated_at.desc"
        );

        renderizarFotos(fotosCargadas);

    }catch(e){

        console.error(e);
        mensajeVacio.textContent = "No se pudo cargar el banco de fotos.";
        mensajeVacio.style.display = "block";

    }

}

function formatearFecha(iso){

    if(!iso){
        return "-";
    }

    const fecha = new Date(iso);

    return fecha.toLocaleDateString("es-PE");

}

function renderizarFotos(lista){

    tblFotos.innerHTML = "";
    mensajeVacio.style.display = "none";

    if(!lista || !lista.length){
        mensajeVacio.textContent = "No hay fotos guardadas todavía.";
        mensajeVacio.style.display = "block";
        return;
    }

    lista.forEach(function(f){

        const tr = document.createElement("tr");

        tr.innerHTML = `
            <td>
                <img class="foto-mini" src="${f.foto || ""}" alt="">
            </td>
            <td>${f.dni}</td>
            <td>${f.nombre || "-"}</td>
            <td>${formatearFecha(f.updated_at)}</td>
            <td>
                <button class="btn-editar" data-dni="${f.dni}">
                    Reemplazar
                </button>
                <button class="btn-eliminar" data-dni="${f.dni}">
                    Eliminar
                </button>
            </td>
        `;

        tblFotos.appendChild(tr);

    });

}

buscador.addEventListener("input", function(){

    const termino = buscador.value.trim().toLowerCase();

    if(!termino){
        renderizarFotos(fotosCargadas);
        return;
    }

    const filtrados = fotosCargadas.filter(function(f){

        return (
            f.dni.toLowerCase().includes(termino) ||
            (f.nombre || "").toLowerCase().includes(termino)
        );

    });

    if(!filtrados.length){
        tblFotos.innerHTML = "";
        mensajeVacio.textContent = "Ninguna foto coincide con la búsqueda.";
        mensajeVacio.style.display = "block";
        return;
    }

    renderizarFotos(filtrados);

});

// ========================================
// EDITAR (reemplazar) / ELIMINAR
// ========================================

tblFotos.addEventListener("click", async function(e){

    const botonEditar = e.target.closest(".btn-editar");
    const botonEliminar = e.target.closest(".btn-eliminar");

    if(botonEditar){

        const dni = botonEditar.dataset.dni;
        const foto = fotosCargadas.find(f => f.dni === dni);

        if(foto){
            abrirModalEditar(foto);
        }

        return;
    }

    if(botonEliminar){

        const dni = botonEliminar.dataset.dni;

        const confirmado = confirm(
            "¿Eliminar la foto del DNI \"" + dni + "\"? Esta acción no se puede deshacer."
        );

        if(!confirmado){
            return;
        }

        botonEliminar.disabled = true;
        botonEliminar.textContent = "Eliminando...";

        try{

            await supabaseFetch(
                "/fotos_colaboradores?dni=eq." + encodeURIComponent(dni),
                { method: "DELETE" }
            );

            cargarFotos();

        }catch(e){

            console.error(e);
            alert("No se pudo eliminar la foto.");
            botonEliminar.disabled = false;
            botonEliminar.textContent = "Eliminar";

        }

        return;
    }

});

// ========================================
// MODAL AGREGAR / REEMPLAZAR
// ========================================

const modalOverlay = document.getElementById("modalOverlay");
const tituloModal = document.getElementById("tituloModal");
const btnAgregar = document.getElementById("btnAgregar");
const btnCancelar = document.getElementById("btnCancelar");
const btnGuardar = document.getElementById("btnGuardar");
const mensajeErrorModal = document.getElementById("mensajeErrorModal");

const inputNuevoDni = document.getElementById("nuevoDni");
const inputNuevoNombre = document.getElementById("nuevoNombre");
const inputNuevoFoto = document.getElementById("nuevoFoto");
const previsualizacionFoto = document.getElementById("previsualizacionFoto");

function abrirModalNuevo(){

    mensajeErrorModal.textContent = "";
    inputNuevoDni.value = "";
    inputNuevoDni.disabled = false;
    inputNuevoNombre.value = "";
    inputNuevoFoto.value = "";
    previsualizacionFoto.style.display = "none";
    previsualizacionFoto.src = "";

    tituloModal.textContent = "Agregar Foto";
    modalOverlay.classList.add("visible");
    inputNuevoDni.focus();

}

function abrirModalEditar(foto){

    mensajeErrorModal.textContent = "";
    inputNuevoDni.value = foto.dni;
    inputNuevoDni.disabled = true;
    inputNuevoNombre.value = foto.nombre || "";
    inputNuevoFoto.value = "";
    previsualizacionFoto.src = foto.foto;
    previsualizacionFoto.style.display = "block";

    tituloModal.textContent = "Reemplazar Foto";
    modalOverlay.classList.add("visible");

}

function cerrarModal(){
    modalOverlay.classList.remove("visible");
}

btnAgregar.addEventListener("click", abrirModalNuevo);
btnCancelar.addEventListener("click", cerrarModal);

modalOverlay.addEventListener("click", function(e){

    if(e.target === modalOverlay){
        cerrarModal();
    }

});

inputNuevoFoto.addEventListener("change", function(){

    const archivo = inputNuevoFoto.files[0];

    if(!archivo){
        return;
    }

    const lector = new FileReader();

    lector.onload = function(e){
        previsualizacionFoto.src = e.target.result;
        previsualizacionFoto.style.display = "block";
    };

    lector.readAsDataURL(archivo);

});

btnGuardar.addEventListener("click", async function(){

    const dni = inputNuevoDni.value.trim();
    const nombre = inputNuevoNombre.value.trim();
    const archivo = inputNuevoFoto.files[0];

    mensajeErrorModal.textContent = "";

    if(!dni){
        mensajeErrorModal.textContent = "Ingrese el DNI.";
        return;
    }

    if(dni.length !== 8){
        mensajeErrorModal.textContent = "El DNI debe tener 8 dígitos.";
        return;
    }

    if(!archivo){
        mensajeErrorModal.textContent = "Seleccione una foto.";
        return;
    }

    btnGuardar.disabled = true;
    btnGuardar.textContent = "GUARDANDO...";

    try{

        await subirFotoColaborador(dni, archivo, nombre || null);

        cerrarModal();
        cargarFotos();

    }catch(e){

        console.error(e);
        mensajeErrorModal.textContent = "No se pudo guardar la foto.";

    }finally{

        btnGuardar.disabled = false;
        btnGuardar.textContent = "Guardar";

    }

});

// ========================================
// INICIO
// ========================================

if(sesion && (sesion.rol === "Administrador" || sesion.rol === "Supervisor")){
    cargarFotos();
}

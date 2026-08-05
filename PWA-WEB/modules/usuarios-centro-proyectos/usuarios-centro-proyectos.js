// ========================================
// SESIÓN Y PERMISOS
// ========================================
// Solo el rol Administrador puede ver este módulo.

const sesion = requerirSesion();

if(sesion && sesion.rol !== "Administrador"){
    window.location.href = "../inicio/home.html";
}

// ========================================
// LISTAR USUARIOS
// ========================================

const tblUsuarios = document.getElementById("tblUsuarios");
const mensajeVacio = document.getElementById("mensajeVacio");

async function cargarUsuarios(){

    tblUsuarios.innerHTML = "";
    mensajeVacio.style.display = "none";

    try{

        const usuarios = await supabaseFetch(
            "/usuarios_centro_proyectos?select=id,dni,nombre,puesto,jd,activo&order=nombre.asc"
        );

        if(!usuarios || !usuarios.length){
            mensajeVacio.textContent = "No hay usuarios registrados.";
            mensajeVacio.style.display = "block";
            return;
        }

        usuarios.forEach(function(u){

            const tr = document.createElement("tr");

            tr.innerHTML = `
                <td>${u.dni}</td>
                <td>${u.nombre}</td>
                <td>${u.puesto || "-"}</td>
                <td>${u.jd || "-"}</td>
                <td>
                    <span class="estado ${u.activo ? "activo" : "inactivo"}">
                        ${u.activo ? "Activo" : "Inactivo"}
                    </span>
                </td>
                <td>
                    <button class="btn-eliminar" data-id="${u.id}" data-dni="${u.dni}">
                        Eliminar
                    </button>
                </td>
            `;

            tblUsuarios.appendChild(tr);

        });

    }catch(e){

        console.error(e);
        mensajeVacio.textContent = "No se pudo cargar la lista de usuarios.";
        mensajeVacio.style.display = "block";

    }

}

// ========================================
// ELIMINAR USUARIO
// ========================================

tblUsuarios.addEventListener("click", async function(e){

    const boton = e.target.closest(".btn-eliminar");

    if(!boton){
        return;
    }

    const id = boton.dataset.id;
    const dni = boton.dataset.dni;

    const confirmado = confirm(
        "¿Eliminar permanentemente al usuario con DNI \"" + dni + "\"? Esta acción no se puede deshacer."
    );

    if(!confirmado){
        return;
    }

    boton.disabled = true;
    boton.textContent = "Eliminando...";

    try{

        await supabaseFetch(
            "/usuarios_centro_proyectos?id=eq." + encodeURIComponent(id),
            { method: "DELETE" }
        );

        cargarUsuarios();

    }catch(e){

        console.error(e);
        alert("No se pudo eliminar el usuario.");
        boton.disabled = false;
        boton.textContent = "Eliminar";

    }

});

// ========================================
// MODAL AGREGAR USUARIO
// ========================================

const modalOverlay = document.getElementById("modalOverlay");
const btnAgregar = document.getElementById("btnAgregar");
const btnCancelar = document.getElementById("btnCancelar");
const btnGuardar = document.getElementById("btnGuardar");
const mensajeErrorModal = document.getElementById("mensajeErrorModal");

const inputNuevoDni = document.getElementById("nuevoDni");
const inputNuevoNombre = document.getElementById("nuevoNombre");
const inputNuevoPuesto = document.getElementById("nuevoPuesto");
const inputNuevoJd = document.getElementById("nuevoJd");
const inputNuevoActivo = document.getElementById("nuevoActivo");

function abrirModal(){

    mensajeErrorModal.textContent = "";
    inputNuevoDni.value = "";
    inputNuevoNombre.value = "";
    inputNuevoPuesto.value = "";
    inputNuevoJd.value = "";
    inputNuevoActivo.checked = true;

    modalOverlay.classList.add("visible");
    inputNuevoDni.focus();

}

function cerrarModal(){
    modalOverlay.classList.remove("visible");
}

btnAgregar.addEventListener("click", abrirModal);
btnCancelar.addEventListener("click", cerrarModal);

modalOverlay.addEventListener("click", function(e){

    if(e.target === modalOverlay){
        cerrarModal();
    }

});

btnGuardar.addEventListener("click", async function(){

    const dni = inputNuevoDni.value.trim();
    const nombre = inputNuevoNombre.value.trim();
    const puesto = inputNuevoPuesto.value.trim();
    const jd = inputNuevoJd.value.trim();
    const activo = inputNuevoActivo.checked;

    mensajeErrorModal.textContent = "";

    if(!dni || !nombre){
        mensajeErrorModal.textContent = "Complete al menos el DNI y el nombre.";
        return;
    }

    if(dni.length !== 8){
        mensajeErrorModal.textContent = "El DNI debe tener 8 dígitos.";
        return;
    }

    btnGuardar.disabled = true;
    btnGuardar.textContent = "GUARDANDO...";

    try{

        await supabaseFetch(
            "/usuarios_centro_proyectos",
            {
                method: "POST",
                body: JSON.stringify({
                    dni: dni,
                    nombre: nombre,
                    puesto: puesto,
                    jd: jd,
                    activo: activo
                })
            }
        );

        cerrarModal();
        cargarUsuarios();

    }catch(e){

        console.error(e);
        mensajeErrorModal.textContent = "No se pudo guardar. Verifique que el DNI no exista.";

    }finally{

        btnGuardar.disabled = false;
        btnGuardar.textContent = "Guardar";

    }

});

// ========================================
// INICIO
// ========================================

if(sesion && sesion.rol === "Administrador"){
    cargarUsuarios();
}

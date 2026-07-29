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
            "/usuarios_app?select=id,usuario,nombre_completo,rol,activo&order=nombre_completo.asc"
        );

        if(!usuarios || !usuarios.length){
            mensajeVacio.textContent = "No hay usuarios registrados.";
            mensajeVacio.style.display = "block";
            return;
        }

        usuarios.forEach(function(u){

            const tr = document.createElement("tr");

            tr.innerHTML = `
                <td>${u.usuario}</td>
                <td>${u.nombre_completo}</td>
                <td>${u.rol}</td>
                <td>
                    <span class="estado ${u.activo ? "activo" : "inactivo"}">
                        ${u.activo ? "Activo" : "Inactivo"}
                    </span>
                </td>
                <td>
                    <button class="btn-eliminar" data-id="${u.id}" data-usuario="${u.usuario}">
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
    const usuario = boton.dataset.usuario;

    const confirmado = confirm(
        "¿Eliminar permanentemente al usuario \"" + usuario + "\"? Esta acción no se puede deshacer."
    );

    if(!confirmado){
        return;
    }

    boton.disabled = true;
    boton.textContent = "Eliminando...";

    try{

        await supabaseFetch(
            "/usuarios_app?id=eq." + encodeURIComponent(id),
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

const inputNuevoUsuario = document.getElementById("nuevoUsuario");
const inputNuevoPassword = document.getElementById("nuevoPassword");
const inputNuevoNombre = document.getElementById("nuevoNombre");
const inputNuevoRol = document.getElementById("nuevoRol");
const inputNuevoActivo = document.getElementById("nuevoActivo");

function abrirModal(){

    mensajeErrorModal.textContent = "";
    inputNuevoUsuario.value = "";
    inputNuevoPassword.value = "";
    inputNuevoNombre.value = "";
    inputNuevoRol.value = "";
    inputNuevoActivo.checked = true;

    modalOverlay.classList.add("visible");
    inputNuevoUsuario.focus();

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

    const usuario = inputNuevoUsuario.value.trim();
    const password = inputNuevoPassword.value;
    const nombre = inputNuevoNombre.value.trim();
    const rol = inputNuevoRol.value.trim();
    const activo = inputNuevoActivo.checked;

    mensajeErrorModal.textContent = "";

    if(!usuario || !password || !nombre || !rol){
        mensajeErrorModal.textContent = "Complete todos los campos.";
        return;
    }

    btnGuardar.disabled = true;
    btnGuardar.textContent = "GUARDANDO...";

    try{

        await supabaseFetch(
            "/usuarios_app",
            {
                method: "POST",
                body: JSON.stringify({
                    usuario: usuario,
                    password: password,
                    nombre_completo: nombre,
                    rol: rol,
                    activo: activo
                })
            }
        );

        cerrarModal();
        cargarUsuarios();

    }catch(e){

        console.error(e);
        mensajeErrorModal.textContent = "No se pudo guardar. Verifique que el usuario no exista.";

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

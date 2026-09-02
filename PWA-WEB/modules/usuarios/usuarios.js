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

// Guarda la última lista cargada para poder rellenar el modal de
// edición sin tener que volver a pedirla a Supabase.
let usuariosCache = [];

async function cargarUsuarios(){

    tblUsuarios.innerHTML = "";
    mensajeVacio.style.display = "none";

    try{

        const usuarios = await supabaseFetch(
            "/usuarios_app?select=id,usuario,password,dni,nombre_completo,rol,activo&order=nombre_completo.asc"
        );

        usuariosCache = usuarios || [];

        if(!usuarios || !usuarios.length){
            mensajeVacio.textContent = "No hay usuarios registrados.";
            mensajeVacio.style.display = "block";
            return;
        }

        usuarios.forEach(function(u){

            const tr = document.createElement("tr");

            tr.innerHTML = `
                <td>${u.usuario}</td>
                <td>${u.password}</td>
                <td>${u.dni || "-"}</td>
                <td>${u.nombre_completo}</td>
                <td>${u.rol}</td>
                <td>
                    <span class="estado ${u.activo ? "activo" : "inactivo"}">
                        ${u.activo ? "Activo" : "Inactivo"}
                    </span>
                </td>
                <td>
                    <div class="acciones">
                        <button class="btn-editar" data-id="${u.id}">
                            Editar
                        </button>
                        <button class="btn-eliminar" data-id="${u.id}" data-usuario="${u.usuario}">
                            Eliminar
                        </button>
                    </div>
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

    const botonEditar = e.target.closest(".btn-editar");

    if(botonEditar){
        const usuario = usuariosCache.find(u => String(u.id) === botonEditar.dataset.id);
        if(usuario){
            abrirModal(usuario);
        }
        return;
    }

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
const tituloModal = document.getElementById("tituloModal");
const btnAgregar = document.getElementById("btnAgregar");
const btnCancelar = document.getElementById("btnCancelar");
const btnGuardar = document.getElementById("btnGuardar");
const mensajeErrorModal = document.getElementById("mensajeErrorModal");

const inputNuevoUsuario = document.getElementById("nuevoUsuario");
const inputNuevoPassword = document.getElementById("nuevoPassword");
const inputNuevoDni = document.getElementById("nuevoDni");
const inputNuevoNombre = document.getElementById("nuevoNombre");
const inputNuevoRol = document.getElementById("nuevoRol");
const inputNuevoActivo = document.getElementById("nuevoActivo");

// Id del usuario en edición, o null cuando el modal está en modo
// "agregar". btnGuardar lo usa para decidir entre POST y PATCH.
let editandoId = null;

function abrirModal(usuario){

    mensajeErrorModal.textContent = "";

    if(usuario){

        editandoId = usuario.id;
        tituloModal.textContent = "Editar Usuario";
        btnGuardar.textContent = "Guardar cambios";

        inputNuevoUsuario.value = usuario.usuario;
        inputNuevoPassword.value = usuario.password;
        inputNuevoDni.value = usuario.dni || "";
        inputNuevoNombre.value = usuario.nombre_completo;
        inputNuevoRol.value = usuario.rol;
        inputNuevoActivo.checked = !!usuario.activo;

    }else{

        editandoId = null;
        tituloModal.textContent = "Agregar Usuario";
        btnGuardar.textContent = "Guardar";

        inputNuevoUsuario.value = "";
        inputNuevoPassword.value = "";
        inputNuevoDni.value = "";
        inputNuevoNombre.value = "";
        inputNuevoRol.value = "";
        inputNuevoActivo.checked = true;

    }

    modalOverlay.classList.add("visible");
    inputNuevoUsuario.focus();

}

function cerrarModal(){
    modalOverlay.classList.remove("visible");
}

btnAgregar.addEventListener("click", function(){
    abrirModal();
});
btnCancelar.addEventListener("click", cerrarModal);

modalOverlay.addEventListener("click", function(e){

    if(e.target === modalOverlay){
        cerrarModal();
    }

});

btnGuardar.addEventListener("click", async function(){

    const usuario = inputNuevoUsuario.value.trim();
    const password = inputNuevoPassword.value;
    const dni = inputNuevoDni.value.trim();
    const nombre = inputNuevoNombre.value.trim();
    const rol = inputNuevoRol.value.trim();
    const activo = inputNuevoActivo.checked;

    mensajeErrorModal.textContent = "";

    if(!usuario || !password || !dni || !nombre || !rol){
        mensajeErrorModal.textContent = "Complete todos los campos.";
        return;
    }

    const editando = editandoId !== null;

    btnGuardar.disabled = true;
    btnGuardar.textContent = "GUARDANDO...";

    try{

        const datos = {
            usuario: usuario,
            password: password,
            dni: dni,
            nombre_completo: nombre,
            rol: rol,
            activo: activo
        };

        if(editando){

            await supabaseFetch(
                "/usuarios_app?id=eq." + encodeURIComponent(editandoId),
                {
                    method: "PATCH",
                    body: JSON.stringify(datos)
                }
            );

        }else{

            await supabaseFetch(
                "/usuarios_app",
                {
                    method: "POST",
                    body: JSON.stringify(datos)
                }
            );

        }

        cerrarModal();
        cargarUsuarios();

    }catch(e){

        console.error(e);
        mensajeErrorModal.textContent = editando
            ? "No se pudo guardar los cambios. Verifique que el usuario no exista."
            : "No se pudo guardar. Verifique que el usuario no exista.";

    }finally{

        btnGuardar.disabled = false;
        btnGuardar.textContent = editando ? "Guardar cambios" : "Guardar";

    }

});

// ========================================
// INICIO
// ========================================

if(sesion && sesion.rol === "Administrador"){
    cargarUsuarios();
}

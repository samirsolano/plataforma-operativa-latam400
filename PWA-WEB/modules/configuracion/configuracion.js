// ========================================
// SESIÓN Y PERMISOS
// ========================================
// Solo el rol Administrador puede ver este módulo.

const sesion = requerirSesion();

if(sesion && sesion.rol !== "Administrador"){
    window.location.href = "../inicio/home.html";
}

// ========================================
// LISTAR ROLES
// ========================================

const tblRoles = document.getElementById("tblRoles");
const mensajeVacio = document.getElementById("mensajeVacio");

// Guarda la última lista cargada para poder rellenar el modal de
// edición sin tener que volver a pedirla a Supabase.
let rolesCache = [];

async function cargarRoles(){

    tblRoles.innerHTML = "";
    mensajeVacio.style.display = "none";

    try{

        const roles = await supabaseFetch(
            "/roles_app?select=id,nombre,activo&order=nombre.asc"
        );

        rolesCache = roles || [];

        if(!roles || !roles.length){
            mensajeVacio.textContent = "No hay roles registrados.";
            mensajeVacio.style.display = "block";
            return;
        }

        roles.forEach(function(r){

            const tr = document.createElement("tr");

            tr.innerHTML = `
                <td>${r.nombre}</td>
                <td>
                    <span class="estado ${r.activo ? "activo" : "inactivo"}">
                        ${r.activo ? "Activo" : "Inactivo"}
                    </span>
                </td>
                <td>
                    <div class="acciones">
                        ${r.nombre === "Administrador" ? "" : `
                        <button class="btn-permisos" data-nombre="${r.nombre}">
                            Permisos
                        </button>
                        `}
                        <button class="btn-editar" data-id="${r.id}">
                            Editar
                        </button>
                        <button class="btn-eliminar" data-id="${r.id}" data-nombre="${r.nombre}">
                            Eliminar
                        </button>
                    </div>
                </td>
            `;

            tblRoles.appendChild(tr);

        });

    }catch(e){

        console.error(e);
        mensajeVacio.textContent = "No se pudo cargar la lista de roles.";
        mensajeVacio.style.display = "block";

    }

}

// ========================================
// ELIMINAR ROL
// ========================================

tblRoles.addEventListener("click", async function(e){

    const botonPermisos = e.target.closest(".btn-permisos");

    if(botonPermisos){
        abrirModalPermisos(botonPermisos.dataset.nombre);
        return;
    }

    const botonEditar = e.target.closest(".btn-editar");

    if(botonEditar){
        const rol = rolesCache.find(r => String(r.id) === botonEditar.dataset.id);
        if(rol){
            abrirModal(rol);
        }
        return;
    }

    const boton = e.target.closest(".btn-eliminar");

    if(!boton){
        return;
    }

    const id = boton.dataset.id;
    const nombre = boton.dataset.nombre;

    const confirmado = confirm(
        "¿Eliminar el rol \"" + nombre + "\"? Los usuarios que ya lo tengan asignado no cambian, pero dejará de poder elegirse para usuarios nuevos."
    );

    if(!confirmado){
        return;
    }

    boton.disabled = true;
    boton.textContent = "Eliminando...";

    try{

        await supabaseFetch(
            "/roles_app?id=eq." + encodeURIComponent(id),
            { method: "DELETE" }
        );

        cargarRoles();

    }catch(e){

        console.error(e);
        alert("No se pudo eliminar el rol.");
        boton.disabled = false;
        boton.textContent = "Eliminar";

    }

});

// ========================================
// MODAL AGREGAR/EDITAR ROL
// ========================================

const modalOverlay = document.getElementById("modalOverlay");
const tituloModal = document.getElementById("tituloModal");
const btnAgregar = document.getElementById("btnAgregar");
const btnCancelar = document.getElementById("btnCancelar");
const btnGuardar = document.getElementById("btnGuardar");
const mensajeErrorModal = document.getElementById("mensajeErrorModal");

const inputNuevoNombre = document.getElementById("nuevoNombre");
const inputNuevoActivo = document.getElementById("nuevoActivo");

// Id del rol en edición, o null cuando el modal está en modo
// "agregar". btnGuardar lo usa para decidir entre POST y PATCH.
let editandoId = null;

function abrirModal(rol){

    mensajeErrorModal.textContent = "";

    if(rol){

        editandoId = rol.id;
        tituloModal.textContent = "Editar Rol";
        btnGuardar.textContent = "Guardar cambios";

        inputNuevoNombre.value = rol.nombre;
        inputNuevoActivo.checked = !!rol.activo;

    }else{

        editandoId = null;
        tituloModal.textContent = "Agregar Rol";
        btnGuardar.textContent = "Guardar";

        inputNuevoNombre.value = "";
        inputNuevoActivo.checked = true;

    }

    modalOverlay.classList.add("visible");
    inputNuevoNombre.focus();

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

    const nombre = inputNuevoNombre.value.trim();
    const activo = inputNuevoActivo.checked;

    mensajeErrorModal.textContent = "";

    if(!nombre){
        mensajeErrorModal.textContent = "Ingrese el nombre del rol.";
        return;
    }

    const editando = editandoId !== null;

    btnGuardar.disabled = true;
    btnGuardar.textContent = "GUARDANDO...";

    try{

        const datos = {
            nombre: nombre,
            activo: activo
        };

        if(editando){

            await supabaseFetch(
                "/roles_app?id=eq." + encodeURIComponent(editandoId),
                {
                    method: "PATCH",
                    body: JSON.stringify(datos)
                }
            );

        }else{

            await supabaseFetch(
                "/roles_app",
                {
                    method: "POST",
                    body: JSON.stringify(datos)
                }
            );

        }

        cerrarModal();
        cargarRoles();

    }catch(e){

        console.error(e);
        mensajeErrorModal.textContent = editando
            ? "No se pudo guardar los cambios. Verifique que el rol no exista."
            : "No se pudo guardar. Verifique que el rol no exista.";

    }finally{

        btnGuardar.disabled = false;
        btnGuardar.textContent = editando ? "Guardar cambios" : "Guardar";

    }

});

// ========================================
// PERMISOS POR ROL (módulos/submódulos)
// ========================================
// Árbol de módulos: shared/modulos-app.js (MODULOS_APP). Cada
// checkbox de módulo controla si el rol ve esa tarjeta/pantalla por
// completo; cada checkbox de submódulo controla una pantalla puntual
// DENTRO de un módulo que es una "suite" (Check List 5S, Check List
// de Equipos, Planificación y Avance). Ver modules/configuracion/
// permisos-rol.sql para el detalle de la tabla.

const modalPermisosOverlay = document.getElementById("modalPermisosOverlay");
const tituloModalPermisos = document.getElementById("tituloModalPermisos");
const arbolPermisos = document.getElementById("arbolPermisos");
const mensajeErrorPermisos = document.getElementById("mensajeErrorPermisos");
const btnCancelarPermisos = document.getElementById("btnCancelarPermisos");
const btnGuardarPermisos = document.getElementById("btnGuardarPermisos");

// Rol sobre el que está abierto el modal en este momento.
let rolEnEdicionPermisos = null;

function claveModulo(moduloKey, submoduloKey){
    return moduloKey + "." + (submoduloKey || "");
}

function dibujarArbolPermisos(mapaHabilitados){

    arbolPermisos.innerHTML = "";

    MODULOS_APP.forEach(function(modulo){

        const fila = document.createElement("div");
        fila.className = "permiso-modulo";

        const idModulo = "perm_" + modulo.key;
        const marcadoModulo = !!mapaHabilitados[claveModulo(modulo.key, "")];

        fila.innerHTML = `
            <label class="permiso-modulo-label">
                <input type="checkbox" id="${idModulo}" data-modulo="${modulo.key}" ${marcadoModulo ? "checked" : ""}>
                <b>${modulo.nombre}</b>
            </label>
        `;

        if(modulo.submodulos.length){

            const listaSub = document.createElement("div");
            listaSub.className = "permiso-submodulos";

            modulo.submodulos.forEach(function(sub){

                const idSub = "perm_" + modulo.key + "_" + sub.key;
                const marcadoSub = !!mapaHabilitados[claveModulo(modulo.key, sub.key)];

                const filaSub = document.createElement("label");
                filaSub.className = "permiso-submodulo-label";
                filaSub.innerHTML = `
                    <input type="checkbox" id="${idSub}" data-modulo="${modulo.key}" data-submodulo="${sub.key}" ${marcadoSub ? "checked" : ""}>
                    ${sub.nombre}
                `;

                listaSub.appendChild(filaSub);

            });

            fila.appendChild(listaSub);

        }

        arbolPermisos.appendChild(fila);

    });

}

async function abrirModalPermisos(rolNombre){

    rolEnEdicionPermisos = rolNombre;
    mensajeErrorPermisos.textContent = "";
    tituloModalPermisos.textContent = "Permisos de \"" + rolNombre + "\"";

    arbolPermisos.innerHTML = "<p class=\"mensaje-vacio\">Cargando permisos...</p>";
    modalPermisosOverlay.classList.add("visible");

    try{

        const filas = await supabaseFetch(
            "/permisos_rol?rol=eq." + encodeURIComponent(rolNombre) +
            "&select=modulo_key,submodulo_key,habilitado"
        );

        const mapaHabilitados = {};

        (filas || []).forEach(function(f){
            mapaHabilitados[claveModulo(f.modulo_key, f.submodulo_key)] = !!f.habilitado;
        });

        dibujarArbolPermisos(mapaHabilitados);

    }catch(e){

        console.error(e);
        arbolPermisos.innerHTML = "";
        mensajeErrorPermisos.textContent = "No se pudieron cargar los permisos de este rol.";

    }

}

function cerrarModalPermisos(){
    modalPermisosOverlay.classList.remove("visible");
    rolEnEdicionPermisos = null;
}

btnCancelarPermisos.addEventListener("click", cerrarModalPermisos);

modalPermisosOverlay.addEventListener("click", function(e){
    if(e.target === modalPermisosOverlay){
        cerrarModalPermisos();
    }
});

btnGuardarPermisos.addEventListener("click", async function(){

    if(!rolEnEdicionPermisos){
        return;
    }

    mensajeErrorPermisos.textContent = "";

    const filas = [];

    MODULOS_APP.forEach(function(modulo){

        filas.push({
            rol: rolEnEdicionPermisos,
            modulo_key: modulo.key,
            submodulo_key: "",
            habilitado: document.getElementById("perm_" + modulo.key).checked
        });

        modulo.submodulos.forEach(function(sub){
            filas.push({
                rol: rolEnEdicionPermisos,
                modulo_key: modulo.key,
                submodulo_key: sub.key,
                habilitado: document.getElementById("perm_" + modulo.key + "_" + sub.key).checked
            });
        });

    });

    btnGuardarPermisos.disabled = true;
    btnGuardarPermisos.textContent = "GUARDANDO...";

    try{

        await supabaseFetch(
            "/permisos_rol?on_conflict=rol,modulo_key,submodulo_key",
            {
                method: "POST",
                headers: {
                    "Prefer": "resolution=merge-duplicates,return=minimal"
                },
                body: JSON.stringify(filas)
            }
        );

        cerrarModalPermisos();

    }catch(e){

        console.error(e);
        mensajeErrorPermisos.textContent = "No se pudieron guardar los permisos.";

    }finally{

        btnGuardarPermisos.disabled = false;
        btnGuardarPermisos.textContent = "Guardar permisos";

    }

});

// ========================================
// INICIO
// ========================================

if(sesion && sesion.rol === "Administrador"){
    cargarRoles();
}

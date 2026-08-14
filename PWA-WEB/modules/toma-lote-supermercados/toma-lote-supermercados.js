// ========================================
// SESIÓN Y PERMISOS
// ========================================
// Solo el rol Administrador puede ver este módulo.

const sesion = requerirSesion();

if(sesion){

    if(sesion.rol !== "Administrador"){
        window.location.href = "../inicio/home.html";
    }

    document.getElementById("nombreUsuario").textContent = sesion.nombre_completo;
    document.getElementById("rolUsuario").textContent = sesion.rol;

}

const btnPerfil = document.getElementById("btnPerfil");
const menuUsuario = document.getElementById("menuUsuario");

btnPerfil.addEventListener("click", function(e){

    e.stopPropagation();
    menuUsuario.style.display = menuUsuario.style.display === "block" ? "none" : "block";

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
// TABS (links del sidebar)
// ========================================

document.querySelectorAll(".tab-link").forEach(function(link){

    link.addEventListener("click", function(e){

        e.preventDefault();

        document.querySelectorAll(".tab-link").forEach(function(l){
            l.classList.remove("activo");
        });

        document.querySelectorAll(".tab-contenido").forEach(function(c){
            c.classList.add("oculto");
        });

        link.classList.add("activo");
        document.getElementById(link.dataset.tab).classList.remove("oculto");

    });

});

// ========================================
// DATA MODULADO
// ========================================

const archivoDataModulado =
    document.getElementById(
        "archivoDataModulado"
    );

const nombreDataModulado =
    document.getElementById(
        "nombreDataModulado"
    );

archivoDataModulado.addEventListener(
    "change",
    function(e){

        const archivo =
            e.target.files[0];

        if(!archivo){
            return;
        }

        nombreDataModulado.textContent =
            archivo.name;

        // Simulación temporal

        document.getElementById(
            "totalRegistros"
        ).textContent =
            "12,458";

        document.getElementById(
            "totalViajes"
        ).textContent =
            "3";

        cargarViajesDemo();

    }
);

// ========================================
// VIAJES DEMO
// ========================================

function cargarViajesDemo(){

    const cmb =
        document.getElementById(
            "cmbViaje"
        );

    cmb.innerHTML =
        "";

    const viajes = [

        "FO001 - Entregas 10,20,30",

        "FO002 - Entregas 10,20",

        "FO003 - Entregas 10,20,30,40"

    ];

    viajes.forEach(

        viaje => {

            const option =
                document.createElement(
                    "option"
                );

            option.value =
                viaje;

            option.textContent =
                viaje;

            cmb.appendChild(
                option
            );

        }

    );

    cargarTablaDemo();

}

// ========================================
// TABLA DEMO
// ========================================

function cargarTablaDemo(){

    const tbody =
        document.getElementById(
            "tblViajes"
        );

    tbody.innerHTML =
        "";

    const datos = [

        {
            viaje:"FO001",
            entregas:"10,20,30",
            hu:320,
            modulacion:"Pendiente",
            fase:"Pendiente",
            estado:"Disponible",
            usuario:"-"
        },

        {
            viaje:"FO002",
            entregas:"10,20",
            hu:180,
            modulacion:"Pendiente",
            fase:"Pendiente",
            estado:"Disponible",
            usuario:"-"
        },

        {
            viaje:"FO003",
            entregas:"10,20,30,40",
            hu:250,
            modulacion:"Pendiente",
            fase:"Pendiente",
            estado:"Disponible",
            usuario:"-"
        }

    ];

    datos.forEach(

        item => {

            const tr =
                document.createElement(
                    "tr"
                );

            tr.innerHTML =

            `
            <td>${item.viaje}</td>

            <td>${item.entregas}</td>

            <td>${item.hu}</td>

            <td>${item.modulacion}</td>

            <td>${item.fase}</td>

            <td>
                <span class="estado disponible">
                    ${item.estado}
                </span>
            </td>

            <td>${item.usuario}</td>

            <td>
                Ver
            </td>
            `;

            tbody.appendChild(
                tr
            );

        }

    );

}

// ========================================
// PROCESAR VIAJE
// ========================================

document.getElementById(
    "btnProcesar"
).addEventListener(

    "click",

    function(){

        const viaje =
            document.getElementById(
                "cmbViaje"
            ).value;

        const modulacion =
            document.getElementById(
                "archivoModulacion"
            ).files[0];

        const fase =
            document.getElementById(
                "archivoFase"
            ).files[0];

        if(!viaje){

            alert(
                "Seleccione un viaje"
            );

            return;

        }

        if(!modulacion){

            alert(
                "Seleccione archivo de modulación"
            );

            return;

        }

        if(!fase){

            alert(
                "Seleccione archivo de fase"
            );

            return;

        }

        alert(
            "Viaje procesado correctamente"
        );

    }

);

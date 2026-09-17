// ========================================
// TABLERO "PROMOTOR 5S" — un cartel por pasillo, estilo
// banner rojo + logo, con los 3 turnos y su foto/nombre.
// ========================================

const ORDEN_TURNOS = ["DIA", "INTERMEDIO", "NOCHE"];

const ETIQUETAS_TURNO = {
    DIA: "1er turno",
    INTERMEDIO: "2do turno",
    NOCHE: "3er turno"
};

// Mismo placeholder corporativo que usa el resto de la app
// (Check List 5S / auditoria.js) cuando no hay foto propia.
const FOTO_DEFAULT =
    "https://drive.google.com/thumbnail?id=1PhR8P8O6Uvsa7kIRptinQonJ3mlEopoV&sz=w800";

const mensajeCarga = document.getElementById("mensajeCarga");
const contenedorTablero = document.getElementById("contenedorTablero");

document.getElementById("btnImprimir").addEventListener("click", function(){
    window.print();
});

async function cargarTablero(){

    try{

        const [promotores, fotos] = await Promise.all([
            checklistFetch(
                "/promotores_5s?select=zona,pasillo,turno,dni,nombre&activo=eq.true&order=zona.asc,pasillo.asc,turno.asc"
            ),
            checklistFetch(
                "/fotos_colaboradores?select=dni,foto"
            )
        ]);

        if(!promotores || !promotores.length){
            mensajeCarga.textContent =
                "No hay Promotores 5S registrados. Ve a \"Promotor 5S\" y agrega o carga desde Colaboradores Activos.";
            return;
        }

        const fotosPorDni = {};

        (fotos || []).forEach(function(f){
            fotosPorDni[f.dni] = f.foto;
        });

        const grupos = agruparPorPasillo(promotores);

        renderizarTablero(grupos, fotosPorDni);

        mensajeCarga.style.display = "none";

    }catch(e){

        console.error(e);
        mensajeCarga.textContent = "No se pudo cargar el tablero.";

    }

}

function agruparPorPasillo(promotores){

    const mapa = {};
    const orden = [];

    promotores.forEach(function(p){

        const clave = p.zona + "||" + p.pasillo;

        if(!mapa[clave]){
            mapa[clave] = { zona: p.zona, pasillo: p.pasillo, porTurno: {} };
            orden.push(clave);
        }

        mapa[clave].porTurno[p.turno] = p;

    });

    return orden.map(clave => mapa[clave]);

}

function renderizarTablero(grupos, fotosPorDni){

    contenedorTablero.innerHTML = "";

    grupos.forEach(function(grupo){

        const tarjeta = document.createElement("div");
        tarjeta.className = "tarjeta-pasillo";

        const personasHtml = ORDEN_TURNOS.map(function(turno){

            const persona = grupo.porTurno[turno];

            if(!persona){

                return `
                    <div class="persona vacia">
                        <div class="foto-persona">Sin asignar</div>
                        <div class="etiqueta-turno">${ETIQUETAS_TURNO[turno]}</div>
                        <div class="etiqueta-rol">Promotor 5S</div>
                    </div>
                `;

            }

            const foto = fotosPorDni[persona.dni] || FOTO_DEFAULT;

            return `
                <div class="persona">
                    <img class="foto-persona" src="${foto}" alt="${persona.nombre}">
                    <div class="etiqueta-rol">Promotor 5S</div>
                    <div class="etiqueta-turno">${ETIQUETAS_TURNO[turno]}</div>
                    <div class="nombre-persona">${persona.nombre}</div>
                </div>
            `;

        }).join("");

        tarjeta.innerHTML = `
            <div class="tarjeta-banner">
                <div class="titulo-principal">Promotores 5S</div>
                <div class="subtitulo">${grupo.zona} — ${grupo.pasillo}</div>
            </div>
            <div class="tarjeta-logo">
                ${LOGO_SIGMA_SVG}
            </div>
            <div class="tarjeta-personas">
                ${personasHtml}
            </div>
        `;

        contenedorTablero.appendChild(tarjeta);

    });

}

cargarTablero();

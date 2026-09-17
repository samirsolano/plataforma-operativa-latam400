// ========================================
// TABLERO "PROMOTOR 5S" — EQUIPO COMPLETO
// Un solo póster con los 3 turnos, y dentro de cada turno todos
// los pasillos con foto/nombre/zona — la vista "consolidada" que
// complementa a tablero.html (que es una tarjeta por pasillo).
// ========================================

const ORDEN_TURNOS = ["DIA", "INTERMEDIO", "NOCHE"];

const ETIQUETAS_TURNO = {
    DIA: "1er turno — DÍA",
    INTERMEDIO: "2do turno — INTERMEDIO",
    NOCHE: "3er turno — NOCHE"
};

// Mismo placeholder corporativo que usa el resto de la app
// (Check List 5S / auditoria.js) cuando no hay foto propia.
const FOTO_DEFAULT =
    "https://drive.google.com/thumbnail?id=1PhR8P8O6Uvsa7kIRptinQonJ3mlEopoV&sz=w800";

const mensajeCarga = document.getElementById("mensajeCarga");
const contenedorTurnos = document.getElementById("contenedorTurnos");

document.getElementById("logoSigma").innerHTML = LOGO_SIGMA_SVG;

document.getElementById("btnImprimir").addEventListener("click", function(){
    window.print();
});

async function cargarEquipoCompleto(){

    try{

        const [promotores, fotos] = await Promise.all([
            checklistFetch(
                "/promotores_5s?select=zona,pasillo,turno,dni,nombre&activo=eq.true&order=turno.asc,zona.asc,pasillo.asc"
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

        renderizarEquipoCompleto(promotores, fotosPorDni);

        mensajeCarga.style.display = "none";

    }catch(e){

        console.error(e);
        mensajeCarga.textContent = "No se pudo cargar el tablero.";

    }

}

function renderizarEquipoCompleto(promotores, fotosPorDni){

    contenedorTurnos.innerHTML = "";

    ORDEN_TURNOS.forEach(function(turno){

        const personasDelTurno = promotores.filter(p => p.turno === turno);

        if(!personasDelTurno.length){
            return;
        }

        const bloque = document.createElement("div");
        bloque.className = "bloque-turno";

        const chipsHtml = personasDelTurno.map(function(persona){

            const foto = fotosPorDni[persona.dni] || FOTO_DEFAULT;

            return `
                <div class="chip-persona">
                    <img class="foto-persona" src="${foto}" alt="${persona.nombre}">
                    <div class="nombre-persona">${persona.nombre}</div>
                    <span class="zona-persona">${persona.zona}</span>
                    <div class="pasillo-persona">${persona.pasillo}</div>
                </div>
            `;

        }).join("");

        bloque.innerHTML = `
            <h3>${ETIQUETAS_TURNO[turno]}</h3>
            <div class="fila-personas">
                ${chipsHtml}
            </div>
        `;

        contenedorTurnos.appendChild(bloque);

    });

}

cargarEquipoCompleto();

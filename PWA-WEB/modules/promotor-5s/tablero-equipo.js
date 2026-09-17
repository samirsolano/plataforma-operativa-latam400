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

// Cuántas personas caben cómodas en una sola hoja (7 columnas x 3
// filas, el mismo layout que ya se ve en pantalla). Si un turno
// tiene más gente que esto, se reparte en varias hojas en vez de
// achicar todo para que "quepa" — así nunca se recorta a nadie.
const PERSONAS_POR_HOJA = 21;

function partirEnGrupos(lista, tamano){

    const grupos = [];

    for(let i = 0; i < lista.length; i += tamano){
        grupos.push(lista.slice(i, i + tamano));
    }

    return grupos;

}

// Mismo placeholder corporativo que usa el resto de la app
// (Check List 5S / auditoria.js) cuando no hay foto propia.
const FOTO_DEFAULT =
    "https://drive.google.com/thumbnail?id=1PhR8P8O6Uvsa7kIRptinQonJ3mlEopoV&sz=w800";

const mensajeCarga = document.getElementById("mensajeCarga");
const contenedorTurnos = document.getElementById("contenedorTurnos");

document.getElementById("btnImprimir").addEventListener("click", function(){
    window.print();
});

async function cargarEquipoCompleto(){

    try{

        const [promotores, fotos, logoUrl] = await Promise.all([
            checklistFetch(
                "/promotores_5s?select=zona,pasillo,turno,dni,nombre&activo=eq.true&order=turno.asc,zona.asc,pasillo.asc"
            ),
            checklistFetch(
                "/fotos_colaboradores?select=dni,foto"
            ),
            cargarLogoSigmaTransparente()
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

        renderizarEquipoCompleto(promotores, fotosPorDni, logoUrl);

        mensajeCarga.style.display = "none";

    }catch(e){

        console.error(e);
        mensajeCarga.textContent = "No se pudo cargar el tablero.";

    }

}

function renderizarEquipoCompleto(promotores, fotosPorDni, logoUrl){

    contenedorTurnos.innerHTML = "";

    ORDEN_TURNOS.forEach(function(turno){

        const personasDelTurno = promotores.filter(p => p.turno === turno);

        if(!personasDelTurno.length){
            return;
        }

        const grupos = partirEnGrupos(personasDelTurno, PERSONAS_POR_HOJA);

        grupos.forEach(function(grupo, indice){

            const hoja = document.createElement("div");
            hoja.className = "hoja-turno";

            const chipsHtml = grupo.map(function(persona){

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

            const sufijoHoja = grupos.length > 1
                ? " · Hoja " + (indice + 1) + " de " + grupos.length
                : "";

            hoja.innerHTML = `
                <div class="hoja-banner">
                    <div class="hoja-logo"><img class="logo-sigma-img" src="${logoUrl}" alt="SIGMA"></div>
                    <div class="hoja-titulos">
                        <h2>PROMOTORES 5S</h2>
                        <span>${ETIQUETAS_TURNO[turno]} — LATAM 400 CL${sufijoHoja}</span>
                    </div>
                </div>
                <div class="hoja-personas">
                    ${chipsHtml}
                </div>
            `;

            contenedorTurnos.appendChild(hoja);

        });

    });

}

cargarEquipoCompleto();

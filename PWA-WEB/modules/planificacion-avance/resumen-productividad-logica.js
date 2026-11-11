// =========================================================
// RESUMEN DE PRODUCTIVIDAD - Lógica
// Todos los colaboradores ordenados por TN total (mayor a menor),
// mostrando además el promedio por día y por hora, para
// un rango de fechas y una función (proceso) elegida. Usa la función
// resumen_productividad_sap (ver resumen-productividad-sap.sql)
// sobre "tareas_almacen_sap" — agrupa del lado del servidor porque
// un rango de varias semanas son cientos de miles de filas crudas.
// =========================================================

// Funciones (proceso) disponibles en tareas_almacen_sap — mismas que
// ya se ven en Diálogo Diario / Dashboard.
const PROD_FUNCIONES = ["PICKING", "EXTRACCION", "ALMACENAMIENTO", "INGRESO", "REPO"];

async function obtenerResumenProductividad(desde, hasta){

    const filas = await planifFetch(
        "/rpc/resumen_productividad_sap?p_desde=" + encodeURIComponent(desde) +
        "&p_hasta=" + encodeURIComponent(hasta)
    ) || [];

    // auxiliar -> proceso -> { tn, dias, horas }
    const porAuxiliar = {};

    filas.forEach(function(f){

        const proceso = (f.proceso || "").toUpperCase();

        if(PROD_FUNCIONES.indexOf(proceso) === -1){
            return;
        }

        const auxiliar = f.auxiliar;
        const tn = Number(f.tn) || 0;
        const dias = Number(f.dias) || 0;
        const horas = Number(f.horas) || 0;

        if(!porAuxiliar[auxiliar]){
            porAuxiliar[auxiliar] = {};
        }

        porAuxiliar[auxiliar][proceso] = { tn: tn, dias: dias, horas: horas };

    });

    return porAuxiliar;

}

function prodNormalizarNombre(n){
    return String(n || "").trim().toUpperCase().replace(/\s+/g, " ");
}

// nombre (auxiliar, tal como viene de SAP) -> supervisor. El nombre de
// tareas_almacen_sap coincide con "colaboradores.nombre_completo", pero
// NO con "colaboradores_activos.nombre" (allí está en otro orden, p.ej.
// "Jaime Amador Morello Fernandez" vs "MORELLO FERNANDEZ JAIME AMADOR").
// Por eso se cruza por DNI: colaboradores (nombre SAP -> dni) +
// colaboradores_activos (dni -> supervisor vigente). Si no está activo,
// se usa el supervisor guardado en colaboradores.
async function obtenerMapaSupervisoresProductividad(){

    const resultados = await Promise.all([
        planifFetch("/colaboradores?select=nombre_completo,dni,supervisor"),
        planifFetch("/colaboradores_activos?select=nombre,dni,supervisor&activo=eq.true")
    ]);

    const colaboradores = resultados[0] || [];
    const activos = resultados[1] || [];

    const supervisorPorDni = {};
    const mapa = {};

    activos.forEach(function(f){
        if(f.dni){
            supervisorPorDni[String(f.dni).trim()] = f.supervisor || "Sin asignar";
        }
        if(f.nombre){
            mapa[prodNormalizarNombre(f.nombre)] = f.supervisor || "Sin asignar";
        }
    });

    colaboradores.forEach(function(f){
        if(!f.nombre_completo){
            return;
        }
        const dni = String(f.dni || "").trim();
        const supervisor = supervisorPorDni[dni] || f.supervisor;
        if(supervisor){
            mapa[prodNormalizarNombre(f.nombre_completo)] = supervisor;
        }
    });

    return mapa;

}

// Arma la lista completa ordenada por TN total (mayor a menor) para UNA función,
// opcionalmente filtrado por supervisor (mapa nombre->supervisor de
// obtenerMapaSupervisoresProductividad).
function prodTopPorFuncion(porAuxiliar, funcion, supervisorMapa, supervisorFiltro){

    return Object.keys(porAuxiliar)
        .map(function(auxiliar){

            const datos = porAuxiliar[auxiliar][funcion];

            if(!datos || datos.dias <= 0){
                return null;
            }

            const supervisor = (supervisorMapa && supervisorMapa[prodNormalizarNombre(auxiliar)]) || "Sin asignar";

            if(supervisorFiltro && supervisor !== supervisorFiltro){
                return null;
            }

            return {
                auxiliar: auxiliar,
                dias: datos.dias,
                tnTotal: ddRedondear(datos.tn),
                promedio: ddRedondear(datos.tn / datos.dias),
                horasTrabajadas: datos.horas,
                promedioHora: ddRedondear(datos.horas > 0 ? datos.tn / datos.horas : 0),
                supervisor: supervisor
            };

        })
        .filter(Boolean)
        .sort(function(a, b){ return b.tnTotal - a.tnTotal || b.promedio - a.promedio; });

}

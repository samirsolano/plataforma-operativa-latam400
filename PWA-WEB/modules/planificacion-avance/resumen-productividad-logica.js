// =========================================================
// RESUMEN DE PRODUCTIVIDAD - Lógica
// Top de colaboradores por PROMEDIO de TN por día trabajado (no
// total acumulado — así no premia solo por asistir más días), para
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
    return String(n || "").trim().toUpperCase();
}

// nombre (auxiliar) -> supervisor, desde "colaboradores_activos" —
// misma tabla/proyecto Supabase que usa Check List 5S (ver
// construirMapaSupervisores en reporte-checklist.js) para el filtro
// de Supervisor.
async function obtenerMapaSupervisoresProductividad(){

    const filas = await planifFetch(
        "/colaboradores_activos?select=nombre,supervisor&activo=eq.true"
    ) || [];

    const mapa = {};

    filas.forEach(function(f){
        if(f.nombre){
            mapa[prodNormalizarNombre(f.nombre)] = f.supervisor || "Sin asignar";
        }
    });

    return mapa;

}

// Arma el top ya ordenado por promedio (TN/día) para UNA función,
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
        .sort(function(a, b){ return b.promedio - a.promedio; });

}

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

    // auxiliar -> proceso -> { tn, dias }
    const porAuxiliar = {};

    filas.forEach(function(f){

        const proceso = (f.proceso || "").toUpperCase();

        if(PROD_FUNCIONES.indexOf(proceso) === -1){
            return;
        }

        const auxiliar = f.auxiliar;
        const tn = Number(f.tn) || 0;
        const dias = Number(f.dias) || 0;

        if(!porAuxiliar[auxiliar]){
            porAuxiliar[auxiliar] = {};
        }

        porAuxiliar[auxiliar][proceso] = { tn: tn, dias: dias };

    });

    return porAuxiliar;

}

// Arma el top ya ordenado por promedio (TN/día) para UNA función.
function prodTopPorFuncion(porAuxiliar, funcion){

    return Object.keys(porAuxiliar)
        .map(function(auxiliar){

            const datos = porAuxiliar[auxiliar][funcion];

            if(!datos || datos.dias <= 0){
                return null;
            }

            return {
                auxiliar: auxiliar,
                dias: datos.dias,
                tnTotal: ddRedondear(datos.tn),
                promedio: ddRedondear(datos.tn / datos.dias)
            };

        })
        .filter(Boolean)
        .sort(function(a, b){ return b.promedio - a.promedio; });

}

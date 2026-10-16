// ========================================
// ÁRBOL DE MÓDULOS DE LA PLATAFORMA
// ========================================
// Fuente única de verdad para el sistema de permisos por rol
// (ver modules/configuracion). Cada entrada es un módulo del Panel
// Principal; "submodulos" son las pantallas internas de los módulos
// que en realidad son una "suite" de varias páginas (Check List 5S,
// Check List de Equipos) o de varias secciones dentro de una sola
// página (Planificación y Avance, ver los mismos keys que usa
// abrirModulo() en planificacion-avance.js).
//
// Si se agrega un módulo o submódulo nuevo a la plataforma, se agrega
// acá también, para que aparezca en Configuración → Permisos.

const MODULOS_APP = [

    {
        key: "checklist-5s",
        nombre: "Check List 5S",
        submodulos: [
            { key: "carga-mensual", nombre: "Carga Mensual" },
            { key: "colaboradores-activos", nombre: "Colaboradores Activos" },
            { key: "fotos-colaboradores", nombre: "Fotos de Colaboradores" },
            { key: "preguntas-checklist", nombre: "Preguntas Checklist" },
            { key: "reporte-checklist", nombre: "Reporte Semanal/Mensual" },
            { key: "promotor-5s", nombre: "Promotor 5S" }
        ]
    },

    { key: "checklist-higiene", nombre: "Checklist Higiene", submodulos: [] },

    {
        key: "checklist-equipos",
        nombre: "Check List de Equipos",
        submodulos: [
            { key: "lista-equipos", nombre: "Lista de Equipos" },
            { key: "preguntas", nombre: "Preguntas" },
            { key: "resumen", nombre: "Resumen" }
        ]
    },

    { key: "reporte-anomalias", nombre: "Sugerencias y Anomalías", submodulos: [] },

    {
        key: "planificacion-avance",
        nombre: "Planificación y Avance",
        submodulos: [
            { key: "planificado", nombre: "Planificado Drive" },
            { key: "recursos", nombre: "Planificación Recursos" },
            { key: "replanificacion", nombre: "Replanificación Recursos" },
            { key: "sap", nombre: "Cargar Data SAP" },
            { key: "dashboard", nombre: "Dashboard" },
            { key: "horahora", nombre: "Hora x Hora" },
            { key: "dialogodiario", nombre: "Diálogo Diario" },
            { key: "productividad", nombre: "Resumen Productividad" }
        ]
    },

    { key: "reconocimiento", nombre: "Reconocimiento", submodulos: [] },
    { key: "skill-matrix", nombre: "Skill Matrix", submodulos: [] },
    { key: "usuarios", nombre: "Usuarios", submodulos: [] },
    { key: "usuarios-centro-proyectos", nombre: "Usuarios Centro de Proyectos", submodulos: [] },
    { key: "toma-lote-supermercados", nombre: "Toma de Lote Supermercados", submodulos: [] },
    { key: "toma-lote-farmacia", nombre: "Toma de Lote Farmacia", submodulos: [] },
    { key: "inventario-paletas", nombre: "Inventario de Paletas", submodulos: [] },
    { key: "inventario-picking", nombre: "Inventario Picking", submodulos: [] },
    { key: "configuracion", nombre: "Configuración", submodulos: [] }

];

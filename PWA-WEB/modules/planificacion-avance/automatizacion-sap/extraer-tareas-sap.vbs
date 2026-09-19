Option Explicit

' ============================================================
' EXTRAER TAREAS DE ALMACEN DESDE SAP (/SCWM/MON) A EXCEL
' ============================================================
' Basado en una grabacion de SAP GUI Scripting ("Script6.vbs").
' Lo unico que hace este script es lo mismo que hacia el original:
' entrar a /SCWM/MON, abrir el monitor de tareas de almacen guardado
' y exportar el resultado a Excel (&XXL). Ese Excel es despues el
' que se sube a mano en la web, en Planificacion y Avance -> SAP ->
' "SUBIR ARCHIVO SAP" (sap.js / procesarArchivoSAP, tabla
' tareas_almacen_sap). Este script NO sube nada a la web ni a
' Supabase: solo automatiza la parte de SAP -> Excel.
'
' Unico cambio respecto al original: el rango de fecha/hora
' (P_CODFR/P_COTFR/P_CODTO/P_COTTO) ya NO esta escrito a mano
' (estaba fijo en "19.09.2026 07:00:00 - 19:00:00", la fecha del
' dia en que se grabo). Ahora se calcula solo, con el mismo
' criterio de turno que ya usa la web (obtenerFechaTurnoActivo en
' shared/planificacion-config.js):
'
'   DIA:   07:00 a 19:00 del mismo dia
'   NOCHE: 19:00 de un dia a 07:00 del dia siguiente
'
' Asi el script se puede correr (o programar en el Task Scheduler
' de Windows) sin editarlo cada vez.
' ============================================================

Dim application, connection, session

If Not IsObject(application) Then
    Dim SapGuiAuto
    Set SapGuiAuto = GetObject("SAPGUI")
    Set application = SapGuiAuto.GetScriptingEngine
End If

If Not IsObject(connection) Then
    Set connection = application.Children(0)
End If

If Not IsObject(session) Then
    Set session = connection.Children(0)
End If

If IsObject(WScript) Then
    WScript.ConnectObject session, "on"
    WScript.ConnectObject application, "on"
End If

' ------------------------------------------------------------
' Calcular fecha/hora del turno activo AHORA MISMO
' ------------------------------------------------------------

Dim horaActual, fechaDesde, horaDesde, fechaHasta, horaHasta
horaActual = Hour(Now)

If horaActual >= 7 And horaActual < 19 Then

    ' Turno DIA: hoy 07:00 -> hoy 19:00
    fechaDesde = Date
    horaDesde  = "07:00:00"
    fechaHasta = Date
    horaHasta  = "19:00:00"

ElseIf horaActual >= 19 Then

    ' Turno NOCHE recien empezado hoy: hoy 19:00 -> mañana 07:00
    fechaDesde = Date
    horaDesde  = "19:00:00"
    fechaHasta = DateAdd("d", 1, Date)
    horaHasta  = "07:00:00"

Else

    ' Entre 00:00 y 06:59: sigue el turno NOCHE que empezo AYER
    fechaDesde = DateAdd("d", -1, Date)
    horaDesde  = "19:00:00"
    fechaHasta = Date
    horaHasta  = "07:00:00"

End If

' SAP espera el formato DD.MM.AAAA
Dim textoFechaDesde, textoFechaHasta
textoFechaDesde = Right("00" & Day(fechaDesde), 2) & "." & Right("00" & Month(fechaDesde), 2) & "." & Year(fechaDesde)
textoFechaHasta = Right("00" & Day(fechaHasta), 2) & "." & Right("00" & Month(fechaHasta), 2) & "." & Year(fechaHasta)

' ------------------------------------------------------------
' Abrir /SCWM/MON y entrar al monitor de tareas de almacen
' (nodo "Tarea de almacen", bajo Modulacion -> Documentos;
' confirmado a mano el 19/09/2026 - el arbol de esta empresa no
' coincide con el de la grabacion original, por eso el codigo
' cambio de "N0000000033" a "N0000000183")
' ------------------------------------------------------------

session.findById("wnd[0]").maximize
session.findById("wnd[0]/tbar[0]/okcd").text = "/n/scwm/mon"
session.findById("wnd[0]").sendVKey 0
session.findById("wnd[0]/usr/shell/shellcont[0]/shell").selectedNode = "N0000000183"
session.findById("wnd[0]/usr/shell/shellcont[0]/shell").doubleClickNode "N0000000183"

' Trae TODOS los status (igual que el original: los 3 checkboxes
' de status quedan desmarcados, no solo Cancelados/Abiertos/Historico)
session.findById("wnd[1]/usr/chkP_TOSTCA").selected = False
session.findById("wnd[1]/usr/chkP_TOSTOP").selected = False
session.findById("wnd[1]/usr/chkP_TOSTHO").selected = False

' Rango de fecha/hora del turno activo, calculado arriba
session.findById("wnd[1]/usr/ctxtP_CODFR").text = textoFechaDesde
session.findById("wnd[1]/usr/ctxtP_COTFR").text = horaDesde
session.findById("wnd[1]/usr/ctxtP_CODTO").text = textoFechaHasta
session.findById("wnd[1]/usr/ctxtP_COTTO").text = horaHasta

session.findById("wnd[1]/usr/ctxtP_COTTO").setFocus
session.findById("wnd[1]/usr/ctxtP_COTTO").caretPosition = 8
session.findById("wnd[1]").sendVKey 8

' ------------------------------------------------------------
' Cargar el layout/variante guardado (igual que el original:
' fila 81 de la lista de variantes) para que la grilla salga con
' las columnas que espera procesarArchivoSAP() en sap-logica.js
' ------------------------------------------------------------

session.findById("wnd[0]/usr/shell/shellcont[1]/shell/shellcont[0]/shell").pressToolbarContextButton "&MB_VARIANT"
session.findById("wnd[0]/usr/shell/shellcont[1]/shell/shellcont[0]/shell").selectContextMenuItem "&LOAD"
session.findById("wnd[1]/usr/subSUB_CONFIGURATION:SAPLSALV_CUL_LAYOUT_CHOOSE:0500/cntlD500_CONTAINER/shellcont/shell").setCurrentCell 81, "TEXT"
session.findById("wnd[1]/usr/subSUB_CONFIGURATION:SAPLSALV_CUL_LAYOUT_CHOOSE:0500/cntlD500_CONTAINER/shellcont/shell").firstVisibleRow = 77
session.findById("wnd[1]/usr/subSUB_CONFIGURATION:SAPLSALV_CUL_LAYOUT_CHOOSE:0500/cntlD500_CONTAINER/shellcont/shell").selectedRows = "81"
session.findById("wnd[1]/usr/subSUB_CONFIGURATION:SAPLSALV_CUL_LAYOUT_CHOOSE:0500/cntlD500_CONTAINER/shellcont/shell").clickCurrentCell

' ------------------------------------------------------------
' Exportar el resultado a Excel (&XXL), igual que el original
' ------------------------------------------------------------

session.findById("wnd[0]/usr/shell/shellcont[1]/shell/shellcont[0]/shell").setCurrentCell 10, "MAKTX"
session.findById("wnd[0]/usr/shell/shellcont[1]/shell/shellcont[0]/shell").contextMenu
session.findById("wnd[0]/usr/shell/shellcont[1]/shell/shellcont[0]/shell").selectContextMenuItem "&XXL"
session.findById("wnd[1]/tbar[0]/btn[20]").press
session.findById("wnd[1]/tbar[0]/btn[0]").press

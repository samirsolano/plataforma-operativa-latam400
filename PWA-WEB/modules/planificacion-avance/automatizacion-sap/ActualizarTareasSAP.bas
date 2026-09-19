Attribute VB_Name = "ActualizarTareasSAP"
Option Explicit

' ============================================================
' ACTUALIZAR TAREAS SAP -> SUPABASE, CADA 1 HORA
' ============================================================
' Reemplaza el flujo manual completo:
'   1. Correr un script SAP GUI para exportar tareas de almacen
'      a Excel (antes: extraer-tareas-sap.vbs, con la ventana de
'      TODO el turno, 12 horas).
'   2. Subir ese Excel a mano en la web (Planificacion y Avance
'      -> SAP -> "SUBIR ARCHIVO SAP").
'
' Esta macro hace las dos cosas sola, cada 1 hora, con una
' ventana de tiempo mas chica (la ultima hora y un poco de
' margen) en vez de todo el turno completo - por eso la
' exportacion en SAP es mas rapida.
'
' Requisitos en esta PC:
'   - SAP GUI abierto y con sesion iniciada (con tu usuario) ANTES
'     de correr esta macro. SAP GUI Scripting se conecta a una
'     sesion que ya existe, no abre una nueva por su cuenta.
'   - Este libro debe quedar ABIERTO en Excel para que
'     Application.OnTime siga disparando la actualizacion cada
'     hora (si cierras Excel, se detiene hasta que lo abras de
'     nuevo).
'   - Habilitar macros al abrir este archivo (Excel lo pide la
'     primera vez, boton "Habilitar contenido").
'
' Ver LEEME-EXCEL.txt para armar el libro paso a paso.
' ============================================================

' ---- Config Supabase (mismo proyecto/llave que ya usa la web en
'      shared/planificacion-config.js: SUPABASE_URL_PLANIF /
'      SUPABASE_KEY_PLANIF - es la llave "publishable", la misma
'      que ya viaja expuesta en el navegador) ----
Private Const SUPABASE_URL As String = "https://iaitqquphjohgsmelhcj.supabase.co/rest/v1"
Private Const SUPABASE_KEY As String = "sb_publishable_rvEz02miPj1MrBVgLd_auw_FlyrVscs"

' Cuantos minutos hacia atras se pide en cada corrida. Mas que 60
' para no perder tareas que SAP confirma con un poco de retraso -
' total, Supabase ignora los id_registro que ya existen (no se
' duplica nada, ver EnviarLoteSupabase).
Private Const MINUTOS_VENTANA As Long = 75

' Cada cuanto se vuelve a correr sola (en minutos)
Private Const MINUTOS_ENTRE_CORRIDAS As Long = 60

Private Const TAMANO_LOTE As Long = 200

Public gProximaCorrida As Date

' ============================================================
' PUNTO DE ENTRADA (boton "Actualizar ahora" y el timer solo)
' ============================================================
Sub ActualizarTareasSAPHoraAHora()

    On Error GoTo TratarError

    RegistrarEstado "Corriendo...", ""

    Dim horaHasta As Date, horaDesde As Date
    horaHasta = Now
    horaDesde = DateAdd("n", -MINUTOS_VENTANA, horaHasta)

    Dim session As Object
    Set session = ObtenerSesionSAP()

    Dim conteoLibrosAntes As Long
    conteoLibrosAntes = Application.Workbooks.Count

    ExportarDesdeSAP session, horaDesde, horaHasta

    Dim libroSAP As Workbook
    Set libroSAP = EsperarLibroExportado(conteoLibrosAntes)

    If libroSAP Is Nothing Then
        RegistrarEstado "ERROR", "No se detecto el Excel exportado por SAP (puede que SAP lo haya abierto en OTRA ventana de Excel, no en esta)."
        GoTo Reprogramar
    End If

    Dim filasLeidas As Long, filasSubidas As Long
    SubirLibroASupabase libroSAP, filasLeidas, filasSubidas

    libroSAP.Close SaveChanges:=False

    RegistrarEstado "OK", "Ventana " & Format(horaDesde, "dd/mm hh:mm") & " a " & Format(horaHasta, "dd/mm hh:mm") & _
        " | Filas leidas: " & filasLeidas & " | Enviadas a Supabase: " & filasSubidas

Reprogramar:
    ProgramarProximaCorrida
    Exit Sub

TratarError:
    RegistrarEstado "ERROR", "Err " & Err.Number & ": " & Err.Description
    ProgramarProximaCorrida

End Sub

' ============================================================
' CONECTAR A LA SESION DE SAP GUI YA ABIERTA
' ============================================================
Function ObtenerSesionSAP() As Object

    Dim sapGuiAuto As Object, application As Object, connection As Object, session As Object

    Set sapGuiAuto = GetObject("SAPGUI")
    Set application = sapGuiAuto.GetScriptingEngine
    Set connection = application.Children(0)
    Set session = connection.Children(0)

    Set ObtenerSesionSAP = session

End Function

' ============================================================
' NAVEGAR EN SAP Y EXPORTAR (mismos pasos que
' extraer-tareas-sap.vbs; la ventana de horaDesde/horaHasta llega
' por parametro en vez de calcularse aca)
' ============================================================
Sub ExportarDesdeSAP(session As Object, horaDesde As Date, horaHasta As Date)

    Dim textoFechaDesde As String, textoFechaHasta As String
    textoFechaDesde = Format(horaDesde, "dd.mm.yyyy")
    textoFechaHasta = Format(horaHasta, "dd.mm.yyyy")

    session.findById("wnd[0]").maximize
    session.findById("wnd[0]/tbar[0]/okcd").Text = "/n/scwm/mon"
    session.findById("wnd[0]").sendVKey 0

    Dim arbol As Object
    Set arbol = session.findById("wnd[0]/usr/shell/shellcont[0]/shell")

    ' El script original (que si funciona) expande la carpeta padre
    ' ANTES de tocar el nodo hijo - sin eso, el arbol recien entrado
    ' (todo colapsado) no carga bien las claves de los hijos. C000000003
    ' es "Documentos" (raiz del arbol) y se ha visto estable en todas
    ' las pruebas.
    arbol.expandNode "C000000003"

    ' El numero de nodo de "Tarea de almacen" (el hijo) SI cambia de
    ' una corrida a otra (SAP recuerda como quedo expandido el arbol la
    ' ultima vez que ese usuario lo abrio) - se prueban los valores ya
    ' vistos, en orden, y se usa el primero que todavia diga "Tarea de
    ' almacen".
    Dim claveNodo As String
    claveNodo = ClaveValidaTareaAlmacen(arbol, Array("N0000000033", "N0000000183"))

    arbol.selectedNode = claveNodo
    arbol.doubleClickNode claveNodo

    session.findById("wnd[1]/usr/chkP_TOSTCA").Selected = False
    session.findById("wnd[1]/usr/chkP_TOSTOP").Selected = False
    session.findById("wnd[1]/usr/chkP_TOSTHO").Selected = False

    session.findById("wnd[1]/usr/ctxtP_CODFR").Text = textoFechaDesde
    session.findById("wnd[1]/usr/ctxtP_COTFR").Text = Format(horaDesde, "hh:mm:ss")
    session.findById("wnd[1]/usr/ctxtP_CODTO").Text = textoFechaHasta
    session.findById("wnd[1]/usr/ctxtP_COTTO").Text = Format(horaHasta, "hh:mm:ss")

    session.findById("wnd[1]/usr/ctxtP_COTTO").SetFocus
    session.findById("wnd[1]/usr/ctxtP_COTTO").CaretPosition = 8
    session.findById("wnd[1]").sendVKey 8

    session.findById("wnd[0]/usr/shell/shellcont[1]/shell/shellcont[0]/shell").pressToolbarContextButton "&MB_VARIANT"
    session.findById("wnd[0]/usr/shell/shellcont[1]/shell/shellcont[0]/shell").selectContextMenuItem "&LOAD"
    session.findById("wnd[1]/usr/subSUB_CONFIGURATION:SAPLSALV_CUL_LAYOUT_CHOOSE:0500/cntlD500_CONTAINER/shellcont/shell").setCurrentCell 81, "TEXT"
    session.findById("wnd[1]/usr/subSUB_CONFIGURATION:SAPLSALV_CUL_LAYOUT_CHOOSE:0500/cntlD500_CONTAINER/shellcont/shell").firstVisibleRow = 77
    session.findById("wnd[1]/usr/subSUB_CONFIGURATION:SAPLSALV_CUL_LAYOUT_CHOOSE:0500/cntlD500_CONTAINER/shellcont/shell").selectedRows = "81"
    session.findById("wnd[1]/usr/subSUB_CONFIGURATION:SAPLSALV_CUL_LAYOUT_CHOOSE:0500/cntlD500_CONTAINER/shellcont/shell").clickCurrentCell

    session.findById("wnd[0]/usr/shell/shellcont[1]/shell/shellcont[0]/shell").setCurrentCell 10, "MAKTX"
    session.findById("wnd[0]/usr/shell/shellcont[1]/shell/shellcont[0]/shell").contextMenu
    session.findById("wnd[0]/usr/shell/shellcont[1]/shell/shellcont[0]/shell").selectContextMenuItem "&XXL"
    session.findById("wnd[1]/tbar[0]/btn[20]").press
    session.findById("wnd[1]/tbar[0]/btn[0]").press

End Sub

' ============================================================
' ESPERAR A QUE APAREZCA EL EXCEL QUE ABRE SAP
' (SAP te dijo que la exportacion cae en una ruta temporal - lo
' mas comun en SAP GUI moderno es que ese archivo temporal se
' abra solo, como un libro nuevo, en Excel. Por eso en vez de
' buscar un archivo por ruta, esta funcion espera a que aparezca
' UN LIBRO NUEVO abierto en este mismo Excel.)
' ============================================================
Function EsperarLibroExportado(conteoAntes As Long) As Workbook

    Dim intento As Integer

    For intento = 1 To 30

        Application.Wait Now + TimeValue("0:00:01")

        If Application.Workbooks.Count > conteoAntes Then
            Set EsperarLibroExportado = Application.Workbooks(Application.Workbooks.Count)
            Exit Function
        End If

    Next intento

    Set EsperarLibroExportado = Nothing

End Function

' ============================================================
' LEER EL EXCEL DE SAP Y SUBIR A SUPABASE (en lotes)
' ============================================================
Sub SubirLibroASupabase(libro As Workbook, ByRef filasLeidas As Long, ByRef filasSubidas As Long)

    Dim hoja As Worksheet
    Set hoja = libro.Sheets(1)

    Dim ultimaFila As Long
    ultimaFila = hoja.Cells(hoja.Rows.Count, 1).End(xlUp).row

    filasLeidas = 0
    filasSubidas = 0

    If ultimaFila < 2 Then
        Exit Sub ' solo encabezado (o vacio) - no hay filas de datos
    End If

    Dim jsonLote As String
    Dim filasEnLote As Long
    jsonLote = ""
    filasEnLote = 0

    Dim fila As Long
    For fila = 2 To ultimaFila

        If Trim(CStr(hoja.Cells(fila, 1).Value)) <> "" Then

            If filasEnLote > 0 Then jsonLote = jsonLote & ","
            jsonLote = jsonLote & ConstruirJSONFila(hoja, fila)

            filasEnLote = filasEnLote + 1
            filasLeidas = filasLeidas + 1

            If filasEnLote >= TAMANO_LOTE Then
                EnviarLoteSupabase "[" & jsonLote & "]"
                filasSubidas = filasSubidas + filasEnLote
                jsonLote = ""
                filasEnLote = 0
            End If

        End If

    Next fila

    If filasEnLote > 0 Then
        EnviarLoteSupabase "[" & jsonLote & "]"
        filasSubidas = filasSubidas + filasEnLote
    End If

End Sub

' ============================================================
' UNA FILA DEL EXCEL -> UN OBJETO JSON
' (mismos campos, mismo orden de columnas y mismo id_registro
' que procesarArchivoSAP() en sap-logica.js, para que quede
' 100% compatible con lo que ya sube "SUBIR ARCHIVO SAP" en la
' web - misma tabla, mismo on_conflict)
' ============================================================
Function ConstruirJSONFila(hoja As Worksheet, fila As Long) As String

    Dim v(0 To 28) As Variant
    Dim c As Integer

    For c = 0 To 28
        v(c) = hoja.Cells(fila, c + 1).Value
    Next c

    Dim idRegistro As String
    idRegistro = CStr(v(0)) & "_" & CStr(v(3)) & "_" & CStr(v(26)) & "_" & CStr(v(13)) & "_" & CStr(v(20))

    Dim json As String
    json = "{"
    json = json & """id_registro"":" & JSONTexto(idRegistro) & ","
    json = json & """tarea_almacen"":" & ConvertirNumeroSAP(v(0)) & ","
    json = json & """orden_almacen"":" & JSONTextoOVacio(v(1)) & ","
    json = json & """status_tarea"":" & JSONTextoOVacio(v(2)) & ","
    json = json & """producto"":" & JSONTextoOVacio(v(3)) & ","
    json = json & """descripcion_producto"":" & JSONTextoOVacio(v(4)) & ","
    json = json & """tipo_stock"":" & JSONTextoOVacio(v(5)) & ","
    json = json & """cantidad_uma"":" & ConvertirNumeroSAP(v(6)) & ","
    json = json & """ubic_procedencia"":" & JSONTextoOVacio(v(7)) & ","
    json = json & """ubic_destino"":" & JSONTextoOVacio(v(8)) & ","
    json = json & """unidad_medida_alternativa"":" & JSONTextoOVacio(v(9)) & ","
    json = json & """clase_proceso_almacen"":" & JSONTextoOVacio(v(10)) & ","
    json = json & """ubic_dest_original"":" & JSONTextoOVacio(v(11)) & ","
    json = json & """unidad_manipulacion_origen"":" & JSONTextoOVacio(v(12)) & ","
    json = json & """ump_destino"":" & JSONTextoOVacio(v(13)) & ","
    json = json & """fecha_inicio"":" & JSONFecha(v(14)) & ","
    json = json & """hora_inicio"":" & JSONHora(v(15)) & ","
    json = json & """confirmado_por"":" & JSONTextoOVacio(v(16)) & ","
    json = json & """fecha_confirmacion"":" & JSONFecha(v(17)) & ","
    json = json & """hora_confirmacion"":" & JSONHora(v(18)) & ","
    json = json & """fase"":" & JSONTextoOVacio(v(19)) & ","
    json = json & """peso_carga"":" & ConvertirNumeroSAP(v(20)) & ","
    json = json & """unidad_peso"":" & JSONTextoOVacio(v(21)) & ","
    json = json & """recurso_origen"":" & JSONTextoOVacio(v(22)) & ","
    json = json & """cola"":" & JSONTextoOVacio(v(23)) & ","
    json = json & """tipo_proceso_almacen"":" & JSONTextoOVacio(v(24)) & ","
    json = json & """denominacion_tipo_proceso"":" & JSONTextoOVacio(v(25)) & ","
    json = json & """cantidad_umb"":" & ConvertirNumeroSAP(v(26)) & ","
    json = json & """unidad_medida_base"":" & JSONTextoOVacio(v(27)) & ","
    json = json & """tipo_almacen_destino"":" & JSONTextoOVacio(v(28))
    json = json & "}"

    ConstruirJSONFila = json

End Function

' ============================================================
' ENVIAR UN LOTE A SUPABASE
' (upsert que ignora duplicados por id_registro, igual que
' insertarSupabaseLoteSAP() en la web - por eso da igual que la
' ventana de 75 minutos se solape con la corrida anterior)
' ============================================================
Sub EnviarLoteSupabase(jsonBody As String)

    Dim http As Object
    Set http = CreateObject("WinHttp.WinHttpRequest.5.1")

    http.Open "POST", SUPABASE_URL & "/tareas_almacen_sap?on_conflict=id_registro", False
    http.SetRequestHeader "apikey", SUPABASE_KEY
    http.SetRequestHeader "Authorization", "Bearer " & SUPABASE_KEY
    http.SetRequestHeader "Content-Type", "application/json"
    http.SetRequestHeader "Prefer", "resolution=ignore-duplicates"

    http.Send jsonBody

    If http.Status < 200 Or http.Status >= 300 Then
        Err.Raise vbObjectError + 1, "EnviarLoteSupabase", _
            "Supabase respondio " & http.Status & ": " & http.responseText
    End If

End Sub

' ============================================================
' HELPERS DE CONVERSION (mismo criterio que sap-logica.js)
' ============================================================
Function ConvertirNumeroSAP(valor As Variant) As String
    If IsEmpty(valor) Or Trim(CStr(valor)) = "" Then
        ConvertirNumeroSAP = "null"
    ElseIf IsNumeric(valor) Then
        ConvertirNumeroSAP = Replace(CStr(CDbl(valor)), ",", ".")
    Else
        ConvertirNumeroSAP = "null"
    End If
End Function

Function JSONFecha(valor As Variant) As String
    If IsEmpty(valor) Then
        JSONFecha = "null"
    ElseIf IsDate(valor) Then
        JSONFecha = Chr(34) & Format(CDate(valor), "yyyy-mm-dd") & Chr(34)
    Else
        JSONFecha = "null"
    End If
End Function

Function JSONHora(valor As Variant) As String
    If IsEmpty(valor) Then
        JSONHora = "null"
    ElseIf IsDate(valor) Then
        JSONHora = Chr(34) & Format(CDate(valor), "hh:mm:ss") & Chr(34)
    Else
        JSONHora = "null"
    End If
End Function

Function JSONTexto(valor As Variant) As String
    Dim texto As String
    texto = CStr(valor)
    texto = Replace(texto, "\", "\\")
    texto = Replace(texto, Chr(34), "\" & Chr(34))
    texto = Replace(texto, vbCrLf, " ")
    texto = Replace(texto, vbCr, " ")
    texto = Replace(texto, vbLf, " ")
    texto = Replace(texto, vbTab, " ")
    JSONTexto = Chr(34) & texto & Chr(34)
End Function

Function JSONTextoOVacio(valor As Variant) As String
    If IsEmpty(valor) Or Trim(CStr(valor)) = "" Then
        JSONTextoOVacio = "null"
    Else
        JSONTextoOVacio = JSONTexto(valor)
    End If
End Function

' ============================================================
' PROGRAMAR / CANCELAR LA PROXIMA CORRIDA (cada
' MINUTOS_ENTRE_CORRIDAS minutos)
' ============================================================
Sub ProgramarProximaCorrida()

    gProximaCorrida = Now + TimeSerial(0, MINUTOS_ENTRE_CORRIDAS, 0)
    Application.OnTime gProximaCorrida, "ActualizarTareasSAPHoraAHora"

End Sub

Sub CancelarProximaCorrida()

    On Error Resume Next
    Application.OnTime gProximaCorrida, "ActualizarTareasSAPHoraAHora", , False
    On Error GoTo 0

End Sub

' ============================================================
' LOG VISIBLE EN LA HOJA "Control" (B2 = estado, B3 = detalle,
' B4 = fecha/hora de esta corrida) - ver LEEME-EXCEL.txt
' ============================================================
Sub RegistrarEstado(estado As String, detalle As String)

    On Error Resume Next

    Dim hoja As Worksheet
    Set hoja = ThisWorkbook.Sheets("Control")

    hoja.Range("B2").Value = estado
    hoja.Range("B3").Value = detalle
    hoja.Range("B4").Value = Now

    On Error GoTo 0

End Sub

' ============================================================
' Prueba cada clave candidata, en orden, y devuelve la primera
' que todavia diga "Tarea de almacen". Si ninguna sirve, avisa
' claro en vez de exportar datos de otro lado del arbol.
' ============================================================
Function ClaveValidaTareaAlmacen(arbol As Object, clavesCandidatas As Variant) As String

    Dim i As Long
    For i = LBound(clavesCandidatas) To UBound(clavesCandidatas)

        Dim clave As String
        clave = clavesCandidatas(i)

        If NormalizarTexto(arbol.GetNodeTextByKey(clave)) = "TAREA DE ALMACEN" Then
            ClaveValidaTareaAlmacen = clave
            Exit Function
        End If

    Next i

    Err.Raise vbObjectError + 3, "ClaveValidaTareaAlmacen", _
        "El nodo del arbol de SAP cambio de lugar otra vez (ninguna de las claves conocidas dice ya " & _
        "'Tarea de almacen'). Corre ListarNodosArbolSAP o MostrarNodoSeleccionado para ubicar la clave nueva."

End Function

' ============================================================
' Insensible a mayusculas/minusculas y a tildes - se usa para
' validar el nodo antes de usarlo (ver ExportarDesdeSAP) y en
' los diagnosticos de mas abajo.
' ============================================================
Function NormalizarTexto(texto As String) As String

    Dim t As String
    t = UCase(Trim(texto))

    t = Replace(t, "Á", "A")
    t = Replace(t, "É", "E")
    t = Replace(t, "Í", "I")
    t = Replace(t, "Ó", "O")
    t = Replace(t, "Ú", "U")
    t = Replace(t, "Ñ", "N")

    NormalizarTexto = t

End Function

' ============================================================
' DIAGNOSTICO (no se usan en la corrida normal - solo si el
' arbol de /SCWM/MON vuelve a cambiar y hay que ubicar de nuevo
' el nodo "Tarea de almacen")
' ============================================================

' Vuelca TODOS los nodos del arbol (clave + texto) en la hoja
' "Control", desde la fila 7, para buscar un nodo por su texto.
Sub ListarNodosArbolSAP()

    Dim session As Object
    Set session = ObtenerSesionSAP()

    Dim arbol As Object
    Set arbol = session.findById("wnd[0]/usr/shell/shellcont[0]/shell")

    Dim claves As Object
    Set claves = arbol.GetAllNodeKeys

    Dim hoja As Worksheet
    Set hoja = ThisWorkbook.Sheets("Control")

    hoja.Range("A6").Value = "Clave"
    hoja.Range("B6").Value = "Texto"

    Dim fila As Long
    fila = 7

    Dim i As Long
    For i = 0 To claves.Count - 1
        hoja.Cells(fila, 1).Value = claves.ElementAt(i)
        hoja.Cells(fila, 2).Value = arbol.GetNodeTextByKey(claves.ElementAt(i))
        fila = fila + 1
    Next i

    MsgBox "Listo: " & claves.Count & " nodos volcados en 'Control' desde la fila 7."

End Sub

' Con SAP abierto en la pantalla del arbol, haz UN clic (no doble)
' sobre el nodo que quieres identificar y corre esto: te dice la
' clave exacta de ese nodo.
Sub MostrarNodoSeleccionado()

    Dim session As Object
    Set session = ObtenerSesionSAP()

    Dim arbol As Object
    Set arbol = session.findById("wnd[0]/usr/shell/shellcont[0]/shell")

    Dim clave As String
    clave = arbol.SelectedNode

    Dim hoja As Worksheet
    Set hoja = ThisWorkbook.Sheets("Control")
    hoja.Range("D2").Value = clave & " -> " & arbol.GetNodeTextByKey(clave)

    MsgBox "Nodo seleccionado: " & clave & " -> " & arbol.GetNodeTextByKey(clave)

End Sub

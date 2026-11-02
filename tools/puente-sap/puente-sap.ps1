# ========================================
# PUENTE SAP -> SUPABASE (WMS Dashboard)
# ========================================
# Corre en la PC que tiene SAP GUI abierto y con sesión iniciada.
# Cada pocos segundos pregunta a Supabase si la web pidió algo
# (tabla sap_comandos), lo ejecuta en SAP y sube el resultado.
#
#   Primera vez:  powershell -ExecutionPolicy Bypass -File puente-sap.ps1 -GenerarToken
#   Normal:       iniciar-puente.bat   (o el mismo .ps1 sin parámetros)
#   Una pasada:   puente-sap.ps1 -UnaVez
#
# La configuración (con el token) vive FUERA del repo, en
# %LOCALAPPDATA%\PuenteSAP\config.json. Nunca subirla a git.

param(
    [switch]$GenerarToken,
    [switch]$UnaVez,
    [int]$Intervalo = 10
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName Microsoft.VisualBasic

$CarpetaDatos = Join-Path $env:LOCALAPPDATA 'PuenteSAP'
$RutaConfig   = Join-Path $CarpetaDatos 'config.json'
$RutaLog      = Join-Path $CarpetaDatos 'puente.log'

if (-not (Test-Path $CarpetaDatos)) { New-Item -ItemType Directory -Path $CarpetaDatos | Out-Null }

function Escribir-Log([string]$texto) {
    $linea = '{0:yyyy-MM-dd HH:mm:ss}  {1}' -f (Get-Date), $texto
    Write-Host $linea
    Add-Content -Path $RutaLog -Value $linea -Encoding UTF8
}

function Hash-Token([string]$token) {
    $sha = [Security.Cryptography.SHA256]::Create()
    $bytes = $sha.ComputeHash([Text.Encoding]::UTF8.GetBytes($token))
    return -join ($bytes | ForEach-Object { $_.ToString('x2') })
}

# ---------- PRIMERA VEZ: CREAR CONFIG + TOKEN ----------

if ($GenerarToken) {
    if (Test-Path $RutaConfig) {
        Write-Host "Ya existe $RutaConfig. Bórralo primero si quieres un token nuevo."
        exit 1
    }
    $bytes = New-Object byte[] 32
    [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
    $token = [Convert]::ToBase64String($bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_')

    $config = [ordered]@{
        url      = 'https://iaitqquphjohgsmelhcj.supabase.co'
        key      = 'sb_publishable_rvEz02miPj1MrBVgLd_auw_FlyrVscs'
        token    = $token
        equipo   = $env:COMPUTERNAME
        sistema  = ''      # p.ej. 'PRD' para usar solo esa conexión SAP; vacío = la primera
        decimal  = ','     # separador decimal con el que SAP muestra los números
    }
    $config | ConvertTo-Json | Set-Content -Path $RutaConfig -Encoding UTF8

    Write-Host "Config creada en $RutaConfig"
    Write-Host ''
    Write-Host 'Registra este HASH en Supabase (no es el token, es seguro compartirlo):'
    Write-Host (Hash-Token $token)
    Write-Host ''
    Write-Host "insert into public.sap_puente_tokens (hash, equipo) values ('<hash>', '$($env:COMPUTERNAME)');"
    exit 0
}

if (-not (Test-Path $RutaConfig)) {
    Write-Host 'Falta la configuración. Ejecuta primero: puente-sap.ps1 -GenerarToken'
    exit 1
}

$Config = Get-Content -Raw -Encoding UTF8 $RutaConfig | ConvertFrom-Json

# ---------- SUPABASE ----------

function Llamar-Rpc([string]$funcion, [hashtable]$cuerpo) {
    $cuerpo['p_token'] = $Config.token
    $json = $cuerpo | ConvertTo-Json -Depth 6 -Compress
    $headers = @{
        apikey        = $Config.key
        Authorization = 'Bearer ' + $Config.key
    }
    return Invoke-RestMethod -Method Post `
        -Uri ($Config.url + '/rest/v1/rpc/' + $funcion) `
        -Headers $headers `
        -ContentType 'application/json; charset=utf-8' `
        -Body ([Text.Encoding]::UTF8.GetBytes($json))
}

# ---------- SAP: CONEXIÓN Y ESPERAS ----------

function Llamar-Com($objeto, [string]$metodo, $argumento) {
    return [Microsoft.VisualBasic.Interaction]::CallByName(
        $objeto, $metodo, [Microsoft.VisualBasic.CallType]::Method, $argumento)
}

function Obtener-Sesion {
    try {
        $sapGui = [Microsoft.VisualBasic.Interaction]::GetObject('SAPGUI')
    } catch {
        throw 'SAP GUI no está abierto en esta PC.'
    }
    $motor = [Microsoft.VisualBasic.Interaction]::CallByName(
        $sapGui, 'GetScriptingEngine', [Microsoft.VisualBasic.CallType]::Method)
    if ($null -eq $motor) { throw 'SAP GUI Scripting no está habilitado.' }

    for ($c = 0; $c -lt $motor.Children.Count; $c++) {
        $conexion = Llamar-Com $motor.Children 'Item' $c
        for ($s = 0; $s -lt $conexion.Children.Count; $s++) {
            $sesion = Llamar-Com $conexion.Children 'Item' $s
            if ([string]::IsNullOrEmpty($Config.sistema) -or $sesion.Info.SystemName -eq $Config.sistema) {
                return $sesion
            }
        }
    }
    if ([string]::IsNullOrEmpty($Config.sistema)) { throw 'No hay ninguna sesión SAP iniciada.' }
    throw "No hay sesión SAP abierta en el sistema $($Config.sistema)."
}

function Esperar-SAP($sesion, [int]$segundos = 120) {
    $limite = (Get-Date).AddSeconds($segundos)
    Start-Sleep -Milliseconds 300
    while ($sesion.Busy) {
        if ((Get-Date) -gt $limite) { throw "SAP siguió ocupado más de $segundos s." }
        Start-Sleep -Milliseconds 300
    }
}

# Devuelve el control o $null si no aparece dentro del tiempo.
function Esperar-Control($sesion, [string]$id, [int]$segundos = 60) {
    $limite = (Get-Date).AddSeconds($segundos)
    do {
        Esperar-SAP $sesion
        $control = $sesion.findById($id, $false)
        if ($null -ne $control) { return $control }
        Start-Sleep -Milliseconds 500
    } while ((Get-Date) -lt $limite)
    return $null
}

function Ir-Transaccion($sesion, [string]$tcode) {
    $sesion.findById('wnd[0]/tbar[0]/okcd').Text = '/n' + $tcode
    $sesion.findById('wnd[0]').sendVKey(0)
    Esperar-SAP $sesion
}

# Error de SAP en la barra de estado -> excepción con el texto.
function Revisar-Barra($sesion, [string]$paso) {
    $barra = $sesion.findById('wnd[0]/sbar')
    if ($barra.MessageType -eq 'E' -or $barra.MessageType -eq 'A') {
        throw "$paso`: $($barra.Text)"
    }
    return $barra.Text
}

# Pega una lista en la ventana de selección múltiple que abre $boton.
function Pegar-Seleccion($sesion, [string]$boton, [string[]]$valores) {
    $anterior = $null
    try { $anterior = Get-Clipboard -Raw } catch { }
    Set-Clipboard -Value ($valores -join "`r`n")
    try {
        $sesion.findById($boton).press()
        Esperar-SAP $sesion
        $sesion.findById('wnd[1]/tbar[0]/btn[16]').press()   # borrar selección previa
        Esperar-SAP $sesion
        $sesion.findById('wnd[1]/tbar[0]/btn[24]').press()   # pegar portapapeles
        Esperar-SAP $sesion
        $sesion.findById('wnd[1]/tbar[0]/btn[8]').press()    # aceptar
        Esperar-SAP $sesion
    } finally {
        if ($null -ne $anterior) { Set-Clipboard -Value $anterior }
    }
}

# Lee el ALV completo. $columnas: nombre técnico -> clave de salida.
function Leer-Grid($grid, [hashtable]$columnas) {
    $filas = New-Object System.Collections.Generic.List[object]
    $total = $grid.RowCount
    $paso = [Math]::Max(1, $grid.VisibleRowCount)
    for ($r = 0; $r -lt $total; $r++) {
        if ($r % $paso -eq 0) { $grid.FirstVisibleRow = $r }   # obliga a SAP a cargar el bloque
        $fila = @{}
        foreach ($tecnico in $columnas.Keys) {
            $fila[$columnas[$tecnico]] = ([string]$grid.GetCellValue($r, $tecnico)).Trim()
        }
        $filas.Add($fila)
    }
    return , $filas
}

# Busca una columna del ALV por nombre técnico o por título visible.
function Buscar-Columna($grid, [string[]]$tecnicos, [string[]]$titulos) {
    $orden = $grid.ColumnOrder
    for ($i = 0; $i -lt $orden.Count; $i++) {
        $nombre = [string](Llamar-Com $orden 'ElementAt' $i)
        if ($tecnicos -contains $nombre) { return $nombre }
    }
    for ($i = 0; $i -lt $orden.Count; $i++) {
        $nombre = [string](Llamar-Com $orden 'ElementAt' $i)
        $titulo = [string]$grid.GetDisplayedColumnTitle($nombre)
        foreach ($patron in $titulos) {
            if ($titulo -like $patron) { return $nombre }
        }
    }
    return $null
}

function Convertir-Numero([string]$texto) {
    $t = $texto.Trim()
    if ($t -eq '') { return $null }
    $negativo = $t.EndsWith('-')
    $t = $t.TrimEnd('-')
    if ($Config.decimal -eq ',') { $t = $t.Replace('.', '').Replace(',', '.') }
    else { $t = $t.Replace(',', '') }
    $valor = 0.0
    if (-not [double]::TryParse($t, [Globalization.NumberStyles]::Float,
            [Globalization.CultureInfo]::InvariantCulture, [ref]$valor)) { return $null }
    if ($negativo) { $valor = -$valor }
    return $valor
}

# ---------- COMANDO: MONITOR DE GUÍAS ----------
# 1) ZO2CP006 por rango de fechas -> lista de FO (si la web no mandó FO)
# 2) ZO2CP004 con esas FO -> entrega, guía (serie/correlativo), transporte, placa, chofer, cliente
# 3) VL06O con las entregas -> peso, destino, organización de ventas

function Monitor-Guias($sesion, $parametros, [ref]$notas) {

    $sesion.findById('wnd[0]').maximize()

    # --- 1. FO ---
    if ($null -ne $parametros.fos) {
        $fos = @($parametros.fos | ForEach-Object { [string]$_ })
    } else {
        $desde = ([datetime]$parametros.fecha_desde).ToString('dd.MM.yyyy')
        $hasta = ([datetime]$parametros.fecha_hasta).ToString('dd.MM.yyyy')

        Ir-Transaccion $sesion 'ZO2CP006'
        if ($null -eq (Esperar-Control $sesion 'wnd[0]/usr/ctxtS_VSTEL-LOW' 30)) { throw 'No abrió ZO2CP006.' }
        $sesion.findById('wnd[0]/usr/ctxtS_VSTEL-LOW').Text = '1054'
        $sesion.findById('wnd[0]/usr/ctxtS_LFDAT-LOW').Text = $desde
        $sesion.findById('wnd[0]/usr/ctxtS_LFDAT-HIGH').Text = $hasta
        $sesion.findById('wnd[0]/usr/radP_FOEXT').select()
        $sesion.findById('wnd[0]').sendVKey(8)

        $grid = Esperar-Control $sesion 'wnd[0]/usr/cntlGRID1/shellcont/shell' 120
        if ($null -eq $grid) {
            $notas.Value += "ZO2CP006 sin resultados ($desde a $hasta): $(Revisar-Barra $sesion 'ZO2CP006')"
            return @()
        }
        $fos = @((Leer-Grid $grid @{ ZZTOR_ID = 'fo' }) | ForEach-Object { $_.fo } |
                 Where-Object { $_ -ne '' } | Select-Object -Unique)
        $notas.Value += "ZO2CP006: $($fos.Count) FO"
    }
    if ($fos.Count -eq 0) { return @() }

    # --- 2. ZO2CP004 ---
    Ir-Transaccion $sesion 'ZO2CP004'
    if ($null -eq (Esperar-Control $sesion 'wnd[0]/usr/ctxtP_BUKRS' 30)) { throw 'No abrió ZO2CP004.' }
    $sesion.findById('wnd[0]/usr/ctxtP_BUKRS').Text = 'PE11'
    $sesion.findById('wnd[0]/usr/ctxtP_VSTEL').Text = '1054'
    foreach ($campo in 'S_VBELN-LOW', 'S_VBELN-HIGH', 'S_WADAT-LOW', 'S_WADAT-HIGH', 'S_TKNUM-LOW', 'S_TKNUM-HIGH') {
        $sesion.findById("wnd[0]/usr/ctxt$campo").Text = ''
    }
    Pegar-Seleccion $sesion 'wnd[0]/usr/btn%_S_TORID_%_APP_%-VALU_PUSH' $fos
    $sesion.findById('wnd[0]/tbar[1]/btn[8]').press()

    $grid = Esperar-Control $sesion 'wnd[0]/usr/cntlGRID1/shellcont/shell' 180
    if ($null -eq $grid) {
        $notas.Value += "ZO2CP004 sin resultados: $(Revisar-Barra $sesion 'ZO2CP004')"
        return @()
    }
    $guias = Leer-Grid $grid @{
        VBELN = 'entrega'; SERIE = 'serie'; CORRN = 'correlativo'; TKNUM = 'transporte'
        TORID = 'fo'; PLACA = 'placa'; LICDR = 'licencia'; NAMDR = 'conductor'
        TPTID = 'transportista_id'; TPTNM = 'transportista'; KUNDE = 'cliente_id'; NAMDE = 'cliente'
    }
    $notas.Value += "ZO2CP004: $($guias.Count) filas"

    # --- 3. VL06O ---
    $entregas = @($guias | ForEach-Object { $_.entrega } | Where-Object { $_ -ne '' } | Select-Object -Unique)
    if ($entregas.Count -gt 0) {
        Ir-Transaccion $sesion 'VL06O'
        if ($null -eq (Esperar-Control $sesion 'wnd[0]/usr/btnBUTTON6' 30)) { throw 'No abrió VL06O.' }
        $sesion.findById('wnd[0]/usr/btnBUTTON6').press()
        Esperar-SAP $sesion

        # Quitar el filtro de fechas por defecto
        $sesion.findById('wnd[0]/usr/btn%_IT_WADAT_%_APP_%-VALU_PUSH').press()
        Esperar-SAP $sesion
        $sesion.findById('wnd[1]/tbar[0]/btn[16]').press()
        Esperar-SAP $sesion
        $sesion.findById('wnd[1]/tbar[0]/btn[8]').press()
        Esperar-SAP $sesion

        Pegar-Seleccion $sesion 'wnd[0]/usr/btn%_IT_VBELN_%_APP_%-VALU_PUSH' $entregas
        $sesion.findById('wnd[0]/tbar[1]/btn[8]').press()

        $grid = Esperar-Control $sesion 'wnd[0]/usr/cntlGRID1/shellcont/shell' 180
        if ($null -eq $grid) {
            $notas.Value += "VL06O sin resultados: $(Revisar-Barra $sesion 'VL06O')"
        } else {
            $colEntrega = Buscar-Columna $grid @('VBELN') @('Entrega*')
            $colPeso    = Buscar-Columna $grid @('BTGEW') @('Peso total*')
            $colDestino = Buscar-Columna $grid @() @('Lugar*destinatario*', 'Lugar*dest*')
            $colOrgVt   = Buscar-Columna $grid @('VKORG') @('Org*ventas*', 'OrgVt*')
            $notas.Value += "VL06O columnas: peso=$colPeso destino=$colDestino orgvt=$colOrgVt"

            $mapa = @{}
            $leer = @{}
            if ($colEntrega) { $leer[$colEntrega] = 'entrega' }
            if ($colPeso)    { $leer[$colPeso]    = 'peso' }
            if ($colDestino) { $leer[$colDestino] = 'destino' }
            if ($colOrgVt)   { $leer[$colOrgVt]   = 'org_ventas' }
            if ($colEntrega) {
                foreach ($f in (Leer-Grid $grid $leer)) {
                    if ($f.entrega -ne '' -and -not $mapa.ContainsKey($f.entrega)) { $mapa[$f.entrega] = $f }
                }
            }
            foreach ($g in $guias) {
                $extra = $mapa[$g.entrega]
                if ($null -ne $extra) {
                    if ($extra.ContainsKey('peso'))       { $g.peso = Convertir-Numero $extra.peso }
                    if ($extra.ContainsKey('destino'))    { $g.destino = $extra.destino }
                    if ($extra.ContainsKey('org_ventas')) { $g.org_ventas = $extra.org_ventas }
                }
            }
        }
    }

    return , $guias
}

function Info-Sesion($sesion) {
    $i = $sesion.Info
    return "SAP $($i.SystemName) mandante $($i.Client) usuario $($i.User) en $($i.Transaction)"
}

# ---------- EJECUTAR UN COMANDO ----------

function Ejecutar-Comando($cmd) {
    $notas = @()
    $sesion = $null
    try {
        $sesion = Obtener-Sesion

        if ($cmd.comando -eq 'ping') {
            Llamar-Rpc 'sap_puente_terminar' @{
                p_comando_id = $cmd.id; p_estado = 'ok'; p_filas = 0
                p_mensaje = "Puente activo en $($Config.equipo). $(Info-Sesion $sesion)"
            } | Out-Null
            return
        }

        if ($cmd.comando -eq 'monitor_guias') {
            $filas = @(Monitor-Guias $sesion $cmd.parametros ([ref]$notas))
            $subidas = 0
            for ($i = 0; $i -lt $filas.Count; $i += 500) {
                $lote = [object[]]($filas[$i..([Math]::Min($i + 499, $filas.Count - 1))])
                $subidas += [int](Llamar-Rpc 'sap_puente_guardar_guias' @{
                    p_comando_id = $cmd.id; p_filas = $lote })
            }
            Llamar-Rpc 'sap_puente_terminar' @{
                p_comando_id = $cmd.id; p_estado = 'ok'; p_filas = $subidas
                p_mensaje = ($notas -join ' | ')
            } | Out-Null
            Escribir-Log "Comando $($cmd.id) OK: $subidas filas"
            return
        }

        throw "Comando desconocido: $($cmd.comando)"
    } catch {
        $msg = $_.Exception.Message
        if ($notas.Count -gt 0) { $msg = ($notas -join ' | ') + ' | ERROR: ' + $msg }
        Escribir-Log "Comando $($cmd.id) ERROR: $msg"
        try {
            Llamar-Rpc 'sap_puente_terminar' @{
                p_comando_id = $cmd.id; p_estado = 'error'; p_mensaje = $msg } | Out-Null
        } catch { Escribir-Log "No se pudo reportar el error: $($_.Exception.Message)" }
    } finally {
        if ($null -ne $sesion) {
            try { $sesion.findById('wnd[0]/tbar[0]/okcd').Text = '/n'; $sesion.findById('wnd[0]').sendVKey(0) } catch { }
        }
    }
}

# ---------- BUCLE PRINCIPAL ----------

Escribir-Log "Puente iniciado en $($Config.equipo) (cada $Intervalo s). Ctrl+C para detener."
while ($true) {
    try {
        $cmds = @(Llamar-Rpc 'sap_puente_tomar' @{})
        foreach ($cmd in $cmds) {
            if ($null -eq $cmd -or $null -eq $cmd.id) { continue }
            Escribir-Log "Comando $($cmd.id): $($cmd.comando) $($cmd.parametros | ConvertTo-Json -Compress)"
            Ejecutar-Comando $cmd
        }
    } catch {
        Escribir-Log "Sin conexión con Supabase: $($_.Exception.Message)"
    }
    if ($UnaVez) { break }
    Start-Sleep -Seconds $Intervalo
}

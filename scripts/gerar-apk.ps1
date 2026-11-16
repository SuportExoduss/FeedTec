# Gera o APK debug e avisa no Windows quando termina.
# Uso (na raiz do projeto): .\scripts\gerar-apk.ps1
# Deu certo: aviso com versão e tamanho. Deu errado: aviso, mostra o erro aqui e abre o log no Bloco de Notas.
$raiz = Split-Path $PSScriptRoot
$log = Join-Path $raiz 'android\build\build-apk.log'
$apk = Join-Path $raiz 'android\app\build\outputs\apk\debug\app-debug.apk'
$versao = (Get-Content (Join-Path $raiz 'app.json') -Raw | ConvertFrom-Json).expo.version
New-Item -ItemType Directory -Force (Split-Path $log) | Out-Null
if (Test-Path $apk) { Remove-Item $apk }

Write-Host "Gerando APK $versao... (log em $log)"
$inicio = Get-Date
Push-Location (Join-Path $raiz 'android')
& .\gradlew.bat assembleDebug --console=plain *> $log
$ok = $LASTEXITCODE -eq 0 -and (Test-Path $apk)
Pop-Location
$min = [math]::Round(((Get-Date) - $inicio).TotalMinutes, 1)

Add-Type -AssemblyName System.Windows.Forms, System.Drawing
$aviso = New-Object System.Windows.Forms.NotifyIcon
$aviso.Icon = [System.Drawing.SystemIcons]::Information
$aviso.Visible = $true
if ($ok) {
  $mb = [math]::Round((Get-Item $apk).Length / 1MB, 1)
  $msg = "APK $versao pronto ($mb MB, $min min)."
  $aviso.ShowBalloonTip(15000, 'FeedTec', $msg, 'Info')
  Write-Host $msg -ForegroundColor Green
  Write-Host $apk
} else {
  $aviso.ShowBalloonTip(15000, 'FeedTec', "O build do APK falhou ($min min). Veja o log.", 'Error')
  Write-Host "FALHOU ($min min). Trecho do erro:" -ForegroundColor Red
  Select-String -Path $log -Pattern 'What went wrong', 'error:' -Context 0, 12 | Select-Object -First 5 | ForEach-Object { $_.Line; $_.Context.PostContext }
  notepad $log
}
Start-Sleep 15
$aviso.Dispose()

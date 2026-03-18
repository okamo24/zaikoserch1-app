$ErrorActionPreference = "Stop"

Set-Location "C:\Projects\kurapuro\web"

& "C:\Program Files\nodejs\node.exe" ".\node_modules\next\dist\bin\next" dev

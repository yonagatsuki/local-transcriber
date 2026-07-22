$bundledNode = "C:\Users\Astge\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"

if (Get-Command node -ErrorAction SilentlyContinue) {
  node server.js
} elseif (Test-Path $bundledNode) {
  & $bundledNode server.js
} else {
  Write-Error "Node.js was not found. Install Node.js 20+ or run with the bundled Codex Node.js path."
}

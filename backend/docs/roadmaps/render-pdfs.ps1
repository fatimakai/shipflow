param()

$ErrorActionPreference = 'Stop'

$chromeCandidates = @(
    'C:\Program Files\Google\Chrome\Application\chrome.exe',
    'C:\Program Files (x86)\Google\Chrome\Application\chrome.exe',
    'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
)

$chrome = $chromeCandidates | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1

if (-not $chrome) {
    throw 'Google Chrome or Microsoft Edge is required to render the roadmap PDFs.'
}

$buildDirectory = Join-Path ([System.IO.Path]::GetTempPath()) 'shipflow-roadmap-pdf'
New-Item -ItemType Directory -Path $buildDirectory -Force | Out-Null

$documents = @(
    @{ Name = 'project-roadmap'; Footer = 'ShipFlow Unified Project Roadmap' },
    @{ Name = 'backend-roadmap'; Footer = 'ShipFlow Backend Roadmap' },
    @{ Name = 'frontend-roadmap'; Footer = 'ShipFlow Frontend Roadmap' }
)

foreach ($document in $documents) {
    $markdownPath = Join-Path $PSScriptRoot "$($document.Name).md"
    $fragmentPath = Join-Path $buildDirectory "$($document.Name)-fragment.html"
    $htmlPath = Join-Path $buildDirectory "$($document.Name).html"
    $pdfPath = Join-Path $PSScriptRoot "$($document.Name).pdf"

    & pnpm dlx marked --gfm --input $markdownPath --output $fragmentPath
    if ($LASTEXITCODE -ne 0) {
        throw "Markdown conversion failed for $markdownPath."
    }

    $fragment = [System.IO.File]::ReadAllText($fragmentPath)
    $fragment = [regex]::Replace(
        $fragment,
        '<h2(.*?)>(Phase\s+.*?)</h2>',
        '<h2$1 class="phase-heading">$2</h2>',
        [System.Text.RegularExpressions.RegexOptions]::IgnoreCase
    )

    $baseDirectory = (Split-Path -Parent $markdownPath).Replace('\', '/')
    $baseHref = "file:///$baseDirectory/"
    $footer = $document.Footer
    $title = $footer.Replace('&', '&amp;').Replace('<', '&lt;').Replace('>', '&gt;')

    $html = @"
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <base href="$baseHref">
  <title>$title</title>
  <style>
    @page {
      size: A4;
      margin: 17mm 15mm 19mm;

      @bottom-left {
        content: "$footer";
        color: #64748b;
        font: 8pt "Segoe UI", Arial, sans-serif;
      }

      @bottom-right {
        content: "Page " counter(page) " of " counter(pages);
        color: #64748b;
        font: 8pt "Segoe UI", Arial, sans-serif;
      }
    }

    * {
      box-sizing: border-box;
    }

    html {
      color: #172033;
      font: 10pt/1.48 "Segoe UI", Arial, sans-serif;
    }

    body {
      margin: 0;
    }

    h1,
    h2,
    h3,
    h4 {
      color: #102a43;
      line-height: 1.2;
      break-after: avoid-page;
      page-break-after: avoid;
    }

    h1 {
      margin: 0 0 8mm;
      padding-bottom: 4mm;
      border-bottom: 2px solid #168aad;
      font-size: 24pt;
      font-weight: 700;
    }

    h2 {
      margin: 9mm 0 4mm;
      padding-bottom: 2mm;
      border-bottom: 1px solid #b8c5d1;
      font-size: 16pt;
    }

    h2.phase-heading {
      break-before: page;
      page-break-before: always;
    }

    h3 {
      margin: 6mm 0 2.5mm;
      font-size: 12.5pt;
    }

    h4 {
      margin: 4mm 0 2mm;
      font-size: 10.5pt;
    }

    p {
      margin: 0 0 3mm;
      orphans: 3;
      widows: 3;
    }

    ul,
    ol {
      margin: 0 0 3.5mm;
      padding-left: 6mm;
    }

    li {
      margin: 0 0 1.25mm;
    }

    li::marker {
      color: #16778f;
    }

    a {
      color: #066d87;
      text-decoration: none;
    }

    strong {
      color: #102a43;
    }

    code {
      padding: 0.2mm 1mm;
      border-radius: 2px;
      background: #eef4f7;
      color: #7a2948;
      font: 8.8pt Consolas, "Courier New", monospace;
      overflow-wrap: anywhere;
    }

    pre {
      margin: 0 0 4mm;
      padding: 3.5mm;
      border-left: 3px solid #168aad;
      background: #f3f7f9;
      break-inside: avoid-page;
      white-space: pre-wrap;
    }

    pre code {
      padding: 0;
      background: transparent;
    }

    blockquote {
      margin: 4mm 0;
      padding: 1mm 0 1mm 4mm;
      border-left: 3px solid #168aad;
      color: #526372;
    }

    table {
      width: 100%;
      margin: 3mm 0 5mm;
      border-collapse: collapse;
      font-size: 8.7pt;
    }

    thead {
      display: table-header-group;
    }

    tr {
      break-inside: avoid-page;
      page-break-inside: avoid;
    }

    th,
    td {
      padding: 2.2mm 2.5mm;
      border: 1px solid #bac8d3;
      text-align: left;
      vertical-align: top;
    }

    th {
      background: #e9f1f4;
      color: #102a43;
      font-weight: 700;
    }

    tbody tr:nth-child(even) {
      background: #f7fafb;
    }

    hr {
      margin: 7mm 0;
      border: 0;
      border-top: 1px solid #bac8d3;
    }

    img {
      max-width: 100%;
    }
  </style>
</head>
<body>
$fragment
</body>
</html>
"@

    [System.IO.File]::WriteAllText($htmlPath, $html, [System.Text.UTF8Encoding]::new($false))

    $htmlUri = "file:///$(($htmlPath.Replace('\', '/')).Replace(' ', '%20'))"
    if (Test-Path -LiteralPath $pdfPath) {
        Remove-Item -LiteralPath $pdfPath -Force
    }

    $chromeArguments = @(
        '--headless=new',
        '--disable-gpu',
        '--no-sandbox',
        '--allow-file-access-from-files',
        '--no-pdf-header-footer',
        "--print-to-pdf=$pdfPath",
        $htmlUri
    )

    & $chrome @chromeArguments | Out-Null
    $renderExitCode = $LASTEXITCODE
    $renderDeadline = [DateTime]::UtcNow.AddSeconds(15)

    while (-not (Test-Path -LiteralPath $pdfPath) -and [DateTime]::UtcNow -lt $renderDeadline) {
        Start-Sleep -Milliseconds 200
    }

    if ($renderExitCode -ne 0 -or -not (Test-Path -LiteralPath $pdfPath)) {
        throw "PDF rendering failed for $markdownPath."
    }

    Write-Host "Rendered $pdfPath"
}

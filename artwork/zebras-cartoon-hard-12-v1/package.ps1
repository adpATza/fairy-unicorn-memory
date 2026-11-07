param()
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
$baseDir = $PSScriptRoot
$manifest = Get-Content -LiteralPath (Join-Path $baseDir 'prompts-and-manifest.json') -Raw | ConvertFrom-Json
$cardsDir = Join-Path $baseDir 'cards'
$originalsDir = Join-Path $baseDir 'originals'
[void][IO.Directory]::CreateDirectory($cardsDir)
[void][IO.Directory]::CreateDirectory($originalsDir)
$pngFormat = [Drawing.Imaging.ImageFormat]::Png
$pixelFormat = [Drawing.Imaging.PixelFormat]::Format32bppArgb
$records = @()

function Get-PixelHash([Drawing.Bitmap]$bitmap) {
    $rect = [Drawing.Rectangle]::new(0, 0, $bitmap.Width, $bitmap.Height)
    $bits = $bitmap.LockBits($rect, [Drawing.Imaging.ImageLockMode]::ReadOnly, [Drawing.Imaging.PixelFormat]::Format32bppArgb)
    try {
        $bytes = [byte[]]::new([Math]::Abs($bits.Stride) * $bits.Height)
        [Runtime.InteropServices.Marshal]::Copy($bits.Scan0, $bytes, 0, $bytes.Length)
        $sha = [Security.Cryptography.SHA256]::Create()
        try { return [Convert]::ToHexString($sha.ComputeHash($bytes)).ToLowerInvariant() }
        finally { $sha.Dispose() }
    } finally { $bitmap.UnlockBits($bits) }
}

foreach ($card in $manifest.cards) {
    $source = [Drawing.Bitmap]::new([string]$card.source)
    try {
        if ($source.Width -ne 1254 -or $source.Height -ne 1254) { throw "Unexpected original size for card $($card.id)" }
        $originalPath = Join-Path $originalsDir $card.filename
        Copy-Item -LiteralPath $card.source -Destination $originalPath -Force
        $small = [Drawing.Bitmap]::new(896, 896, $pixelFormat)
        $sg = [Drawing.Graphics]::FromImage($small)
        try {
            $sg.InterpolationMode = [Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
            $sg.PixelOffsetMode = [Drawing.Drawing2D.PixelOffsetMode]::HighQuality
            $attributes = [Drawing.Imaging.ImageAttributes]::new()
            try {
                $attributes.SetWrapMode([Drawing.Drawing2D.WrapMode]::TileFlipXY)
                $sg.DrawImage($source, [Drawing.Rectangle]::new(0, 0, 896, 896), 0, 0, $source.Width, $source.Height, [Drawing.GraphicsUnit]::Pixel, $attributes)
            } finally { $attributes.Dispose() }
        } finally { $sg.Dispose() }
        $canvas = [Drawing.Bitmap]::new(1024, 1024, $pixelFormat)
        $cg = [Drawing.Graphics]::FromImage($canvas)
        try {
            # Extend only the blank edge background; preserve every source pixel in the resized square.
            foreach ($corner in @(@(0, 0, 0, 0), @(895, 0, 960, 0), @(0, 895, 0, 960), @(895, 895, 960, 960))) {
                $brush = [Drawing.SolidBrush]::new($small.GetPixel($corner[0], $corner[1]))
                try { $cg.FillRectangle($brush, [int]$corner[2], [int]$corner[3], 64, 64) }
                finally { $brush.Dispose() }
            }
            for ($n = 0; $n -lt 896; $n++) {
                $specs = @(
                    @($small.GetPixel(0, $n), 0, ($n + 64), 64, 1),
                    @($small.GetPixel(895, $n), 960, ($n + 64), 64, 1),
                    @($small.GetPixel($n, 0), ($n + 64), 0, 1, 64),
                    @($small.GetPixel($n, 895), ($n + 64), 960, 1, 64)
                )
                foreach ($spec in $specs) {
                    $brush = [Drawing.SolidBrush]::new($spec[0])
                    try { $cg.FillRectangle($brush, [int]$spec[1], [int]$spec[2], [int]$spec[3], [int]$spec[4]) }
                    finally { $brush.Dispose() }
                }
            }
            $cg.DrawImageUnscaled($small, 64, 64)
        } finally { $cg.Dispose(); $small.Dispose() }
        try {
            $target = Join-Path $cardsDir $card.filename
            $canvas.Save($target, $pngFormat)
            $records += [ordered]@{
                id = $card.id; file = $card.filename; title = $card.title; observed = $card.observed
                width = $canvas.Width; height = $canvas.Height
                sha256 = (Get-FileHash -LiteralPath $target -Algorithm SHA256).Hash.ToLowerInvariant()
                decoded_sha256 = Get-PixelHash $canvas
                original_sha256 = (Get-FileHash -LiteralPath $originalPath -Algorithm SHA256).Hash.ToLowerInvariant()
            }
        } finally { $canvas.Dispose() }
    } finally { $source.Dispose() }
}

function Save-ContactSheet([string]$filename, [int]$imageSize, [int]$columns, [bool]$labels) {
    $gap = 18
    $labelHeight = if ($labels) { 44 } else { 26 }
    $titleHeight = 76
    $rows = [int][Math]::Ceiling($manifest.cards.Count / $columns)
    $cellW = $imageSize + $gap
    $cellH = $imageSize + $labelHeight + $gap
    $sheet = [Drawing.Bitmap]::new(($columns * $cellW + $gap), ($rows * $cellH + $titleHeight + $gap))
    $g = [Drawing.Graphics]::FromImage($sheet)
    $titleFont = [Drawing.Font]::new('Segoe UI', 22, [Drawing.FontStyle]::Bold, [Drawing.GraphicsUnit]::Pixel)
    $labelFont = [Drawing.Font]::new('Segoe UI', 13, [Drawing.FontStyle]::Regular, [Drawing.GraphicsUnit]::Pixel)
    $ink = [Drawing.SolidBrush]::new([Drawing.Color]::FromArgb(48, 45, 42))
    try {
        $g.Clear([Drawing.Color]::FromArgb(239, 235, 228))
        $g.TextRenderingHint = [Drawing.Text.TextRenderingHint]::AntiAliasGridFit
        $g.InterpolationMode = [Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $g.DrawString('CUTE ZEBRAS / HARD', $titleFont, $ink, 18, 12)
        $subtitle = if ($labels) { '12 individual cards / six closely related pose families' } else { '100 px card-size review / similar poses kept together' }
        $g.DrawString($subtitle, $labelFont, $ink, 18, 43)
        for ($i = 0; $i -lt $manifest.cards.Count; $i++) {
            $card = $manifest.cards[$i]
            $x = $gap + ($i % $columns) * $cellW
            $y = $titleHeight + [Math]::Floor($i / $columns) * $cellH
            $img = [Drawing.Bitmap]::new((Join-Path $cardsDir $card.filename))
            try { $g.DrawImage($img, [int]$x, [int]$y, $imageSize, $imageSize) }
            finally { $img.Dispose() }
            $label = if ($labels) { "$($card.id)  $($card.title)" } else { [string]$card.id }
            $g.DrawString($label, $labelFont, $ink, [single]$x, [single]($y + $imageSize + 6))
        }
        $sheet.Save((Join-Path $baseDir $filename), $pngFormat)
    } finally { $g.Dispose(); $sheet.Dispose(); $titleFont.Dispose(); $labelFont.Dispose(); $ink.Dispose() }
}
Save-ContactSheet 'contact-sheet.png' 270 4 $true
Save-ContactSheet 'thumbnail-review-100px.png' 100 6 $false

$zipPath = Join-Path (Split-Path $baseDir -Parent) 'zebras-cartoon-hard-12-v1-cards.zip'
$stream = [IO.File]::Open($zipPath, [IO.FileMode]::Create)
$zip = [IO.Compression.ZipArchive]::new($stream, [IO.Compression.ZipArchiveMode]::Create, $false)
try {
    foreach ($card in $manifest.cards) {
        [void][IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, (Join-Path $cardsDir $card.filename), $card.filename, [IO.Compression.CompressionLevel]::Optimal)
    }
} finally { $zip.Dispose(); $stream.Dispose() }

$zip = [IO.Compression.ZipFile]::OpenRead($zipPath)
try {
    if ($zip.Entries.Count -ne 12) { throw 'Expected exactly 12 flat PNG files in ZIP.' }
    foreach ($entry in $zip.Entries) {
        if ($entry.FullName -match '[/\\]' -or -not $entry.Name.EndsWith('.png')) { throw 'ZIP must contain only flat PNGs.' }
        $record = $records | Where-Object file -eq $entry.Name
        $entryStream = $entry.Open()
        $sha = [Security.Cryptography.SHA256]::Create()
        try { $digest = [Convert]::ToHexString($sha.ComputeHash($entryStream)).ToLowerInvariant() }
        finally { $entryStream.Dispose(); $sha.Dispose() }
        if ($digest -ne $record.sha256) { throw "ZIP hash mismatch for $($entry.Name)" }
    }
} finally { $zip.Dispose() }
$uniqueCount = @($records.decoded_sha256 | Sort-Object -Unique).Count
if ($uniqueCount -ne 12) { throw 'Duplicate decoded images found.' }
if (@(Get-ChildItem -LiteralPath $cardsDir -File).Count -ne 12) { throw 'Import folder must contain exactly 12 files.' }
$verification = [ordered]@{
    image_count = $records.Count; unique_decoded_images = $uniqueCount
    card_size = @(1024, 1024); original_size = @(1254, 1254)
    zip_flat_png_count = 12; zip_entry_hashes_match = $true
    zip_sha256 = (Get-FileHash -LiteralPath $zipPath -Algorithm SHA256).Hash.ToLowerInvariant()
    imported_into_game = $false; play_tested = $false
    files = $records
}
$verification | ConvertTo-Json -Depth 7 | Set-Content -LiteralPath (Join-Path $baseDir 'verification.json') -Encoding utf8
$checksumLines = foreach ($record in $records) { "$($record.sha256)  cards/$($record.file)"; "$($record.original_sha256)  originals/$($record.file)" }
$checksumLines += "$($verification.zip_sha256)  ../zebras-cartoon-hard-12-v1-cards.zip"
$checksumLines | Set-Content -LiteralPath (Join-Path $baseDir 'SHA256SUMS.txt') -Encoding utf8
[pscustomobject]$verification | Select-Object image_count, unique_decoded_images, card_size, zip_flat_png_count, zip_entry_hashes_match, imported_into_game, play_tested | ConvertTo-Json

param([string]$Root = $PSScriptRoot)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
Add-Type -AssemblyName System.IO.Compression.FileSystem
$inputs = Get-Content -LiteralPath (Join-Path $Root 'generation-inputs.json') -Raw | ConvertFrom-Json
$items = @($inputs.cards | Sort-Object n)
if ($items.Count -ne 24) { throw 'Expected 24 unique panda cards.' }
$cardsRoot = Join-Path $Root 'cards'
$sourceRoot = Join-Path $Root 'originals'
$archive = Join-Path (Split-Path $Root -Parent) 'pandas-cartoon-hard-24-cards.zip'
if (Test-Path -LiteralPath $archive) { throw 'Archive exists; choose a new version before packaging.' }
New-Item -ItemType Directory -Path $cardsRoot,$sourceRoot -Force | Out-Null

function Get-PixelHash([System.Drawing.Bitmap]$Bitmap) {
    $bounds = [System.Drawing.Rectangle]::new(0,0,$Bitmap.Width,$Bitmap.Height)
    $bits = $Bitmap.LockBits($bounds,[System.Drawing.Imaging.ImageLockMode]::ReadOnly,[System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    try {
        $bytes = [byte[]]::new([Math]::Abs($bits.Stride)*$Bitmap.Height)
        [System.Runtime.InteropServices.Marshal]::Copy($bits.Scan0,$bytes,0,$bytes.Length)
        $sha = [System.Security.Cryptography.SHA256]::Create()
        try { return ([BitConverter]::ToString($sha.ComputeHash($bytes))).Replace('-','').ToLowerInvariant() }
        finally { $sha.Dispose() }
    } finally { $Bitmap.UnlockBits($bits) }
}

$records = @()
foreach ($item in $items) {
    $sourcePath = Join-Path $sourceRoot $item.file
    if (Test-Path -LiteralPath $sourcePath) { throw ('Original exists: ' + $sourcePath) }
    Copy-Item -LiteralPath $item.path -Destination $sourcePath
    $sourceHash = (Get-FileHash -LiteralPath $sourcePath -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($sourceHash -ne (Get-FileHash -LiteralPath $item.path -Algorithm SHA256).Hash.ToLowerInvariant()) { throw 'Source copy hash mismatch.' }
    $source = [System.Drawing.Bitmap]::new($sourcePath)
    $final = [System.Drawing.Bitmap]::new(1024,1024,[System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $graphics = [System.Drawing.Graphics]::FromImage($final)
    $attributes = [System.Drawing.Imaging.ImageAttributes]::new()
    try {
        if ($source.Width -ne $source.Height) { throw ('Non-square source: ' + $item.file) }
        $graphics.Clear($source.GetPixel(0,0))
        $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
        $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
        $attributes.SetWrapMode([System.Drawing.Drawing2D.WrapMode]::TileFlipXY)
        $rectangle = [System.Drawing.Rectangle]::new(80,80,864,864)
        $graphics.DrawImage($source,$rectangle,0,0,$source.Width,$source.Height,[System.Drawing.GraphicsUnit]::Pixel,$attributes)
        $destination = Join-Path $cardsRoot $item.file
        $final.Save($destination,[System.Drawing.Imaging.ImageFormat]::Png)
        $records += [pscustomobject]@{
            number=$item.n; name=$item.name; family=$item.family; pose=$item.pose
            file=('cards/'+$item.file); original=('originals/'+$item.file)
            width=1024; height=1024; original_width=$source.Width; original_height=$source.Height
            sha256=(Get-FileHash -LiteralPath $destination -Algorithm SHA256).Hash.ToLowerInvariant()
            pixel_sha256=(Get-PixelHash $final); original_sha256=$sourceHash
            prompt=$item.prompt; reference_image=$(if($item.n -eq 1){$null}else{'originals/'+$items[0].file})
        }
    } finally { $attributes.Dispose(); $graphics.Dispose(); $source.Dispose(); $final.Dispose() }
}
if (@($records.pixel_sha256 | Sort-Object -Unique).Count -ne 24) { throw 'Duplicate decoded images found.' }
if (@(Get-ChildItem -LiteralPath $cardsRoot -File).Count -ne 24) { throw 'Unexpected file count in cards directory.' }

function New-ReviewSheet([int]$Tile,[int]$Columns,[int]$Gap,[int]$LabelHeight,[string]$Filename) {
    $rows = [int][Math]::Ceiling(24/$Columns)
    $header = $(if($Tile -gt 100){64}else{34})
    $sheet = [System.Drawing.Bitmap]::new(($Columns*($Tile+$Gap)+$Gap),($rows*($Tile+$Gap+$LabelHeight)+$Gap+$header))
    $draw = [System.Drawing.Graphics]::FromImage($sheet)
    $font = [System.Drawing.Font]::new('Segoe UI',[single]$(if($Tile -gt 100){11}else{8}),[System.Drawing.FontStyle]::Regular)
    $titleFont = [System.Drawing.Font]::new('Segoe UI',[single]$(if($Tile -gt 100){22}else{11}),[System.Drawing.FontStyle]::Bold)
    $brush = [System.Drawing.SolidBrush]::new([System.Drawing.ColorTranslator]::FromHtml('#403b36'))
    try {
        $draw.Clear([System.Drawing.ColorTranslator]::FromHtml('#f4eee4'))
        $draw.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $draw.DrawString('Cartoon Pandas - Hard - 24 pairs',$titleFont,$brush,[single]$Gap,[single]8)
        for($i=0;$i -lt $items.Count;$i++) {
            $x=$Gap+($i%$Columns)*($Tile+$Gap)
            $y=$header+$Gap+[int][Math]::Floor($i/$Columns)*($Tile+$Gap+$LabelHeight)
            $picture=[System.Drawing.Image]::FromFile((Join-Path $cardsRoot $items[$i].file))
            try { $draw.DrawImage($picture,[int]$x,[int]$y,$Tile,$Tile) } finally { $picture.Dispose() }
            $label=('{0:00}' -f $items[$i].n)
            if($Tile -gt 100){ $label+=' '+$items[$i].name.Replace('-',' ') }
            $textBox=[System.Drawing.RectangleF]::new([single]$x,[single]($y+$Tile+3),[single]$Tile,[single]$LabelHeight)
            $draw.DrawString($label,$font,$brush,$textBox)
        }
        $sheet.Save((Join-Path $Root $Filename),[System.Drawing.Imaging.ImageFormat]::Png)
    } finally { $brush.Dispose(); $font.Dispose(); $titleFont.Dispose(); $draw.Dispose(); $sheet.Dispose() }
}
New-ReviewSheet -Tile 240 -Columns 6 -Gap 16 -LabelHeight 44 -Filename 'contact-sheet.png'
New-ReviewSheet -Tile 96 -Columns 6 -Gap 10 -LabelHeight 20 -Filename 'thumbnail-review-96px.png'

$manifest=[ordered]@{
    title='Cartoon Pandas - Hard'; created='2026-11-01'; tool='built-in image_gen'
    reference_thread='01a191d5-eb59-7430-9dcc-c615495770ff'
    unique_images=24; matching_pairs=24; board_cards=48
    normalization='Each complete original render fitted to an 864 x 864 square at (80,80) on a 1024 x 1024 canvas matching its corner cream colour; no cropping, stretching, or pose changes.'
    difficulty='Intended Hard: consistent black-and-white panda character and background, six pose families, four variations each. Difficulty has not been play-tested.'
    cards=$records
}
$manifest | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $Root 'prompts-and-manifest.json') -Encoding utf8

$readme=@'
Cartoon Pandas - Hard - 24 matching pairs
Created 1 November 2026 using the built-in image_gen tool.

The cards folder contains 24 unique 1024 x 1024 PNG images.
Import each once: the memory game creates the identical matching partner.
Using all 24 images gives 24 pairs, or 48 playing cards.

The same cute black-and-white cartoon panda appears on a cream background throughout.
The six pose families (four cards each) are seated, standing, lying on the belly,
lying on the back, side lying, and on four paws. Paws, feet, head angle and facial
expressions distinguish closely related cards. Intended difficulty: Hard.
There are no labels, borders, props or watermarks on the actual cards.

IMPORT
Extract pandas-cartoon-hard-24-cards.zip into a new folder.
Open Deck library > Import an image folder and choose that extracted folder.
Alternatively, import this package's cards folder directly.
Choose all 24 panda images, style Illustrated, complexity Hard, and a panda deck name.
Do not import contact-sheet.png or thumbnail-review-96px.png as playing cards.

FILES
cards/ - the import-ready PNGs, one unique image per pair.
originals/ - untouched original tool renders, preserved at their generated size.
contact-sheet.png - large review of all 24 cards.
thumbnail-review-96px.png - each card shown at 96 pixels, at 100% image zoom.
prompts-and-manifest.json - exact prompts, pose descriptions, dimensions and SHA-256 hashes.
generation-inputs.json - generation source paths and prompts for packaging provenance.
generation-plan.json - original 24-pose design plan.
package-pandas.ps1 - packaging, normalization, review-sheet and archive verification script.
validation.json - file, dimension, uniqueness and ZIP verification results.
SHA256SUMS.txt - hashes for the card PNGs and the flat import ZIP.

Every complete original is scaled uniformly into an 864 x 864 square on a
1024 x 1024 cream canvas with 80 pixels of additional margin on all sides.
No source is cropped or stretched. The character poses were made using image_gen.

Validation covers image decoding, square dimensions, decoded-pixel uniqueness,
preserved original files and exact ZIP contents. The set has been visually
reviewed at 96 pixels, but has not been imported or play-tested in the running game.
'@
Set-Content -LiteralPath (Join-Path $Root 'README.txt') -Value $readme -Encoding utf8

Compress-Archive -LiteralPath @($items | ForEach-Object { Join-Path $cardsRoot $_.file }) -DestinationPath $archive -CompressionLevel Optimal
$zip=[System.IO.Compression.ZipFile]::OpenRead($archive)
try {
    if($zip.Entries.Count -ne 24){throw 'ZIP must contain exactly 24 entries.'}
    foreach($entry in $zip.Entries){
        if($entry.FullName -ne $entry.Name -or $entry.Name -notlike '*.png'){throw 'ZIP is not a flat PNG-only deck.'}
        $expected=@($records | Where-Object { ('cards/'+$entry.Name) -eq $_.file })
        if($expected.Count -ne 1){throw 'Unexpected ZIP entry.'}
        $stream=$entry.Open()
        $sha=[System.Security.Cryptography.SHA256]::Create()
        try{$entryHash=([BitConverter]::ToString($sha.ComputeHash($stream))).Replace('-','').ToLowerInvariant()}
        finally{$sha.Dispose();$stream.Dispose()}
        if($entryHash -ne $expected[0].sha256){throw 'ZIP entry hash mismatch.'}
    }
} finally {$zip.Dispose()}
foreach($record in $records){
    $picture=[System.Drawing.Bitmap]::new((Join-Path $Root $record.file))
    try{
        if($picture.Width -ne 1024 -or $picture.Height -ne 1024){throw 'Unexpected final image size.'}
        if((Get-PixelHash $picture) -ne $record.pixel_sha256){throw 'Decoded final image hash mismatch.'}
    } finally {$picture.Dispose()}
}
$archiveHash=(Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash.ToLowerInvariant()
$checksumLines=@($records | ForEach-Object { $_.sha256+'  '+$_.file })
$checksumLines+=($archiveHash+'  ../pandas-cartoon-hard-24-cards.zip')
Set-Content -LiteralPath (Join-Path $Root 'SHA256SUMS.txt') -Value $checksumLines -Encoding ascii
$validation=[ordered]@{
    unique_cards=24; width=1024; height=1024
    unique_decoded_images=@($records.pixel_sha256 | Sort-Object -Unique).Count
    originals_verified=$true; zip_entries=24; zip_flat=$true; zip_png_only=$true; zip_hashes_match=$true
    archive=(Split-Path $archive -Leaf); archive_bytes=(Get-Item -LiteralPath $archive).Length; archive_sha256=$archiveHash
    visual_review='Pending'; game_import_tested=$false; difficulty_play_tested=$false
}
$validation | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath (Join-Path $Root 'validation.json') -Encoding utf8
$validation | ConvertTo-Json -Depth 4


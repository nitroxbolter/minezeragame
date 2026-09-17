Add-Type -AssemblyName System.Drawing

$out = Join-Path $PSScriptRoot '..\assets\guilherme-skin.png'
$bmp = [System.Drawing.Bitmap]::new(64,64,[System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$transparent = [System.Drawing.Color]::FromArgb(0,0,0,0)
$bmp.MakeTransparent($transparent)

function C([int]$r,[int]$g,[int]$b) { [System.Drawing.Color]::FromArgb(255,$r,$g,$b) }
function Fill([int]$x,[int]$y,[int]$w,[int]$h,$color) {
  for ($yy=$y; $yy -lt ($y+$h); $yy++) { for ($xx=$x; $xx -lt ($x+$w); $xx++) {
    if ($xx -ge 0 -and $yy -ge 0 -and $xx -lt 64 -and $yy -lt 64) { $bmp.SetPixel($xx,$yy,$color) }
  }}
}
function Stripe([int]$x,[int]$y,[int]$w,[int]$h,$a,$b) {
  Fill $x $y $w $h $a
  for ($yy=$y; $yy -lt ($y+$h); $yy++) { for ($xx=$x; $xx -lt ($x+$w); $xx++) {
    if ((($xx+$yy) % 5) -eq 0) { $bmp.SetPixel($xx,$yy,$b) }
  }}
}

$black = C 8 8 10; $hair = C 20 17 20; $burgundy = C 86 12 18; $red = C 170 25 34
$redDark = C 55 7 12; $white = C 232 236 238; $gray = C 145 151 158; $skin = C 110 70 58
$gold = C 196 150 55

# Head, repeated on every face of the classic 64x64 layout.
$headFaces = @(@(0,8),@(8,8),@(16,8),@(24,8),@(16,0),@(8,0))
foreach ($p in $headFaces) {
  Stripe $p[0] $p[1] 8 8 $hair $black
  Fill ($p[0]+1) ($p[1]+5) 6 3 $black
  Fill ($p[0]+2) ($p[1]+6) 4 1 $redDark
}
# Head overlay: black hair and two red horn accents.
foreach ($p in @(@(32,8),@(40,8),@(48,8),@(56,8),@(40,0),@(48,0))) { Fill $p[0] $p[1] 8 8 $transparent }
Fill 40 8 8 8 $hair; Fill 48 8 8 8 $hair; Fill 56 8 8 8 $hair
Fill 40 0 8 8 $hair; Fill 48 0 8 8 $hair
Fill 40 8 2 4 $red; Fill 54 8 2 4 $red; Fill 40 4 2 4 $red; Fill 54 4 2 4 $red

# Body: burgundy coat, black center, white/gray tie details.
foreach ($p in @(@(16,20),@(20,20),@(28,20),@(32,20),@(20,16),@(28,16))) {
  $pw = 4; $ph = 12
  if ($p[1] -eq 16) { $pw = 8; $ph = 4 }
  Stripe $p[0] $p[1] $pw $ph $burgundy $redDark
}
Fill 20 20 8 12 $burgundy; Fill 23 20 2 12 $black; Fill 24 21 1 4 $white; Fill 23 25 3 2 $gray; Fill 24 27 1 5 $white
Fill 20 16 8 2 $redDark; Fill 28 16 8 2 $redDark

# Arms, with burgundy sleeves, black cuffs and red trim.
foreach ($p in @(@(40,20),@(44,20),@(48,20),@(52,20),@(32,52),@(36,52),@(40,52),@(44,52))) { Stripe $p[0] $p[1] 4 12 $burgundy $redDark; Fill $p[0] ($p[1]+9) 4 3 $black; Fill $p[0] ($p[1]+11) 4 1 $red }

# Legs and white boots.
foreach ($p in @(@(0,20),@(4,20),@(8,20),@(12,20),@(16,52),@(20,52),@(24,52),@(28,52))) {
  Fill $p[0] $p[1] 4 12 $black; Fill $p[0] ($p[1]+9) 4 2 $red; Fill $p[0] ($p[1]+11) 4 1 $white
}
Fill 4 16 4 2 $black; Fill 8 16 4 2 $black; Fill 20 48 4 2 $black; Fill 24 48 4 2 $black

$bmp.Save($out,[System.Drawing.Imaging.ImageFormat]::Png)
$bmp.Dispose()
Write-Output $out

# 시연 원본 이미지는 그대로 두고, 앱의 toBlob()과 같은 워터마크 미리보기를 만든다.
Add-Type -AssemblyName System.Drawing

$root = Split-Path -Parent $PSScriptRoot
$sourceDir = Join-Path $root 'assets/demo'
$previewDir = Join-Path $sourceDir 'previews'
$watermark = -join [char[]]@(0xAC00, 0xAC8C, 0xC628, 0x20, 0xACAC, 0xC801, 0xC6A9, 0x20, 0xBBF8, 0xB9AC, 0xBCF4, 0xAE30)
New-Item -ItemType Directory -Path $previewDir -Force | Out-Null

Get-ChildItem -LiteralPath $sourceDir -Filter '*.png' -File | ForEach-Object {
  $source = [System.Drawing.Image]::FromFile($_.FullName)
  try {
    $scale = [Math]::Min(1.0, 800.0 / [Math]::Max($source.Width, $source.Height))
    $width = [int][Math]::Round($source.Width * $scale)
    $height = [int][Math]::Round($source.Height * $scale)
    $bitmap = [System.Drawing.Bitmap]::new($width, $height)
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    $font = [System.Drawing.Font]::new('Malgun Gothic', [float][Math]::Round($width / 14), [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
    $brush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(46, 0, 0, 0))
    $format = [System.Drawing.StringFormat]::new()
    try {
      $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
      $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
      $graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAlias
      $graphics.DrawImage($source, 0, 0, $width, $height)
      $graphics.TranslateTransform($width / 2, $height / 2)
      $graphics.RotateTransform(-30)
      $format.Alignment = [System.Drawing.StringAlignment]::Center
      $format.LineAlignment = [System.Drawing.StringAlignment]::Center
      for ($line = -2; $line -le 2; $line++) {
        $y = $line * $height / 4
        $box = [System.Drawing.RectangleF]::new(-$width, [float]($y - $font.Size), 2 * $width, 2 * $font.Size)
        $graphics.DrawString($watermark, $font, $brush, $box, $format)
      }
      $target = Join-Path $previewDir $_.Name
      $bitmap.Save($target, [System.Drawing.Imaging.ImageFormat]::Png)
      Write-Output $target
    } finally {
      $format.Dispose()
      $brush.Dispose()
      $font.Dispose()
      $graphics.Dispose()
      $bitmap.Dispose()
    }
  } finally {
    $source.Dispose()
  }
}

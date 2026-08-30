<#
.SYNOPSIS
    quickpost CLI uploader
.DESCRIPTION
    Uploads files to qpst.cc from the terminal (up to 50 MB).
.EXAMPLE
    .\qp.ps1 file.png
.EXAMPLE
    "hello world" | .\qp.ps1 -Name customname
#>
[CmdletBinding(DefaultParameterSetName='Path')]
param(
    [Parameter(Position=0, ParameterSetName='Path')]
    [string]$Path,

    [Alias("n", "name")]
    [Parameter()]
    [string]$CustomName,

    [Parameter(ParameterSetName='Pipeline', ValueFromPipeline=$true)]
    [string]$InputObject
)

begin {
    $QpUrl = $env:QP_URL
    if ([string]::IsNullOrWhiteSpace($QpUrl)) {
        $QpUrl = "https://qpst.cc"
    }
    
    $tempFile = $null
    $pipelineData = [System.Collections.Generic.List[string]]::new()
}

process {
    if ($PSCmdlet.ParameterSetName -eq 'Pipeline') {
        if ($null -ne $InputObject) {
            $pipelineData.Add($InputObject)
        }
    }
}

end {
    $filePath = ""
    $fileName = ""
    $mime = "application/octet-stream"
    
    if ($PSCmdlet.ParameterSetName -eq 'Path' -and -not [string]::IsNullOrWhiteSpace($Path)) {
        try {
            $filePath = Resolve-Path $Path -ErrorAction Stop | Select-Object -ExpandProperty Path
            $fileName = Split-Path $filePath -Leaf
        } catch {
            Write-Error "Error: file not found: $Path"
            return
        }
    } elseif ($pipelineData.Count -gt 0) {
        $tempFile = [System.IO.Path]::GetTempFileName()
        $pipelineData -join "`n" | Set-Content -Path $tempFile -NoNewline
        $filePath = $tempFile
        $fileName = "stdin.txt"
    } else {
        Write-Error "Usage: qp <file>  or  <command> | qp"
        return
    }

    # Derive extension
    $ext = [System.IO.Path]::GetExtension($fileName).TrimStart('.')
    if ([string]::IsNullOrWhiteSpace($ext) -or $fileName -eq "stdin.txt") { 
        $ext = "txt" 
    }
    $ext = $ext.ToLower()

    # Basic MIME types for common formats
    switch ($ext) {
        "txt"  { $mime = "text/plain" }
        "py"   { $mime = "text/x-python" }
        "js"   { $mime = "application/javascript" }
        "html" { $mime = "text/html" }
        "css"  { $mime = "text/css" }
        "json" { $mime = "application/json" }
        "md"   { $mime = "text/markdown" }
        "png"  { $mime = "image/png" }
        "jpg"  { $mime = "image/jpeg" }
        "jpeg" { $mime = "image/jpeg" }
        "pdf"  { $mime = "application/pdf" }
    }

    # Generate 3-char base36 ID
    if (-not [string]::IsNullOrWhiteSpace($CustomName)) {
        $baseId = $CustomName -replace '\.[^.]*$', '' -replace '[^a-zA-Z0-9_-]', '_'
        if ([string]::IsNullOrWhiteSpace($baseId)) {
            $chars = "abcdefghijklmnopqrstuvwxyz0123456789"
            $baseId = -join (1..3 | ForEach-Object { $chars[(Get-Random -Maximum $chars.Length)] })
        }
    } else {
        $chars = "abcdefghijklmnopqrstuvwxyz0123456789"
        $baseId = -join (1..3 | ForEach-Object { $chars[(Get-Random -Maximum $chars.Length)] })
    }

    $storagePath = "$baseId.$ext"

    # Step 1: Presigned URL
    $headers = @{ "Content-Type" = "application/json" }
    $body = @{ fileName = $storagePath; fileType = $mime } | ConvertTo-Json -Compress

    try {
        $presign = Invoke-RestMethod -Uri "$QpUrl/api/upload-url" -Method Post -Headers $headers -Body $body
        $uploadUrl = $presign.uploadUrl
    } catch {
        Write-Error "Error: failed to get upload URL. $_"
        if ($tempFile) { Remove-Item $tempFile -Force }
        return
    }

    if ([string]::IsNullOrWhiteSpace($uploadUrl)) {
        Write-Error "Error: could not parse upload URL from response."
        if ($tempFile) { Remove-Item $tempFile -Force }
        return
    }

    # Step 2: Upload file directly to R2
    try {
        Invoke-RestMethod -Uri $uploadUrl -Method Put -InFile $filePath -ContentType $mime | Out-Null
    } catch {
        Write-Error "Error: upload to storage failed. $_"
        if ($tempFile) { Remove-Item $tempFile -Force }
        return
    }

    # Step 3: Register metadata
    $regBody = @{ short_id = $baseId; filename = $storagePath; storage_path = $storagePath } | ConvertTo-Json -Compress
    try {
        $reg = Invoke-RestMethod -Uri "$QpUrl/api/register" -Method Post -Headers $headers -Body $regBody
        Write-Output $reg.url
    } catch {
        Write-Error "Error: failed to register file metadata. $_"
    }

    # Cleanup
    if ($tempFile) { Remove-Item $tempFile -Force }
}

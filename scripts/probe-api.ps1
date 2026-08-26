$u = 'https://build-what-moves-india-indol.vercel.app'

function Probe($label, $body, $method = 'POST') {
    $p = @{
        Uri                = "$u/api/query"
        Method             = $method
        SkipHttpErrorCheck = $true
        UseBasicParsing    = $true
    }
    if ($body) {
        $p.Body = ($body | ConvertTo-Json -Compress)
        $p.ContentType = 'application/json'
    }
    $r = Invoke-WebRequest @p
    $out = "$($r.Content)"
    '{0,-24} {1}  {2}' -f $label, $r.StatusCode, $out.Substring(0, [Math]::Min(64, $out.Length))
}

Probe 'GET not allowed'   $null 'GET'
Probe 'unknown name'      @{ name = 'drop' }
Probe 'raw SQL as name'   @{ name = 'SELECT 1' }
Probe 'injected relation' @{ name = 'preview'; relation = 'TAXPAYER; DROP TABLE NOTICE' }
Probe 'unlisted relation' @{ name = 'preview'; relation = 'INFORMATION_SCHEMA.TABLES' }
Probe 'valid named query' @{ name = 'corpusSize' }

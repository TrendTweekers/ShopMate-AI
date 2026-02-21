param([Parameter(Mandatory=$true)][string]$BaseUrl)

$BaseUrl = $BaseUrl.TrimEnd('/')

$tomlPath = ".\shopify.app.toml"
$toml = Get-Content $tomlPath -Raw

# Update application_url
$toml = $toml -replace '(?m)^\s*application_url\s*=\s*".*"\s*$', "application_url = `"$BaseUrl`""

# Update app_proxy url (expects /apps/shopmate)
$toml = $toml -replace '(?m)^\s*url\s*=\s*".*?/apps/shopmate"\s*$', "url = `"$BaseUrl/apps/shopmate`""

Set-Content $tomlPath $toml -Encoding UTF8
Write-Host "Updated application_url to $BaseUrl"
Write-Host "Updated [app_proxy].url to $BaseUrl/apps/shopmate"
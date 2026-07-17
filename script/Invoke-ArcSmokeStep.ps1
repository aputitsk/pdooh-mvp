param(
  [Parameter(Mandatory = $true)]
  [ValidateSet("Preflight", "Deploy", "Configure", "Bid", "Finalize", "Confirm", "Settle", "Expire")]
  [string]$Step,

  [string]$EnvFile = ".env.arc-smoke.local"
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path -LiteralPath $EnvFile)) {
  throw "Env file not found: $EnvFile"
}

Get-Content -LiteralPath $EnvFile | ForEach-Object {
  $line = $_.Trim()
  if ($line.Length -eq 0 -or $line.StartsWith("#")) {
    return
  }

  $parts = $line -split "=", 2
  if ($parts.Length -ne 2) {
    throw "Invalid env line: $line"
  }

  $name = $parts[0].Trim()
  $value = $parts[1].Trim()
  if (($value.StartsWith('"') -and $value.EndsWith('"')) -or ($value.StartsWith("'") -and $value.EndsWith("'"))) {
    $value = $value.Substring(1, $value.Length - 2)
  }

  [Environment]::SetEnvironmentVariable($name, $value, "Process")
}

function Require-Env([string]$Name) {
  $value = [Environment]::GetEnvironmentVariable($Name, "Process")
  if ([string]::IsNullOrWhiteSpace($value)) {
    throw "Missing required env var: $Name"
  }
}

switch ($Step) {
  "Preflight" {
    $checks = @(
      @{ Name = "ARC_TESTNET_USDC"; Expected = 42 },
      @{ Name = "PDOOH_ADMIN"; Expected = 42 },
      @{ Name = "PDOOH_CONFIG_ADMIN"; Expected = 42 },
      @{ Name = "PDOOH_REPORTER"; Expected = 42 },
      @{ Name = "PDOOH_PAUSER"; Expected = 42 },
      @{ Name = "PDOOH_TREASURY"; Expected = 42 },
      @{ Name = "PDOOH_INITIAL_SITE_ID"; Expected = 66 },
      @{ Name = "PDOOH_SMOKE_SITE_ID"; Expected = 66 },
      @{ Name = "PDOOH_SMOKE_ADVERTISER"; Expected = 42 },
      @{ Name = "PDOOH_SMOKE_ADVERTISEMENT_ID"; Expected = 66 },
      @{ Name = "PDOOH_SMOKE_SCREEN_ID"; Expected = 66 },
      @{ Name = "PDOOH_SMOKE_EVIDENCE_HASH"; Expected = 66 },
      @{ Name = "PDOOH_ADMIN_PRIVATE_KEY"; Expected = 66 },
      @{ Name = "PDOOH_CONFIG_ADMIN_PRIVATE_KEY"; Expected = 66 },
      @{ Name = "PDOOH_SMOKE_ADVERTISER_PRIVATE_KEY"; Expected = 66 },
      @{ Name = "PDOOH_REPORTER_PRIVATE_KEY"; Expected = 66 },
      @{ Name = "PDOOH_RELAYER_PRIVATE_KEY"; Expected = 66 }
    )

    foreach ($check in $checks) {
      $value = [Environment]::GetEnvironmentVariable($check.Name, "Process")
      [PSCustomObject]@{
        Name = $check.Name
        Set = -not [string]::IsNullOrWhiteSpace($value)
        Length = $value.Length
        ExpectedLength = $check.Expected
      }
    }

    foreach ($name in @("PDOOH_FIRST_CYCLE_START", "PDOOH_PROOF_DEADLINE_SECONDS", "PDOOH_SMOKE_CYCLE_ID", "PDOOH_SMOKE_SLOT_INDEX", "PDOOH_SMOKE_BID_AMOUNT", "PDOOH_SMOKE_REPORTER_NONCE")) {
      $value = [Environment]::GetEnvironmentVariable($name, "Process")
      [PSCustomObject]@{
        Name = $name
        Set = -not [string]::IsNullOrWhiteSpace($value)
        Length = $value.Length
        ExpectedLength = "number"
      }
    }

    $start = [Environment]::GetEnvironmentVariable("PDOOH_FIRST_CYCLE_START", "Process")
    if (-not [string]::IsNullOrWhiteSpace($start)) {
      [PSCustomObject]@{
        Name = "PDOOH_FIRST_CYCLE_START_DELTA_SECONDS"
        Set = $true
        Length = ([int64]$start - [DateTimeOffset]::UtcNow.ToUnixTimeSeconds())
        ExpectedLength = "positive"
      }
    }
  }
  "Deploy" {
    Require-Env "PDOOH_ADMIN_PRIVATE_KEY"
    forge script script/DeployAuctionEngineV1.s.sol:DeployAuctionEngineV1 --rpc-url arc_testnet --broadcast --private-key $env:PDOOH_ADMIN_PRIVATE_KEY
  }
  "Configure" {
    Require-Env "PDOOH_CONFIG_ADMIN_PRIVATE_KEY"
    forge script script/ConfigureAuctionEngineV1Site.s.sol:ConfigureAuctionEngineV1Site --rpc-url arc_testnet --broadcast --private-key $env:PDOOH_CONFIG_ADMIN_PRIVATE_KEY
  }
  "Bid" {
    Require-Env "PDOOH_SMOKE_ADVERTISER_PRIVATE_KEY"
    forge script script/SmokeAuctionEngineV1.s.sol:SmokeAuctionEngineV1Bid --rpc-url arc_testnet --broadcast --skip-simulation --private-key $env:PDOOH_SMOKE_ADVERTISER_PRIVATE_KEY
  }
  "Finalize" {
    Require-Env "PDOOH_RELAYER_PRIVATE_KEY"
    forge script script/SmokeAuctionEngineV1.s.sol:SmokeAuctionEngineV1Finalize --rpc-url arc_testnet --broadcast --private-key $env:PDOOH_RELAYER_PRIVATE_KEY
  }
  "Confirm" {
    Require-Env "PDOOH_REPORTER_PRIVATE_KEY"
    forge script script/SmokeAuctionEngineV1.s.sol:SmokeAuctionEngineV1Confirm --rpc-url arc_testnet --broadcast --private-key $env:PDOOH_REPORTER_PRIVATE_KEY
  }
  "Settle" {
    Require-Env "PDOOH_RELAYER_PRIVATE_KEY"
    forge script script/SmokeAuctionEngineV1.s.sol:SmokeAuctionEngineV1Settle --rpc-url arc_testnet --broadcast --skip-simulation --private-key $env:PDOOH_RELAYER_PRIVATE_KEY
  }
  "Expire" {
    Require-Env "PDOOH_RELAYER_PRIVATE_KEY"
    forge script script/SmokeAuctionEngineV1.s.sol:SmokeAuctionEngineV1Expire --rpc-url arc_testnet --broadcast --private-key $env:PDOOH_RELAYER_PRIVATE_KEY
  }
}

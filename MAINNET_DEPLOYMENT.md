# Vesting Halving Program - Mainnet Deployment

## Program Information
- **Program ID**: `6Bg1RuRv2yHxJbSodDMKH2dFbDQKGeZwKkDhzZxXQ7xc`
- **Network**: X1 Mainnet
- **Deployment Signature**: `2VLi8xV71CJfLmnyxvN1hTpRfwa4rUCGg74fAsVHmPLG3m3Q2j7uwG8SPSpetD81ypHqm8tchd2GA9Qp5ppsW1Uf`
- **Deployed**: March 24, 2026
- **Size**: 252 KB
- **Authority**: C5V1AaFcE8WSEWaC6gb1w3mcXd3JbdgJ7yXYBuoxphGZ

## Features
✅ All tokens vested upfront (initial_supply × 2)
✅ Time-locked halving schedule
✅ Period 0 unlocked immediately
✅ Automatic halving: 100k → 50k → 25k → 12.5k...
✅ One-transaction claims
✅ Beneficiary control

## Instructions
1. `initialize_vesting_halving(initial_supply, halving_interval)`
2. `claim_vesting_period()`
3. `update_beneficiary(new_beneficiary)`

## Example Usage
```javascript
// Initialize: 100k tokens, 365 day halving
await program.methods
  .initializeVestingHalving(
    new BN(100000 * 1e9),  // 100k tokens
    new BN(31536000)        // 365 days
  )
  .rpc();

// Claim period 0 immediately (100k)
await program.methods.claimVestingPeriod().rpc();

// Wait 365 days...

// Claim period 1 (50k)
await program.methods.claimVestingPeriod().rpc();
```

## Verification
```bash
solana program show 6Bg1RuRv2yHxJbSodDMKH2dFbDQKGeZwKkDhzZxXQ7xc
```

## Security
- Security.txt embedded on-chain
- Open source: MIT License
- Tested on X1 Testnet

# Vesting Halving Program - API Reference

Complete technical reference for all program instructions and accounts.

## Program Information

- **Program ID**: `6Bg1RuRv2yHxJbSodDMKH2dFbDQKGeZwKkDhzZxXQ7xc`
- **Network**: X1 Mainnet
- **Framework**: Anchor 0.32.1

---

## Instructions

### initialize_vesting_halving

Initializes vesting schedule and mints all tokens to vault.

**Parameters:**
- `initial_supply: u64` - First period allocation (with decimals)
- `halving_interval: i64` - Seconds between halvings

**Accounts:**
- `vesting_halving` - PDA (writable, initialized)
- `token_mint` - Token mint (writable)
- `vault_token_account` - Vault ATA (writable, initialized)
- `beneficiary` - Who can claim (unchecked)
- `mint_authority` - Current authority (signer)
- `payer` - Pays for accounts (signer, writable)

**PDA Seeds:** `["vesting_halving", token_mint]`

**Example:**
```javascript
await program.methods
  .initializeVestingHalving(
    new BN(100_000 * 1e9),
    new BN(31_536_000)
  )
  .accounts({...})
  .rpc();
```

---

### claim_vesting_period

Claims unlocked period tokens.

**Parameters:** None

**Accounts:**
- `vesting_halving` - Vesting config (writable)
- `token_mint` - Token mint
- `vault_token_account` - Vault (writable)
- `beneficiary_token_account` - Beneficiary ATA (writable)
- `beneficiary` - Signer
- `token_program` - SPL Token

**Example:**
```javascript
await program.methods
  .claimVestingPeriod()
  .accounts({...})
  .rpc();
```

---

### update_beneficiary

Transfers beneficiary rights.

**Parameters:**
- `new_beneficiary: Pubkey` - New owner

**Accounts:**
- `vesting_halving` - Config (writable)
- `beneficiary` - Current owner (signer)

**Example:**
```javascript
await program.methods
  .updateBeneficiary(newBeneficiary)
  .accounts({...})
  .rpc();
```

---

## Account Structure

### VestingHalvingConfig
```rust
pub struct VestingHalvingConfig {
    pub beneficiary: Pubkey,        // 32 bytes
    pub token_mint: Pubkey,          // 32 bytes
    pub initial_supply: u64,         // 8 bytes
    pub current_period: u32,         // 4 bytes
    pub period_supply: u64,          // 8 bytes
    pub claimed_this_period: bool,   // 1 byte
    pub total_claimed: u64,          // 8 bytes
    pub start_time: i64,             // 8 bytes
    pub halving_interval: i64,       // 8 bytes
    pub bump: u8,                    // 1 byte
}
```

**Total:** 113 bytes (8 discriminator + 105 data)

---

## Error Codes

| Code | Name | Message |
|------|------|---------|
| 6000 | InvalidSupply | Invalid supply - must be > 0 |
| 6001 | InvalidInterval | Invalid halving interval - must be > 0 |
| 6002 | PeriodNotUnlocked | Vesting period not unlocked yet |
| 6003 | AllPeriodsClaimed | All vesting periods claimed |
| 6004 | Overflow | Arithmetic overflow |

---

## Calculations

**Total Supply:** `initial_supply × 2`

**Period N Supply:** `initial_supply / (2^N)`

**Time Period:** `(now - start_time) / halving_interval`

**Unlock Time:** `start_time + (N × halving_interval)`

---

## Events
```
Initialize: "✅ Vesting Halving: {total} tokens vaulted..."
Claim: "✅ Vesting claim: {amount} tokens for period {N}"
Update: "✅ Beneficiary updated"
```

---

## Security

- ✅ Time-locked via Solana Clock sysvar
- ✅ Authority checks on all mutations
- ✅ Overflow protection
- ✅ No reentrancy vulnerabilities


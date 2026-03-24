# Vesting Halving Program

**Bitcoin-style halving with time-locked vesting**

![Status](https://img.shields.io/badge/status-mainnet-success)
![Network](https://img.shields.io/badge/network-X1-blue)

## 🎯 Overview

The Vesting Halving Program mints all tokens upfront to a vault and releases them on a Bitcoin-style halving schedule. Each period releases half the previous period's allocation.

## 📊 Program Information

- **Program ID**: `6Bg1RuRv2yHxJbSodDMKH2dFbDQKGeZwKkDhzZxXQ7xc`
- **Network**: X1 Mainnet
- **Deployment Signature**: `2VLi8xV71CJfLmnyxvN1hTpRfwa4rUCGg74fAsVHmPLG3m3Q2j7uwG8SPSpetD81ypHqm8tchd2GA9Qp5ppsW1Uf`
- **Size**: 252 KB

## 🔑 Key Features

✅ **All Tokens Vested Upfront** - Mints `initial_supply × 2` tokens to vault immediately  
✅ **Time-Locked Halving** - Each period releases half of previous period  
✅ **Immediate Period 0** - First allocation available instantly  
✅ **One-Transaction Claims** - Simple `claim_vesting_period()` call  
✅ **Transferable Beneficiary** - Update who can claim tokens  

## 📈 How It Works

### Initialization
```javascript
// Example: 100,000 tokens with 365-day halving
await program.methods
  .initializeVestingHalving(
    new BN(100_000 * 1e9),  // 100k tokens
    new BN(31_536_000)       // 365 days in seconds
  )
  .rpc();
```

**Result:**
- 200,000 tokens minted to vault (100k × 2)
- Period 0: 100,000 tokens (unlocked immediately)
- Period 1: 50,000 tokens (unlocks after 365 days)
- Period 2: 25,000 tokens (unlocks after 730 days)
- Period 3: 12,500 tokens (unlocks after 1,095 days)
- Continues halving...

### Claiming
```javascript
// Claim unlocked period
await program.methods
  .claimVestingPeriod()
  .rpc();
```

### Vesting Schedule Example

| Period | Unlock Time | Amount    | Cumulative |
|--------|------------|-----------|------------|
| 0      | Day 0      | 100,000   | 100,000    |
| 1      | Day 365    | 50,000    | 150,000    |
| 2      | Day 730    | 25,000    | 175,000    |
| 3      | Day 1,095  | 12,500    | 187,500    |
| 4      | Day 1,460  | 6,250     | 193,750    |
| ...    | ...        | ...       | → 200,000  |

## 🛠️ Instructions

### `initialize_vesting_halving`
Initializes the vesting schedule and mints all tokens to vault.

**Parameters:**
- `initial_supply: u64` - First period allocation (with decimals)
- `halving_interval: i64` - Seconds between halvings

**Note:** Transfer mint authority to the halving PDA after initialization.

### `claim_vesting_period`
Claims tokens for the current unlocked period.

**Requirements:**
- Period must be time-unlocked
- Called by beneficiary
- Tokens still available

### `update_beneficiary`
Transfers beneficiary rights to a new address.

**Parameters:**
- `new_beneficiary: Pubkey` - New beneficiary address

## 🔒 Security

- ✅ Security.txt embedded on-chain
- ✅ Time-locked vesting - cannot be rushed
- ✅ Immutable supply calculation
- ✅ Open source - MIT License

## 🧪 Testing

Tested on X1 Testnet with multiple scenarios:
- ✅ Initialization and minting
- ✅ Immediate Period 0 claim
- ✅ Time-locked period enforcement
- ✅ Halving calculations
- ✅ Multi-period claims

## 📝 Example Flow
```bash
# Day 0: Initialize
initialize_vesting_halving(100_000, 365 days)
→ 200,000 tokens minted to vault

# Day 0: Claim Period 0
claim_vesting_period()
→ Receive 100,000 tokens

# Day 365: Claim Period 1
claim_vesting_period()
→ Receive 50,000 tokens

# Day 730: Claim Period 2
claim_vesting_period()
→ Receive 25,000 tokens
```

## 📚 Documentation

- [Usage Guide](./docs/USAGE_GUIDE.md) - Complete examples and integration
- [API Reference](./docs/API_REFERENCE.md) - Full technical reference
- [Architecture](./docs/ARCHITECTURE.md) - System design and diagrams

## 🔗 Links

- [X1 Blockchain](https://x1.xyz)
- [Security Policy](./SECURITY.md)
- [License](./LICENSE)

## 📄 License

MIT License - See [LICENSE](./LICENSE) file

## 🙏 Acknowledgments

Built for X1Nexus token launch platform.

**Other X1Nexus Programs:**
- [Liquidity Lock Program](https://github.com/omenpotter/liquidity-lock-program) - Time-lock any SPL token

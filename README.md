# Liquidity Lock Program

**Time-lock ANY SPL token with tamper-proof protection**

![Status](https://img.shields.io/badge/status-mainnet-success)
![Network](https://img.shields.io/badge/network-X1-blue)

## 🎯 Overview

The Liquidity Lock Program provides time-based token custody for the X1 blockchain. Lock **any SPL token** for a specified duration with cryptographic guarantees that tokens cannot be accessed until the unlock time.

**Originally designed for LP tokens, but works with ANY SPL token:**
- 💧 LP tokens (DEX liquidity pairs)
- 🪙 Project tokens
- 🗳️ Governance tokens
- 🖼️ NFTs
- 💰 Any SPL-compatible token

## 📊 Program Information

- **Program ID**: `BLM1UpG3ZJQnini6sG3oqznTQnsZCCuPUaLDVHEH4Ka1`
- **Network**: X1 Mainnet
- **Size**: 230 KB
- **Status**: ✅ Production Ready

## 🔑 Key Features

✅ **Universal Token Support** - Lock any SPL token  
✅ **Time-Locked Security** - Cannot bypass unlock time  
✅ **Extend Lock Period** - Increase lock duration anytime  
✅ **Transfer Ownership** - Move lock to another wallet  
✅ **Rent Recovery** - Get rent back when unlocking  
✅ **No Fees** - Only standard Solana transaction costs  

## 💡 Use Cases

### 1. Liquidity Protection (Original Use)
Lock DEX LP tokens to prove project commitment and prevent rug pulls.
```javascript
// Lock LP tokens for 1 year
await program.methods
  .initializeLock(
    new BN(1000 * 1e9),
    new BN(Date.now()/1000 + 31536000)
  ).rpc();
```

### 2. Team Token Vesting
Lock team allocations with time-based release.
```javascript
// Lock team tokens for 2 years
await program.methods
  .initializeLock(teamAmount, twoYearsLater).rpc();
```

### 3. Treasury Management
Lock DAO or project treasury tokens for governance decisions.

### 4. Investor Lock-ups
Enforce cliff and vesting periods for early investors.

### 5. Personal Token Savings
Lock your own tokens for self-discipline or long-term holding.

### 6. NFT Time Lock
Lock NFTs (SPL tokens with supply=1) for future reveals or airdrops.

## 🚀 Quick Start

### Installation
```bash
npm install @coral-xyz/anchor @solana/web3.js @solana/spl-token
```

### Basic Usage
```javascript
const anchor = require("@coral-xyz/anchor");
const { PublicKey } = require("@solana/web3.js");

// Program ID
const PROGRAM_ID = new PublicKey("BLM1UpG3ZJQnini6sG3oqznTQnsZCCuPUaLDVHEH4Ka1");

// Lock tokens for 1 year
const lockAmount = new BN(1000 * 1e9);
const unlockTime = new BN(Math.floor(Date.now()/1000) + 31536000);

await program.methods
  .initializeLock(lockAmount, unlockTime)
  .accounts({...})
  .rpc();
```

## 📖 Instructions

### `initialize_lock`
Locks tokens in time-locked vault.

**Parameters:**
- `amount: u64` - Token amount (with decimals)
- `unlock_time: i64` - Unix timestamp when unlockable

### `unlock`
Retrieves tokens after unlock time expires.

### `extend_lock`
Extends unlock time to later date.

**Parameters:**
- `new_unlock_time: i64` - New unlock timestamp

### `transfer_lock`
Transfers lock ownership to another wallet.

**Parameters:**
- `new_authority: Pubkey` - New owner address

## 🎨 Architecture
```
┌─────────────┐
│  SPL Token  │ (LP, governance, NFT, any token)
└─────────────┘
       │
       │ Lock tokens
       ▼
┌─────────────┐
│  Lock PDA   │ Time-locked vault
│  (Secure)   │ Cannot access until unlock_time
└─────────────┘
       │
       │ After unlock_time
       ▼
┌─────────────┐
│    Owner    │ Receives tokens back
└─────────────┘
```

## 🔒 Security

- ✅ Time-locked via Solana Clock sysvar (tamper-proof)
- ✅ Only authority can unlock/extend/transfer
- ✅ No emergency withdrawal or backdoors
- ✅ Security.txt embedded on-chain
- ✅ Open source - MIT License

## 📚 Documentation

- [Usage Guide](./docs/USAGE_GUIDE.md) - Complete examples and integration
- [API Reference](./docs/API_REFERENCE.md) - Full technical reference
- [Architecture](./docs/ARCHITECTURE.md) - System design and diagrams

## 🧪 Examples

### Lock LP Tokens (1 Year)
```javascript
const lpAmount = new BN(1000 * 1e9);
const oneYear = new BN(Date.now()/1000 + 31536000);
await program.methods.initializeLock(lpAmount, oneYear).rpc();
```

### Lock Team Tokens (2 Years)
```javascript
const teamTokens = new BN(100000 * 1e9);
const twoYears = new BN(Date.now()/1000 + 63072000);
await program.methods.initializeLock(teamTokens, twoYears).rpc();
```

### Lock NFT (1 Month)
```javascript
const oneNFT = new BN(1);
const oneMonth = new BN(Date.now()/1000 + 2592000);
await program.methods.initializeLock(oneNFT, oneMonth).rpc();
```

### Extend Lock Period
```javascript
const currentLock = await program.account.lock.fetch(lockPDA);
const newTime = new BN(currentLock.unlockTime.toNumber() + 15552000); // +6 months
await program.methods.extendLock(newTime).rpc();
```

### Transfer Lock to DAO
```javascript
const daoWallet = new PublicKey("...");
await program.methods.transferLock(daoWallet).rpc();
```

## 🌐 Integration

### React Component
```jsx
import { useWallet } from '@solana/wallet-adapter-react';

function TokenLock({ tokenMint, amount, duration }) {
  const wallet = useWallet();
  
  const lockTokens = async () => {
    const unlockTime = Math.floor(Date.now()/1000) + duration;
    await program.methods
      .initializeLock(new BN(amount), new BN(unlockTime))
      .rpc();
  };
  
  return <button onClick={lockTokens}>Lock Tokens</button>;
}
```

## 📊 Token Support

| Token Type | Supported | Example |
|------------|-----------|---------|
| LP Tokens | ✅ | SOL-USDC LP |
| Project Tokens | ✅ | Your token |
| Governance | ✅ | DAO tokens |
| NFTs | ✅ | Metaplex NFTs |
| Stablecoins | ✅ | USDC, USDT |
| Wrapped Tokens | ✅ | Wrapped SOL |
| **ANY SPL Token** | ✅ | All compatible |

## ⚠️ Important Notes

- ✅ Works with **ANY** SPL token
- ⏰ Time lock cannot be bypassed
- 🔒 One lock per (token, wallet) pair
- 💰 Rent recovered on unlock (~0.003 SOL)
- 🚫 Cannot unlock before time expires

## 🔗 Links

- [X1 Blockchain](https://x1.xyz)
- [Security Policy](./SECURITY.md)
- [License](./LICENSE)

## 📄 License

MIT License - See [LICENSE](./LICENSE) file

## 🙏 Built For

X1Nexus - Comprehensive token launch platform for X1 blockchain

**Other X1Nexus Programs:**
- [Vesting Halving Program](https://github.com/omenpotter/vesting-halving-program) - Time-locked vesting with halving schedule


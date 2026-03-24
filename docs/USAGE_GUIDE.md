# Vesting Halving Program - Usage Guide

Complete guide for integrating and using the Vesting Halving Program.

## Table of Contents
1. [Quick Start](#quick-start)
2. [Installation](#installation)
3. [Basic Usage](#basic-usage)
4. [Advanced Examples](#advanced-examples)
5. [Integration Guide](#integration-guide)
6. [Common Use Cases](#common-use-cases)
7. [Troubleshooting](#troubleshooting)

---

## Quick Start

### 1. Install Dependencies
```bash
npm install @coral-xyz/anchor @solana/web3.js @solana/spl-token
```

### 2. Import Program
```javascript
const anchor = require("@coral-xyz/anchor");
const { PublicKey } = require("@solana/web3.js");

const PROGRAM_ID = new PublicKey("6Bg1RuRv2yHxJbSodDMKH2dFbDQKGeZwKkDhzZxXQ7xc");
```

### 3. Initialize Vesting
```javascript
// Create token with your wallet as mint authority
const tokenMint = await createMint(
  connection,
  payer,
  payer.publicKey,
  null,
  9 // decimals
);

// Derive vesting PDA
const [vestingPDA] = PublicKey.findProgramAddressSync(
  [Buffer.from("vesting_halving"), tokenMint.toBuffer()],
  PROGRAM_ID
);

// Get vault ATA
const vaultATA = await getAssociatedTokenAddress(
  tokenMint,
  vestingPDA,
  true
);

// Initialize vesting (100k tokens, 365 day halving)
await program.methods
  .initializeVestingHalving(
    new anchor.BN(100_000 * 1e9),  // 100k tokens (with 9 decimals)
    new anchor.BN(31_536_000)       // 365 days in seconds
  )
  .accounts({
    vestingHalving: vestingPDA,
    tokenMint: tokenMint,
    vaultTokenAccount: vaultATA,
    beneficiary: beneficiary.publicKey,
    mintAuthority: payer.publicKey,
    payer: payer.publicKey,
    tokenProgram: TOKEN_PROGRAM_ID,
    associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
    systemProgram: SystemProgram.programId,
    rent: SYSVAR_RENT_PUBKEY,
  })
  .rpc();

// IMPORTANT: Transfer mint authority to vesting PDA
await setAuthority(
  connection,
  payer,
  tokenMint,
  payer.publicKey,
  AuthorityType.MintTokens,
  vestingPDA
);
```

---

## Installation

### Prerequisites
- Node.js v16+
- Solana CLI v1.17+
- Anchor Framework v0.32+
- X1 Wallet with XNT tokens

### Setup
```bash
# Clone the repository
git clone https://github.com/omenpotter/vesting-halving-program.git
cd vesting-halving-program

# Install dependencies
npm install

# Build (optional, for verification)
anchor build
```

---

## Basic Usage

### Complete Workflow
```javascript
const anchor = require("@coral-xyz/anchor");
const { 
  PublicKey, 
  Keypair, 
  SystemProgram 
} = require("@solana/web3.js");
const {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createMint,
  getOrCreateAssociatedTokenAccount,
  getAssociatedTokenAddress,
  setAuthority,
  AuthorityType
} = require("@solana/spl-token");

// Setup connection
const connection = new anchor.web3.Connection(
  "https://rpc.mainnet.x1.xyz",
  "confirmed"
);

// Load wallet
const wallet = anchor.Wallet.local();
const provider = new anchor.AnchorProvider(connection, wallet, {
  commitment: "confirmed"
});
anchor.setProvider(provider);

// Load program
const programId = new PublicKey("6Bg1RuRv2yHxJbSodDMKH2dFbDQKGeZwKkDhzZxXQ7xc");
const idl = await anchor.Program.fetchIdl(programId, provider);
const program = new anchor.Program(idl, provider);

// Step 1: Create token
console.log("Creating token...");
const tokenMint = await createMint(
  connection,
  wallet.payer,
  wallet.publicKey,
  null,
  9
);

// Step 2: Calculate PDAs
const [vestingPDA] = PublicKey.findProgramAddressSync(
  [Buffer.from("vesting_halving"), tokenMint.toBuffer()],
  programId
);

const vaultATA = await getAssociatedTokenAddress(
  tokenMint,
  vestingPDA,
  true
);

// Step 3: Initialize vesting
console.log("Initializing vesting...");
const initialSupply = new anchor.BN(1_000_000 * 1e9); // 1M tokens
const halvingInterval = new anchor.BN(30 * 24 * 60 * 60); // 30 days

await program.methods
  .initializeVestingHalving(initialSupply, halvingInterval)
  .accounts({
    vestingHalving: vestingPDA,
    tokenMint: tokenMint,
    vaultTokenAccount: vaultATA,
    beneficiary: wallet.publicKey,
    mintAuthority: wallet.publicKey,
    payer: wallet.publicKey,
    tokenProgram: TOKEN_PROGRAM_ID,
    associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
    systemProgram: SystemProgram.programId,
    rent: anchor.web3.SYSVAR_RENT_PUBKEY,
  })
  .rpc();

// Step 4: Transfer mint authority
console.log("Transferring mint authority...");
await setAuthority(
  connection,
  wallet.payer,
  tokenMint,
  wallet.publicKey,
  AuthorityType.MintTokens,
  vestingPDA
);

console.log("✅ Vesting initialized!");
console.log("Token Mint:", tokenMint.toString());
console.log("Vesting PDA:", vestingPDA.toString());
console.log("Vault:", vaultATA.toString());

// Step 5: Claim Period 0 (available immediately)
console.log("\nClaiming Period 0...");
const beneficiaryATA = await getOrCreateAssociatedTokenAccount(
  connection,
  wallet.payer,
  tokenMint,
  wallet.publicKey
);

await program.methods
  .claimVestingPeriod()
  .accounts({
    vestingHalving: vestingPDA,
    tokenMint: tokenMint,
    vaultTokenAccount: vaultATA,
    beneficiaryTokenAccount: beneficiaryATA.address,
    beneficiary: wallet.publicKey,
    tokenProgram: TOKEN_PROGRAM_ID,
  })
  .rpc();

console.log("✅ Claimed Period 0!");

// Check balance
const balance = await connection.getTokenAccountBalance(beneficiaryATA.address);
console.log("Balance:", balance.value.uiAmount);
```

---

## Advanced Examples

### 1. Multi-Period Claim Script
```javascript
async function claimAllAvailablePeriods() {
  const config = await program.account.vestingHalvingConfig.fetch(vestingPDA);
  const currentTime = Math.floor(Date.now() / 1000);
  const elapsed = currentTime - config.startTime.toNumber();
  const periodsUnlocked = Math.floor(elapsed / config.halvingInterval.toNumber());
  
  console.log(`Periods unlocked: ${periodsUnlocked}`);
  console.log(`Current period: ${config.currentPeriod}`);
  
  for (let i = config.currentPeriod; i <= periodsUnlocked; i++) {
    if (config.periodSupply.toNumber() === 0) {
      console.log("All periods claimed!");
      break;
    }
    
    console.log(`Claiming period ${i}...`);
    try {
      await program.methods
        .claimVestingPeriod()
        .accounts({
          vestingHalving: vestingPDA,
          tokenMint: tokenMint,
          vaultTokenAccount: vaultATA,
          beneficiaryTokenAccount: beneficiaryATA.address,
          beneficiary: wallet.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .rpc();
      
      console.log(`✅ Claimed period ${i}`);
    } catch (error) {
      console.log(`Period ${i} not ready or already claimed`);
      break;
    }
  }
}
```

### 2. Monitor Vesting Schedule
```javascript
async function getVestingSchedule() {
  const config = await program.account.vestingHalvingConfig.fetch(vestingPDA);
  
  const schedule = [];
  let periodSupply = config.initialSupply.toNumber();
  const startTime = config.startTime.toNumber();
  const interval = config.halvingInterval.toNumber();
  
  for (let period = 0; period < 10; period++) {
    if (periodSupply === 0) break;
    
    const unlockTime = new Date((startTime + period * interval) * 1000);
    const isUnlocked = Date.now() / 1000 >= (startTime + period * interval);
    
    schedule.push({
      period,
      amount: periodSupply / 1e9,
      unlockTime: unlockTime.toISOString(),
      isUnlocked,
      isClaimed: period < config.currentPeriod
    });
    
    periodSupply = Math.floor(periodSupply / 2);
  }
  
  return schedule;
}

// Usage
const schedule = await getVestingSchedule();
console.table(schedule);
```

### 3. Transfer Beneficiary
```javascript
async function transferBeneficiary(newBeneficiary) {
  await program.methods
    .updateBeneficiary(newBeneficiary)
    .accounts({
      vestingHalving: vestingPDA,
      beneficiary: wallet.publicKey,
    })
    .rpc();
  
  console.log("✅ Beneficiary updated to:", newBeneficiary.toString());
}
```

---

## Integration Guide

### React Integration
```jsx
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { Program, AnchorProvider } from '@coral-xyz/anchor';
import { PublicKey } from '@solana/web3.js';

function VestingClaimButton({ tokenMint }) {
  const { connection } = useConnection();
  const wallet = useWallet();
  
  const handleClaim = async () => {
    const provider = new AnchorProvider(connection, wallet, {});
    const programId = new PublicKey("6Bg1RuRv2yHxJbSodDMKH2dFbDQKGeZwKkDhzZxXQ7xc");
    const idl = await Program.fetchIdl(programId, provider);
    const program = new Program(idl, provider);
    
    const [vestingPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from("vesting_halving"), tokenMint.toBuffer()],
      programId
    );
    
    // ... claim logic
  };
  
  return <button onClick={handleClaim}>Claim Tokens</button>;
}
```

### Next.js API Route
```javascript
// pages/api/vesting/claim.js
import { Connection, PublicKey } from '@solana/web3.js';
import { Program, AnchorProvider, Wallet } from '@coral-xyz/anchor';

export default async function handler(req, res) {
  const { tokenMint, beneficiary } = req.body;
  
  const connection = new Connection("https://rpc.mainnet.x1.xyz");
  // ... setup program
  
  try {
    const tx = await program.methods
      .claimVestingPeriod()
      .accounts({...})
      .rpc();
    
    res.status(200).json({ success: true, signature: tx });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
```

---

## Common Use Cases

### 1. Team Token Vesting
```javascript
// 10M tokens, 6-month halving
// Period 0: 10M  (immediate)
// Period 1: 5M   (6 months)
// Period 2: 2.5M (12 months)
// Period 3: 1.25M (18 months)

const initialSupply = new anchor.BN(10_000_000 * 1e9);
const halvingInterval = new anchor.BN(180 * 24 * 60 * 60); // 6 months
```

### 2. Advisor Tokens
```javascript
// 100k tokens, quarterly halving
const initialSupply = new anchor.BN(100_000 * 1e9);
const halvingInterval = new anchor.BN(90 * 24 * 60 * 60); // 90 days
```

### 3. Community Rewards
```javascript
// 1M tokens, monthly halving
const initialSupply = new anchor.BN(1_000_000 * 1e9);
const halvingInterval = new anchor.BN(30 * 24 * 60 * 60); // 30 days
```

---

## Troubleshooting

### Error: "Period not unlocked yet"
**Cause:** Trying to claim before time has passed  
**Solution:** Wait for halving interval or check current time vs unlock time
```javascript
const config = await program.account.vestingHalvingConfig.fetch(vestingPDA);
const nextUnlock = config.startTime.toNumber() + 
  (config.currentPeriod + 1) * config.halvingInterval.toNumber();
console.log("Next unlock:", new Date(nextUnlock * 1000));
```

### Error: "All periods claimed"
**Cause:** Supply exhausted  
**Solution:** All vesting periods have been claimed

### Error: "Account not found"
**Cause:** Vesting not initialized  
**Solution:** Run `initializeVestingHalving` first

### Transaction Fails Silently
**Cause:** Insufficient SOL for transaction  
**Solution:** Ensure wallet has >0.01 SOL for fees
```javascript
const balance = await connection.getBalance(wallet.publicKey);
console.log("SOL balance:", balance / 1e9);
```

---

## Additional Resources

- [Program Source Code](https://github.com/omenpotter/vesting-halving-program)
- [Security Policy](../SECURITY.md)
- [API Reference](./API_REFERENCE.md)
- [Architecture Diagram](./ARCHITECTURE.md)


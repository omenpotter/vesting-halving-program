# Liquidity Lock Program - Usage Guide

Complete guide for integrating and using the Liquidity Lock Program.

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

const PROGRAM_ID = new PublicKey("BLM1UpG3ZJQnini6sG3oqznTQnsZCCuPUaLDVHEH4Ka1");
```

### 3. Lock Liquidity
```javascript
// Lock 1000 LP tokens for 365 days
const lockAmount = new anchor.BN(1000 * 1e9);
const unlockTime = Math.floor(Date.now() / 1000) + (365 * 24 * 60 * 60);

await program.methods
  .initializeLock(lockAmount, new anchor.BN(unlockTime))
  .accounts({
    lock: lockPDA,
    tokenMint: lpTokenMint,
    authority: wallet.publicKey,
    // ... other accounts
  })
  .rpc();
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
# Clone repository
git clone https://github.com/omenpotter/liquidity-lock-program.git
cd liquidity-lock-program

# Install dependencies
npm install

# Build (optional)
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
  createMint,
  getOrCreateAssociatedTokenAccount,
  mintTo,
  getAssociatedTokenAddress
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
const programId = new PublicKey("BLM1UpG3ZJQnini6sG3oqznTQnsZCCuPUaLDVHEH4Ka1");
const idl = await anchor.Program.fetchIdl(programId, provider);
const program = new anchor.Program(idl, provider);

// Step 1: Create LP token (or use existing)
const lpTokenMint = await createMint(
  connection,
  wallet.payer,
  wallet.publicKey,
  null,
  9
);

// Step 2: Get your LP token account
const userTokenAccount = await getOrCreateAssociatedTokenAccount(
  connection,
  wallet.payer,
  lpTokenMint,
  wallet.publicKey
);

// Mint some LP tokens for testing
await mintTo(
  connection,
  wallet.payer,
  lpTokenMint,
  userTokenAccount.address,
  wallet.publicKey,
  1000 * 1e9
);

// Step 3: Calculate lock PDA
const [lockPDA] = PublicKey.findProgramAddressSync(
  [
    Buffer.from("lock"),
    lpTokenMint.toBuffer(),
    wallet.publicKey.toBuffer()
  ],
  programId
);

// Step 4: Get vault ATA
const vaultATA = await getAssociatedTokenAddress(
  lpTokenMint,
  lockPDA,
  true
);

// Step 5: Initialize lock (1 year)
const lockAmount = new anchor.BN(500 * 1e9); // 500 tokens
const unlockTime = new anchor.BN(
  Math.floor(Date.now() / 1000) + (365 * 24 * 60 * 60)
);

console.log("Initializing lock...");
await program.methods
  .initializeLock(lockAmount, unlockTime)
  .accounts({
    lock: lockPDA,
    tokenMint: lpTokenMint,
    userTokenAccount: userTokenAccount.address,
    vaultTokenAccount: vaultATA,
    authority: wallet.publicKey,
    tokenProgram: TOKEN_PROGRAM_ID,
    associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
    systemProgram: SystemProgram.programId,
    rent: anchor.web3.SYSVAR_RENT_PUBKEY,
  })
  .rpc();

console.log("✅ Liquidity locked!");
console.log("Lock PDA:", lockPDA.toString());
console.log("Unlock time:", new Date(unlockTime.toNumber() * 1000));

// Step 6: Check lock status
const lockAccount = await program.account.lock.fetch(lockPDA);
console.log("Locked amount:", lockAccount.amount.toString());
console.log("Unlock time:", new Date(lockAccount.unlockTime.toNumber() * 1000));

// ... Wait for unlock time ...

// Step 7: Unlock after time passes
console.log("Unlocking tokens...");
await program.methods
  .unlock()
  .accounts({
    lock: lockPDA,
    tokenMint: lpTokenMint,
    vaultTokenAccount: vaultATA,
    userTokenAccount: userTokenAccount.address,
    authority: wallet.publicKey,
    tokenProgram: TOKEN_PROGRAM_ID,
  })
  .rpc();

console.log("✅ Tokens unlocked!");
```

---

## Advanced Examples

### 1. Extend Lock Duration
```javascript
async function extendLock(lockPDA, additionalSeconds) {
  const lockAccount = await program.account.lock.fetch(lockPDA);
  const currentUnlock = lockAccount.unlockTime.toNumber();
  const newUnlock = new anchor.BN(currentUnlock + additionalSeconds);
  
  await program.methods
    .extendLock(newUnlock)
    .accounts({
      lock: lockPDA,
      authority: wallet.publicKey,
    })
    .rpc();
  
  console.log("✅ Lock extended to:", new Date(newUnlock.toNumber() * 1000));
}

// Extend by 6 months
await extendLock(lockPDA, 180 * 24 * 60 * 60);
```

### 2. Transfer Lock Ownership
```javascript
async function transferLock(lockPDA, newOwner) {
  await program.methods
    .transferLock(newOwner)
    .accounts({
      lock: lockPDA,
      authority: wallet.publicKey,
    })
    .rpc();
  
  console.log("✅ Lock transferred to:", newOwner.toString());
}

// Transfer to another wallet
const newOwner = new PublicKey("...");
await transferLock(lockPDA, newOwner);
```

### 3. Monitor Multiple Locks
```javascript
async function getAllUserLocks(userPubkey) {
  // Get all lock accounts for a user
  const locks = await connection.getProgramAccounts(programId, {
    filters: [
      {
        memcmp: {
          offset: 8, // After discriminator
          bytes: userPubkey.toBase58(),
        }
      }
    ]
  });
  
  const lockData = [];
  for (const { pubkey, account } of locks) {
    const data = program.coder.accounts.decode("Lock", account.data);
    lockData.push({
      address: pubkey.toString(),
      amount: data.amount.toString(),
      unlockTime: new Date(data.unlockTime.toNumber() * 1000),
      isUnlocked: Date.now() / 1000 >= data.unlockTime.toNumber()
    });
  }
  
  return lockData;
}

// Usage
const userLocks = await getAllUserLocks(wallet.publicKey);
console.table(userLocks);
```

### 4. Time-Until-Unlock Calculator
```javascript
async function getTimeUntilUnlock(lockPDA) {
  const lockAccount = await program.account.lock.fetch(lockPDA);
  const unlockTime = lockAccount.unlockTime.toNumber();
  const now = Math.floor(Date.now() / 1000);
  
  if (now >= unlockTime) {
    return { canUnlock: true, timeRemaining: 0 };
  }
  
  const secondsRemaining = unlockTime - now;
  const days = Math.floor(secondsRemaining / 86400);
  const hours = Math.floor((secondsRemaining % 86400) / 3600);
  const minutes = Math.floor((secondsRemaining % 3600) / 60);
  
  return {
    canUnlock: false,
    timeRemaining: secondsRemaining,
    formatted: `${days}d ${hours}h ${minutes}m`
  };
}

// Usage
const status = await getTimeUntilUnlock(lockPDA);
if (status.canUnlock) {
  console.log("✅ Ready to unlock!");
} else {
  console.log(`⏰ Time remaining: ${status.formatted}`);
}
```

---

## Integration Guide

### React Component
```jsx
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { Program, AnchorProvider } from '@coral-xyz/anchor';
import { PublicKey, SystemProgram } from '@solana/web3.js';
import { useState, useEffect } from 'react';

function LiquidityLockPanel({ lpTokenMint }) {
  const { connection } = useConnection();
  const wallet = useWallet();
  const [lockData, setLockData] = useState(null);
  const [loading, setLoading] = useState(false);
  
  const programId = new PublicKey("BLM1UpG3ZJQnini6sG3oqznTQnsZCCuPUaLDVHEH4Ka1");
  
  // Derive lock PDA
  const [lockPDA] = PublicKey.findProgramAddressSync(
    [
      Buffer.from("lock"),
      lpTokenMint.toBuffer(),
      wallet.publicKey.toBuffer()
    ],
    programId
  );
  
  // Load lock data
  useEffect(() => {
    if (!wallet.publicKey) return;
    
    const loadLock = async () => {
      const provider = new AnchorProvider(connection, wallet, {});
      const idl = await Program.fetchIdl(programId, provider);
      const program = new Program(idl, provider);
      
      try {
        const lock = await program.account.lock.fetch(lockPDA);
        setLockData(lock);
      } catch (e) {
        setLockData(null); // Lock doesn't exist
      }
    };
    
    loadLock();
  }, [wallet.publicKey, lpTokenMint]);
  
  const handleLock = async (amount, days) => {
    setLoading(true);
    try {
      const provider = new AnchorProvider(connection, wallet, {});
      const program = new Program(idl, provider);
      
      const unlockTime = Math.floor(Date.now() / 1000) + (days * 86400);
      
      await program.methods
        .initializeLock(
          new BN(amount * 1e9),
          new BN(unlockTime)
        )
        .accounts({...})
        .rpc();
      
      alert("✅ Liquidity locked!");
    } catch (err) {
      alert("Error: " + err.message);
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div>
      {lockData ? (
        <div>
          <h3>Locked: {lockData.amount.toString()} tokens</h3>
          <p>Unlocks: {new Date(lockData.unlockTime * 1000).toLocaleString()}</p>
        </div>
      ) : (
        <button onClick={() => handleLock(1000, 365)}>
          Lock Liquidity (1 year)
        </button>
      )}
    </div>
  );
}
```

### Next.js API Route
```javascript
// pages/api/locks/[user].js
import { Connection, PublicKey } from '@solana/web3.js';
import { Program, AnchorProvider, Wallet } from '@coral-xyz/anchor';

export default async function handler(req, res) {
  const { user } = req.query;
  
  try {
    const connection = new Connection("https://rpc.mainnet.x1.xyz");
    const programId = new PublicKey("BLM1UpG3ZJQnini6sG3oqznTQnsZCCuPUaLDVHEH4Ka1");
    
    // Get all locks for user
    const locks = await connection.getProgramAccounts(programId, {
      filters: [{
        memcmp: {
          offset: 8,
          bytes: user,
        }
      }]
    });
    
    res.status(200).json({
      user,
      lockCount: locks.length,
      locks: locks.map(l => ({
        address: l.pubkey.toString(),
        // ... decode data
      }))
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
```

---

## Common Use Cases

### 1. DEX Liquidity Lock (Standard)
```javascript
// Lock LP tokens for 1 year with standard settings
const unlockTime = new BN(
  Math.floor(Date.now() / 1000) + (365 * 86400)
);

await program.methods
  .initializeLock(lpAmount, unlockTime)
  .accounts({...})
  .rpc();
```

### 2. Team Token Lock (Extended)
```javascript
// Lock team tokens for 3 years
const unlockTime = new BN(
  Math.floor(Date.now() / 1000) + (3 * 365 * 86400)
);

await program.methods
  .initializeLock(teamTokens, unlockTime)
  .accounts({...})
  .rpc();
```

### 3. Gradual Unlock (Multiple Locks)
```javascript
// Create 12 monthly locks instead of 1 yearly
const monthlyAmount = totalAmount / 12;

for (let i = 0; i < 12; i++) {
  const unlockTime = new BN(
    Math.floor(Date.now() / 1000) + ((i + 1) * 30 * 86400)
  );
  
  await program.methods
    .initializeLock(new BN(monthlyAmount), unlockTime)
    .accounts({...})
    .rpc();
  
  console.log(`✅ Lock ${i + 1}/12 created`);
}
```

---

## Troubleshooting

### Error: "Unlock time not reached"

**Cause:** Trying to unlock before time  
**Solution:** Wait or check unlock time
```javascript
const lock = await program.account.lock.fetch(lockPDA);
const now = Math.floor(Date.now() / 1000);
if (now < lock.unlockTime.toNumber()) {
  console.log("Wait until:", new Date(lock.unlockTime.toNumber() * 1000));
}
```

### Error: "Lock already exists"

**Cause:** PDA collision (same mint + authority)  
**Solution:** One lock per mint+authority combo. Unlock existing or use different mint.

### Error: "Insufficient token balance"

**Cause:** Not enough tokens to lock  
**Solution:** Check balance first
```javascript
const balance = await connection.getTokenAccountBalance(userTokenAccount.address);
console.log("Available:", balance.value.uiAmount);
```

### Transaction Fails Silently

**Cause:** Insufficient SOL for fees  
**Solution:** Ensure >0.01 SOL
```javascript
const balance = await connection.getBalance(wallet.publicKey);
if (balance < 0.01 * 1e9) {
  throw new Error("Need more SOL for fees");
}
```

---

## Additional Resources

- [Program Source Code](https://github.com/omenpotter/liquidity-lock-program)
- [Security Policy](../SECURITY.md)
- [API Reference](./API_REFERENCE.md)
- [Architecture Diagram](./ARCHITECTURE.md)


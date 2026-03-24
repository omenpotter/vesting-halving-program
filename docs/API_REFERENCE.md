# Liquidity Lock Program - API Reference

Complete technical reference for all program instructions and accounts.

## Program Information

- **Program ID**: `BLM1UpG3ZJQnini6sG3oqznTQnsZCCuPUaLDVHEH4Ka1`
- **Network**: X1 Mainnet
- **Framework**: Anchor 0.32.1

---

## Instructions

### initialize_lock

Creates a new liquidity lock and transfers tokens to vault.

**Signature:**
```rust
pub fn initialize_lock(
    ctx: Context<InitializeLock>,
    amount: u64,
    unlock_time: i64,
) -> Result<()>
```

**Parameters:**

| Name | Type | Description | Example |
|------|------|-------------|---------|
| `amount` | `u64` | Tokens to lock (with decimals) | `1000 * 1e9` |
| `unlock_time` | `i64` | Unix timestamp when unlockable | `1735689600` |

**Accounts:**

| Account | Type | Writable | Signer | Description |
|---------|------|----------|--------|-------------|
| `lock` | PDA | ✅ | ❌ | Lock config (initialized) |
| `token_mint` | Mint | ❌ | ❌ | SPL Token mint |
| `user_token_account` | TokenAccount | ✅ | ❌ | User's token account (source) |
| `vault_token_account` | ATA | ✅ | ❌ | Vault for locked tokens (initialized) |
| `authority` | Signer | ❌ | ✅ | Lock owner |
| `token_program` | Program | ❌ | ❌ | SPL Token Program |
| `associated_token_program` | Program | ❌ | ❌ | Associated Token Program |
| `system_program` | Program | ❌ | ❌ | System Program |
| `rent` | Sysvar | ❌ | ❌ | Rent Sysvar |

**PDA Derivation:**
```javascript
const [lockPDA, bump] = PublicKey.findProgramAddressSync(
  [
    Buffer.from("lock"),
    tokenMint.toBuffer(),
    authority.toBuffer()
  ],
  programId
);
```

**Behavior:**
1. Validates `amount > 0` and `unlock_time > now`
2. Creates lock PDA and vault ATA
3. Transfers `amount` tokens from user to vault
4. Stores lock configuration

**Constraints:**
- ⏰ `unlock_time` must be in the future
- 💰 User must have sufficient token balance
- 🔒 One lock per (mint, authority) pair

**Errors:**

| Code | Name | Description |
|------|------|-------------|
| `0x1770` | `InvalidAmount` | amount must be > 0 |
| `0x1771` | `InvalidUnlockTime` | unlock_time must be in future |

**Example:**
```javascript
const lockAmount = new anchor.BN(1000 * 1e9);
const unlockTime = new anchor.BN(
  Math.floor(Date.now() / 1000) + (365 * 86400)
);

await program.methods
  .initializeLock(lockAmount, unlockTime)
  .accounts({
    lock: lockPDA,
    tokenMint: lpTokenMint,
    userTokenAccount: userATA,
    vaultTokenAccount: vaultATA,
    authority: wallet.publicKey,
    tokenProgram: TOKEN_PROGRAM_ID,
    associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
    systemProgram: SystemProgram.programId,
    rent: SYSVAR_RENT_PUBKEY,
  })
  .rpc();
```

---

### unlock

Unlocks and transfers tokens back to owner after time expires.

**Signature:**
```rust
pub fn unlock(
    ctx: Context<Unlock>,
) -> Result<()>
```

**Parameters:** None

**Accounts:**

| Account | Type | Writable | Signer | Description |
|---------|------|----------|--------|-------------|
| `lock` | Lock | ✅ | ❌ | Lock configuration |
| `token_mint` | Mint | ❌ | ❌ | Token mint (validation) |
| `vault_token_account` | TokenAccount | ✅ | ❌ | Vault holding tokens |
| `user_token_account` | TokenAccount | ✅ | ❌ | User's token account (destination) |
| `authority` | Signer | ❌ | ✅ | Lock owner |
| `token_program` | Program | ❌ | ❌ | SPL Token Program |

**Behavior:**
1. Validates current time >= unlock_time
2. Transfers all tokens from vault to user
3. Closes lock account
4. Returns rent to authority

**Constraints:**
- ⏰ Current time must be >= unlock_time
- 👤 Caller must be lock authority

**Errors:**

| Code | Name | Description |
|------|------|-------------|
| `0x1772` | `UnlockTimeNotReached` | Cannot unlock yet - time not reached |

**Example:**
```javascript
await program.methods
  .unlock()
  .accounts({
    lock: lockPDA,
    tokenMint: lpTokenMint,
    vaultTokenAccount: vaultATA,
    userTokenAccount: userATA,
    authority: wallet.publicKey,
    tokenProgram: TOKEN_PROGRAM_ID,
  })
  .rpc();
```

---

### extend_lock

Extends the unlock time to a later date.

**Signature:**
```rust
pub fn extend_lock(
    ctx: Context<ExtendLock>,
    new_unlock_time: i64,
) -> Result<()>
```

**Parameters:**

| Name | Type | Description |
|------|------|-------------|
| `new_unlock_time` | `i64` | New unlock timestamp (must be later) |

**Accounts:**

| Account | Type | Writable | Signer | Description |
|---------|------|----------|--------|-------------|
| `lock` | Lock | ✅ | ❌ | Lock configuration |
| `authority` | Signer | ❌ | ✅ | Lock owner |

**Behavior:**
Updates `lock.unlock_time` to `new_unlock_time`

**Constraints:**
- ⏰ `new_unlock_time` must be > current `unlock_time`
- 👤 Caller must be lock authority

**Errors:**

| Code | Name | Description |
|------|------|-------------|
| `0x1773` | `InvalidExtension` | new_unlock_time must be later than current |

**Example:**
```javascript
// Extend by 6 months
const currentLock = await program.account.lock.fetch(lockPDA);
const newUnlockTime = new anchor.BN(
  currentLock.unlockTime.toNumber() + (180 * 86400)
);

await program.methods
  .extendLock(newUnlockTime)
  .accounts({
    lock: lockPDA,
    authority: wallet.publicKey,
  })
  .rpc();
```

---

### transfer_lock

Transfers lock ownership to a new authority.

**Signature:**
```rust
pub fn transfer_lock(
    ctx: Context<TransferLock>,
    new_authority: Pubkey,
) -> Result<()>
```

**Parameters:**

| Name | Type | Description |
|------|------|-------------|
| `new_authority` | `Pubkey` | New owner address |

**Accounts:**

| Account | Type | Writable | Signer | Description |
|---------|------|----------|--------|-------------|
| `lock` | Lock | ✅ | ❌ | Lock configuration |
| `authority` | Signer | ❌ | ✅ | Current lock owner |

**Behavior:**
Updates `lock.authority` to `new_authority`

**Constraints:**
- 👤 Caller must be current lock authority
- 🔑 New authority must be valid Pubkey

**Example:**
```javascript
const newOwner = new PublicKey("...");

await program.methods
  .transferLock(newOwner)
  .accounts({
    lock: lockPDA,
    authority: currentOwner.publicKey,
  })
  .signers([currentOwner])
  .rpc();
```

---

## Account Structures

### Lock

Stores liquidity lock configuration and state.

**Size:** 89 bytes (8 discriminator + 81 data)
```rust
pub struct Lock {
    pub authority: Pubkey,      // 32 bytes
    pub token_mint: Pubkey,      // 32 bytes
    pub amount: u64,             // 8 bytes
    pub unlock_time: i64,        // 8 bytes
    pub bump: u8,                // 1 byte
}
```

**Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `authority` | `Pubkey` | Who can unlock and manage |
| `token_mint` | `Pubkey` | Locked token mint |
| `amount` | `u64` | Locked token amount |
| `unlock_time` | `i64` | Unix timestamp when unlockable |
| `bump` | `u8` | PDA bump seed |

**Fetch Example:**
```javascript
const lock = await program.account.lock.fetch(lockPDA);
console.log("Amount:", lock.amount.toString());
console.log("Unlocks:", new Date(lock.unlockTime.toNumber() * 1000));
console.log("Can unlock:", Date.now() / 1000 >= lock.unlockTime.toNumber());
```

---

## Error Codes

| Code | Hex | Name | Description |
|------|-----|------|-------------|
| 6000 | 0x1770 | `InvalidAmount` | Lock amount must be greater than 0 |
| 6001 | 0x1771 | `InvalidUnlockTime` | Unlock time must be in the future |
| 6002 | 0x1772 | `UnlockTimeNotReached` | Cannot unlock yet - time not reached |
| 6003 | 0x1773 | `InvalidExtension` | New unlock time must be later than current |

---

## Constants

| Name | Value | Description |
|------|-------|-------------|
| `LOCK_SEED` | `"lock"` | PDA seed prefix |

---

## PDA Derivation Rules

### Lock PDA
```
Seeds: ["lock", token_mint, authority]
Unique per: (token_mint, authority) pair
```

**Implications:**
- One lock per token per user
- Predictable addresses
- No signature required for PDA

**JavaScript:**
```javascript
const [lockPDA, bump] = PublicKey.findProgramAddressSync(
  [
    Buffer.from("lock"),
    tokenMint.toBuffer(),
    authority.toBuffer()
  ],
  programId
);
```

**Rust:**
```rust
let (lock_pda, bump) = Pubkey::find_program_address(
    &[
        b"lock",
        token_mint.as_ref(),
        authority.as_ref(),
    ],
    program_id
);
```

---

## Time Calculations

### Unix Timestamp Helpers
```javascript
// Current time
const now = Math.floor(Date.now() / 1000);

// Days from now
const daysFromNow = (days) => now + (days * 86400);

// Lock for 1 year
const oneYear = daysFromNow(365);

// Lock until specific date
const untilDate = (date) => Math.floor(date.getTime() / 1000);
const newYear = untilDate(new Date('2027-01-01'));

// Time remaining
const getTimeRemaining = (unlockTime) => {
  const remaining = unlockTime - now;
  return {
    seconds: remaining,
    days: Math.floor(remaining / 86400),
    hours: Math.floor((remaining % 86400) / 3600),
    minutes: Math.floor((remaining % 3600) / 60),
  };
};
```

---

## Events / Logs

Program emits logs via `msg!()`:

| Event | Format | Example |
|-------|--------|---------|
| Initialize | `"Lock created: {amount} until {time}"` | `Lock created: 1000000000000 until 1735689600` |
| Unlock | `"Unlocked {amount} tokens"` | `Unlocked 1000000000000 tokens` |
| Extend | `"Lock extended to {time}"` | `Lock extended to 1767225600` |
| Transfer | `"Lock transferred"` | `Lock transferred` |

---

## Security Considerations

### Time Manipulation
- ✅ Uses Solana `Clock` sysvar (tamper-proof)
- ✅ Cannot bypass or rush unlock time
- ✅ Validators enforce consensus time

### Authority Control
- ✅ Only authority can unlock
- ✅ Only authority can extend
- ✅ Only authority can transfer
- ✅ Authority checks on all mutations

### Token Safety
- ✅ Tokens held in vault ATA owned by lock PDA
- ✅ Cannot be accessed until unlock time
- ✅ No emergency withdrawal
- ✅ No backdoors

### Reentrancy
- ✅ No cross-program invocations during state changes
- ✅ State updated before token transfers
- ✅ Account closed after final transfer

---

## State Transitions
```
┌─────────────┐
│   Created   │ ← initialize_lock()
│  (Locked)   │
└─────────────┘
       │
       │ extend_lock()
       ↓
┌─────────────┐
│  Extended   │
│  (Locked)   │
└─────────────┘
       │
       │ transfer_lock()
       ↓
┌─────────────┐
│ Transferred │
│  (Locked)   │
└─────────────┘
       │
       │ Time passes...
       │ unlock()
       ↓
┌─────────────┐
│  Unlocked   │
│  (Closed)   │
└─────────────┘
```

---

## Gas Optimization

### Compute Units

| Instruction | Typical CU | Notes |
|-------------|-----------|-------|
| initialize_lock | ~60,000 | Creates 2 accounts |
| unlock | ~20,000 | Transfers + closes |
| extend_lock | ~5,000 | State update only |
| transfer_lock | ~5,000 | State update only |

### Transaction Costs (X1 Mainnet)

| Operation | Estimated Cost |
|-----------|---------------|
| Initialize | ~0.003 SOL |
| Unlock | ~0.001 SOL |
| Extend | ~0.0003 SOL |
| Transfer | ~0.0003 SOL |

---

## Query Helpers

### Check if Lock Exists
```javascript
async function lockExists(programId, tokenMint, authority) {
  const [lockPDA] = PublicKey.findProgramAddressSync(
    [Buffer.from("lock"), tokenMint.toBuffer(), authority.toBuffer()],
    programId
  );
  
  try {
    await program.account.lock.fetch(lockPDA);
    return true;
  } catch {
    return false;
  }
}
```

### Get All Locks for User
```javascript
async function getUserLocks(programId, authority) {
  const accounts = await connection.getProgramAccounts(programId, {
    filters: [
      {
        memcmp: {
          offset: 8, // After discriminator
          bytes: authority.toBase58(),
        }
      }
    ]
  });
  
  return accounts.map(({ pubkey, account }) => ({
    address: pubkey,
    data: program.coder.accounts.decode("Lock", account.data)
  }));
}
```

### Check if Unlockable
```javascript
async function canUnlock(lockPDA) {
  const lock = await program.account.lock.fetch(lockPDA);
  const now = Math.floor(Date.now() / 1000);
  return now >= lock.unlockTime.toNumber();
}
```

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-03-24 | Initial mainnet deployment |

---

## Related Documentation

- [Usage Guide](./USAGE_GUIDE.md) - Examples and integration
- [Architecture](./ARCHITECTURE.md) - System design
- [Security Policy](../SECURITY.md) - Vulnerability reporting


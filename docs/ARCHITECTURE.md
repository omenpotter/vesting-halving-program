# Liquidity Lock Program - Architecture

Visual guide to understanding how the Liquidity Lock Program works.

## Table of Contents
1. [System Overview](#system-overview)
2. [Component Architecture](#component-architecture)
3. [Data Flow](#data-flow)
4. [State Machine](#state-machine)
5. [Account Relationships](#account-relationships)
6. [Sequence Diagrams](#sequence-diagrams)

---

## System Overview
```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│              LIQUIDITY LOCK PROGRAM                            │
│         BLM1UpG3ZJQnini6sG3oqznTQnsZCCuPUaLDVHEH4Ka1          │
│                                                                 │
│  Time-locked token custody for liquidity protection            │
│  Prevents rug pulls and ensures project commitment             │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │
            ┌─────────────────┼─────────────────┐
            │                 │                 │
            ▼                 ▼                 ▼
    ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
    │   Lock       │  │     Vault    │  │    Owner     │
    │   PDA        │  │     ATA      │  │   Account    │
    │              │  │              │  │              │
    │  Config &    │  │  Locked LP   │  │  Receives    │
    │  Authority   │  │  tokens      │  │  unlock      │
    └──────────────┘  └──────────────┘  └──────────────┘
```

---

## Component Architecture

### Core Components
```
┌─────────────────────────────────────────────────────────────┐
│                     LP TOKEN MINT                           │
│  Standard SPL Token (e.g., DEX LP token)                   │
│  No special requirements                                    │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ associated with
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      LOCK PDA                               │
│                                                             │
│  Seeds: ["lock", token_mint, authority]                    │
│                                                             │
│  Stores:                                                    │
│  • Authority (owner pubkey)                                 │
│  • Token mint                                               │
│  • Locked amount                                            │
│  • Unlock timestamp                                         │
│  • Bump seed                                                │
│                                                             │
│  Unique per: (token_mint, authority) pair                  │
│  One lock per token per user                                │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ owns
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                     VAULT ATA                               │
│  Associated Token Account owned by Lock PDA                │
│                                                             │
│  Holds: All locked LP tokens                                │
│  Cannot be accessed until unlock_time                       │
│                                                             │
│  Protected by:                                              │
│  • Lock PDA authority                                       │
│  • Time lock (Clock sysvar)                                 │
│  • Program logic                                            │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ returns to (after unlock)
                              ▼
┌─────────────────────────────────────────────────────────────┐
│               USER TOKEN ACCOUNT                            │
│  Regular ATA owned by authority                            │
│  Receives tokens when unlock() is called                    │
└─────────────────────────────────────────────────────────────┘
```

---

## Data Flow

### Lock Creation Flow
```
Step 1: User Has LP Tokens
┌──────────────┐
│    User      │
│  LP tokens:  │
│  1000        │
└──────────────┘

Step 2: Initialize Lock
┌──────────────┐
│    User      │──► initialize_lock(1000, unlock_time)
└──────────────┘         │
                         ▼
                  ┌─────────────┐
                  │ Create PDA  │
                  │ Create Vault│
                  │ Transfer LP │──► 1000 LP to vault
                  └─────────────┘
                         │
                         ▼
                  ┌─────────────┐
                  │ Vault ATA   │
                  │ Balance:    │
                  │ 1000 LP     │ 🔒 LOCKED
                  └─────────────┘

Step 3: Tokens Locked
┌──────────────┐
│    User      │
│  LP tokens:  │
│  0           │ ← Transferred to vault
└──────────────┘
```

### Unlock Flow
```
Time Check Flow:
┌──────────────┐
│ Current Time │
└──────────────┘
       │
       ▼
┌─────────────────────────────────┐
│ now >= unlock_time?             │
└─────────────────────────────────┘
       │               │
      NO              YES
       │               │
       ▼               ▼
   ❌ Error      ✅ Continue


Token Return Flow:
┌─────────────┐
│ Vault       │
│ 1000 LP     │
└─────────────┘
       │
       │ unlock() transfers all
       ▼
┌─────────────┐
│ User        │
│ receives    │
│ 1000 LP     │ ✅ UNLOCKED
└─────────────┘
       │
       │ Account closed
       ▼
┌─────────────┐
│ Lock PDA    │
│ CLOSED      │ → Rent returned
└─────────────┘
```

### Extension Flow
```
Current State:
┌─────────────────────────────────┐
│ Lock                            │
│ unlock_time: Jan 1, 2027        │
└─────────────────────────────────┘

extend_lock(new_time):
┌─────────────────────────────────┐
│ Validate:                       │
│ new_time > current unlock_time  │
└─────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────┐
│ Updated Lock                    │
│ unlock_time: Jul 1, 2027        │ ✅ Extended
└─────────────────────────────────┘
```

### Transfer Flow
```
Original Owner:
┌─────────────────────────────────┐
│ Lock                            │
│ authority: User A               │
└─────────────────────────────────┘

transfer_lock(user_b):
┌─────────────────────────────────┐
│ Validate:                       │
│ caller == current authority     │
└─────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────┐
│ Updated Lock                    │
│ authority: User B               │ ✅ Transferred
└─────────────────────────────────┘
```

---

## State Machine

### Lock Lifecycle
```
┌────────────────────────────────────────────────────────────┐
│                    NON-EXISTENT                            │
│  No lock created yet                                       │
└────────────────────────────────────────────────────────────┘
                         │
                         │ initialize_lock()
                         ▼
┌────────────────────────────────────────────────────────────┐
│                      LOCKED                                │
│  Tokens in vault                                           │
│  unlock_time in future                                     │
│  Can: extend, transfer                                     │
│  Cannot: unlock                                            │
└────────────────────────────────────────────────────────────┘
                         │
          ┌──────────────┼──────────────┐
          │              │              │
          │              │              │
          ▼              ▼              ▼
    ┌──────────┐  ┌──────────┐  ┌──────────┐
    │ extend() │  │transfer()│  │Time passes│
    └──────────┘  └──────────┘  └──────────┘
          │              │              │
          │              │              │
          └──────────────┴──────────────┘
                         │
                         │ now >= unlock_time
                         ▼
┌────────────────────────────────────────────────────────────┐
│                    UNLOCKABLE                              │
│  Time condition met                                        │
│  Can: unlock                                               │
└────────────────────────────────────────────────────────────┘
                         │
                         │ unlock()
                         ▼
┌────────────────────────────────────────────────────────────┐
│                     UNLOCKED                               │
│  Tokens returned to owner                                  │
│  Lock account closed                                       │
│  Rent returned                                             │
└────────────────────────────────────────────────────────────┘
```

### State Transitions Matrix
```
Current State  │ Action        │ New State      │ Allowed?
───────────────┼───────────────┼────────────────┼──────────
NON-EXISTENT   │ initialize    │ LOCKED         │ ✅
LOCKED         │ unlock        │ LOCKED         │ ❌ (time check fails)
LOCKED         │ extend        │ LOCKED         │ ✅
LOCKED         │ transfer      │ LOCKED         │ ✅
UNLOCKABLE     │ unlock        │ UNLOCKED       │ ✅
UNLOCKABLE     │ extend        │ LOCKED         │ ✅
UNLOCKED       │ any           │ -              │ ❌ (closed)
```

---

## Account Relationships

### Ownership Hierarchy
```
                    System Program
                          │
                          │ owns
                          ▼
                   ┌─────────────┐
                   │  Lock PDA   │ (Program Derived Address)
                   └─────────────┘
                          │
           ┌──────────────┼──────────────┐
           │              │              │
           ▼              ▼              ▼
    ┌──────────┐   ┌──────────┐   ┌──────────┐
    │ Vault    │   │  Config  │   │ Authority│
    │ ATA      │   │  Data    │   │ Reference│
    │          │   │          │   │          │
    │ (owned)  │   │ (stored) │   │ (field)  │
    └──────────┘   └──────────┘   └──────────┘
         │
         │ returns to
         ▼
    ┌──────────┐
    │  User    │
    │   ATA    │
    └──────────┘
```

### PDA Derivation
```
Input:
├─ Program ID: BLM1UpG3ZJQnini6sG3oqznTQnsZCCuPUaLDVHEH4Ka1
├─ Seeds:
│  ├─ "lock" (constant string)
│  ├─ token_mint pubkey (32 bytes)
│  └─ authority pubkey (32 bytes)
└─ Bump: Found automatically

Process:
┌─────────────────────────────────────┐
│  findProgramAddressSync()           │
│  • Hash seeds with program ID       │
│  • Try bumps 255 → 0                │
│  • Return first valid PDA           │
└─────────────────────────────────────┘

Output:
└─ Lock PDA (deterministic address)

Uniqueness:
Each (token_mint, authority) pair = unique PDA
→ One lock per token per user
```

---

## Sequence Diagrams

### Complete Lock & Unlock Sequence
```
User       Program       Token Mint    Vault ATA    User ATA    Clock
 │            │               │            │           │          │
 │────────────►               │            │           │          │
 │ initialize_ │               │            │           │          │
 │ lock()      │               │            │           │          │
 │            │───────────────────────────────────────────────────►
 │            │          get current time                          │
 │            │◄───────────────────────────────────────────────────
 │            │               │            │           │          │
 │            │───────────────────────────►│           │          │
 │            │    create vault ATA                               │
 │            │               │            │           │          │
 │            │               │            │           │          │
 │            │◄──────────────────────────────────────►│          │
 │            │    transfer tokens (user → vault)                 │
 │◄───────────│               │            │           │          │
 │  success   │               │            │           │          │
 │            │               │            │           │          │
 │            │      ... TIME PASSES ...                          │
 │            │               │            │           │          │
 │────────────►               │            │           │          │
 │ unlock()   │               │            │           │          │
 │            │───────────────────────────────────────────────────►
 │            │          check time >= unlock_time                │
 │            │◄───────────────────────────────────────────────────
 │            │  ✅ time check passed                             │
 │            │               │            │           │          │
 │            │◄──────────────────────────────────────►│          │
 │            │    transfer tokens (vault → user)                 │
 │            │               │            │           │          │
 │            │    close lock account                             │
 │            │    return rent                                    │
 │◄───────────│               │            │           │          │
 │  success + │               │            │           │          │
 │    rent    │               │            │           │          │
```

### Extend Lock Sequence
```
User       Program       Lock PDA      Clock
 │            │              │           │
 │────────────►              │           │
 │ extend_lock│              │           │
 │ (new_time) │              │           │
 │            │──────────────►           │
 │            │  fetch current unlock    │
 │            │◄──────────────           │
 │            │              │           │
 │            │              │           │
 │            │  validate:               │
 │            │  new_time > current      │
 │            │              │           │
 │            │──────────────►           │
 │            │  update unlock_time      │
 │◄───────────│              │           │
 │  success   │              │           │
```

### Transfer Lock Sequence
```
Owner A    Program    Lock PDA    Owner B
   │          │           │          │
   │──────────►           │          │
   │ transfer_│           │          │
   │ lock(B)  │           │          │
   │          │───────────►          │
   │          │ fetch lock            │
   │          │ verify authority = A  │
   │          │                       │
   │          │───────────►           │
   │          │ update authority = B  │
   │◄─────────│           │          │
   │ success  │           │          │
   │          │           │          │
   │          │    Owner B can now:  │
   │          │    • unlock          │
   │          │    • extend          │
   │          │    • transfer again  │
```

---

## Memory Layout

### Lock Account
```
Byte Offset  Field             Type        Size
─────────────────────────────────────────────────────
0-7          Discriminator     u64         8
8-39         authority         Pubkey      32
40-71        token_mint        Pubkey      32
72-79        amount            u64         8
80-87        unlock_time       i64         8
88           bump              u8          1
─────────────────────────────────────────────────────
Total: 89 bytes
```

---

## Security Architecture

### Access Control Matrix
```
┌────────────────────────────────────────────────────┐
│         INSTRUCTION PERMISSIONS                    │
├────────────────────────────────────────────────────┤
│                                                    │
│  initialize_lock                                   │
│  • Signer: authority ✅                           │
│  • Owns: user_token_account ✅                    │
│  • Has balance: amount ✅                         │
│                                                    │
│  unlock                                            │
│  • Signer: authority ✅                           │
│  • Constraint: authority == lock.authority        │
│  • Time check: now >= unlock_time ✅              │
│                                                    │
│  extend_lock                                       │
│  • Signer: authority ✅                           │
│  • Constraint: authority == lock.authority        │
│  • Constraint: new_time > current_time            │
│                                                    │
│  transfer_lock                                     │
│  • Signer: authority ✅                           │
│  • Constraint: authority == lock.authority        │
│                                                    │
└────────────────────────────────────────────────────┘
```

### Time-Lock Mechanism
```
┌─────────────────────────────────────────┐
│     TIME-BASED ACCESS CONTROL           │
├─────────────────────────────────────────┤
│                                         │
│  Unlock Check:                          │
│                                         │
│  Clock::get()?.unix_timestamp           │
│         >=                              │
│  lock.unlock_time                       │
│                                         │
│  Cannot be bypassed:                    │
│  ✅ Clock sysvar is read-only           │
│  ✅ Validators enforce consensus        │
│  ✅ No backdoors or overrides           │
│  ✅ No emergency withdrawal             │
│                                         │
└─────────────────────────────────────────┘
```

### Token Custody
```
┌─────────────────────────────────────────┐
│       VAULT PROTECTION                  │
├─────────────────────────────────────────┤
│                                         │
│  Vault ATA owned by Lock PDA            │
│  └─ Only program can sign for PDA      │
│                                         │
│  Transfer requires:                     │
│  1. Valid instruction                   │
│  2. Correct PDA derivation              │
│  3. Time lock satisfied (for unlock)    │
│  4. Authority signature                 │
│                                         │
│  No other way to access tokens:         │
│  ❌ Cannot close vault early            │
│  ❌ Cannot transfer without unlock      │
│  ❌ Cannot bypass program logic         │
│                                         │
└─────────────────────────────────────────┘
```

---

## Use Case Patterns

### Pattern 1: DEX Liquidity Lock
```
┌──────────────────────────────────────────┐
│  Token Launch Scenario                  │
└──────────────────────────────────────────┘

Step 1: Create LP Pool
   DEX: SOL-TOKEN pool
   LP tokens minted: 1000

Step 2: Lock LP Tokens
   Lock: 800 LP (80%)
   Duration: 1 year
   Purpose: Prove commitment

Step 3: After 1 Year
   unlock() → retrieve 800 LP
   Option: Remove liquidity or re-lock
```

### Pattern 2: Team Token Vesting
```
┌──────────────────────────────────────────┐
│  Team Token Distribution                 │
└──────────────────────────────────────────┘

Create multiple locks:
   Lock 1: 25% → 6 months
   Lock 2: 25% → 12 months
   Lock 3: 25% → 18 months
   Lock 4: 25% → 24 months

Gradual unlock over 2 years
```

### Pattern 3: Transferable Lock
```
┌──────────────────────────────────────────┐
│  DAO Treasury Lock                       │
└──────────────────────────────────────────┘

Initial: Project owner creates lock
Transfer: transfer_lock(dao_multisig)
Result: DAO controls unlock
```

---

## Performance Characteristics

### Compute Units
```
Instruction        Typical CU    Notes
─────────────────────────────────────────────
initialize_lock    ~60,000       Creates 2 accounts
unlock            ~20,000       Transfer + close
extend_lock       ~5,000        State update only
transfer_lock     ~5,000        State update only
```

### Storage Costs
```
Account          Size      Rent (SOL)
──────────────────────────────────────
Lock PDA         89 bytes  ~0.00063
Vault ATA        165 bytes ~0.00203
──────────────────────────────────────
Total initial    254 bytes ~0.00266

Recovered on unlock: ~0.00266 SOL returned
```

---

## Integration Patterns

### Frontend Flow
```
┌────────────────┐
│   React App    │
│                │
│  Connect       │
│  Wallet        │
└────────────────┘
        │
        │ derive PDA
        ▼
┌────────────────┐
│  Check Lock    │
│  Exists?       │
└────────────────┘
        │
   ┌────┴────┐
   │         │
  NO        YES
   │         │
   ▼         ▼
┌─────┐  ┌─────┐
│Lock │  │Show │
│ UI  │  │Lock │
└─────┘  └─────┘
```

### Backend Monitoring
```
┌────────────────┐
│  Cron Job      │
│  (Every hour)  │
└────────────────┘
        │
        ▼
┌────────────────┐
│ Query all      │
│ locks for user │
└────────────────┘
        │
        ▼
┌────────────────┐
│ Check unlock   │
│ times          │
└────────────────┘
        │
        ▼
┌────────────────┐
│ Send alert if  │
│ unlockable     │
└────────────────┘
```

---

## Deployment Architecture
```
┌─────────────────────────────────────────────┐
│           X1 MAINNET CLUSTER                │
│                                             │
│  ┌────────────────────────────────────┐    │
│  │   Liquidity Lock Program           │    │
│  │   BLM1UpG3...H4Ka1                 │    │
│  │                                    │    │
│  │   Deployed via:                    │    │
│  │   solana program deploy            │    │
│  │                                    │    │
│  │   Upgradeable: Yes                 │    │
│  │   Authority: C5V1AaFcE8W...        │    │
│  └────────────────────────────────────┘    │
│                                             │
│  Multiple Lock Instances:                   │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐ │
│  │ Lock 1   │  │ Lock 2   │  │ Lock 3   │ │
│  │ User A   │  │ User A   │  │ User B   │ │
│  │ Token X  │  │ Token Y  │  │ Token X  │ │
│  └──────────┘  └──────────┘  └──────────┘ │
│                                             │
└─────────────────────────────────────────────┘
```


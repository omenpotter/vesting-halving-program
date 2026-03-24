# Vesting Halving Program - Architecture

Visual guide to understanding how the Vesting Halving Program works.

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
│              VESTING HALVING PROGRAM                           │
│         6Bg1RuRv2yHxJbSodDMKH2dFbDQKGeZwKkDhzZxXQ7xc          │
│                                                                 │
│  Bitcoin-style halving with time-locked vesting                │
│  All tokens minted upfront, released on schedule               │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │
            ┌─────────────────┼─────────────────┐
            │                 │                 │
            ▼                 ▼                 ▼
    ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
    │   Vesting    │  │     Vault    │  │ Beneficiary  │
    │   PDA        │  │     ATA      │  │   Account    │
    │              │  │              │  │              │
    │  Config &    │  │  All tokens  │  │  Receives    │
    │  Authority   │  │  locked here │  │  claims      │
    └──────────────┘  └──────────────┘  └──────────────┘
```

---

## Component Architecture

### Core Components
```
┌─────────────────────────────────────────────────────────────┐
│                     TOKEN MINT                              │
│  SPL Token with 9 decimals (standard)                      │
│  Mint Authority: Vesting PDA (after initialization)        │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ controls
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   VESTING PDA                               │
│                                                             │
│  Seeds: ["vesting_halving", token_mint]                    │
│                                                             │
│  Stores:                                                    │
│  • Beneficiary address                                      │
│  • Initial supply                                           │
│  • Current period (0, 1, 2...)                             │
│  • Period supply (halves each time)                         │
│  • Start time                                               │
│  • Halving interval                                         │
│  • Total claimed                                            │
│                                                             │
│  Authority over:                                            │
│  • Vault ATA (can transfer)                                 │
│  • Token Mint (can mint - but only used once)              │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ owns
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                     VAULT ATA                               │
│  Associated Token Account owned by Vesting PDA             │
│                                                             │
│  Initial Balance: initial_supply × 2                        │
│  (e.g., 200,000 tokens for 100k initial)                   │
│                                                             │
│  Tokens Released:                                           │
│  • Period 0: 100,000 → Beneficiary                         │
│  • Period 1: 50,000  → Beneficiary                         │
│  • Period 2: 25,000  → Beneficiary                         │
│  • Etc...                                                   │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ transfers to
                              ▼
┌─────────────────────────────────────────────────────────────┐
│               BENEFICIARY TOKEN ACCOUNT                     │
│  Regular ATA owned by beneficiary                          │
│  Receives tokens when claim_vesting_period() is called     │
└─────────────────────────────────────────────────────────────┘
```

---

## Data Flow

### Initialization Flow
```
Step 1: User Creates Token
┌──────────┐
│  User    │──► createMint()
└──────────┘         │
                     ▼
              ┌─────────────┐
              │ Token Mint  │
              │ Authority:  │
              │ User        │
              └─────────────┘

Step 2: Initialize Vesting
┌──────────┐
│  User    │──► initialize_vesting_halving(100k, 365d)
└──────────┘         │
                     ▼
              ┌─────────────┐
              │ Create PDA  │
              │ Create Vault│
              │ Mint 200k   │──► All tokens to vault
              └─────────────┘
                     │
                     ▼
              ┌─────────────┐
              │ Vault ATA   │
              │ Balance:    │
              │ 200,000     │
              └─────────────┘

Step 3: Transfer Authority
┌──────────┐
│  User    │──► setAuthority(vestingPDA)
└──────────┘         │
                     ▼
              ┌─────────────┐
              │ Token Mint  │
              │ Authority:  │
              │ Vesting PDA │ ✅ Locked!
              └─────────────┘
```

### Claim Flow
```
Time Check Flow:
┌──────────────┐
│ Current Time │
└──────────────┘
       │
       ▼
┌─────────────────────────────────┐
│ Elapsed = now - start_time      │
│ Period = Elapsed / interval     │
└─────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────┐
│ Is Period >= Current Period?    │
└─────────────────────────────────┘
       │               │
      NO              YES
       │               │
       ▼               ▼
   ❌ Error      ✅ Continue


Token Transfer Flow:
┌─────────────┐
│ Vault       │
│ 200k tokens │
└─────────────┘
       │
       │ claim_vesting_period()
       │ transfers period_supply
       ▼
┌─────────────┐
│ Beneficiary │
│ receives    │
│ tokens      │
└─────────────┘


State Update Flow:
┌─────────────────────────────────┐
│ Before Claim:                   │
│ • current_period = 0            │
│ • period_supply = 100k          │
│ • total_claimed = 0             │
└─────────────────────────────────┘
       │
       │ After claim_vesting_period()
       ▼
┌─────────────────────────────────┐
│ After Claim:                    │
│ • current_period = 1            │
│ • period_supply = 50k (halved!) │
│ • total_claimed = 100k          │
└─────────────────────────────────┘
```

---

## State Machine

### Period Progression
```
┌────────────────────────────────────────────────────────────┐
│                     PERIOD 0                               │
│  Supply: 100,000                                           │
│  Unlock: Immediate                                         │
│  Status: Claimable ✅                                      │
└────────────────────────────────────────────────────────────┘
                         │
                         │ claim_vesting_period()
                         │ + 365 days elapsed
                         ▼
┌────────────────────────────────────────────────────────────┐
│                     PERIOD 1                               │
│  Supply: 50,000 (halved)                                   │
│  Unlock: Day 365                                           │
│  Status: Time-locked 🔒 → Claimable ✅                    │
└────────────────────────────────────────────────────────────┘
                         │
                         │ claim_vesting_period()
                         │ + 365 days elapsed
                         ▼
┌────────────────────────────────────────────────────────────┐
│                     PERIOD 2                               │
│  Supply: 25,000 (halved)                                   │
│  Unlock: Day 730                                           │
│  Status: Time-locked 🔒 → Claimable ✅                    │
└────────────────────────────────────────────────────────────┘
                         │
                         │ continues...
                         ▼
                      Period N
                 Supply → 0 eventually
```

### State Transitions
```
        Initialize
             │
             ▼
    ┌────────────────┐
    │   INITIALIZED  │
    │  Period 0      │
    │  Ready to claim│
    └────────────────┘
             │
             │ claim_vesting_period()
             ▼
    ┌────────────────┐
    │  PERIOD_CLAIMED│
    │  Advance to 1  │
    │  Wait for time │
    └────────────────┘
             │
             │ Time passes
             ▼
    ┌────────────────┐
    │  PERIOD_READY  │
    │  Period 1      │
    │  Can claim     │
    └────────────────┘
             │
             │ Repeats...
             ▼
    ┌────────────────┐
    │   EXHAUSTED    │
    │  supply = 0    │
    │  All claimed ✅│
    └────────────────┘
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
                   │ Vesting PDA │ (Program Derived Address)
                   └─────────────┘
                          │
           ┌──────────────┼──────────────┐
           │              │              │
           ▼              ▼              ▼
    ┌──────────┐   ┌──────────┐   ┌──────────┐
    │ Vault    │   │  Token   │   │  Config  │
    │ ATA      │   │  Mint    │   │  Data    │
    │          │   │ Authority│   │          │
    │ (owned)  │   │ (control)│   │ (stored) │
    └──────────┘   └──────────┘   └──────────┘
         │
         │ transfers to
         ▼
    ┌──────────┐
    │Beneficry │
    │   ATA    │
    └──────────┘
```

### PDA Derivation
```
Input:
├─ Program ID: 6Bg1RuRv2yHxJbSodDMKH2dFbDQKGeZwKkDhzZxXQ7xc
├─ Seeds:
│  ├─ "vesting_halving" (constant string)
│  └─ token_mint pubkey (32 bytes)
└─ Bump: Found automatically

Process:
┌─────────────────────────────────────┐
│  findProgramAddressSync()           │
│  • Hash seeds with program ID       │
│  • Try bumps 255 → 0                │
│  • Return first valid PDA           │
└─────────────────────────────────────┘

Output:
└─ Vesting PDA (deterministic address)
```

---

## Sequence Diagrams

### Complete Initialization Sequence
```
User         Program         Token Mint      Vault ATA      Clock
 │              │                 │              │           │
 │─────────────►│                 │              │           │
 │ create_mint  │                 │              │           │
 │              │────────────────►│              │           │
 │              │   initialize    │              │           │
 │◄─────────────│                 │              │           │
 │              │                 │              │           │
 │─────────────►│                 │              │           │
 │ initialize_  │                 │              │           │
 │ vesting_     │                 │              │           │
 │ halving()    │                 │              │           │
 │              │─────────────────────────────────────────►  │
 │              │         get current time                   │
 │              │◄─────────────────────────────────────────  │
 │              │                 │              │           │
 │              │────────────────────────────────►           │
 │              │       create vault ATA                     │
 │              │                 │              │           │
 │              │────────────────►│              │           │
 │              │  mint_to(200k) │              │           │
 │              │                 │─────────────►│           │
 │              │                 │  tokens      │           │
 │◄─────────────│                 │              │           │
 │              │                 │              │           │
 │─────────────►│                 │              │           │
 │ set_authority│                 │              │           │
 │   → PDA      │────────────────►│              │           │
 │              │  update authority               │           │
 │◄─────────────│                 │              │           │
```

### Claim Sequence
```
User         Program         Vault ATA      Beneficiary ATA    Clock
 │              │                 │                │            │
 │─────────────►│                 │                │            │
 │ claim_vesting│                 │                │            │
 │ _period()    │                 │                │            │
 │              │─────────────────────────────────────────────►│
 │              │         check time elapsed                   │
 │              │◄─────────────────────────────────────────────│
 │              │  time_period = elapsed / interval            │
 │              │                 │                │            │
 │              │  ✅ time_period >= current_period            │
 │              │                 │                │            │
 │              │────────────────►│                │            │
 │              │  transfer tokens│                │            │
 │              │                 │───────────────►│            │
 │              │                 │   100k tokens  │            │
 │              │                 │                │            │
 │              │  Update state:                                │
 │              │  • period++                                   │
 │              │  • supply /= 2                                │
 │              │  • total_claimed += 100k                      │
 │◄─────────────│                 │                │            │
 │   success    │                 │                │            │
```

---

## Memory Layout

### VestingHalvingConfig Account
```
Byte Offset  Field                Type        Size
─────────────────────────────────────────────────────
0-7          Discriminator        u64         8
8-39         beneficiary          Pubkey      32
40-71        token_mint           Pubkey      32
72-79        initial_supply       u64         8
80-83        current_period       u32         4
84-91        period_supply        u64         8
92           claimed_this_period  bool        1
93-100       total_claimed        u64         8
101-108      start_time           i64         8
109-116      halving_interval     i64         8
117          bump                 u8          1
─────────────────────────────────────────────────────
Total: 118 bytes
```

---

## Security Architecture

### Access Control
```
┌────────────────────────────────────────────────┐
│         INSTRUCTION PERMISSIONS                │
├────────────────────────────────────────────────┤
│                                                │
│  initialize_vesting_halving                    │
│  • Signer: mint_authority ✅                  │
│  • Signer: payer ✅                           │
│                                                │
│  claim_vesting_period                          │
│  • Signer: beneficiary ✅                     │
│  • Constraint: must match config.beneficiary  │
│                                                │
│  update_beneficiary                            │
│  • Signer: current beneficiary ✅             │
│                                                │
└────────────────────────────────────────────────┘
```

### Time-Lock Mechanism
```
┌─────────────────────────────────────────┐
│     TIME-BASED ACCESS CONTROL           │
├─────────────────────────────────────────┤
│                                         │
│  Period Unlock Check:                   │
│                                         │
│  current_time >= unlock_time           │
│                                         │
│  where:                                 │
│  unlock_time = start_time +            │
│                (period × interval)      │
│                                         │
│  Cannot be bypassed:                    │
│  ✅ Uses Solana Clock sysvar            │
│  ✅ Tamper-proof timestamp              │
│  ✅ Validators enforce consensus        │
│                                         │
└─────────────────────────────────────────┘
```

---

## Halving Mathematics

### Geometric Series
```
Total Supply = Σ(initial / 2^n) for n = 0 to ∞

= initial × (1 + 1/2 + 1/4 + 1/8 + ...)
= initial × 2

Example: initial = 100,000

Period 0: 100,000 / 2^0 = 100,000
Period 1: 100,000 / 2^1 =  50,000
Period 2: 100,000 / 2^2 =  25,000
Period 3: 100,000 / 2^3 =  12,500
Period 4: 100,000 / 2^4 =   6,250
...
Total:                     200,000 (approaches)
```

### Practical Example
```
Timeline for 100k initial, 365 day interval:

┌───────┬──────────────┬─────────────┬──────────────┐
│ Period│ Unlock Date  │   Amount    │  Cumulative  │
├───────┼──────────────┼─────────────┼──────────────┤
│   0   │ Day 0        │   100,000   │   100,000    │
│   1   │ Day 365      │    50,000   │   150,000    │
│   2   │ Day 730      │    25,000   │   175,000    │
│   3   │ Day 1,095    │    12,500   │   187,500    │
│   4   │ Day 1,460    │     6,250   │   193,750    │
│   5   │ Day 1,825    │     3,125   │   196,875    │
│   6   │ Day 2,190    │     1,562   │   198,437    │
│   7   │ Day 2,555    │       781   │   199,218    │
│  ...  │    ...       │      ...    │   → 200,000  │
└───────┴──────────────┴─────────────┴──────────────┘

Approaches 200k but never quite reaches it due to
integer division (eventually hits 0)
```

---

## Performance Characteristics

### Compute Units
```
Instruction                  Typical CU Usage
─────────────────────────────────────────────
initialize_vesting_halving   ~50,000 CU
claim_vesting_period         ~15,000 CU
update_beneficiary           ~5,000 CU
```

### Transaction Costs (X1 Mainnet)
```
Operation                    Estimated Cost
─────────────────────────────────────────────
Initialize                   ~0.002 SOL
Claim                        ~0.0005 SOL
Update Beneficiary           ~0.0003 SOL
```

---

## Integration Patterns

### Frontend Integration
```
┌────────────────┐
│   React App    │
│                │
│  useWallet()   │
│  useConnection │
└────────────────┘
        │
        │ calls
        ▼
┌────────────────┐
│  Anchor SDK    │
│  Program       │
│  Interface     │
└────────────────┘
        │
        │ RPC
        ▼
┌────────────────┐
│ X1 RPC Node    │
│                │
│ Vesting Program│
└────────────────┘
```

### Backend Integration
```
┌────────────────┐
│  Node.js API   │
│                │
│  Express       │
└────────────────┘
        │
        │
        ▼
┌────────────────┐
│  @solana/web3  │
│  @coral-xyz    │
│  /anchor       │
└────────────────┘
        │
        │
        ▼
┌────────────────┐
│  Vesting PDA   │
│  Read State    │
│  Send Tx       │
└────────────────┘
```

---

## Deployment Architecture
```
┌─────────────────────────────────────────────┐
│           X1 MAINNET CLUSTER                │
│                                             │
│  ┌────────────────────────────────────┐    │
│  │   Vesting Halving Program          │    │
│  │   6Bg1RuRv...Q7xc                  │    │
│  │                                    │    │
│  │   Deployed via:                    │    │
│  │   solana program deploy            │    │
│  │                                    │    │
│  │   Upgradeable: Yes                 │    │
│  │   Authority: C5V1AaFcE8W...        │    │
│  └────────────────────────────────────┘    │
│                                             │
│  Multiple Vesting Instances:                │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐ │
│  │ Vesting1 │  │ Vesting2 │  │ Vesting3 │ │
│  │ PDA      │  │ PDA      │  │ PDA      │ │
│  └──────────┘  └──────────┘  └──────────┘ │
│                                             │
└─────────────────────────────────────────────┘
```


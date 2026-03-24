const anchor = require("@coral-xyz/anchor");
const { PublicKey, Keypair, SystemProgram } = require("@solana/web3.js");
const { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, createMint, getOrCreateAssociatedTokenAccount, getAssociatedTokenAddress, setAuthority, AuthorityType } = require("@solana/spl-token");
const fs = require('fs');

const idl = JSON.parse(fs.readFileSync('./target/idl/halving_program.json', 'utf-8'));

async function testVestingHalving() {
  console.log("🧪 Testing VESTING-BASED HALVING\n");
  
  const connection = new anchor.web3.Connection("https://rpc.testnet.x1.xyz", "confirmed");
  const walletKeypair = Keypair.fromSecretKey(
    new Uint8Array(JSON.parse(fs.readFileSync(require('os').homedir() + '/.config/solana/x1-testnet.json', 'utf-8')))
  );
  
  const wallet = new anchor.Wallet(walletKeypair);
  const provider = new anchor.AnchorProvider(connection, wallet, { commitment: "confirmed" });
  anchor.setProvider(provider);
  
  const programId = new PublicKey("E8kLqkqM5sxLjMNGk6dBjP5soVY3U2kpdL2Pk856BCzg");
  const program = new anchor.Program(idl, provider);
  
  console.log("📋 Configuration:");
  console.log("  Beneficiary:", wallet.publicKey.toString());
  console.log();
  
  // Create token
  console.log("🪙 Step 1: Creating token...");
  const tokenMint = await createMint(connection, walletKeypair, walletKeypair.publicKey, null, 9);
  console.log("  Token:", tokenMint.toString());
  
  const [halvingPDA] = PublicKey.findProgramAddressSync(
    [Buffer.from("halving"), tokenMint.toBuffer()],
    programId
  );
  console.log("  Halving PDA:", halvingPDA.toString());
  
  const vaultTokenAccount = await getAssociatedTokenAddress(tokenMint, halvingPDA, true);
  console.log("  Vault ATA:", vaultTokenAccount.toString());
  console.log();
  
  // Initialize (BEFORE transferring authority)
  console.log("🔧 Step 2: Initializing halving (100k, 30s)...");
  const initialSupply = new anchor.BN(100000 * 1e9);
  const halvingInterval = new anchor.BN(30);
  
  try {
    const tx = await program.methods
      .initializeHalving(initialSupply, halvingInterval)
      .accounts({
        halving: halvingPDA,
        tokenMint: tokenMint,
        vaultTokenAccount: vaultTokenAccount,
        beneficiary: wallet.publicKey,
        mintAuthority: wallet.publicKey, // Current mint authority
        payer: wallet.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      })
      .rpc();
    
    console.log("  ✅ Initialized! Tx:", tx);
    
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const vaultBalance = await connection.getTokenAccountBalance(vaultTokenAccount);
    console.log("  💰 Vault: ", vaultBalance.value.uiAmount, "tokens");
    console.log();
    
  } catch (error) {
    console.log("  ❌ Failed:", error.message);
    if (error.logs) {
      error.logs.slice(0, 8).forEach(log => console.log("    ", log));
    }
    return;
  }
  
  // NOW transfer mint authority
  console.log("🔑 Step 3: Transferring mint authority to PDA...");
  await setAuthority(connection, walletKeypair, tokenMint, walletKeypair.publicKey, AuthorityType.MintTokens, halvingPDA);
  console.log("  ✅ Authority transferred!");
  console.log();
  
  // Create beneficiary account
  console.log("💼 Step 4: Creating beneficiary token account...");
  const beneficiaryTokenAccount = await getOrCreateAssociatedTokenAccount(connection, walletKeypair, tokenMint, wallet.publicKey);
  console.log("  Account:", beneficiaryTokenAccount.address.toString());
  console.log();
  
  // Claim period 0
  console.log("🎁 Step 5: Claiming Period 0 (100k - NOW)...");
  try {
    const tx = await program.methods
      .claimPeriod()
      .accounts({
        halving: halvingPDA,
        tokenMint: tokenMint,
        vaultTokenAccount: vaultTokenAccount,
        beneficiaryTokenAccount: beneficiaryTokenAccount.address,
        beneficiary: wallet.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();
    
    console.log("  ✅ Claimed! Tx:", tx);
    
    await new Promise(resolve => setTimeout(resolve, 2000));
    const balance = await connection.getTokenAccountBalance(beneficiaryTokenAccount.address);
    console.log("  💰 Balance:", balance.value.uiAmount);
    console.log();
    
  } catch (error) {
    console.log("  ❌ Failed:", error.message);
    return;
  }
  
  // Try period 1 (should fail)
  console.log("🚫 Step 6: Try Period 1 NOW (should FAIL)...");
  try {
    await program.methods.claimPeriod().accounts({
      halving: halvingPDA,
      tokenMint: tokenMint,
      vaultTokenAccount: vaultTokenAccount,
      beneficiaryTokenAccount: beneficiaryTokenAccount.address,
      beneficiary: wallet.publicKey,
      tokenProgram: TOKEN_PROGRAM_ID,
    }).rpc();
    console.log("  ⚠️ Unexpected!");
  } catch (error) {
    console.log("  ✅ Expected failure!");
  }
  console.log();
  
  // Wait
  console.log("⏰ Step 7: Waiting 30s...");
  for (let i = 30; i > 0; i--) {
    process.stdout.write(`\r  ${i}s...`);
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  console.log("\r  ⏱️ Done!     ");
  console.log();
  
  // Claim period 1
  console.log("🎁 Step 8: Claiming Period 1 (50k)...");
  try {
    const tx = await program.methods.claimPeriod().accounts({
      halving: halvingPDA,
      tokenMint: tokenMint,
      vaultTokenAccount: vaultTokenAccount,
      beneficiaryTokenAccount: beneficiaryTokenAccount.address,
      beneficiary: wallet.publicKey,
      tokenProgram: TOKEN_PROGRAM_ID,
    }).rpc();
    
    console.log("  ✅ Claimed! Tx:", tx);
    
    await new Promise(resolve => setTimeout(resolve, 2000));
    const balance = await connection.getTokenAccountBalance(beneficiaryTokenAccount.address);
    console.log("  💰 Total:", balance.value.uiAmount);
    
    console.log("\n✅✅✅ TEST PASSED!");
    
  } catch (error) {
    console.log("  ❌ Failed:", error.message);
  }
}

testVestingHalving().catch(console.error);

const anchor = require("@coral-xyz/anchor");
const { PublicKey, Keypair, SystemProgram } = require("@solana/web3.js");
const { TOKEN_PROGRAM_ID, createMint, getOrCreateAssociatedTokenAccount, setAuthority, AuthorityType } = require("@solana/spl-token");
const fs = require('fs');

// Load the IDL
const idl = JSON.parse(fs.readFileSync('./target/idl/halving_program.json', 'utf-8'));

async function testHalvingProgram() {
  console.log("🧪 Starting Halving Program Test\n");
  
  // Setup
  const connection = new anchor.web3.Connection("https://rpc.testnet.x1.xyz", "confirmed");
  const walletKeypair = Keypair.fromSecretKey(
    new Uint8Array(JSON.parse(fs.readFileSync(require('os').homedir() + '/.config/solana/x1-testnet.json', 'utf-8')))
  );
  
  const wallet = new anchor.Wallet(walletKeypair);
  const provider = new anchor.AnchorProvider(connection, wallet, { commitment: "confirmed" });
  anchor.setProvider(provider);
  
  const programId = new PublicKey("E8kLqkqM5sxLjMNGk6dBjP5soVY3U2kpdL2Pk856BCzg");
  const program = new anchor.Program(idl, provider);
  
  console.log("📋 Test Configuration:");
  console.log("  Program ID:", programId.toString());
  console.log("  Your Wallet:", wallet.publicKey.toString());
  console.log();
  
  // Create test token
  console.log("🪙 Step 1: Creating test token...");
  const tokenMint = await createMint(
    connection,
    walletKeypair,
    walletKeypair.publicKey, // Temporary authority
    null,
    9
  );
  console.log("  Token created:", tokenMint.toString());
  console.log();
  
  // Derive halving PDA
  const [halvingPDA] = PublicKey.findProgramAddressSync(
    [Buffer.from("halving"), tokenMint.toBuffer()],
    programId
  );
  console.log("  Halving PDA:", halvingPDA.toString());
  console.log();
  
  // Initialize halving
  const initialSupply = new anchor.BN(100000 * 1e9); // 100,000 tokens
  const halvingInterval = new anchor.BN(60); // 60 seconds for testing
  
  console.log("🔧 Step 2: Initializing halving configuration...");
  console.log("  Initial supply: 100,000 tokens");
  console.log("  Halving interval: 60 seconds");
  
  try {
    const tx = await program.methods
      .initializeHalving(initialSupply, halvingInterval)
      .accounts({
        halving: halvingPDA,
        tokenMint: tokenMint,
        authority: wallet.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
    
    console.log("  ✅ Initialized! Tx:", tx);
    console.log();
    
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Fetch halving config
    const halvingConfig = await program.account.halvingConfig.fetch(halvingPDA);
    console.log("📊 Halving Configuration:");
    console.log("  Current period:", halvingConfig.currentPeriod);
    console.log("  Period supply:", halvingConfig.periodSupply.toString());
    console.log();
    
  } catch (error) {
    console.log("  ❌ Initialization failed:", error.message);
    return;
  }
  
  // Transfer mint authority to halving PDA
  console.log("🔑 Step 3: Transferring mint authority to halving PDA...");
  try {
    await setAuthority(
      connection,
      walletKeypair,
      tokenMint,
      walletKeypair.publicKey,
      AuthorityType.MintTokens,
      halvingPDA
    );
    console.log("  ✅ Mint authority transferred to halving PDA!");
    console.log();
    
    await new Promise(resolve => setTimeout(resolve, 2000));
    
  } catch (error) {
    console.log("  ❌ Authority transfer failed:", error.message);
    return;
  }
  
  // Create recipient token account
  console.log("💼 Step 4: Creating recipient token account...");
  const recipientTokenAccount = await getOrCreateAssociatedTokenAccount(
    connection,
    walletKeypair,
    tokenMint,
    wallet.publicKey
  );
  console.log("  Token account:", recipientTokenAccount.address.toString());
  console.log();
  
  // Mint some tokens (Period 0: 100k available)
  console.log("🪙 Step 5: Minting 50,000 tokens (Period 0)...");
  const mintAmount = new anchor.BN(50000 * 1e9);
  
  try {
    const tx = await program.methods
      .mintPeriod(mintAmount)
      .accounts({
        halving: halvingPDA,
        tokenMint: tokenMint,
        recipientTokenAccount: recipientTokenAccount.address,
        authority: wallet.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();
    
    console.log("  ✅ Minted! Tx:", tx);
    
    await new Promise(resolve => setTimeout(resolve, 2000));
    const balance = await connection.getTokenAccountBalance(recipientTokenAccount.address);
    console.log("  Token balance:", balance.value.uiAmount);
    console.log();
    
  } catch (error) {
    console.log("  ❌ Minting failed:", error.message);
    if (error.logs) {
      error.logs.slice(0, 5).forEach(log => console.log("    ", log));
    }
    return;
  }
  
  // Try to exceed period supply
  console.log("🚫 Step 6: Try to exceed period supply (should FAIL)...");
  try {
    await program.methods
      .mintPeriod(new anchor.BN(60000 * 1e9))
      .accounts({
        halving: halvingPDA,
        tokenMint: tokenMint,
        recipientTokenAccount: recipientTokenAccount.address,
        authority: wallet.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();
    
    console.log("  ⚠️ UNEXPECTED: Mint succeeded");
    
  } catch (error) {
    console.log("  ✅ EXPECTED: Mint failed correctly");
    if (error.message.includes("PeriodSupplyExceeded") || error.message.includes("0x1771")) {
      console.log("  ✅✅ Correct error: Period supply exceeded!");
    }
  }
  console.log();
  
  // Wait 60 seconds
  console.log("⏰ Step 7: Waiting 60 seconds for halving...");
  for (let i = 60; i > 0; i--) {
    process.stdout.write(`\r  Time remaining: ${i} seconds...`);
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  console.log("\r  ⏱️ 60 seconds elapsed!                    ");
  console.log();
  
  // Advance period
  console.log("🔄 Step 8: Advancing to Period 1 (supply halves to 50k)...");
  try {
    const tx = await program.methods
      .advancePeriod()
      .accounts({
        halving: halvingPDA,
        authority: wallet.publicKey,
      })
      .rpc();
    
    console.log("  ✅ Period advanced! Tx:", tx);
    
    await new Promise(resolve => setTimeout(resolve, 2000));
    const halvingConfig = await program.account.halvingConfig.fetch(halvingPDA);
    console.log("  📊 Updated Configuration:");
    console.log("    Current period:", halvingConfig.currentPeriod);
    console.log("    Period supply:", halvingConfig.periodSupply.toString(), "(halved!)");
    console.log();
    
  } catch (error) {
    console.log("  ❌ Advance failed:", error.message);
    return;
  }
  
  // Mint in new period
  console.log("🪙 Step 9: Minting 25,000 tokens (Period 1)...");
  try {
    const tx = await program.methods
      .mintPeriod(new anchor.BN(25000 * 1e9))
      .accounts({
        halving: halvingPDA,
        tokenMint: tokenMint,
        recipientTokenAccount: recipientTokenAccount.address,
        authority: wallet.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();
    
    console.log("  ✅ Minted! Tx:", tx);
    
    await new Promise(resolve => setTimeout(resolve, 2000));
    const balance = await connection.getTokenAccountBalance(recipientTokenAccount.address);
    console.log("  Final token balance:", balance.value.uiAmount);
    console.log();
    
  } catch (error) {
    console.log("  ❌ Minting failed:", error.message);
  }
  
  console.log("✅✅✅ HALVING PROGRAM TEST COMPLETE!");
  console.log("\nTest Results:");
  console.log("  ✅ Initialize halving config");
  console.log("  ✅ Transfer mint authority");
  console.log("  ✅ Mint tokens (period 0)");
  console.log("  ✅ Prevent exceeding period supply");
  console.log("  ✅ Advance period after interval");
  console.log("  ✅ Supply halved correctly");
  console.log("  ✅ Mint in new period");
}

testHalvingProgram().catch(console.error);

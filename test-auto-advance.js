const anchor = require("@coral-xyz/anchor");
const { PublicKey, Keypair, SystemProgram } = require("@solana/web3.js");
const { TOKEN_PROGRAM_ID, createMint, getOrCreateAssociatedTokenAccount, setAuthority, AuthorityType } = require("@solana/spl-token");
const fs = require('fs');

const idl = JSON.parse(fs.readFileSync('./target/idl/halving_program.json', 'utf-8'));

async function testAutoAdvance() {
  console.log("🧪 Testing AUTO-ADVANCE Feature\n");
  
  const connection = new anchor.web3.Connection("https://rpc.testnet.x1.xyz", "confirmed");
  const walletKeypair = Keypair.fromSecretKey(
    new Uint8Array(JSON.parse(fs.readFileSync(require('os').homedir() + '/.config/solana/x1-testnet.json', 'utf-8')))
  );
  
  const wallet = new anchor.Wallet(walletKeypair);
  const provider = new anchor.AnchorProvider(connection, wallet, { commitment: "confirmed" });
  anchor.setProvider(provider);
  
  const programId = new PublicKey("E8kLqkqM5sxLjMNGk6dBjP5soVY3U2kpdL2Pk856BCzg");
  const program = new anchor.Program(idl, provider);
  
  // Setup
  console.log("🔧 Setup: Creating token and initializing halving...");
  const tokenMint = await createMint(connection, walletKeypair, walletKeypair.publicKey, null, 9);
  const [halvingPDA] = PublicKey.findProgramAddressSync([Buffer.from("halving"), tokenMint.toBuffer()], programId);
  
  await program.methods
    .initializeHalving(new anchor.BN(100000 * 1e9), new anchor.BN(30))
    .accounts({
      halving: halvingPDA,
      tokenMint: tokenMint,
      authority: wallet.publicKey,
      systemProgram: SystemProgram.programId,
    })
    .rpc();
  
  await setAuthority(connection, walletKeypair, tokenMint, walletKeypair.publicKey, AuthorityType.MintTokens, halvingPDA);
  const recipientTokenAccount = await getOrCreateAssociatedTokenAccount(connection, walletKeypair, tokenMint, wallet.publicKey);
  
  await new Promise(resolve => setTimeout(resolve, 2000));
  console.log("  ✅ Setup complete!\n");
  
  // Mint in period 0
  console.log("🪙 Period 0: Minting 30,000 tokens...");
  await program.methods
    .mintPeriod(new anchor.BN(30000 * 1e9))
    .accounts({
      halving: halvingPDA,
      tokenMint: tokenMint,
      recipientTokenAccount: recipientTokenAccount.address,
      authority: wallet.publicKey,
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .rpc();
  
  let config = await program.account.halvingConfig.fetch(halvingPDA);
  console.log("  Current period:", config.currentPeriod);
  console.log("  Period supply:", config.periodSupply.toString());
  console.log("  Minted:", config.mintedThisPeriod.toString());
  console.log();
  
  // Wait 30 seconds
  console.log("⏰ Waiting 30 seconds for auto-advance...");
  for (let i = 30; i > 0; i--) {
    process.stdout.write(`\r  Time: ${i}s...`);
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  console.log("\r  ⏱️ 30 seconds passed!              \n");
  
  // Mint again - should AUTO-ADVANCE
  console.log("🔄 Minting after interval (should AUTO-ADVANCE)...");
  const tx = await program.methods
    .mintPeriod(new anchor.BN(20000 * 1e9))
    .accounts({
      halving: halvingPDA,
      tokenMint: tokenMint,
      recipientTokenAccount: recipientTokenAccount.address,
      authority: wallet.publicKey,
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .rpc();
  
  console.log("  ✅ Tx:", tx);
  
  // Check if period advanced
  await new Promise(resolve => setTimeout(resolve, 2000));
  config = await program.account.halvingConfig.fetch(halvingPDA);
  
  console.log("\n📊 After Auto-Advance:");
  console.log("  Current period:", config.currentPeriod);
  console.log("  Period supply:", config.periodSupply.toString());
  console.log("  Minted this period:", config.mintedThisPeriod.toString());
  console.log();
  
  if (config.currentPeriod === 1) {
    console.log("✅✅✅ AUTO-ADVANCE WORKED!");
    console.log("Period automatically advanced from 0 → 1");
    console.log("Supply automatically halved: 100k → 50k");
  } else {
    console.log("❌ Auto-advance did not work");
  }
}

testAutoAdvance().catch(console.error);

import * as anchor from "@coral-xyz/anchor";
import { BN } from "@coral-xyz/anchor";
import { PublicKey, Keypair, SystemProgram, SYSVAR_RENT_PUBKEY, Transaction } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, getAssociatedTokenAddress, createMint, createAssociatedTokenAccountInstruction } from "@solana/spl-token";
import { HalvingProgram } from "../target/types/halving_program";

async function main() {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.HalvingProgram as anchor.Program<HalvingProgram>;
  console.log("Wallet:", provider.wallet.publicKey.toString());

  const mintKeypair = Keypair.generate();
  const mint = await createMint(provider.connection, provider.wallet.payer, provider.wallet.publicKey, provider.wallet.publicKey, 0, mintKeypair);
  console.log("Mint:", mint.toString());

  const [vestingPDA, bump] = PublicKey.findProgramAddressSync(
    [Buffer.from("vesting_halving"), mint.toBuffer()], program.programId
  );
  console.log("Vesting PDA:", vestingPDA.toString());

  const vaultATA = await getAssociatedTokenAddress(mint, vestingPDA, true, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID);

  // Step 0a: Pre-create vault ATA
  console.log("Step 0a: Creating vault ATA...");
  const createATAIx = createAssociatedTokenAccountInstruction(
    provider.wallet.publicKey, vaultATA, vestingPDA, mint, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID
  );
  const tx0a = new Transaction().add(createATAIx);
  const sig0a = await provider.sendAndConfirm(tx0a);
  console.log("✅ Vault ATA:", sig0a);

  // Step 0b: Pre-create vesting PDA account via SystemProgram
  console.log("Step 0b: Pre-creating vesting PDA account...");
  const space = 8 + 32 + 32 + 8 + 4 + 8 + 1 + 8 + 8 + 8 + 1 + 1;
  const lamports = await provider.connection.getMinimumBalanceForRentExemption(space);
  const createPDAIx = SystemProgram.createAccountWithSeed({
    fromPubkey: provider.wallet.publicKey,
    newAccountPubkey: vestingPDA,
    basePubkey: provider.wallet.publicKey,
    seed: "",
    lamports,
    space,
    programId: program.programId,
  });
  // Actually use createAccount directly since it's a PDA
  // PDA can't be created with createAccount - use the program's init
  // Skip this - let anchor handle it but with mut constraint now
  console.log("Skipping PDA pre-create - program handles it");

  // Step 1: initializeVestingHalving
  console.log("Step 1: initializeVestingHalving...");
  const tx1 = await program.methods
    .initializeVestingHalving(new BN(1000000), new BN(86400))
    .accounts({
      vestingHalving: vestingPDA,
      tokenMint: mint,
      vaultTokenAccount: vaultATA,
      beneficiary: provider.wallet.publicKey,
      payer: provider.wallet.publicKey,
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
      rent: SYSVAR_RENT_PUBKEY,
    })
    .rpc();
  console.log("✅ Step 1 TX:", tx1);

  // Step 2: fundVault
  console.log("Step 2: fundVault...");
  const tx2 = await program.methods
    .fundVault()
    .accounts({
      vestingHalving: vestingPDA,
      tokenMint: mint,
      vaultTokenAccount: vaultATA,
      mintAuthority: provider.wallet.publicKey,
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .rpc();
  console.log("✅ Step 2 TX:", tx2);
  console.log("🎉 All steps succeeded!");
}

main().catch(e => {
  console.error("❌ FAILED:", e.message);
  if (e.logs) e.logs.forEach((l: string) => console.log(l));
  process.exit(1);
});

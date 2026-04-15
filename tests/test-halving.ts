import * as anchor from "@coral-xyz/anchor";
import { BN } from "@coral-xyz/anchor";
import { PublicKey, Keypair, SystemProgram, SYSVAR_RENT_PUBKEY } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, getAssociatedTokenAddress, createMint } from "@solana/spl-token";
import { HalvingProgram } from "../target/types/halving_program";

async function main() {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.HalvingProgram as anchor.Program<HalvingProgram>;

  console.log("Wallet:", provider.wallet.publicKey.toString());

  const mintKeypair = Keypair.generate();
  const mint = await createMint(provider.connection, provider.wallet.payer, provider.wallet.publicKey, provider.wallet.publicKey, 0, mintKeypair);
  console.log("Mint:", mint.toString());

  const [vestingPDA] = PublicKey.findProgramAddressSync(
    [Buffer.from("vesting_halving"), mint.toBuffer()], program.programId
  );
  const vaultATA = await getAssociatedTokenAddress(mint, vestingPDA, true, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID);

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
  console.log("🎉 Both steps succeeded!");
}

main().catch(e => {
  console.error("❌ FAILED:", e.message);
  if (e.logs) e.logs.forEach((l: string) => console.log(l));
  process.exit(1);
});

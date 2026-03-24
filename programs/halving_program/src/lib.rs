use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Mint, MintTo, Transfer};
use anchor_spl::associated_token::AssociatedToken;

declare_id!("6Bg1RuRv2yHxJbSodDMKH2dFbDQKGeZwKkDhzZxXQ7xc");

#[cfg(not(feature = "no-entrypoint"))]
solana_security_txt::security_txt! {
    name: "Vesting Halving Program",
    project_url: "https://github.com/omenpotter/vesting-halving-program",
    contacts: "https://github.com/omenpotter/vesting-halving-program/security/advisories/new",
    policy: "https://github.com/omenpotter/vesting-halving-program/blob/main/SECURITY.md",
    source_code: "https://github.com/omenpotter/vesting-halving-program"
}

#[program]
pub mod halving_program {
    use super::*;

    /// Initialize vesting halving schedule
    /// 
    /// Mints all tokens upfront (initial_supply × 2) to vault and locks them
    /// in a halving vesting schedule:
    /// - Period 0: initial_supply (unlocked immediately)
    /// - Period 1: initial_supply / 2 (unlocks after halving_interval)
    /// - Period 2: initial_supply / 4 (unlocks after 2 × halving_interval)
    /// - And so on...
    /// 
    /// Note: Transfer mint authority to halving PDA after initialization
    pub fn initialize_vesting_halving(
        ctx: Context<InitializeVestingHalving>,
        initial_supply: u64,
        halving_interval: i64,
    ) -> Result<()> {
        let clock = Clock::get()?;
        
        require!(initial_supply > 0, VestingHalvingError::InvalidSupply);
        require!(halving_interval > 0, VestingHalvingError::InvalidInterval);
        
        let vesting = &mut ctx.accounts.vesting_halving;
        vesting.beneficiary = ctx.accounts.beneficiary.key();
        vesting.token_mint = ctx.accounts.token_mint.key();
        vesting.initial_supply = initial_supply;
        vesting.current_period = 0;
        vesting.period_supply = initial_supply;
        vesting.claimed_this_period = false;
        vesting.total_claimed = 0;
        vesting.start_time = clock.unix_timestamp;
        vesting.halving_interval = halving_interval;
        vesting.bump = ctx.bumps.vesting_halving;
        
        // Calculate total vested tokens (geometric series: initial × 2)
        let total_vested = initial_supply
            .checked_mul(2)
            .ok_or(VestingHalvingError::Overflow)?;
        
        // Mint all tokens upfront to vault
        token::mint_to(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                MintTo {
                    mint: ctx.accounts.token_mint.to_account_info(),
                    to: ctx.accounts.vault_token_account.to_account_info(),
                    authority: ctx.accounts.mint_authority.to_account_info(),
                },
            ),
            total_vested,
        )?;
        
        msg!("✅ Vesting Halving: {} tokens vaulted with halving schedule", total_vested);
        msg!("   Period 0: {} unlocked immediately", initial_supply);
        msg!("   Period 1+: Halves every {} seconds", halving_interval);
        Ok(())
    }

    /// Claim tokens for unlocked vesting period
    /// 
    /// Checks if current period is time-unlocked and transfers
    /// the period's allocation to beneficiary
    pub fn claim_vesting_period(ctx: Context<ClaimVestingPeriod>) -> Result<()> {
        let vesting = &mut ctx.accounts.vesting_halving;
        let clock = Clock::get()?;
        
        // Calculate which period is unlocked based on elapsed time
        let elapsed = clock.unix_timestamp - vesting.start_time;
        let time_based_period = (elapsed / vesting.halving_interval) as u32;
        
        // Determine which period to claim
        let claim_period = if vesting.claimed_this_period {
            vesting.current_period + 1
        } else {
            vesting.current_period
        };
        
        // Verify period is time-unlocked
        require!(
            time_based_period >= claim_period,
            VestingHalvingError::PeriodNotUnlocked
        );
        
        // Verify supply still available
        require!(
            vesting.period_supply > 0,
            VestingHalvingError::AllPeriodsClaimed
        );
        
        // Transfer vested tokens from vault to beneficiary
        let seeds = &[
            b"vesting_halving",
            vesting.token_mint.as_ref(),
            &[vesting.bump],
        ];
        
        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.vault_token_account.to_account_info(),
                    to: ctx.accounts.beneficiary_token_account.to_account_info(),
                    authority: vesting.to_account_info(),
                },
                &[seeds],
            ),
            vesting.period_supply,
        )?;
        
        vesting.total_claimed += vesting.period_supply;
        
        msg!("✅ Vesting claim: {} tokens for period {}", vesting.period_supply, claim_period);
        
        // Advance to next period with halved supply
        vesting.current_period += 1;
        vesting.period_supply = vesting.period_supply / 2;
        vesting.claimed_this_period = false;
        
        Ok(())
    }

    /// Update beneficiary who can claim vested tokens
    pub fn update_beneficiary(
        ctx: Context<UpdateBeneficiary>,
        new_beneficiary: Pubkey,
    ) -> Result<()> {
        ctx.accounts.vesting_halving.beneficiary = new_beneficiary;
        msg!("✅ Beneficiary updated");
        Ok(())
    }
}

#[derive(Accounts)]
pub struct InitializeVestingHalving<'info> {
    #[account(
        init,
        payer = payer,
        space = 8 + 32 + 32 + 8 + 4 + 8 + 1 + 8 + 8 + 8 + 1,
        seeds = [b"vesting_halving", token_mint.key().as_ref()],
        bump
    )]
    pub vesting_halving: Account<'info, VestingHalvingConfig>,
    
    #[account(mut)]
    pub token_mint: Account<'info, Mint>,
    
    /// Vault holds all vested tokens
    #[account(
        init,
        payer = payer,
        associated_token::mint = token_mint,
        associated_token::authority = vesting_halving,
    )]
    pub vault_token_account: Account<'info, TokenAccount>,
    
    /// CHECK: Beneficiary who can claim vested tokens
    pub beneficiary: AccountInfo<'info>,
    
    /// Current mint authority (must transfer to vesting_halving PDA after init)
    pub mint_authority: Signer<'info>,
    
    #[account(mut)]
    pub payer: Signer<'info>,
    
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct ClaimVestingPeriod<'info> {
    #[account(
        mut,
        seeds = [b"vesting_halving", vesting_halving.token_mint.as_ref()],
        bump = vesting_halving.bump,
        has_one = beneficiary,
        has_one = token_mint
    )]
    pub vesting_halving: Account<'info, VestingHalvingConfig>,
    
    pub token_mint: Account<'info, Mint>,
    
    #[account(mut)]
    pub vault_token_account: Account<'info, TokenAccount>,
    
    #[account(mut)]
    pub beneficiary_token_account: Account<'info, TokenAccount>,
    
    pub beneficiary: Signer<'info>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct UpdateBeneficiary<'info> {
    #[account(
        mut,
        seeds = [b"vesting_halving", vesting_halving.token_mint.as_ref()],
        bump = vesting_halving.bump,
        has_one = beneficiary
    )]
    pub vesting_halving: Account<'info, VestingHalvingConfig>,
    
    pub beneficiary: Signer<'info>,
}

#[account]
pub struct VestingHalvingConfig {
    pub beneficiary: Pubkey,        // 32 - Who can claim vested tokens
    pub token_mint: Pubkey,          // 32 - Token mint
    pub initial_supply: u64,         // 8 - Period 0 supply
    pub current_period: u32,         // 4 - Current vesting period
    pub period_supply: u64,          // 8 - Current period allocation
    pub claimed_this_period: bool,   // 1 - Period claim status
    pub total_claimed: u64,          // 8 - Total claimed so far
    pub start_time: i64,             // 8 - Vesting start timestamp
    pub halving_interval: i64,       // 8 - Seconds between halvings
    pub bump: u8,                    // 1 - PDA bump
}

#[error_code]
pub enum VestingHalvingError {
    #[msg("Invalid supply - must be greater than 0")]
    InvalidSupply,
    
    #[msg("Invalid halving interval - must be greater than 0")]
    InvalidInterval,
    
    #[msg("Vesting period not unlocked yet - wait for time to pass")]
    PeriodNotUnlocked,
    
    #[msg("All vesting periods claimed - no more tokens available")]
    AllPeriodsClaimed,
    
    #[msg("Arithmetic overflow")]
    Overflow,
}

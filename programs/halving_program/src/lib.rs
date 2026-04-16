use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Mint, MintTo, Transfer};
use anchor_spl::associated_token::AssociatedToken;

declare_id!("6Bg1RuRv2yHxJbSodDMKH2dFbDQKGeZwKkDhzZxXQ7xc");

#[program]
pub mod halving_program {
    use super::*;

    /// Initialize vesting — vesting PDA must be pre-created by frontend
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
        vesting.funded = false;
        msg!("Vesting initialized");
        Ok(())
    }

    /// Fund vault — mint tokens to pre-created vault ATA
    pub fn fund_vault(ctx: Context<FundVault>) -> Result<()> {
        let vesting = &mut ctx.accounts.vesting_halving;
        require!(!vesting.funded, VestingHalvingError::AlreadyFunded);
        let total_vested = vesting.initial_supply
            .checked_mul(2)
            .ok_or(VestingHalvingError::Overflow)?;
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
        vesting.funded = true;
        msg!("Vault funded: {} tokens", total_vested);
        Ok(())
    }

    pub fn claim_vesting_period(ctx: Context<ClaimVestingPeriod>) -> Result<()> {
        let vesting = &mut ctx.accounts.vesting_halving;
        let clock = Clock::get()?;
        require!(vesting.funded, VestingHalvingError::NotFunded);
        let elapsed = clock.unix_timestamp - vesting.start_time;
        let time_based_period = (elapsed / vesting.halving_interval) as u32;
        let claim_period = if vesting.claimed_this_period {
            vesting.current_period + 1
        } else {
            vesting.current_period
        };
        require!(time_based_period >= claim_period, VestingHalvingError::PeriodNotUnlocked);
        require!(vesting.period_supply > 0, VestingHalvingError::AllPeriodsClaimed);
        let seeds = &[b"vesting_halving", vesting.token_mint.as_ref(), &[vesting.bump]];
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
        vesting.current_period += 1;
        vesting.period_supply = vesting.period_supply / 2;
        vesting.claimed_this_period = false;
        msg!("Claimed period");
        Ok(())
    }

    pub fn update_beneficiary(ctx: Context<UpdateBeneficiary>, new_beneficiary: Pubkey) -> Result<()> {
        ctx.accounts.vesting_halving.beneficiary = new_beneficiary;
        Ok(())
    }
}

#[derive(Accounts)]
pub struct InitializeVestingHalving<'info> {
    /// Vesting PDA — pre-allocated by frontend via SystemProgram::createAccount
    #[account(
        init_if_needed,
        payer = payer,
        space = 8 + 32 + 32 + 8 + 4 + 8 + 1 + 8 + 8 + 8 + 1 + 1,
        seeds = [b"vesting_halving", token_mint.key().as_ref()],
        bump
    )]
    pub vesting_halving: Account<'info, VestingHalvingConfig>,
    pub token_mint: Account<'info, Mint>,
    /// Vault ATA — pre-created by frontend
    #[account(
        mut,
        associated_token::mint = token_mint,
        associated_token::authority = vesting_halving,
    )]
    pub vault_token_account: Account<'info, TokenAccount>,
    /// CHECK: Beneficiary
    pub beneficiary: AccountInfo<'info>,
    #[account(mut)]
    pub payer: Signer<'info>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct FundVault<'info> {
    #[account(
        mut,
        seeds = [b"vesting_halving", vesting_halving.token_mint.as_ref()],
        bump = vesting_halving.bump,
    )]
    pub vesting_halving: Account<'info, VestingHalvingConfig>,
    #[account(mut)]
    pub token_mint: Account<'info, Mint>,
    #[account(mut)]
    pub vault_token_account: Account<'info, TokenAccount>,
    pub mint_authority: Signer<'info>,
    pub token_program: Program<'info, Token>,
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
    pub beneficiary: Pubkey,
    pub token_mint: Pubkey,
    pub initial_supply: u64,
    pub current_period: u32,
    pub period_supply: u64,
    pub claimed_this_period: bool,
    pub total_claimed: u64,
    pub start_time: i64,
    pub halving_interval: i64,
    pub bump: u8,
    pub funded: bool,
}

#[error_code]
pub enum VestingHalvingError {
    #[msg("Invalid supply")]
    InvalidSupply,
    #[msg("Invalid interval")]
    InvalidInterval,
    #[msg("Period not unlocked")]
    PeriodNotUnlocked,
    #[msg("All periods claimed")]
    AllPeriodsClaimed,
    #[msg("Arithmetic overflow")]
    Overflow,
    #[msg("Already funded")]
    AlreadyFunded,
    #[msg("Not funded yet")]
    NotFunded,
}

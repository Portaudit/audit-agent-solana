use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

declare_id!("QZcT1TGL1jePJumCEhbqpw9QD8F4svxQRPjWSUbhZHh");

/// Protocol fee: 200 bps = 2%, taken only on successful settlement.
pub const FEE_BPS: u64 = 200;
/// Protocol treasury. Hardcoded so clients can never redirect fees.
pub const FEE_WALLET: Pubkey = pubkey!("6qz9eLcCJgeMHraij2Dtkqoz2EZQaDvE4Jfh5sSjokaB");
/// Treasury devnet USDC ATA (hardcoded, computed off-chain).
pub const FEE_USDC_ATA: Pubkey = pubkey!("9FQzaKqtPccfgnj8GJi5DMuWn1Zezz37PAQfgP9JxaRZ");

#[program]
pub mod agent_payrails {
    use super::*;

    pub fn create_task(
        ctx: Context<CreateTask>,
        task_hash: String,
        agent_wallet: Pubkey,
        amount: u64,
    ) -> Result<()> {
        let escrow = &mut ctx.accounts.escrow;
        escrow.user = ctx.accounts.user.key();
        escrow.agent_wallet = agent_wallet;
        escrow.task_hash = task_hash;
        escrow.status = TaskStatus::Pending;
        escrow.amount = amount;
        escrow.is_usdc = false;

        let ix = anchor_lang::solana_program::system_instruction::transfer(
            &ctx.accounts.user.key(),
            &escrow.key(),
            amount,
        );
        anchor_lang::solana_program::program::invoke(
            &ix,
            &[
                ctx.accounts.user.to_account_info(),
                escrow.to_account_info(),
                ctx.accounts.system_program.to_account_info(),
            ],
        )?;
        Ok(())
    }

    pub fn create_task_usdc(
        ctx: Context<CreateTaskUsdc>,
        task_hash: String,
        agent_wallet: Pubkey,
        amount: u64,
    ) -> Result<()> {
        let escrow = &mut ctx.accounts.escrow;
        escrow.user = ctx.accounts.user.key();
        escrow.agent_wallet = agent_wallet;
        escrow.task_hash = task_hash;
        escrow.status = TaskStatus::Pending;
        escrow.amount = amount;
        escrow.is_usdc = true;

        let cpi_accounts = Transfer {
            from: ctx.accounts.user_token_account.to_account_info(),
            to: ctx.accounts.escrow_token_account.to_account_info(),
            authority: ctx.accounts.user.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.key();
        let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
        token::transfer(cpi_ctx, amount)?;
        Ok(())
    }

    pub fn resolve_task(ctx: Context<ResolveTask>, success: bool) -> Result<()> {
        let escrow = &mut ctx.accounts.escrow;
        require!(escrow.status == TaskStatus::Pending, ErrorCode::TaskAlreadyResolved);
        require!(!escrow.is_usdc, ErrorCode::InvalidPaymentMethod);
        
        let amount = escrow.amount;
        escrow.status = if success { TaskStatus::Completed } else { TaskStatus::Refunded };

        if success {
            let fee = amount
                .checked_mul(FEE_BPS)
                .ok_or(error!(ErrorCode::MathOverflow))?
                / 10_000;
            let agent_cut = amount - fee;
            **escrow.to_account_info().try_borrow_mut_lamports()? -= fee;
            **ctx.accounts.fee_wallet.to_account_info().try_borrow_mut_lamports()? += fee;
            **escrow.to_account_info().try_borrow_mut_lamports()? -= agent_cut;
            **ctx.accounts.agent_wallet.to_account_info().try_borrow_mut_lamports()? += agent_cut;
        } else {
            **escrow.to_account_info().try_borrow_mut_lamports()? -= amount;
            **ctx.accounts.user.to_account_info().try_borrow_mut_lamports()? += amount;
        }
        Ok(())
    }

    pub fn resolve_task_usdc(ctx: Context<ResolveTaskUsdc>, success: bool) -> Result<()> {
        let escrow = &mut ctx.accounts.escrow;
        require!(escrow.status == TaskStatus::Pending, ErrorCode::TaskAlreadyResolved);
        require!(escrow.is_usdc, ErrorCode::InvalidPaymentMethod);
        
        let amount = escrow.amount;
        escrow.status = if success { TaskStatus::Completed } else { TaskStatus::Refunded };

        let user_key = escrow.user;
        let bump = ctx.bumps.escrow;
        let signer_seeds: &[&[&[u8]]] = &[&[b"escrow", user_key.as_ref(), &[bump]]];

        if success {
            let fee = amount
                .checked_mul(FEE_BPS)
                .ok_or(error!(ErrorCode::MathOverflow))?
                / 10_000;
            let agent_cut = amount - fee;

            let fee_xfer = Transfer {
                from: ctx.accounts.escrow_token_account.to_account_info(),
                to: ctx.accounts.fee_token_account.to_account_info(),
                authority: escrow.to_account_info(),
            };
            token::transfer(
                CpiContext::new_with_signer(ctx.accounts.token_program.key(), fee_xfer, signer_seeds),
                fee,
            )?;

            let agent_xfer = Transfer {
                from: ctx.accounts.escrow_token_account.to_account_info(),
                to: ctx.accounts.agent_token_account.to_account_info(),
                authority: escrow.to_account_info(),
            };
            token::transfer(
                CpiContext::new_with_signer(ctx.accounts.token_program.key(), agent_xfer, signer_seeds),
                agent_cut,
            )?;
        } else {
            let refund_xfer = Transfer {
                from: ctx.accounts.escrow_token_account.to_account_info(),
                to: ctx.accounts.user_token_account.to_account_info(),
                authority: escrow.to_account_info(),
            };
            token::transfer(
                CpiContext::new_with_signer(ctx.accounts.token_program.key(), refund_xfer, signer_seeds),
                amount,
            )?;
        }
        Ok(())
    }

    pub fn cancel_task(ctx: Context<CancelTask>) -> Result<()> {
        let escrow = &mut ctx.accounts.escrow;
        require!(escrow.status == TaskStatus::Pending, ErrorCode::TaskAlreadyResolved);
        require!(!escrow.is_usdc, ErrorCode::InvalidPaymentMethod);
        
        let amount = escrow.amount;
        escrow.status = TaskStatus::Refunded;

        **escrow.to_account_info().try_borrow_mut_lamports()? -= amount;
        **ctx.accounts.user.to_account_info().try_borrow_mut_lamports()? += amount;
        Ok(())
    }

    pub fn cancel_task_usdc(ctx: Context<CancelTaskUsdc>) -> Result<()> {
        let escrow = &mut ctx.accounts.escrow;
        require!(escrow.status == TaskStatus::Pending, ErrorCode::TaskAlreadyResolved);
        require!(escrow.is_usdc, ErrorCode::InvalidPaymentMethod);
        
        let amount = escrow.amount;
        escrow.status = TaskStatus::Refunded;

        let user_key = escrow.user;
        let bump = ctx.bumps.escrow;
        let signer_seeds: &[&[&[u8]]] = &[&[b"escrow", user_key.as_ref(), &[bump]]];

        let cpi_accounts = Transfer {
            from: ctx.accounts.escrow_token_account.to_account_info(),
            to: ctx.accounts.user_token_account.to_account_info(),
            authority: escrow.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.key();
        let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, signer_seeds);
        token::transfer(cpi_ctx, amount)?;
        Ok(())
    }
}

#[account]
pub struct TaskEscrow {
    pub user: Pubkey,
    pub agent_wallet: Pubkey,
    pub task_hash: String,
    pub status: TaskStatus,
    pub amount: u64,
    pub is_usdc: bool,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum TaskStatus { Pending, Completed, Refunded }

#[derive(Accounts)]
pub struct CreateTask<'info> {
    #[account(
        init, payer = user,
        space = 8 + 32 + 32 + (4 + 64) + 1 + 8 + 1,
        seeds = [b"escrow", user.key().as_ref()], bump
    )]
    pub escrow: Account<'info, TaskEscrow>,
    #[account(mut)]
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CreateTaskUsdc<'info> {
    #[account(
        init, payer = user,
        space = 8 + 32 + 32 + (4 + 64) + 1 + 8 + 1,
        seeds = [b"escrow", user.key().as_ref()], bump
    )]
    pub escrow: Account<'info, TaskEscrow>,
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(mut)]
    pub user_token_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub escrow_token_account: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ResolveTask<'info> {
    #[account(
        mut,
        close = user,
        seeds = [b"escrow", escrow.user.as_ref()], bump
    )]
    pub escrow: Account<'info, TaskEscrow>,
    pub orchestrator: Signer<'info>,
    #[account(mut)]
    pub user: SystemAccount<'info>,
    #[account(mut)]
    pub agent_wallet: SystemAccount<'info>,
    #[account(mut, address = FEE_WALLET)]
    pub fee_wallet: SystemAccount<'info>,
}

#[derive(Accounts)]
pub struct ResolveTaskUsdc<'info> {
    #[account(
        mut,
        close = user,
        seeds = [b"escrow", escrow.user.as_ref()], bump
    )]
    pub escrow: Account<'info, TaskEscrow>,
    pub orchestrator: Signer<'info>,
    #[account(mut)]
    pub user: SystemAccount<'info>,
    #[account(mut)]
    pub agent_wallet: SystemAccount<'info>,
    #[account(mut)]
    pub user_token_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub agent_token_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub escrow_token_account: Account<'info, TokenAccount>,
    #[account(mut, address = FEE_USDC_ATA)]
    pub fee_token_account: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct CancelTask<'info> {
    #[account(
        mut,
        close = user,
        seeds = [b"escrow", escrow.user.as_ref()], bump,
        has_one = user,
    )]
    pub escrow: Account<'info, TaskEscrow>,
    #[account(mut)]
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CancelTaskUsdc<'info> {
    #[account(
        mut,
        close = user,
        seeds = [b"escrow", escrow.user.as_ref()], bump,
        has_one = user,
    )]
    pub escrow: Account<'info, TaskEscrow>,
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(mut)]
    pub user_token_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub escrow_token_account: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[error_code]
pub enum ErrorCode {
    #[msg("This task has already been resolved.")]
    TaskAlreadyResolved,
    #[msg("Invalid payment method for this instruction.")]
    InvalidPaymentMethod,
    #[msg("Math overflow in fee calculation.")]
    MathOverflow,
}

use anchor_lang::prelude::*;
use anchor_lang::solana_program::program::invoke;
use anchor_lang::solana_program::system_instruction;

declare_id!("QZcT1TGL1jePJumCEhbqpw9QD8F4svxQRPjWSUbhZHh");

#[program]
pub mod agent_payrails {
    use super::*;

    pub fn create_task(
        ctx: Context<CreateTask>, 
        task_hash: String, 
        agent_wallet: Pubkey,
        amount: u64
    ) -> Result<()> {
        let escrow = &mut ctx.accounts.escrow;
        escrow.user = ctx.accounts.user.key();
        escrow.agent_wallet = agent_wallet;
        escrow.task_hash = task_hash;
        escrow.status = TaskStatus::Pending;
        escrow.amount = amount;

        let transfer_ix = system_instruction::transfer(
            &ctx.accounts.user.key(),
            &escrow.key(),
            amount,
        );
        invoke(
            &transfer_ix,
            &[
                ctx.accounts.user.to_account_info(),
                escrow.to_account_info(),
                ctx.accounts.system_program.to_account_info(),
            ],
        )?;
        Ok(())
    }

    pub fn resolve_task(
        ctx: Context<ResolveTask>, 
        success: bool
    ) -> Result<()> {
        let escrow = &mut ctx.accounts.escrow;
        require!(escrow.status == TaskStatus::Pending, ErrorCode::TaskAlreadyResolved);

        let amount = escrow.amount;
        let destination = if success {
            escrow.status = TaskStatus::Completed;
            ctx.accounts.agent_wallet.to_account_info()
        } else {
            escrow.status = TaskStatus::Refunded;
            ctx.accounts.user.to_account_info()
        };

        **escrow.to_account_info().try_borrow_mut_lamports()? -= amount;
        **destination.try_borrow_mut_lamports()? += amount;
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
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum TaskStatus { Pending, Completed, Refunded }

#[derive(Accounts)]
pub struct CreateTask<'info> {
    #[account(
        init, payer = user, 
        space = 8 + 32 + 32 + (4 + 64) + 1 + 8, 
        seeds = [b"escrow", user.key().as_ref()], bump
    )]
    pub escrow: Account<'info, TaskEscrow>,
    #[account(mut)]
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ResolveTask<'info> {
    #[account(
        mut, 
        close = user, // <--- MAGIC: Closes account and returns rent to user after execution
        seeds = [b"escrow", escrow.user.as_ref()], bump
    )]
    pub escrow: Account<'info, TaskEscrow>,
    #[account(mut)]
    pub orchestrator: Signer<'info>,
    #[account(mut)]
    pub user: SystemAccount<'info>,
    #[account(mut)]
    pub agent_wallet: SystemAccount<'info>,
}

#[error_code]
pub enum ErrorCode {
    #[msg("This task has already been resolved.")]
    TaskAlreadyResolved,
}

use anchor_lang::prelude::*;

pub mod error;
pub mod state;

use error::AttestationError;
use state::*;

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod attestations {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        let config = &mut ctx.accounts.config;
        config.admin = ctx.accounts.admin.key();
        config.max_validity_secs = 30 * 24 * 60 * 60; // 30 days default
        config.spec_version = 1;
        Ok(())
    }

    pub fn create_attestation(
        ctx: Context<CreateAttestation>,
        attestation_id: [u8; 32],
        benchmark_run_hash: [u8; 32],
        kpi_aggregate_hash: [u8; 32],
        valid_from: u64,
        valid_until: u64,
        category: u8,
        spec_version: u8,
    ) -> Result<()> {
        let config = &ctx.accounts.config;
        require!(ctx.accounts.harness_signer.is_signer, AttestationError::InvalidSigner);
        require!(valid_until > valid_from, AttestationError::InvalidValidityWindow);
        require!(
            valid_until.saturating_sub(valid_from) <= config.max_validity_secs,
            AttestationError::ValidityWindowTooLong
        );

        let attestation = &mut ctx.accounts.attestation;
        attestation.attestation_id = attestation_id;
        attestation.benchmark_run_hash = benchmark_run_hash;
        attestation.kpi_aggregate_hash = kpi_aggregate_hash;
        attestation.valid_from = valid_from;
        attestation.valid_until = valid_until;
        attestation.harness_signer = ctx.accounts.harness_signer.key();
        attestation.category = category;
        attestation.spec_version = spec_version;
        attestation.revoked = false;

        emit!(AttestationCreated {
            attestation_id,
            harness_signer: ctx.accounts.harness_signer.key(),
            benchmark_run_hash,
            category,
            valid_from,
            valid_until,
        });

        Ok(())
    }

    pub fn revoke_attestation(ctx: Context<RevokeAttestation>) -> Result<()> {
        let attestation = &mut ctx.accounts.attestation;
        require!(!attestation.revoked, AttestationError::AlreadyRevoked);
        require!(
            ctx.accounts.authority.key() == attestation.harness_signer
                || ctx.accounts.authority.key() == ctx.accounts.config.admin,
            AttestationError::UnauthorizedRevoke
        );

        attestation.revoked = true;

        emit!(AttestationRevoked {
            attestation_id: attestation.attestation_id,
        });

        Ok(())
    }

    pub fn update_provider_profile(
        ctx: Context<UpdateProviderProfile>,
        provider_id: [u8; 32],
        chain_id: u64,
        region: [u8; 16],
        new_attestation_hash: [u8; 32],
        rolling_p99: u64,
        rolling_success_ratio: u64,
    ) -> Result<()> {
        let config = &ctx.accounts.config;
        require!(
            ctx.accounts.updater.key() == config.admin,
            AttestationError::UnauthorizedUpdater
        );

        let profile = &mut ctx.accounts.profile;
        profile.provider_id = provider_id;
        profile.chain_id = chain_id;
        profile.region = region;

        // Rotate last attestations (keep last 10)
        if profile.last_attestations.len() >= 10 {
            profile.last_attestations.remove(0);
        }
        profile.last_attestations.push(new_attestation_hash);

        profile.rolling_p99 = rolling_p99;
        profile.rolling_success_ratio = rolling_success_ratio;
        profile.last_updated_slot = Clock::get()?.slot;

        emit!(ProviderProfileUpdated {
            provider_id,
            chain_id,
            region,
        });

        Ok(())
    }

    pub fn update_config(
        ctx: Context<UpdateConfig>,
        new_admin: Option<Pubkey>,
        new_max_validity_secs: Option<u64>,
        new_spec_version: Option<u8>,
    ) -> Result<()> {
        let config = &mut ctx.accounts.config;
        require!(
            ctx.accounts.admin.key() == config.admin,
            AttestationError::UnauthorizedAdmin
        );

        if let Some(admin) = new_admin {
            config.admin = admin;
        }
        if let Some(max_validity_secs) = new_max_validity_secs {
            config.max_validity_secs = max_validity_secs;
        }
        if let Some(spec_version) = new_spec_version {
            config.spec_version = spec_version;
        }

        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(init, payer = admin, space = 8 + Config::SIZE)]
    pub config: Account<'info, Config>,
    #[account(mut)]
    pub admin: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CreateAttestation<'info> {
    #[account(
        init,
        payer = harness_signer,
        space = 8 + Attestation::SIZE,
        seeds = [b"attestation", harness_signer.key().as_ref(), attestation_id.as_ref()],
        bump
    )]
    pub attestation: Account<'info, Attestation>,
    #[account(mut)]
    pub harness_signer: Signer<'info>,
    pub config: Account<'info, Config>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct RevokeAttestation<'info> {
    #[account(mut)]
    pub attestation: Account<'info, Attestation>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub config: Account<'info, Config>,
}

#[derive(Accounts)]
pub struct UpdateProviderProfile<'info> {
    #[account(
        init_if_needed,
        payer = updater,
        space = 8 + ProviderProfile::SIZE,
        seeds = [b"provider_profile", provider_id.as_ref(), &chain_id.to_le_bytes(), region.as_ref()],
        bump
    )]
    pub profile: Account<'info, ProviderProfile>,
    #[account(mut)]
    pub updater: Signer<'info>,
    pub config: Account<'info, Config>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdateConfig<'info> {
    #[account(mut)]
    pub config: Account<'info, Config>,
    #[account(mut)]
    pub admin: Signer<'info>,
}

#[event]
pub struct AttestationCreated {
    pub attestation_id: [u8; 32],
    pub harness_signer: Pubkey,
    pub benchmark_run_hash: [u8; 32],
    pub category: u8,
    pub valid_from: u64,
    pub valid_until: u64,
}

#[event]
pub struct AttestationRevoked {
    pub attestation_id: [u8; 32],
}

#[event]
pub struct ProviderProfileUpdated {
    pub provider_id: [u8; 32],
    pub chain_id: u64,
    pub region: [u8; 16],
}

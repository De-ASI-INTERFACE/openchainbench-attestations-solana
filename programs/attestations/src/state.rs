use anchor_lang::prelude::*;

#[account]
pub struct Config {
    pub admin: Pubkey,
    pub max_validity_secs: u64,
    pub spec_version: u8,
    pub _padding: [u8; 7],
}

impl Config {
    pub const SIZE: usize = 32 + 8 + 1 + 7;
}

#[account]
pub struct Attestation {
    pub attestation_id: [u8; 32],
    pub benchmark_run_hash: [u8; 32],
    pub kpi_aggregate_hash: [u8; 32],
    pub valid_from: u64,
    pub valid_until: u64,
    pub harness_signer: Pubkey,
    pub category: u8,
    pub spec_version: u8,
    pub revoked: bool,
    pub _padding: [u8; 6],
}

impl Attestation {
    pub const SIZE: usize = 32 + 32 + 32 + 8 + 8 + 32 + 1 + 1 + 1 + 6;
}

#[account]
pub struct ProviderProfile {
    pub provider_id: [u8; 32],
    pub chain_id: u64,
    pub region: [u8; 16],
    pub last_attestations: Vec<[u8; 32]>,
    pub rolling_p99: u64,
    pub rolling_success_ratio: u64,
    pub last_updated_slot: u64,
}

impl ProviderProfile {
    pub const SIZE: usize = 32 + 8 + 16 + 4 + (10 * 32) + 8 + 8 + 8; // approximate for 10 attestations
}

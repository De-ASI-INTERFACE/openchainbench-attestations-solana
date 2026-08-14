use anchor_lang::prelude::*;

#[error_code]
pub enum AttestationError {
    #[msg("Invalid signer")]
    InvalidSigner,
    #[msg("Invalid validity window")]
    InvalidValidityWindow,
    #[msg("Validity window too long")]
    ValidityWindowTooLong,
    #[msg("Already revoked")]
    AlreadyRevoked,
    #[msg("Unauthorized revoke")]
    UnauthorizedRevoke,
    #[msg("Unauthorized updater")]
    UnauthorizedUpdater,
    #[msg("Unauthorized admin")]
    UnauthorizedAdmin,
    #[msg("Invalid category")]
    InvalidCategory,
}

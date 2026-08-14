# OpenChainBench Attestations (Solana/Anchor)

On-chain performance attestation program for OpenChainBench KPIs on Solana.

## Architecture

- `programs/attestations/` – Anchor program implementing:
  - `create_attestation` – bind harness signer to a benchmark run hash and KPI aggregate hash
  - `revoke_attestation` – revoke an existing attestation
  - `update_provider_profile` – update rolling provider profile
  - `update_config` – admin-only config updates
- `tests/` – Anchor TypeScript integration tests (localnet)
- `scripts/` – CLI to publish attestations from off-chain harnesses

## Accounts

- `Attestation` PDA: `["attestation", harness_signer, attestation_id]`
- `ProviderProfile` PDA: `["provider_profile", provider_id, chain_id, region]`
- `Config` PDA: `["config"]`

## Safety

- No raw metrics or secrets on-chain; only hashes and aggregates
- Time-bound validity windows; revocation supported
- Access control: harness signers, authorized updaters, admin multi-sig

## Deployment

```bash
anchor build
anchor deploy
```

## CLI usage

```bash
npm install
npm run publish-attestation \
  -- --rpc https://... \
  --harness-keypair ~/.config/solana/id.json \
  --run-hash <32-byte-hex> \
  --kpi-hash <32-byte-hex> \
  --valid-from <unix-ts> \
  --valid-until <unix-ts> \
  --category rpc \
  --spec-version 1
```

## License

MIT

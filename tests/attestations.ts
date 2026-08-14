import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Attestations } from "../target/types/attestations";
import { assert } from "chai";

describe("attestations", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = program<Attestations>(provider);
  const admin = provider.wallet;

  const attestationId = anchor.utils.bytes.random(32);
  const benchmarkRunHash = anchor.utils.bytes.random(32);
  const kpiAggregateHash = anchor.utils.bytes.random(32);
  const validFrom = new anchor.BN(Math.floor(Date.now() / 1000));
  const validUntil = new anchor.BN(validFrom.toNumber() + 24 * 60 * 60);
  const category = 0; // rpc
  const specVersion = 1;

  it("Initializes config", async () => {
    await program.methods
      .initialize()
      .accounts({
        config: await get_config_pda(program.provider),
        admin: admin.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    const config = await program.account.config.fetch(await get_config_pda(program.provider));
    assert.ok(config.admin.equals(admin.publicKey));
    assert.ok(config.max_validity_secs.toNumber() === 30 * 24 * 60 * 60);
    assert.strictEqual(config.spec_version, 1);
  });

  it("Creates an attestation", async () => {
    const harnessSigner = anchor.web3.Keypair.generate();
    await provider.connection.requestAirdrop(harnessSigner.publicKey, 1e9);

    const [attestationPda] = await anchor.web3.PublicKey.findProgramAddress(
      [Buffer.from("attestation"), harnessSigner.publicKey.toBuffer(), Buffer.from(attestationId)],
      program.programId
    );

    await program.methods
      .createAttestation(attestationId, benchmarkRunHash, kpiAggregateHash, validFrom, validUntil, category, specVersion)
      .accounts({
        attestation: attestationPda,
        harnessSigner: harnessSigner.publicKey,
        config: await get_config_pda(provider),
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([harnessSigner])
      .rpc();

    const attestation = await program.account.attestation.fetch(attestationPda);
    assert.deepEqual(attestation.attestation_id, attestationId);
    assert.deepEqual(attestation.benchmark_run_hash, benchmarkRunHash);
    assert.deepEqual(attestation.kpi_aggregate_hash, kpiAggregateHash);
    assert.ok(attestation.valid_from.eq(validFrom));
    assert.ok(attestation.valid_until.eq(validUntil));
    assert.strictEqual(attestation.category, category);
    assert.strictEqual(attestation.spec_version, specVersion);
    assert.isFalse(attestation.revoked);
  });

  it("Revokes an attestation", async () => {
    const harnessSigner = anchor.web3.Keypair.generate();
    await provider.connection.requestAirdrop(harnessSigner.publicKey, 1e9);

    const testAttId = anchor.utils.bytes.random(32);
    const [attestationPda] = await anchor.web3.PublicKey.findProgramAddress(
      [Buffer.from("attestation"), harnessSigner.publicKey.toBuffer(), Buffer.from(testAttId)],
      program.programId
    );

    await program.methods
      .createAttestation(testAttId, benchmarkRunHash, kpiAggregateHash, validFrom, validUntil, category, specVersion)
      .accounts({
        attestation: attestationPda,
        harnessSigner: harnessSigner.publicKey,
        config: await get_config_pda(provider),
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([harnessSigner])
      .rpc();

    await program.methods
      .revokeAttestation()
      .accounts({
        attestation: attestationPda,
        authority: harnessSigner.publicKey,
        config: await get_config_pda(provider),
      })
      .signers([harnessSigner])
      .rpc();

    const attestation = await program.account.attestation.fetch(attestationPda);
    assert.isTrue(attestation.revoked);
  });

  it("Updates provider profile", async () => {
    const providerId = anchor.utils.bytes.random(32);
    const chainId = new anchor.BN(8453);
    const region = Buffer.from("us-east-1").slice(0, 16);
    const newAttHash = anchor.utils.bytes.random(32);
    const rollingP99 = new anchor.BN(120); // ms
    const rollingSuccessRatio = new anchor.BN(999_000); // 0.999 scaled

    const [profilePda] = await anchor.web3.PublicKey.findProgramAddress(
      [Buffer.from("provider_profile"), Buffer.from(providerId), chainId.toArrayLike(new Uint8Array, "le", 8), region],
      program.programId
    );

    await program.methods
      .updateProviderProfile(providerId, chainId, region, newAttHash, rollingP99, rollingSuccessRatio)
      .accounts({
        profile: profilePda,
        updater: admin.publicKey,
        config: await get_config_pda(provider),
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    const profile = await program.account.providerProfile.fetch(profilePda);
    assert.deepEqual(profile.provider_id, providerId);
    assert.ok(profile.chain_id.eq(chainId));
    assert.deepEqual(profile.region.slice(0, 9), Buffer.from("us-east-1"));
    assert.ok(profile.rolling_p99.eq(rollingP99));
    assert.ok(profile.rolling_success_ratio.eq(rollingSuccessRatio));
  });
});

async function get_config_pda(provider: anchor.AnchorProvider) {
  const [pda] = await anchor.web3.PublicKey.findProgramAddress(
    [Buffer.from("config")],
    (provider.program as Program<Attestations>).programId
  );
  return pda;
}

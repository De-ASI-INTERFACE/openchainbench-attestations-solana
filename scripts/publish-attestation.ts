#!/usr/bin/env ts-node

/**
 * CLI to publish an OpenChainBench attestation on Solana.
 *
 * Usage:
 *   npx ts-node scripts/publish-attestation.ts \
 *     --rpc https://api.mainnet-beta.solana.com \
 *     --harness-keypair ~/.config/solana/id.json \
 *     --run-hash <32-byte-hex> \
 *     --kpi-hash <32-byte-hex> \
 *     --valid-from <unix-ts> \
 *     --valid-until <unix-ts> \
 *     --category rpc \
 *     --spec-version 1
 */

import { Command } from "commander";
import * as anchor from "@coral-xyz/anchor";
import { Program, AnchorProvider, Wallet } from "@coral-xyz/anchor";
import { Attestations } from "../target/types/attestations";
import { readFileSync } from "fs";
import { resolve } from "path";
import { Keypair } from "@solana/web3.js";

const program = new Command();

program
  .requiredOption("--rpc <url>", "Solana RPC URL")
  .requiredOption("--harness-keypair <path>", "Path to harness keypair JSON")
  .requiredOption("--run-hash <hex>", "Benchmark run hash (32-byte hex)")
  .requiredOption("--kpi-hash <hex>", "KPI aggregate hash (32-byte hex)")
  .requiredOption("--valid-from <ts>", "Valid from (unix timestamp)", parseInt)
  .requiredOption("--valid-until <ts>", "Valid until (unix timestamp)", parseInt)
  .requiredOption("--category <cat>", "Category: rpc|intents|aa")
  .requiredOption("--spec-version <v>", "Spec version", parseInt)
  .option("--attestation-id <hex>", "Optional explicit attestation ID (32-byte hex)");

program.parse(process.argv);
const opts = program.opts();

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
  if (clean.length !== 64) throw new Error("Hex must be 32 bytes (64 chars)");
  const bytes = new Uint8Array(32);
  for (let i = 0; i < 32; i++) bytes[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  return bytes;
}

async function main() {
  const connection = new anchor.web3.Connection(opts.rpc);
  const harnessKeypair = Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(readFileSync(resolve(opts.harnessKeypair), "utf-8")))
  );
  const provider = new AnchorProvider(connection, new Wallet(harnessKeypair), { commitment: "confirmed" });
  anchor.setProvider(provider);

  const attestProgram = anchor.workspace.Attestations as Program<Attestations>;

  const attestationId = opts.attestationId ? hexToBytes(opts.attestationId) : anchor.utils.bytes.random(32);
  const runHash = hexToBytes(opts.runHash);
  const kpiHash = hexToBytes(opts.kpiHash);

  const categoryMap: Record<string, number> = { rpc: 0, intents: 1, aa: 2 };
  const category = categoryMap[opts.category.toLowerCase()];
  if (category === undefined) throw new Error("Invalid category");

  const [attestationPda] = await anchor.web3.PublicKey.findProgramAddress(
    [Buffer.from("attestation"), harnessKeypair.publicKey.toBuffer(), Buffer.from(attestationId)],
    attestProgram.programId
  );

  const configPda = await getConfigPda(attestProgram);

  const tx = await attestProgram.methods
    .createAttestation(
      attestationId,
      Array.from(runHash),
      Array.from(kpiHash),
      new anchor.BN(opts.validFrom),
      new anchor.BN(opts.validUntil),
      category,
      opts.specVersion
    )
    .accounts({
      attestation: attestationPda,
      harnessSigner: harnessKeypair.publicKey,
      config: configPda,
      systemProgram: anchor.web3.SystemProgram.programId,
    })
    .transaction();

  const signature = await anchor.web3.sendAndConfirmTransaction(connection, tx, [harnessKeypair], { commitment: "confirmed" });
  console.log("Attestation published:", {
    attestationId: Buffer.from(attestationId).toString("hex"),
    attestationPda: attestationPda.toBase58(),
    signature,
  });
}

async function getConfigPda(program: Program<Attestations>) {
  const [pda] = await anchor.web3.PublicKey.findProgramAddress([Buffer.from("config")], program.programId);
  return pda;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

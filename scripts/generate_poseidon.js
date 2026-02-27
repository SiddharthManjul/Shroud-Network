#!/usr/bin/env node
/**
 * generate_poseidon.js
 *
 * Generates the deployable Poseidon(2) contract bytecode using circomlibjs and
 * writes it to contracts/src/PoseidonBytecode.txt (raw hex, no 0x prefix).
 *
 * The Deploy.s.sol script reads this file at deploy time via vm.readFile() and
 * deploys it with CREATE.
 *
 * Usage:
 *   node scripts/generate_poseidon.js
 */

const path = require("path");
const fs = require("fs");

async function main() {
  // circomlibjs is installed in the client workspace
  const { poseidonContract } = require(
    path.join(__dirname, "..", "client", "node_modules", "circomlibjs")
  );

  // Generate bytecode for Poseidon with 2 inputs (state width t=3)
  const bytecode = poseidonContract.createCode(2);

  // bytecode is a hex string starting with "0x"
  const hex = bytecode.startsWith("0x") ? bytecode.slice(2) : bytecode;

  // Write as raw binary so Foundry's vm.readFileBinary() gets actual bytecode
  const buf = Buffer.from(hex, "hex");

  const outPath = path.join(
    __dirname,
    "..",
    "contracts",
    "src",
    "PoseidonBytecode.bin"
  );
  fs.writeFileSync(outPath, buf);

  console.log("Poseidon(2) bytecode written to:", outPath);
  console.log("Bytecode size:", buf.length, "bytes");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

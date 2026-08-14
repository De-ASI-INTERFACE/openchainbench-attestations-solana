// Migrations are an early feature. Currently, they're just used to run some
// simple scripts after deployment.

import * as anchor from "@coral-xyz/anchor";

module.exports = async function (provider: anchor.AnchorProvider) {
  // Configure client to use the provider
  anchor.setProvider(provider);

  // Add migration steps here if needed
  console.log("Deploy migrations complete.");
};

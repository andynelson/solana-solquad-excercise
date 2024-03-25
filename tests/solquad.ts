import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import idl from "../target/idl/solquad.json";
import { Solquad } from "../target/idl/solquad";

import { utf8 } from "@coral-xyz/anchor/dist/cjs/utils/bytes";
import { BN } from "bn.js";
import { expect } from "chai";

describe("solquad", async () => {

  const connection = new anchor.web3.Connection("http://localhost:8899", 'confirmed');
  const programId = new anchor.web3.PublicKey("7iKx1QyUrbgDBRnQchsjb439a9cUXapzeRL5sSdaVR2E");

  const admin = anchor.web3.Keypair.generate();
  const admin2 = anchor.web3.Keypair.generate();
  const wallet = new anchor.Wallet(admin);

  const provider = new anchor.AnchorProvider(connection, wallet, {});
  const provider2 = new anchor.AnchorProvider(connection, new anchor.Wallet(admin2), {});
  const program = new Program<Solquad>(idl as Solquad, programId, provider)
  const program2 = new Program<Solquad>(idl as Solquad, programId, provider2)

  const escrowOwner = anchor.web3.Keypair.generate();
  const projectOwner1 = anchor.web3.Keypair.generate();
  const projectOwner2 = anchor.web3.Keypair.generate();
  const projectOwner3 = anchor.web3.Keypair.generate();
  const voter1 = anchor.web3.Keypair.generate();
  const voter2 = anchor.web3.Keypair.generate();
  const voter3 = anchor.web3.Keypair.generate();
  const voter4 = anchor.web3.Keypair.generate();
  const voter5 = anchor.web3.Keypair.generate();
  const voter6 = anchor.web3.Keypair.generate();

  const [escrowPDA] = await anchor.web3.PublicKey.findProgramAddressSync([
    utf8.encode("escrow"),
    admin.publicKey.toBuffer(),
  ],
    program.programId
  );
  console.log("escrowPDA", escrowPDA.toString());

  const [poolPDA] = anchor.web3.PublicKey.findProgramAddressSync([
    utf8.encode("pool"),
    admin.publicKey.toBuffer(),
  ],
    program.programId
  );
  console.log("poolPDA", poolPDA.toString());

  const [projectPDA1] = anchor.web3.PublicKey.findProgramAddressSync([
    utf8.encode("project"),
    poolPDA.toBytes(),
    admin.publicKey.toBuffer(),
  ],
    program.programId
  );
  console.log("projectPDA1", projectPDA1.toString());

  const [differentEscrowPDA] = anchor.web3.PublicKey.findProgramAddressSync([
    utf8.encode("escrow"),
    admin2.publicKey.toBuffer(),
  ],
    program.programId
  );
  console.log("differentEscrowPDA", differentEscrowPDA.toString());

  const [differentPoolPDA] = anchor.web3.PublicKey.findProgramAddressSync([
    utf8.encode("pool"),
    admin2.publicKey.toBuffer()
  ],
    program.programId
  );
  console.log("differentPoolPDA", differentPoolPDA.toString());

  // await airdrop(admin, provider);
  // await airdrop(admin2, provider);

  // dummy test
  it("this is a dummy test", async () => {
    const a = await airdrop(admin, provider);
    const b = await airdrop(admin2, provider);
    expect(1).to.equal(1);
    console.log("dummy test passed");
  });

  // Test 1
  it("initializes escrow and pool", async () => {
    const poolIx = await program.methods.initializePool().accounts({
      poolAccount: poolPDA,
    }).instruction();

    const escrowAndPoolTx = await program.methods.initializeEscrow(new BN(10000)).accounts({
      escrowAccount: escrowPDA,
    })
      .postInstructions([poolIx])
      .rpc()

    console.log("Escrow and Pool are successfully created!", escrowAndPoolTx);

  });

  // Test 2
  it("creates project and add it to the pool", async () => {
    const addProjectIx = await program.methods.addProjectToPool().accounts({
      escrowAccount: escrowPDA,
      poolAccount: poolPDA,
      projectAccount: projectPDA1,
    })
      .instruction();

    const addProjectTx = await program.methods.initializeProject("My Project").accounts({
      projectAccount: projectPDA1,
      poolAccount: poolPDA
    })
      .postInstructions([addProjectIx])
      .rpc();
    console.log("Project successfully created and added to the pool once", addProjectTx);

    const data = await program.account.pool.fetch(poolPDA)
    console.log("data projects", data.projects);
  })

  it("tries to add the project to the same pool again", async () => {
    const addProjectIx = await program.methods.addProjectToPool().accounts({
      escrowAccount: escrowPDA,
      poolAccount: poolPDA,
      projectAccount: projectPDA1,
    })
      .instruction();

    const addProjectTx = await program.methods.initializeProject("My Project").accounts({
      projectAccount: projectPDA1,
      poolAccount: poolPDA
    })
      .postInstructions([addProjectIx])
      .rpc();
    console.log("Project successfully created and added to the pool again", addProjectTx);

  });

  // Test 3
  it("tries to add the project in the different pool", async () => {
    const poolIx = await program2.methods.initializePool().accounts({
      poolAccount: differentPoolPDA,
    }).instruction();

    const escrowIx = await program2.methods.initializeEscrow(new BN(10000)).accounts({
      escrowAccount: differentEscrowPDA,
    })
      .instruction()

    const addProjectTx = await program2.methods.addProjectToPool().accounts({
      projectAccount: projectPDA1,
      poolAccount: differentPoolPDA,
      escrowAccount: differentEscrowPDA
    })
      .preInstructions([escrowIx, poolIx])
      .rpc();

    console.log("Different pool is created and the project is inserted into it", addProjectTx);

    const data = await program.account.pool.fetch(differentPoolPDA)
    console.log("data projects", data.projects);
  });

  // Test 4
  it("votes for the project and distributes the rewards", async () => {
    const distribIx = await program.methods.distributeEscrowAmount().accounts({
      escrowAccount: escrowPDA,
      poolAccount: poolPDA,
      projectAccount: projectPDA1,
    })
      .instruction();

    const voteTx = await program.methods.voteForProject(new BN(10)).accounts({
      poolAccount: poolPDA,
      projectAccount: projectPDA1,
    })
      .postInstructions([distribIx])
      .rpc();

    console.log("Successfully voted on the project and distributed weighted rewards", voteTx);

    const ant = await program.account.project.fetch(projectPDA1)
    console.log("amount", ant.distributedAmt.toString());
  });
});


async function airdrop(user, provider) {
  // const AIRDROP_AMOUNT = anchor.web3.LAMPORTS_PER_SOL; // 5 SOL
  const AIRDROP_AMOUNT = 1000000000; // 1 SOL

  // airdrop to user
  const airdropSignature = await provider.connection.requestAirdrop(
    user.publicKey,
    AIRDROP_AMOUNT
  );
  const { blockhash, lastValidBlockHeight } = await provider.connection.getLatestBlockhash();

  await provider.connection.confirmTransaction({
    blockhash: blockhash,
    lastValidBlockHeight: lastValidBlockHeight,
    signature: airdropSignature,
  });
  console.log(`Airdropped ${AIRDROP_AMOUNT} to ${user.publicKey.toString()}`);

  console.log(`Tx Complete: https://explorer.solana.com/tx/${airdropSignature}?cluster=localnet`)
}

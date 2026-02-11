import { createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia, base } from "viem/chains";
import { CHAIN_ID, BASE_CHAIN_ID, RED_PACKET_CONTRACT } from "./constants";

function getSignerClient() {
  const key = process.env.SIGNER_PRIVATE_KEY;
  if (!key) throw new Error("SIGNER_PRIVATE_KEY not configured");

  const chain = CHAIN_ID === BASE_CHAIN_ID ? base : baseSepolia;
  const account = privateKeyToAccount(`0x${key}` as `0x${string}`);

  return createWalletClient({
    account,
    chain,
    transport: http(),
  });
}

export async function signClaim(
  packetId: number,
  claimer: `0x${string}`,
  twitterUserId: string,
  nonce: bigint
): Promise<`0x${string}`> {
  const client = getSignerClient();

  const signature = await client.signTypedData({
    domain: {
      name: "RedPacket",
      version: "1",
      chainId: CHAIN_ID,
      verifyingContract: RED_PACKET_CONTRACT,
    },
    types: {
      Claim: [
        { name: "packetId", type: "uint256" },
        { name: "claimer", type: "address" },
        { name: "twitterUserId", type: "string" },
        { name: "nonce", type: "uint256" },
      ],
    },
    primaryType: "Claim",
    message: {
      packetId: BigInt(packetId),
      claimer,
      twitterUserId,
      nonce,
    },
  });

  return signature;
}

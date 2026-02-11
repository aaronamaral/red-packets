export const USDC_ADDRESS_BASE_SEPOLIA = "0x036CbD53842c5426634e7929541eC2318f3dCF7e" as const;

export const BASE_CHAIN_ID = 8453;

export const USDC_DECIMALS = 6;

export const RED_PACKET_CONTRACT = process.env.NEXT_PUBLIC_RED_PACKET_CONTRACT as `0x${string}`;
export const USDC_ADDRESS = (process.env.NEXT_PUBLIC_USDC_ADDRESS || USDC_ADDRESS_BASE_SEPOLIA) as `0x${string}`;
export const CHAIN_ID = Number(process.env.NEXT_PUBLIC_CHAIN_ID || 84532);

export const ANTIBOT = {
  MIN_ACCOUNT_AGE_DAYS: 30,
  MIN_FOLLOWERS: 10,
  MAX_CLAIMS_PER_DAY: 10,
} as const;

export const PACKET_LIMITS = {
  MAX_CLAIMS: 200,
  MAX_EXPIRY_HOURS: 24,
  MIN_AMOUNT_PER_CLAIM: 0.01,
  MAX_DEPOSIT: 2000,
} as const;

export const EXPIRY_OPTIONS = [
  { label: "1 hour", hours: 1 },
  { label: "6 hours", hours: 6 },
  { label: "12 hours", hours: 12 },
  { label: "24 hours", hours: 24 },
] as const;

export const USDC_ABI = [
  {
    name: "approve",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ type: "bool" }],
  },
  {
    name: "allowance",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ type: "uint256" }],
  },
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
] as const;

export const RED_PACKET_ABI = [
  {
    name: "createPacket",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "amount", type: "uint256" },
      { name: "totalClaims", type: "uint16" },
      { name: "isRandom", type: "bool" },
      { name: "expiry", type: "uint48" },
    ],
    outputs: [{ name: "packetId", type: "uint256" }],
  },
  {
    name: "claim",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "packetId", type: "uint256" },
      { name: "twitterUserId", type: "string" },
      { name: "nonce", type: "uint256" },
      { name: "signature", type: "bytes" },
    ],
    outputs: [],
  },
  {
    name: "refund",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "packetId", type: "uint256" }],
    outputs: [],
  },
  {
    name: "packets",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "packetId", type: "uint256" }],
    outputs: [
      { name: "creator", type: "address" },
      { name: "totalAmount", type: "uint256" },
      { name: "remainingAmount", type: "uint256" },
      { name: "totalClaims", type: "uint16" },
      { name: "claimedCount", type: "uint16" },
      { name: "expiry", type: "uint48" },
      { name: "isRandom", type: "bool" },
      { name: "refunded", type: "bool" },
    ],
  },
  {
    name: "hasClaimed",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "packetId", type: "uint256" },
      { name: "claimer", type: "address" },
    ],
    outputs: [{ type: "bool" }],
  },
  {
    name: "nextPacketId",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "event",
    name: "PacketCreated",
    inputs: [
      { name: "packetId", type: "uint256", indexed: true },
      { name: "creator", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
      { name: "totalClaims", type: "uint16", indexed: false },
      { name: "isRandom", type: "bool", indexed: false },
      { name: "expiry", type: "uint48", indexed: false },
    ],
  },
  {
    type: "event",
    name: "PacketClaimed",
    inputs: [
      { name: "packetId", type: "uint256", indexed: true },
      { name: "claimer", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
      { name: "claimIndex", type: "uint16", indexed: false },
    ],
  },
] as const;

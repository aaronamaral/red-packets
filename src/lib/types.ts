export interface Packet {
  packetId: number;
  creator: string;
  totalAmount: bigint;
  remainingAmount: bigint;
  totalClaims: number;
  claimedCount: number;
  expiry: number;
  isRandom: boolean;
  refunded: boolean;
}

export interface PacketMetadata {
  id: string;
  packetId: number;
  creatorAddress: string;
  creatorTwitterId: string;
  creatorTwitterHandle: string;
  creatorTwitterAvatar: string | null;
  txHash: string;
  createdAt: string;
}

export interface ClaimRecord {
  id: string;
  packetId: number;
  claimerAddress: string;
  claimerTwitterId: string;
  claimerTwitterHandle: string;
  nonce: string;
  signature: string;
  amount: string | null;
  txHash: string | null;
  claimedAt: string;
}

export interface PacketInfo {
  packetId: number;
  creator: {
    twitterHandle: string;
    twitterAvatar: string | null;
  };
  totalAmount: string;
  totalClaims: number;
  claimedCount: number;
  isRandom: boolean;
  expiry: number;
  isExpired: boolean;
  isFullyClaimed: boolean;
  refunded: boolean;
}

export interface ClaimSignatureResponse {
  signature: string;
  nonce: string;
  twitterUserId: string;
}

export interface AntiBotError {
  error: string;
  reason:
    | "account_too_new"
    | "insufficient_followers"
    | "already_claimed"
    | "rate_limited"
    | "not_following_creator"
    | "not_following_coinbase"
    | "follow_check_failed"
    | "packet_expired"
    | "packet_full";
}

export type SplitType = "equal" | "random";

export interface CreatePacketParams {
  amount: string;
  recipients: number;
  splitType: SplitType;
  expiryHours: number;
}

export type ClaimState =
  | "loading"
  | "sealed"
  | "auth_required"
  | "auth_failed"
  | "connecting_wallet"
  | "ready"
  | "claiming"
  | "opening"
  | "revealed"
  | "already_claimed"
  | "expired"
  | "fully_claimed"
  | "error";

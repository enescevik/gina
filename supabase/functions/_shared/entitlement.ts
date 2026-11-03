export interface SubscriptionUpsert {
  familyId: string;
  purchaserUserId: string | null;
  platform: "apple" | "google";
  productId: string;
  storeKey: string; // Apple originalTransactionId / Google purchaseToken
  status: "active" | "grace" | "on_hold" | "expired" | "revoked";
  expiresAt: string; // ISO
  autoRenewing: boolean;
  raw?: unknown;
}

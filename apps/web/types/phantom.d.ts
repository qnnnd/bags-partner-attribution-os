// Phantom wallet browser injection type (used in login/page.tsx and CampaignTracker.tsx)
interface Window {
  solana?: {
    isPhantom?: boolean;
    connect: () => Promise<{ publicKey: { toString: () => string } }>;
    signMessage: (message: Uint8Array, encoding: string) => Promise<{ signature: Uint8Array }>;
  };
}

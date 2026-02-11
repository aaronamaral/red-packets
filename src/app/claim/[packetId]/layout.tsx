import type { Metadata } from "next";

type Props = {
  params: Promise<{ packetId: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { packetId } = await params;
  const baseUrl = process.env.AUTH_URL || "http://localhost:3000";
  const ogImageUrl = `${baseUrl}/api/og/${packetId}`;

  return {
    title: "Red Packet | Red Packets on Base",
    description: "Open your blessing — claim USDC from this red packet on Base.",
    openGraph: {
      title: "Open your blessing",
      description: "Claim USDC from this red packet on Base.",
      type: "website",
      images: [
        {
          url: ogImageUrl,
          width: 1200,
          height: 675,
          alt: "Red Packet on Base",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: "Open your blessing",
      description: "Claim USDC from this red packet on Base.",
      images: [ogImageUrl],
    },
  };
}

export default function ClaimLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}

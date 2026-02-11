import NextAuth from "next-auth";
import Twitter from "next-auth/providers/twitter";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name: string;
      image: string;
      twitterHandle: string;
      twitterId: string;
      followersCount: number;
      createdAt: string;
    };
  }
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Twitter({
      clientId: process.env.AUTH_TWITTER_ID!,
      clientSecret: process.env.AUTH_TWITTER_SECRET!,
      authorization: {
        url: "https://twitter.com/i/oauth2/authorize",
        params: {
          scope: "users.read tweet.read offline.access",
        },
      },
      userinfo: {
        url: "https://api.twitter.com/2/users/me",
        params: {
          "user.fields": "created_at,public_metrics,profile_image_url",
        },
      },
    }),
  ],
  callbacks: {
    async jwt({ token, account, profile }) {
      if (account && profile) {
        const p = profile as Record<string, unknown>;
        const data = (p.data as Record<string, unknown>) || p;
        if (process.env.NODE_ENV === "development") {
          console.log("[AUTH] Twitter profile received:", JSON.stringify(p, null, 2));
        }
        token.twitterId = (data.id as string) || (p.sub as string) || "";
        token.twitterHandle = (data.username as string) || (p.screen_name as string) || "";
        token.followersCount =
          ((data.public_metrics as Record<string, number>)?.followers_count) || 0;
        token.createdAt = (data.created_at as string) || "";
      }
      return token;
    },
    async session({ session, token }) {
      session.user.twitterId = token.twitterId as string;
      session.user.twitterHandle = token.twitterHandle as string;
      session.user.followersCount = (token.followersCount as number) || 0;
      session.user.createdAt = token.createdAt as string;
      return session;
    },
  },
  pages: {
    signIn: "/",
  },
});

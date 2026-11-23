import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';
import { isAllowedEmail } from '@/lib/server/auth-guard';

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [Google],
  session: { strategy: 'jwt', maxAge: 60 * 60 * 24 * 90 },
  pages: { signIn: '/login', error: '/login' },
  trustHost: true,
  callbacks: {
    signIn({ profile }) {
      return isAllowedEmail(profile?.email, Boolean(profile?.email_verified));
    },
  },
});

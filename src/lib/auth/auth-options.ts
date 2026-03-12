import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import AzureADProvider from 'next-auth/providers/azure-ad';
import bcrypt from 'bcryptjs';
import prisma from '@/lib/prisma';
import { Role } from '@prisma/client';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      role: Role;
      department: string | null;
      employeeId: string | null;
      mustChangePassword: boolean;
      image?: string | null;
    };
  }

  interface User {
    id: string;
    email: string;
    name: string;
    role: Role;
    department: string | null;
    employeeId: string | null;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string;
    role: Role;
    department: string | null;
    employeeId: string | null;
    mustChangePassword: boolean;
  }
}

export const authOptions: NextAuthOptions = {
  // Only use adapter for account linking, not for JWT session management
  session: {
    strategy: 'jwt',
    maxAge: 24 * 60 * 60, // 24 hours
  },
  pages: {
    signIn: '/login',
    error: '/login',
  },
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error('Email and password are required');
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email.toLowerCase() },
        });

        if (!user || !user.password) {
          throw new Error('Invalid email or password');
        }

        if (!user.isActive) {
          throw new Error('Account is deactivated');
        }

        const isPasswordValid = await bcrypt.compare(
          credentials.password,
          user.password
        );

        if (!isPasswordValid) {
          throw new Error('Invalid email or password');
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          department: user.department,
          employeeId: user.employeeId,
          mustChangePassword: user.mustChangePassword,
        };
      },
    }),
    ...(process.env.AZURE_AD_CLIENT_ID && process.env.AZURE_AD_CLIENT_SECRET && process.env.AZURE_AD_TENANT_ID
      ? [AzureADProvider({
          clientId: process.env.AZURE_AD_CLIENT_ID,
          clientSecret: process.env.AZURE_AD_CLIENT_SECRET,
          tenantId: process.env.AZURE_AD_TENANT_ID,
          allowDangerousEmailAccountLinking: true,
          authorization: {
            params: {
              scope: 'openid profile email',
            },
          },
        })]
      : []),
  ],
  callbacks: {
    async signIn({ user, account }) {
      // For OAuth providers, validate and link to existing user
      if (account?.provider === 'azure-ad' && user.email) {
        const existingUser = await prisma.user.findUnique({
          where: { email: user.email.toLowerCase() },
        });
        if (!existingUser) {
          return '/login?error=NoAccount';
        }
        if (!existingUser.isActive) {
          return '/login?error=AccountDeactivated';
        }
        // Link the OAuth account if not already linked
        const existingAccount = await prisma.account.findUnique({
          where: {
            provider_providerAccountId: {
              provider: account.provider,
              providerAccountId: account.providerAccountId,
            },
          },
        });
        if (!existingAccount) {
          await prisma.account.create({
            data: {
              userId: existingUser.id,
              type: account.type,
              provider: account.provider,
              providerAccountId: account.providerAccountId,
              access_token: account.access_token,
              refresh_token: account.refresh_token,
              expires_at: account.expires_at,
              token_type: account.token_type,
              scope: account.scope,
              id_token: account.id_token,
              session_state: account.session_state as string | undefined,
            },
          });
        }
      }
      return true;
    },
    async jwt({ token, user, trigger, session, account }) {
      if (user) {
        // For OAuth logins, look up the full user from DB
        if (account?.provider === 'azure-ad') {
          const dbUser = await prisma.user.findUnique({
            where: { email: user.email!.toLowerCase() },
          });
          if (dbUser) {
            token.id = dbUser.id;
            token.role = dbUser.role;
            token.department = dbUser.department;
            token.employeeId = dbUser.employeeId;
            token.mustChangePassword = dbUser.mustChangePassword;
          }
        } else {
          token.id = user.id;
          token.role = user.role;
          token.department = user.department;
          token.employeeId = user.employeeId;
          token.mustChangePassword = (user as any).mustChangePassword ?? false;
        }
      }

      // Handle session updates
      if (trigger === 'update' && session) {
        token.name = session.name;
        token.department = session.department;
        if (session.mustChangePassword !== undefined) {
          token.mustChangePassword = session.mustChangePassword;
        }
      }

      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id;
        session.user.role = token.role;
        session.user.department = token.department;
        session.user.employeeId = token.employeeId;
        session.user.mustChangePassword = token.mustChangePassword ?? false;
      }
      return session;
    },
  },
  events: {
    async signIn({ user }) {
      // Logged for audit
    },
  },
  debug: false,
};

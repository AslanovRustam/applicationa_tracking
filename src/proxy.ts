import { NextResponse, type NextFetchEvent, type NextRequest } from 'next/server';
import { auth } from '@/auth';
import { isAuthDisabled } from '@/lib/server/auth-guard';

const authProxy = auth((req) => {
  if (!req.auth?.user) {
    return NextResponse.redirect(new URL('/login', req.nextUrl));
  }
});

export default function proxy(req: NextRequest, event: NextFetchEvent) {
  if (isAuthDisabled()) return NextResponse.next();
  return authProxy(req, event as never);
}

export const config = {
  matcher: [
    '/((?!api/auth|login|_next/static|_next/image|favicon.ico|manifest.webmanifest|icon-192.png|icon-512.png|apple-touch-icon.png).*)',
  ],
};

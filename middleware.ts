import { getToken } from 'next-auth/jwt';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// /tournoi : page publique en direct des tournois (horaire + classement, lien envoyé aux joueurs)
// /analyse : outil public d'analyse de portefeuille (constats, sans auth) + ses routes API
// ⚠ ATTENTION : la comparaison est un startsWith — un préfixe rend TOUTE son
// arborescence publique. « /api/portfolio » ouvre donc aussi /api/portfolio/*.
// Avant d'ajouter une entrée ici, vérifier ce qu'elle expose vraiment.
// RETIRÉ le 4 août 2026 : '/api/setup' — route de bootstrap qui créait un compte
// admin avec un mot de passe EN DUR et divulguait le courriel de l'admin à un
// appelant anonyme. La route est supprimée du dépôt.
// RETIRÉ le 4 août 2026 : '/api/test-email' — permettait d'envoyer des courriels
// sans authentification.
const publicPaths = ['/login', '/api/auth', '/api/cron', '/api/team-profile/public', '/api/events', '/api/portfolio', '/api/tool-feedback', '/tournoi', '/analyse', '/api/diagnostic', '/api/fonds', '/api/rapport', '/api/transmission'];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public paths
  if (publicPaths.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Allow static files and Next.js internals
  if (pathname.startsWith('/_next') || pathname.startsWith('/favicon') || pathname.includes('.')) {
    return NextResponse.next();
  }

  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });

  if (!token) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Force password change — only allow change-password page and auth API
  if (token.mustChangePassword && pathname !== '/change-password') {
    return NextResponse.redirect(new URL('/change-password', request.url));
  }

  // Admin-only routes
  if (pathname.startsWith('/admin') && token.role !== 'admin') {
    return NextResponse.redirect(new URL('/', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};

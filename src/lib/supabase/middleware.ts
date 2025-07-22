import { createServerClient } from '@supabase/ssr';
import { type NextRequest, NextResponse } from 'next/server';

export const updateSession = async (req: NextRequest) => {
  let res = NextResponse.next({
    request: {
      headers: req.headers,
    },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => req.cookies.getAll(),
        setAll: (all) =>
          all.forEach(({ name, value, options }) => {
            res.cookies.set(name, value, options);
          }),
      },
    },
  );

  const { data: { user } } = await supabase.auth.getUser();

  // 보호된 라우트 정의
  const protectedRoutes = ['/dashboard', '/profile', '/settings'];
  const authRoutes = ['/login', '/signup', '/forgot-password'];
  
  const { pathname } = req.nextUrl;

  // 보호된 라우트에 인증되지 않은 사용자가 접근하는 경우
  if (protectedRoutes.some(route => pathname.startsWith(route)) && !user) {
    const redirectUrl = new URL('/login', req.url);
    redirectUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(redirectUrl);
  }

  // 인증된 사용자가 auth 페이지에 접근하는 경우
  if (authRoutes.some(route => pathname.startsWith(route)) && user) {
    return NextResponse.redirect(new URL('/dashboard', req.url));
  }

  return res;
};

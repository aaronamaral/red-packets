import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// OFAC sanctioned countries (ISO 3166-1 alpha-2)
const BLOCKED_COUNTRIES = new Set([
  "CU", // Cuba
  "IR", // Iran
  "KP", // North Korea
  "SY", // Syria
  "RU", // Russia
]);

export function middleware(request: NextRequest) {
  // Vercel provides this header automatically at the edge
  const country = request.headers.get("x-vercel-ip-country");

  // Skip check if no country header (localhost/dev) or if it's an allowed country
  if (!country || !BLOCKED_COUNTRIES.has(country)) {
    return NextResponse.next();
  }

  // Return 403 for sanctioned countries
  return new NextResponse(
    `<!DOCTYPE html>
<html>
<head><title>Access Restricted</title></head>
<body style="background:#1a0808;color:#FFF8E7;font-family:sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;">
  <div style="text-align:center;max-width:400px;padding:2rem;">
    <h1 style="font-size:1.5rem;margin-bottom:1rem;">Access Restricted</h1>
    <p style="color:rgba(255,248,231,0.6);font-size:0.875rem;">
      This service is not available in your region due to regulatory requirements.
    </p>
  </div>
</body>
</html>`,
    {
      status: 403,
      headers: { "Content-Type": "text/html" },
    }
  );
}

export const config = {
  // Run on all routes except static assets and api/auth (needed for OAuth callbacks)
  matcher: ["/((?!_next/static|_next/image|images|favicon.ico|api/auth).*)"],
};

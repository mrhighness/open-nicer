/** Security headers for dev server and static hosting (_headers). */

import { buildConnectSrcDirective } from "./csp";



export function getSecurityHeaders(supabaseOrigin?: string): Record<string, string> {

  const connectSrc = buildConnectSrcDirective(supabaseOrigin);



  const csp = [

    "default-src 'self'",

    "script-src 'self' 'unsafe-inline'",

    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",

    "font-src 'self' https://fonts.gstatic.com",

    `connect-src ${connectSrc}`,

    "img-src 'self' data: blob: https:",

    "media-src 'self' blob: https:",

    "frame-ancestors 'none'",

    "base-uri 'self'",

    "form-action 'self'",

  ].join("; ");



  return {

    "X-Content-Type-Options": "nosniff",

    "X-Frame-Options": "DENY",

    "Referrer-Policy": "strict-origin-when-cross-origin",

    "Permissions-Policy": "camera=(self), microphone=(self), geolocation=()",

    "Content-Security-Policy": csp,

  };

}


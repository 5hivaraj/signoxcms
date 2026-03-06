import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "SignoX - Digital Signage CMS",
  description: "Multi-tenant digital signage content management system",
  // Disable PWA features that might trigger notifications
  manifest: undefined,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        {/* Mobile viewport configuration */}
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0, user-scalable=yes" />
        {/* Disable notification permissions and PWA features */}
        <meta name="mobile-web-app-capable" content="no" />
        <meta name="apple-mobile-web-app-capable" content="no" />
        <meta name="msapplication-notification" content="frequency=never" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              // Disable all notification APIs
              if (typeof window !== 'undefined') {
                // Override Notification API
                if ('Notification' in window) {
                  window.Notification = undefined;
                }
                
                // Override service worker registration
                if ('serviceWorker' in navigator) {
                  navigator.serviceWorker = undefined;
                }
                
                // Override push manager
                if ('PushManager' in window) {
                  window.PushManager = undefined;
                }
                
                // Disable notification permission requests
                if (navigator.permissions) {
                  const originalQuery = navigator.permissions.query;
                  navigator.permissions.query = function(permissionDesc) {
                    if (permissionDesc.name === 'notifications' || permissionDesc.name === 'push') {
                      return Promise.resolve({ state: 'denied' });
                    }
                    return originalQuery.call(this, permissionDesc);
                  };
                }

                // Hide Next.js development indicators (including the circular N dev tools logo)
                function hideNextJSIndicators() {
                  const selectors = [
                    '[data-nextjs-build-indicator]',
                    '[data-nextjs-toast]',
                    '[data-nextjs-toast-root]',
                    '[id^="__nextjs"]',
                    '[class*="nextjs-toast"]',
                    '[class*="__nextjs-toast"]',
                    '[data-nextjs-dialog]',
                    '[data-nextjs-dialog-overlay]',
                    '[data-nextjs-portal]',
                    'button[aria-label*="Next.js"]',
                    'div[role="dialog"][data-nextjs]',
                    '.__next-build-watcher',
                    '.__nextjs_original-stack-frame',
                    '[data-nextjs-dev-indicator]',
                    '[class*="devtools-indicator"]',
                    '[class*="dev-indicator"]',
                    'a[href*="nextjs"]',
                    'iframe[title*="Next"]'
                  ];
                  
                  selectors.forEach(selector => {
                    try {
                      document.querySelectorAll(selector).forEach(el => {
                        el.style.cssText = 'display: none !important; visibility: hidden !important; opacity: 0 !important; pointer-events: none !important; position: absolute !important; left: -9999px !important; top: -9999px !important;';
                      });
                    } catch (e) {}
                  });

                  // Hide fixed bottom-right / bottom-left dev indicator (circular N logo)
                  document.querySelectorAll('div[style*="position: fixed"], button[style*="position: fixed"], a[style*="position: fixed"]').forEach(el => {
                    const style = (el.getAttribute('style') || '').toLowerCase();
                    const isBottom = style.includes('bottom');
                    const highZ = (el.getAttribute('style') || '').includes('z-index') && parseInt((el.getAttribute('style') || '').match(/z-index:\\s*(\\d+)/)?.[1] || '0', 10) > 9000;
                    if (isBottom && (highZ || style.includes('9999') || style.includes('99999'))) {
                      el.style.cssText = 'display: none !important; visibility: hidden !important; opacity: 0 !important; pointer-events: none !important;';
                    }
                  });

                  // Also hide any fixed positioned elements that look like Next.js indicators
                  document.querySelectorAll('div[style*="position: fixed"][style*="z-index: 9999"]').forEach(el => {
                    const style = el.getAttribute('style') || '';
                    if (style.includes('background') && (style.includes('rgb(239, 68, 68)') || style.includes('#ef4444') || style.includes('bottom: 16px'))) {
                      el.style.cssText = 'display: none !important; visibility: hidden !important; opacity: 0 !important; pointer-events: none !important;';
                    }
                  });
                }

                // Run immediately and then periodically
                hideNextJSIndicators();
                setInterval(hideNextJSIndicators, 100);

                // Also run on DOM changes
                if (typeof MutationObserver !== 'undefined') {
                  const observer = new MutationObserver(hideNextJSIndicators);
			if (document.body) {
 			 observer.observe(document.body, { childList: true, subtree: true });
		}
              }
            `,
          }}
        />
      </head>
      <body className={inter.className}>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}

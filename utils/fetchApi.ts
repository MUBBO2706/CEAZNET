export async function fetchApi(url: string, options: RequestInit = {}) {
  // Only include credentials for same-origin or relative URLs to avoid CORS failure with third-party APIs
  let isSameOrigin = true;
  if (url.startsWith('http://') || url.startsWith('https://')) {
    if (typeof window !== 'undefined') {
      try {
        const parsed = new URL(url);
        isSameOrigin = parsed.origin === window.location.origin;
      } catch {
        isSameOrigin = false;
      }
    } else {
      isSameOrigin = false;
    }
  }

  const mergedOptions: RequestInit = {
    ...options,
    ...(isSameOrigin && !options.credentials ? { credentials: 'include' as RequestCredentials } : {}),
  };
  
  try {
    const response = await fetch(url, mergedOptions);
    
    if (response.ok && isSameOrigin) {
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('text/html')) {
        // AI Studio proxy interception detected!
        // The proxy returned __cookie_check.html instead of JSON.
        if (typeof window !== 'undefined') {
          const reloadCount = parseInt(sessionStorage.getItem('proxy_reload_count') || '0');
          if (reloadCount < 3) {
            sessionStorage.setItem('proxy_reload_count', (reloadCount + 1).toString());
            console.warn(`[Proxy Interception] API request to ${url} intercepted. Reloading page to restore session... (Attempt ${reloadCount + 1})`);
            window.location.reload();
            return new Promise<Response>(() => {});
          } else {
            console.error(`[Proxy Interception] Failed to restore session after 3 reloads.`);
            // Reset counter for future manual reloads
            sessionStorage.setItem('proxy_reload_count', '0');
          }
        }
        throw new Error(`Proxy Interception (HTML returned for API request): ${url}`);
      }
      
      // If successful JSON, reset the reload counter
      if (typeof window !== 'undefined') {
          sessionStorage.removeItem('proxy_reload_count');
      }
    }
    
    return response;
  } catch (error: any) {
    throw error;
  }
}

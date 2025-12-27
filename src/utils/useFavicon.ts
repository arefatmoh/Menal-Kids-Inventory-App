import { useEffect } from 'react';

export function useFavicon() {
  useEffect(() => {
    const url = "https://hnmcacgtgnofatbjxtox.supabase.co/storage/v1/object/public/Menal/menal%20kids.png";

    // Update favicon
    let link = document.querySelector<HTMLLinkElement>("link[rel~='icon']");
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }
    link.href = url;

    // No remediation needed for dynamic URL as it's a fixed remote asset
  }, []);
}


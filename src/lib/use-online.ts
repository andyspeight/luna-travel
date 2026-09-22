'use client';

import { useEffect, useState } from 'react';

/**
 * Whether the phone has a connection.
 *
 * Starts optimistic. Server-rendered HTML has no navigator, and a screen that
 * flashed "Offline" on every first paint would teach travellers to ignore the
 * word on the one day it matters.
 */
export function useOnline(): boolean {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    const read = () => setOnline(typeof navigator === 'undefined' ? true : navigator.onLine);
    read();
    window.addEventListener('online', read);
    window.addEventListener('offline', read);
    return () => {
      window.removeEventListener('online', read);
      window.removeEventListener('offline', read);
    };
  }, []);

  return online;
}

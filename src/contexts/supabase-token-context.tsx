"use client";

import { createContext, useContext, useState, useEffect } from "react";

const SupabaseTokenContext = createContext<string | null>(null);

const REFRESH_INTERVAL_MS = 45 * 60 * 1000; // 45 minutes

export function SupabaseTokenProvider({
  token: initialToken,
  children,
}: {
  token: string;
  children: React.ReactNode;
}) {
  const [token, setToken] = useState(initialToken);

  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch("/api/auth/token");
        if (res.ok) {
          const data = await res.json();
          if (data.token) {
            setToken(data.token);
          }
        }
      } catch {
        // Token refresh failed; will retry on next interval
      }
    }, REFRESH_INTERVAL_MS);

    return () => clearInterval(interval);
  }, []);

  return (
    <SupabaseTokenContext.Provider value={token}>
      {children}
    </SupabaseTokenContext.Provider>
  );
}

export function useSupabaseToken() {
  const token = useContext(SupabaseTokenContext);
  if (!token) {
    throw new Error("useSupabaseToken must be used within SupabaseTokenProvider");
  }
  return token;
}

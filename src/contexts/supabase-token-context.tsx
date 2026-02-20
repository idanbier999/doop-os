"use client";

import { createContext, useContext } from "react";

const SupabaseTokenContext = createContext<string | null>(null);

export function SupabaseTokenProvider({
  token,
  children,
}: {
  token: string;
  children: React.ReactNode;
}) {
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

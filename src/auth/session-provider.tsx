"use client";

import { useQueryClient } from "@tanstack/react-query";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { core } from "@/api/client";
import { unwrap } from "@/api/errors";
import type { components } from "@/api/generated/core";
import { onSessionEnded, refreshSession, setAccessToken } from "@/auth/session";

export type User = components["schemas"]["User"];
export type SessionStatus = "loading" | "signedIn" | "signedOut";

interface Session {
  status: SessionStatus;
  user: User | null;
  login(email: string, password: string): Promise<void>;
  register(fullName: string, email: string, password: string): Promise<void>;
  logout(): Promise<void>;
}

const SessionContext = createContext<Session | null>(null);

export function useSession(): Session {
  const session = useContext(SessionContext);
  if (session === null) throw new Error("useSession outside SessionProvider");
  return session;
}

/** Restores the session from the refresh cookie on start and keeps the signed-in user. */
export function SessionProvider({ children }: { children: ReactNode }) {
  const queries = useQueryClient();
  const [status, setStatus] = useState<SessionStatus>("loading");
  const [user, setUser] = useState<User | null>(null);

  const signedOut = useCallback(() => {
    setAccessToken(null);
    setUser(null);
    setStatus("signedOut");
    // Data of the previous user must not be shown to the next one.
    queries.clear();
  }, [queries]);

  const loadUser = useCallback(async () => {
    setUser(await unwrap(core.GET("/users/me")));
    setStatus("signedIn");
  }, []);

  useEffect(() => {
    let active = true;
    void (async () => {
      const restored = await refreshSession();
      if (!active) return;
      if (!restored) {
        signedOut();
        return;
      }
      try {
        await loadUser();
      } catch {
        if (active) signedOut();
      }
    })();
    const unsubscribe = onSessionEnded(signedOut);
    return () => {
      active = false;
      unsubscribe();
    };
  }, [loadUser, signedOut]);

  const login = useCallback(
    async (email: string, password: string) => {
      const tokens = await unwrap(
        core.POST("/auth/login", { body: { email: email.trim(), password, client: "web" } }),
      );
      setAccessToken(tokens.accessToken);
      await loadUser();
    },
    [loadUser],
  );

  const register = useCallback(
    async (fullName: string, email: string, password: string) => {
      await unwrap(
        core.POST("/auth/register", { body: { fullName: fullName.trim(), email: email.trim(), password } }),
      );
      await login(email, password);
    },
    [login],
  );

  const logout = useCallback(async () => {
    try {
      // The cookie is sent automatically; core revokes the token and clears the cookie.
      await core.POST("/auth/logout", {});
    } catch {
      // Offline: the token expires on the server by itself; the device forgets it now.
    } finally {
      signedOut();
    }
  }, [signedOut]);

  const value = useMemo(
    () => ({ status, user, login, register, logout }),
    [status, user, login, register, logout],
  );
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

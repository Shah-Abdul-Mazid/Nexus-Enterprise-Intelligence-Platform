"use client";

import React, { createContext, useContext, useSyncExternalStore } from "react";
import { api } from "@/lib/api";
import { AuthSnapshot } from "@/types";

interface AuthContextType {
  auth: AuthSnapshot;
  login: (email: string, password: string) => Promise<void>;
  register: (
    email: string,
    password: string,
    fullName: string,
  ) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const serverAuthSnapshot: AuthSnapshot = {
  authHydrated: false,
  isAuthenticated: false,
  userRole: null,
  userFullName: null,
};

let cachedAuthSnapshot = serverAuthSnapshot;

const getAuthSnapshot = (): AuthSnapshot => {
  if (typeof window === "undefined") {
    return serverAuthSnapshot;
  }

  const token = localStorage.getItem("token");
  const nextSnapshot = {
    authHydrated: true,
    isAuthenticated: Boolean(token),
    userRole: localStorage.getItem("role"),
    userFullName: localStorage.getItem("fullName"),
  };

  if (
    cachedAuthSnapshot.authHydrated === nextSnapshot.authHydrated &&
    cachedAuthSnapshot.isAuthenticated === nextSnapshot.isAuthenticated &&
    cachedAuthSnapshot.userRole === nextSnapshot.userRole &&
    cachedAuthSnapshot.userFullName === nextSnapshot.userFullName
  ) {
    return cachedAuthSnapshot;
  }

  cachedAuthSnapshot = nextSnapshot;
  return cachedAuthSnapshot;
};

const subscribeToAuthChanges = (callback: () => void) => {
  if (typeof window === "undefined") {
    return () => {};
  }

  window.addEventListener("storage", callback);
  window.addEventListener("authchange", callback);

  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener("authchange", callback);
  };
};

const notifyAuthChanged = () => {
  window.dispatchEvent(new Event("authchange"));
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const auth = useSyncExternalStore(
    subscribeToAuthChanges,
    getAuthSnapshot,
    () => serverAuthSnapshot,
  );

  const login = async (email: string, password: string) => {
    const params = new URLSearchParams();
    params.append("username", email);
    params.append("password", password);

    const response = await api.post("/api/v1/auth/login", params);
    const data = response.data;

    localStorage.setItem("token", data.access_token);
    localStorage.setItem("role", data.role);
    localStorage.setItem("fullName", data.full_name);

    notifyAuthChanged();
  };

  const register = async (
    email: string,
    password: string,
    fullName: string,
  ) => {
    await api.post("/api/v1/auth/register", {
      email,
      password,
      full_name: fullName,
    });
  };

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("role");
    localStorage.removeItem("fullName");
    notifyAuthChanged();
  };

  return (
    <AuthContext.Provider value={{ auth, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

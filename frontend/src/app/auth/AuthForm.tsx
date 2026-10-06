"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import {
  Activity,
  Cpu,
  Database,
  LockKeyhole,
  Sparkles,
} from "lucide-react";

interface AuthFormProps {
  mode: "login" | "register";
}

export default function AuthForm({ mode }: AuthFormProps) {
  const { auth, login, register } = useAuth();
  const router = useRouter();

  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [registerFullName, setRegisterFullName] = useState("");
  const [authMessage, setAuthMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (auth.authHydrated && auth.isAuthenticated) {
      router.push("/dashboard");
    }
  }, [auth.authHydrated, auth.isAuthenticated, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError("");
    setAuthMessage("");
    setIsSubmitting(true);

    try {
      if (mode === "login") {
        await login(loginEmail, loginPassword);
        router.push("/dashboard");
      } else {
        await register(loginEmail, loginPassword, registerFullName);
        setAuthMessage("Account created. You can sign in now.");
        // Redirect to login page after a brief delay
        setTimeout(() => {
          router.push("/auth/login");
        }, 1500);
      }
    } catch (error: any) {
      console.error("Auth error:", error);
      if (mode === "login") {
        if (error.response?.data?.detail) {
          setLoginError(String(error.response.data.detail));
        } else {
          setLoginError("Login failed. Please verify your credentials or ensure the backend server is running.");
        }
      } else {
        if (error.response?.data?.detail) {
          setLoginError(String(error.response.data.detail));
        } else {
          setLoginError("Could not complete registration. Please try again.");
        }
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (auth.isAuthenticated) {
    return null; // Prevents layout flash during redirection
  }

  return (
    <div className="min-h-screen bg-[#08090d] text-white">
      <div className="grid min-h-screen lg:grid-cols-[1.05fr_0.95fr]">
        <section className="flex flex-col justify-between border-r border-white/10 p-6 md:p-10">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-sky-500 text-white shadow-lg shadow-sky-500/20">
              <Activity size={24} />
            </div>
            <div>
              <p className="text-lg font-semibold">Nexus Intelligence</p>
              <p className="text-xs text-slate-400">Private enterprise RAG platform</p>
            </div>
          </div>

          <div className="max-w-2xl py-14">
            <div className="mb-5 inline-flex items-center gap-2 rounded-lg border border-emerald-400/20 bg-emerald-400/10 px-3 py-2 text-xs font-medium text-emerald-200">
              <Sparkles size={14} />
              Multi-agent AI for secure company knowledge
            </div>
            <h1 className="text-4xl font-semibold leading-tight text-white md:text-6xl">
              Ask your enterprise data. Get grounded answers with governance.
            </h1>
            <p className="mt-5 max-w-xl text-sm leading-6 text-slate-400 md:text-base">
              A recruiter-friendly showcase of FastAPI, Next.js, Pinecone, document ingestion, semantic retrieval,
              agent orchestration, and compliance checks in one product experience.
            </p>

            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              <LoginFeature icon={<Database size={18} />} title="RAG Search" value="Pinecone" />
              <LoginFeature icon={<Cpu size={18} />} title="AI Agents" value="API + RAG routing" />
              <LoginFeature icon={<LockKeyhole size={18} />} title="Security" value="JWT access" />
            </div>
          </div>

          <p className="text-xs text-slate-500">Built for MGI interview demo readiness.</p>
        </section>

        <section className="flex items-center justify-center p-6">
          <div className="w-full max-w-[420px] rounded-lg border border-white/10 bg-white/[0.04] p-6 shadow-2xl shadow-black/30">
            <div className="mb-7">
              <p className="text-sm text-slate-400">Secure access</p>
              <h2 className="mt-1 text-2xl font-semibold">
                {mode === "login" ? "Enterprise Login" : "Create Account"}
              </h2>
            </div>

            <div className="mb-5 grid grid-cols-2 gap-2 rounded-lg border border-white/10 bg-black/20 p-1">
              <button
                type="button"
                onClick={() => {
                  router.push("/auth/login");
                }}
                className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  mode === "login" ? "bg-sky-500 text-white" : "text-slate-400 hover:text-white"
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => {
                  router.push("/auth/register");
                }}
                className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  mode === "register" ? "bg-sky-500 text-white" : "text-slate-400 hover:text-white"
                }`}
              >
                Sign Up
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {mode === "register" && (
                <label className="block">
                  <span className="mb-2 block text-sm text-slate-300">Full Name</span>
                  <input
                    type="text"
                    required
                    value={registerFullName}
                    onChange={(e) => setRegisterFullName(e.target.value)}
                    className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none transition-colors focus:border-sky-400"
                    placeholder="New User"
                  />
                </label>
              )}
              <label className="block">
                <span className="mb-2 block text-sm text-slate-300">Email / Username</span>
                <input
                  type="text"
                  required
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none transition-colors focus:border-sky-400"
                  placeholder="admin@nexus.org"
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm text-slate-300">Password</span>
                <input
                  type="password"
                  required
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none transition-colors focus:border-sky-400"
                  placeholder="password"
                />
              </label>

              {authMessage && <p className="text-center text-xs text-emerald-300">{authMessage}</p>}
              {loginError && <p className="text-center text-xs text-rose-300">{loginError}</p>}

              <button
                type="submit"
                disabled={isSubmitting}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-sky-500 py-3 text-sm font-semibold text-white transition-colors hover:bg-sky-400 disabled:opacity-50"
              >
                <LockKeyhole size={16} />
                {mode === "login" ? "Sign In" : "Create Account"}
              </button>
            </form>

            <div className="mt-6 rounded-lg border border-white/10 bg-black/20 p-4 text-xs text-slate-400">
              <p className="mb-2 font-medium text-slate-200">Demo accounts</p>
              <p>Admin: admin@nexus.org / Admin2026</p>
              <p>User: user@nexus.org / User2026</p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function LoginFeature({ icon, title, value }: { icon: React.ReactNode; title: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
      <div className="mb-3 text-sky-200">{icon}</div>
      <p className="text-sm font-medium">{title}</p>
      <p className="mt-1 text-xs text-slate-500">{value}</p>
    </div>
  );
}

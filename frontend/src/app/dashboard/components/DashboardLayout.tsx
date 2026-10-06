"use client";

import React from "react";
import { Sidebar } from "./Sidebar";
import { ActiveTab, AuthSnapshot } from "@/types";
import { getApiBase } from "@/lib/api";
import { Database, MessageSquare, ShieldCheck, Clock } from "lucide-react";
import { getBrowserTimeZone } from "@/lib/dateTime";

interface DashboardLayoutProps {
  auth: AuthSnapshot;
  logout: () => void;
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  children: React.ReactNode;
}

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({
  auth,
  logout,
  activeTab,
  setActiveTab,
  children,
}) => {
  const [currentTime, setCurrentTime] = React.useState<string>("");
  const [userTz, setUserTz] = React.useState<string>("");

  React.useEffect(() => {
    const tz = getBrowserTimeZone();
    setUserTz(tz);

    const updateTime = () => {
      const now = new Date();
      try {
        const formatted = new Intl.DateTimeFormat(undefined, {
          timeZone: tz,
          weekday: "short",
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
          second: "2-digit",
          hour12: true,
        }).format(now);
        setCurrentTime(formatted);
      } catch {
        setCurrentTime(now.toLocaleTimeString());
      }
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[#08090d] text-white md:flex-row">
      {/* Desktop Sidebar */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        userRole={auth.userRole}
      />

      <main className="flex min-w-0 flex-1 flex-col">
        {/* Header */}
        <header className="flex h-16 shrink-0 items-center justify-between border-b border-white/10 bg-[#101218]/95 px-4 md:px-7">
          <div className="flex items-center gap-3 text-xs text-slate-400 md:text-sm">
            <span className="hidden sm:inline">System health</span>
            <span className="flex items-center gap-2 rounded-lg border border-emerald-400/20 bg-emerald-400/10 px-3 py-1.5 text-emerald-200">
              <span className="h-2 w-2 rounded-full bg-emerald-300" />
              Operational
            </span>
            <span className="hidden rounded-lg border border-white/10 px-3 py-1.5 text-slate-400 2xl:inline-flex">
              API: {getApiBase().replace("https://", "")}
            </span>
          </div>

          {/* Live Location Date & Time Badge */}
          {currentTime && (
            <div className="hidden md:flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-slate-300">
              <Clock size={13} className="text-sky-400" />
              <span>{currentTime}</span>
              <span className="rounded bg-sky-400/10 px-1.5 py-0.5 text-[10px] font-medium text-sky-200">
                {userTz}
              </span>
            </div>
          )}

          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-medium">{auth.userFullName}</p>
              <p className="text-xs uppercase text-slate-500">{auth.userRole}</p>
            </div>
            <button
              onClick={logout}
              className="rounded-lg px-3 py-2 text-xs text-rose-300 hover:bg-rose-400/10"
            >
              Logout
            </button>
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-500 text-sm font-semibold">
              {auth.userFullName?.charAt(0) ?? "U"}
            </div>
          </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-4 md:p-7">
          {children}
        </div>

        {/* Mobile Navigation */}
        <div className="flex shrink-0 justify-around border-t border-white/10 bg-[#101218] p-2 md:hidden">
          <MobileNav
            icon={<MessageSquare size={20} />}
            label="Chat"
            active={activeTab === "chat"}
            onClick={() => setActiveTab("chat")}
          />
          {auth.userRole === "admin" && (
            <>
              <MobileNav
                icon={<Database size={20} />}
                label="Docs"
                active={activeTab === "docs"}
                onClick={() => setActiveTab("docs")}
              />
              <MobileNav
                icon={<ShieldCheck size={20} />}
                label="Control"
                active={activeTab === "analytics"}
                onClick={() => setActiveTab("analytics")}
              />
            </>
          )}
        </div>
      </main>
    </div>
  );
};

function MobileNav({
  icon,
  label,
  active,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-lg px-4 py-2 text-xs ${
        active ? "bg-sky-500 text-white" : "text-slate-500"
      }`}
    >
      <span className="flex flex-col items-center gap-1">
        {icon}
        {label}
      </span>
    </button>
  );
}

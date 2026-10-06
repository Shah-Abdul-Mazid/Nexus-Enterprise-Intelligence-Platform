"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { useChat } from "./hooks/useChat";
import { useDocs } from "./hooks/useDocs";
import { DashboardLayout } from "./components/DashboardLayout";
import { ChatTab } from "./components/ChatTab";
import { DocsTab } from "./components/DocsTab";
import { AnalyticsTab } from "./components/AnalyticsTab";
import { Loader } from "@/components/ui/Loader";
import { ActiveTab } from "@/types";

export default function DashboardPage() {
  const { auth, logout } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<ActiveTab>("chat");

  const chat = useChat();
  const docs = useDocs();

  useEffect(() => {
    if (auth.authHydrated && !auth.isAuthenticated) {
      router.push("/auth");
    }
  }, [auth.authHydrated, auth.isAuthenticated, router]);

  // Restrict non-admin users to only the 'chat' tab
  useEffect(() => {
    if (auth.isAuthenticated && auth.userRole !== "admin" && activeTab !== "chat") {
      setActiveTab("chat");
    }
  }, [auth.isAuthenticated, auth.userRole, activeTab]);

  if (!auth.authHydrated) {
    return <Loader />;
  }

  if (!auth.isAuthenticated) {
    return null; // Prevents layout flash during redirection
  }

  return (
    <DashboardLayout
      auth={auth}
      logout={logout}
      activeTab={activeTab}
      setActiveTab={setActiveTab}
    >
      {activeTab === "chat" && (
        <ChatTab
          messages={chat.messages}
          input={chat.input}
          setInput={chat.setInput}
          isLoading={chat.isLoading}
          selectedProvider={chat.selectedProvider}
          setSelectedProvider={chat.setSelectedProvider}
          selectedTimezone={chat.selectedTimezone}
          setSelectedTimezone={chat.setSelectedTimezone}
          chatEndRef={chat.chatEndRef}
          handleSendMessage={chat.handleSendMessage}
          handleFeedback={chat.handleFeedback}
          totalDocs={docs.documentStats.total}
        />
      )}
      {activeTab === "docs" && auth.userRole === "admin" && (
        <DocsTab
          files={docs.files}
          isUploading={docs.isUploading}
          scrapeUrl={docs.scrapeUrl}
          setScrapeUrl={docs.setScrapeUrl}
          isScraping={docs.isScraping}
          documentStats={docs.documentStats}
          handleFileUpload={docs.handleFileUpload}
          handleUrlScrape={docs.handleUrlScrape}
        />
      )}
      {activeTab === "analytics" && auth.userRole === "admin" && (
        <AnalyticsTab />
      )}
    </DashboardLayout>
  );
}

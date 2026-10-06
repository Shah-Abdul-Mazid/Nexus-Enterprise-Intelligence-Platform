"use client";

import { useState, useRef, useEffect } from "react";
import { Message } from "@/types";
import { api } from "@/lib/api";

export const useChat = () => {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content:
        "Welcome to Nexus Intelligence. Ask a question and I will search company knowledge, synthesize an answer, and show the agent trace.",
      created_at: new Date().toISOString(),
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState("openai");
  const [selectedTimezone, setSelectedTimezone] = useState("auto");
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSendMessage = async (nextInput = input) => {
    const trimmedInput = nextInput.trim();
    if (!trimmedInput || isLoading) return;

    const nowIso = new Date().toISOString();
    const userMessage: Message = {
      role: "user",
      content: trimmedInput,
      created_at: nowIso,
    };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const response = await api.post("/api/v1/chat", {
        message: trimmedInput,
        provider: selectedProvider,
        timezone: selectedTimezone,
      });

      const botMessage: Message = {
        role: "assistant",
        content: response.data.answer,
        sources: response.data.sources,
        logs: response.data.agent_logs,
        shap: response.data.shap,
        lime: response.data.lime,
        fairness: response.data.fairness,
        profile: response.data.profile,
        decision: response.data.decision,
        created_at: response.data.created_at || new Date().toISOString(),
      };
      setMessages((prev) => [...prev, botMessage]);
    } catch (error) {
      console.error("Chat error:", error);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "I could not reach the AI engine. Please confirm the FastAPI backend is running on port 8000.",
          created_at: new Date().toISOString(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFeedback = async (query: string, answer: string, isPositive: boolean) => {
    try {
      await api.post("/api/v1/feedback", {
        query,
        answer,
        is_positive: isPositive,
      });
      alert("Thank you for your feedback.");
    } catch (error) {
      console.error("Feedback error:", error);
    }
  };

  return {
    messages,
    setMessages,
    input,
    setInput,
    isLoading,
    selectedProvider,
    setSelectedProvider,
    selectedTimezone,
    setSelectedTimezone,
    chatEndRef,
    handleSendMessage,
    handleFeedback,
  };
};

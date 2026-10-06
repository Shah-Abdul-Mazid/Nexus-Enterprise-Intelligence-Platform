"use client";

import React from "react";
import { Message } from "@/types";
import { motion } from "framer-motion";
import {
  Activity,
  Brain,
  Clock,
  FileText,
  Gauge,
  Globe,
  Layers,
  Loader2,
  Search,
  Send,
  ShieldCheck,
  ThumbsDown,
  ThumbsUp,
} from "lucide-react";
import {
  formatMessageTime,
  TIMEZONE_OPTIONS,
  resolveActiveTimeZone,
} from "@/lib/dateTime";

interface ChatTabProps {
  messages: Message[];
  input: string;
  setInput: (val: string) => void;
  isLoading: boolean;
  selectedProvider: string;
  setSelectedProvider: (val: string) => void;
  selectedTimezone?: string;
  setSelectedTimezone?: (val: string) => void;
  chatEndRef: React.RefObject<HTMLDivElement | null>;
  handleSendMessage: (nextInput?: string) => Promise<void>;
  handleFeedback: (query: string, answer: string, isPositive: boolean) => Promise<void>;
  totalDocs: number;
}

const starterPrompts = [
  "What is today's weather in Dhaka?",
  "Summarize the latest uploaded policy document",
  "Which sources support this answer?",
];

const agentPipeline = [
  { label: "Live Data", detail: "Routes weather and API questions to real-time connectors", icon: Globe, color: "text-emerald-300" },
  { label: "Retriever", detail: "Semantic search over private knowledge", icon: Search, color: "text-sky-300" },
  { label: "Generator", detail: "Grounded synthesis with source context", icon: Brain, color: "text-violet-300" },
  { label: "Compliance", detail: "PII and policy guardrails before response", icon: ShieldCheck, color: "text-emerald-300" },
];

export const ChatTab: React.FC<ChatTabProps> = ({
  messages,
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
  totalDocs,
}) => {
  return (
    <div className="grid h-full gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
      <section className="flex min-h-[680px] flex-col rounded-lg border border-white/10 bg-[#0d0f14]">
        <div className="border-b border-white/10 p-5">
          <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
            <div>
              <div className="mb-2 flex items-center gap-2 text-xs font-medium text-sky-200">
                <SparklesIcon size={15} />
                Multi-agent intelligence assistant
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="text-2xl font-semibold">Ask company knowledge with confidence</h2>
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={selectedProvider}
                    onChange={(e) => setSelectedProvider(e.target.value)}
                    className="rounded-lg border border-white/10 bg-[#101218] px-3 py-1.5 text-xs text-sky-200 outline-none transition-colors focus:border-sky-400"
                  >
                    <option value="openai">GPT-4o (OpenAI)</option>
                    <option value="grok">Grok-2 (X.AI)</option>
                    <option value="gemini">Gemini 1.5 Flash</option>
                    <option value="bedrock">AWS Bedrock (Llama 3)</option>
                  </select>
                  <div className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-[#101218] px-2.5 py-1 text-xs text-slate-300">
                    <Clock size={13} className="text-sky-300" />
                    <select
                      value={selectedTimezone || "auto"}
                      onChange={(e) => setSelectedTimezone?.(e.target.value)}
                      className="bg-transparent text-xs text-slate-300 outline-none cursor-pointer"
                      title="Adjust Display Timezone"
                    >
                      {TIMEZONE_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value} className="bg-[#101218] text-slate-200">
                          {opt.value === "auto" ? `Auto (${resolveActiveTimeZone("auto")})` : opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
                The assistant retrieves trusted context, generates a grounded answer, then applies compliance
                checks before showing the response.
              </p>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <MiniMetric label="Docs" value={totalDocs.toString()} />
              <MiniMetric label="Agents" value="4" />
              <MiniMetric label="Mode" value="API + RAG" />
            </div>
          </div>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto p-5">
          {messages.map((msg, idx) => (
            <motion.div
              key={`${msg.role}-${idx}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[92%] rounded-lg p-4 text-sm leading-6 md:max-w-[78%] ${
                  msg.role === "user"
                    ? "bg-sky-500 text-white"
                    : "border border-white/10 bg-white/[0.04] text-slate-200"
                }`}
              >
                <p>{msg.content}</p>
                {msg.role === "user" && msg.created_at && (
                  <div className="mt-1.5 flex items-center justify-end gap-1 text-[10px] text-sky-100/75">
                    <Clock size={10} />
                    <span>{formatMessageTime(msg.created_at, selectedTimezone)}</span>
                  </div>
                )}

                {/* Explainability Section (SHAP & LIME) */}
                {(msg.shap || msg.lime) && (
                  <div className="mt-5 space-y-4 rounded-lg border border-white/10 bg-black/30 p-4">
                    <div className="flex items-center justify-between border-b border-white/10 pb-2">
                      <div className="flex items-center gap-2">
                        <ShieldCheck size={16} className="text-emerald-400" />
                        <span className="font-semibold text-xs text-white uppercase tracking-wider">Responsible AI Explainability (SHAP & LIME)</span>
                      </div>
                      <span className={`rounded px-2 py-0.5 text-xs font-semibold ${msg.decision === 'Approved' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                        Model Decision: {msg.decision}
                      </span>
                    </div>

                    {msg.profile && (
                      <div>
                        <p className="mb-2 text-xs font-medium text-slate-400">Applicant Profile Evaluated</p>
                        <div className="grid grid-cols-2 gap-2 text-xs md:grid-cols-4">
                          {Object.entries(msg.profile).map(([key, val]) => (
                            <div key={key} className="rounded bg-white/[0.02] border border-white/5 p-2">
                              <span className="block text-[10px] text-slate-500 capitalize">{key.replace(/_/g, ' ')}</span>
                              <span className="font-mono text-slate-300">
                                {key === 'annual_income' ? `$${val.toLocaleString()}` : val}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {msg.shap && (
                      <div className="space-y-2 border-t border-white/5 pt-3">
                        <p className="text-xs font-medium text-slate-400">SHAP Feature Influence (Pushes Approved vs. Rejected)</p>
                        <div className="space-y-2.5">
                          {Object.entries(msg.shap).map(([key, val]) => {
                            const percent = Math.min(Math.abs(val) * 100, 100);
                            const isPositive = val >= 0;
                            return (
                              <div key={key} className="space-y-1">
                                <div className="flex justify-between text-xs font-mono text-slate-400">
                                  <span className="capitalize">{key.replace(/_/g, ' ')}</span>
                                  <span className={isPositive ? 'text-emerald-400' : 'text-rose-400'}>
                                    {isPositive ? '+' : ''}{val.toFixed(4)}
                                  </span>
                                </div>
                                <div className="h-1.5 w-full rounded-full bg-white/[0.03]">
                                  <div
                                    className={`h-full rounded-full ${isPositive ? 'bg-gradient-to-r from-emerald-500 to-teal-400' : 'bg-gradient-to-r from-rose-500 to-red-400'}`}
                                    style={{ width: `${percent}%` }}
                                  />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {msg.lime && (
                      <div className="space-y-2 border-t border-white/5 pt-3">
                        <p className="text-xs font-medium text-slate-400">LIME Local Decision Rules</p>
                        <div className="space-y-1.5 text-xs font-mono">
                          {Object.entries(msg.lime).map(([rule, weight]) => {
                            const isPositive = weight >= 0;
                            return (
                              <div key={rule} className="flex justify-between rounded bg-white/[0.01] p-1.5 border border-white/5">
                                <span className="text-slate-400 text-[11px]">{rule}</span>
                                <span className={isPositive ? 'text-emerald-400' : 'text-rose-400'}>
                                  {isPositive ? '+' : ''}{weight.toFixed(4)}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {msg.fairness && (
                      <div className="space-y-2 border-t border-white/5 pt-3">
                        <p className="text-xs font-medium text-slate-400">Fairlearn Global Bias Audit</p>
                        <div className="grid grid-cols-1 gap-2 md:grid-cols-2 text-xs">
                          <div className="rounded border border-white/5 bg-white/[0.02] p-2">
                            <span className="block text-[10px] text-slate-500">Gender Parity Gap</span>
                            <span className="font-mono text-slate-300">{(msg.fairness.demographic_parity_gap_gender * 100).toFixed(2)}%</span>
                          </div>
                          <div className="rounded border border-white/5 bg-white/[0.02] p-2">
                            <span className="block text-[10px] text-slate-500">Age Parity Gap</span>
                            <span className="font-mono text-slate-300">{(msg.fairness.demographic_parity_gap_age * 100).toFixed(2)}%</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {msg.logs && (
                  <div className="mt-4 flex flex-wrap gap-2 border-t border-white/10 pt-3">
                    {msg.logs.map((log, i) => (
                      <span key={i} className="flex items-center gap-1 rounded-md bg-black/20 px-2 py-1 text-[11px] text-slate-300">
                        <Activity size={11} className="text-sky-300" />
                        {log}
                      </span>
                    ))}
                  </div>
                )}

                {msg.sources && msg.sources.length > 0 && (
                  <div className="mt-4 flex flex-col gap-3 border-t border-white/10 pt-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[11px] text-slate-500">Sources</span>
                      {msg.sources.map((src, i) => (
                        <span key={i} className="flex items-center gap-1 rounded-md bg-sky-400/10 px-2 py-1 text-[11px] text-sky-200">
                          <FileText size={11} />
                          {src}
                        </span>
                      ))}
                    </div>
                    {msg.role === "assistant" && idx > 0 && (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleFeedback(messages[idx - 1].content, msg.content, true)}
                          className="rounded-md p-1.5 text-slate-500 hover:bg-emerald-400/10 hover:text-emerald-300"
                          aria-label="Positive feedback"
                        >
                          <ThumbsUp size={14} />
                        </button>
                        <button
                          onClick={() => handleFeedback(messages[idx - 1].content, msg.content, false)}
                          className="rounded-md p-1.5 text-slate-500 hover:bg-rose-400/10 hover:text-rose-300"
                          aria-label="Negative feedback"
                        >
                          <ThumbsDown size={14} />
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {msg.role === "assistant" && msg.created_at && (
                  <div className="mt-2.5 flex items-center gap-1.5 text-[10px] text-slate-500">
                    <Clock size={11} className="text-sky-400/70" />
                    <span>{formatMessageTime(msg.created_at, selectedTimezone)}</span>
                  </div>
                )}
              </div>
            </motion.div>
          ))}

          {isLoading && (
            <div className="flex justify-start">
              <div className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/[0.04] p-4 text-sm text-slate-400">
                <Loader2 size={16} className="animate-spin text-sky-300" />
                Agent pipeline is retrieving, reasoning, and checking compliance...
              </div>
            </div>
          )}
          <div ref={chatEndRef as React.RefObject<HTMLDivElement>} />
        </div>

        <div className="border-t border-white/10 bg-[#101218] p-4">
          <div className="mb-3 flex flex-wrap gap-2">
            {starterPrompts.map((prompt) => (
              <button
                key={prompt}
                onClick={() => handleSendMessage(prompt)}
                className="rounded-lg border border-white/10 px-3 py-2 text-xs text-slate-300 hover:border-sky-400/40 hover:bg-sky-400/10 hover:text-sky-100"
              >
                {prompt}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-black/20 p-1">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
              placeholder="Ask anything about your documents..."
              className="min-w-0 flex-1 bg-transparent px-4 py-3 text-sm text-slate-100 outline-none placeholder:text-slate-600"
            />
            <button
              onClick={() => handleSendMessage()}
              disabled={isLoading}
              className="flex h-11 w-11 items-center justify-center rounded-lg bg-sky-500 text-white transition-colors hover:bg-sky-400 disabled:opacity-50"
              aria-label="Send message"
            >
              <Send size={18} />
            </button>
          </div>
        </div>
      </section>

      <aside className="space-y-5">
        <Panel title="Agent Pipeline" icon={<Layers size={17} />}>
          <div className="space-y-3">
            {agentPipeline.map((agent) => (
              <div key={agent.label} className="flex gap-3 rounded-lg border border-white/10 bg-white/[0.03] p-3">
                <agent.icon size={18} className={agent.color} />
                <div>
                  <p className="text-sm font-medium text-slate-100">{agent.label}</p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">{agent.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Executive Signals" icon={<Gauge size={17} />}>
          <div className="grid gap-3">
            <Signal label="Answer grounding" value="Source aware" tone="emerald" />
            <Signal label="Live API tools" value="Weather ready" tone="sky" />
            <Signal label="Data posture" value="Private index" tone="violet" />
          </div>
        </Panel>
      </aside>
    </div>
  );
};

function SparklesIcon({ size }: { size?: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size || 24}
      height={size || 24}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="lucide lucide-sparkles animate-pulse"
    >
      <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275Z" />
      <path d="m5 3 1 2.5L8.5 6 6 7 5 9.5 4 7 1.5 6 4 5Z" />
      <path d="m19 17 1 2.5 2.5.5-2.5 1-1 2.5-1-2.5-2.5-1 2.5-1Z" />
    </svg>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.04] px-4 py-3">
      <p className="text-base font-semibold">{value}</p>
      <p className="mt-1 text-[11px] text-slate-500">{label}</p>
    </div>
  );
}

function Panel({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-white/10 bg-[#101218] p-5">
      <div className="mb-4 flex items-center gap-2 text-sm font-semibold">
        <span className="text-sky-200">{icon}</span>
        {title}
      </div>
      {children}
    </section>
  );
}

function Signal({ label, value, tone }: { label: string; value: string; tone: "emerald" | "sky" | "violet" }) {
  const toneClass = {
    emerald: "text-emerald-200 bg-emerald-400/10",
    sky: "text-sky-200 bg-sky-400/10",
    violet: "text-violet-200 bg-violet-400/10",
  }[tone];

  return (
    <div className="flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.03] p-3">
      <span className="text-sm text-slate-400">{label}</span>
      <span className={`rounded-md px-2 py-1 text-xs font-medium ${toneClass}`}>{value}</span>
    </div>
  );
}

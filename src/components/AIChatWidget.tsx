"use client";

import React, { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { X, Send, Bot, AlertCircle, RefreshCw, Minus, RotateCcw, Sparkles } from "lucide-react";
import { useParams } from "next/navigation";
import { apiClient } from "@/lib/api-client";
import { useTenant } from "@/lib/tenant-context";
import { useSession } from "@/lib/session-context";

const CHAT_STORAGE_KEY = "institutional_ai_chat_history";

const QUICK_SUGGESTIONS = [
  "How many students are in JSS 1?",
  "Who is 1st position in 1st term?",
  "What is promotion threshold?",
  "Total fee collections",
];

export default function AIChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [fallbackAlert, setFallbackAlert] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleOpenAi = () => setIsOpen(true);
    window.addEventListener("open-institutional-ai", handleOpenAi);
    return () => window.removeEventListener("open-institutional-ai", handleOpenAi);
  }, []);

  // Tenant and Session resolution for contextual queries
  const params = useParams();
  const schoolDomain = (params?.schoolDomain as string) || "demo";

  let tenantName = "Apex International Academy";
  let tenantRole = "";
  let schoolId = "";

  try {
    const tenant = useTenant();
    if (tenant) {
      if (tenant.name) tenantName = tenant.name;
      if (tenant.id) schoolId = tenant.id;
      if (tenant.userRole) tenantRole = tenant.userRole;
    }
  } catch {
    // Outside TenantProvider fallback
  }

  const { role: sessionRole } = useSession();
  const effectiveRole = useMemo(() => {
    return (sessionRole || tenantRole || "ADMIN").toUpperCase().trim();
  }, [sessionRole, tenantRole]);

  // Session-only conversation history
  const defaultWelcome = useMemo(() => ({
    role: "ai" as const,
    text: `Hello! I am your Institutional AI for **${tenantName}** (Role: **${effectiveRole}**).\n\nAsk me about student enrollment, academic broadsheets, term rankings, promotion policies, or fee totals.`,
  }), [tenantName, effectiveRole]);

  const [messages, setMessages] = useState<{ role: "user" | "ai"; text: string }[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = sessionStorage.getItem(CHAT_STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
      } catch {
        // Ignore JSON error
      }
    }
    return [defaultWelcome];
  });

  // Sync conversation history into sessionStorage
  useEffect(() => {
    try {
      sessionStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(messages));
    } catch {
      // Ignore sessionStorage issues
    }
  }, [messages]);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping, scrollToBottom]);

  // Focus input when chat opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

  // Escape key to minimize/close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  const executeSend = async (queryText: string) => {
    const userMessage = queryText.trim();
    if (!userMessage) {
      setFallbackAlert("Please enter a query before submitting.");
      return;
    }

    setMessages((prev) => [...prev, { role: "user", text: userMessage }]);
    setInput("");
    setFallbackAlert(null);
    setIsTyping(true);

    try {
      const res = await apiClient.post("/api/institutional-ai", {
        prompt: userMessage,
        schoolDomain,
        schoolId,
        userRole: effectiveRole,
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `Institutional AI error (Status ${res.status})`);
      }

      const data = await res.json();
      const aiResponse = data?.response;

      if (!aiResponse || typeof aiResponse !== "string" || !aiResponse.trim()) {
        setFallbackAlert("Institutional AI router returned empty feedback. Please rephrase or query specific metrics like student enrollment or fees.");
        setMessages((prev) => [
          ...prev,
          {
            role: "ai",
            text: "⚠️ No analytical records were returned for this request. Try asking about 'How many students are in JSS 1?' or 'What is promotion threshold?'.",
          },
        ]);
      } else {
        setMessages((prev) => [...prev, { role: "ai", text: aiResponse }]);
        setFallbackAlert(null);
      }
    } catch (error: any) {
      console.error("[AIChatWidget Error]:", error);
      const errorMessage = error?.message || "Failed to connect to the institutional AI service.";
      setFallbackAlert(`AI Alert: ${errorMessage}`);
      setMessages((prev) => [
        ...prev,
        {
          role: "ai",
          text: `An error occurred while querying institutional data (${errorMessage}). Please check your connection or try again.`,
        },
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleSend = () => {
    executeSend(input);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleClearHistory = () => {
    setMessages([defaultWelcome]);
    setFallbackAlert(null);
    try {
      sessionStorage.removeItem(CHAT_STORAGE_KEY);
    } catch {}
  };

  // Helper to render text with bold formatting
  const renderFormattedText = (text: string) => {
    const lines = text.split("\n");
    return lines.map((line, lIdx) => {
      const parts = line.split(/(\*\*[^*]+\*\*)/g);
      return (
        <div key={lIdx} className={line.trim() === "" ? "h-2" : "min-h-[1.25em]"}>
          {parts.map((part, pIdx) => {
            if (part.startsWith("**") && part.endsWith("**")) {
              return (
                <strong key={pIdx} className="font-semibold text-slate-900 dark:text-zinc-100">
                  {part.slice(2, -2)}
                </strong>
              );
            }
            return <span key={pIdx}>{part}</span>;
          })}
        </div>
      );
    });
  };

  return (
    <>
      {/* Chat Window Dialog (Mobile-friendly, minimizable, non-blocking) */}
      {isOpen && (
        <div
          className="fixed bottom-[85px] sm:bottom-[90px] right-3 sm:right-6 z-50 w-[calc(100vw-24px)] max-w-sm sm:w-[420px] max-h-[75vh] sm:max-h-[82vh] bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-zinc-800 flex flex-col overflow-hidden animate-in slide-in-from-bottom-5"
          role="dialog"
          aria-label="Institutional AI Assistant"
        >
          {/* Header */}
          <div className="bg-slate-900 dark:bg-black text-white p-3.5 flex justify-between items-center border-b border-slate-800">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-blue-600/20 border border-blue-500/30 flex items-center justify-center shrink-0">
                <Bot className="w-4 h-4 text-blue-400" />
              </div>
              <div className="min-w-0">
                <h3 className="font-semibold text-sm truncate">Ask Institutional AI</h3>
                <p className="text-[11px] text-slate-400 truncate flex items-center gap-1.5">
                  <span>{tenantName}</span>
                  <span>•</span>
                  <span className="text-blue-400 font-medium">{effectiveRole}</span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={handleClearHistory}
                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                title="Reset conversation"
                aria-label="Reset conversation"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                title="Minimize chat"
                aria-label="Minimize chat"
              >
                <Minus className="w-4 h-4" />
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                title="Close chat"
                aria-label="Close chat"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Chat Body */}
          <div className="flex-1 overflow-y-auto p-4 bg-slate-50 dark:bg-zinc-950/60 space-y-3.5 text-xs sm:text-sm">
            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[88%] p-3.5 rounded-2xl leading-relaxed ${
                    msg.role === "user"
                      ? "bg-blue-600 text-white rounded-tr-xs shadow-sm"
                      : "bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-800 dark:text-zinc-200 rounded-tl-xs shadow-xs"
                  }`}
                >
                  {renderFormattedText(msg.text)}
                </div>
              </div>
            ))}

            {isTyping && (
              <div className="flex justify-start">
                <div className="max-w-[85%] p-3 rounded-2xl text-xs bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-500 dark:text-slate-400 rounded-tl-xs shadow-xs flex items-center gap-2">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-500" />
                  <span>Querying institutional records...</span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Quick Prompts Strip */}
          <div className="px-3 py-2 bg-slate-100/80 dark:bg-zinc-900 border-t border-slate-200/60 dark:border-zinc-800 flex items-center gap-1.5 overflow-x-auto hide-scrollbar text-[11px]">
            <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0 ml-1" />
            {QUICK_SUGGESTIONS.map((suggestion, sIdx) => (
              <button
                key={sIdx}
                onClick={() => executeSend(suggestion)}
                disabled={isTyping}
                className="whitespace-nowrap px-2.5 py-1 bg-white dark:bg-zinc-800 hover:bg-blue-50 dark:hover:bg-zinc-700 border border-slate-200 dark:border-zinc-700 rounded-full text-slate-700 dark:text-zinc-300 font-medium transition cursor-pointer disabled:opacity-50"
              >
                {suggestion}
              </button>
            ))}
          </div>

          {/* Fallback Alert Banner */}
          {fallbackAlert && (
            <div className="px-3 py-2 bg-amber-50 dark:bg-amber-950/40 border-t border-amber-200 dark:border-amber-900/50 flex items-start gap-2 text-xs text-amber-800 dark:text-amber-300 animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div className="flex-1">{fallbackAlert}</div>
              <button
                onClick={() => setFallbackAlert(null)}
                className="text-amber-600 dark:text-amber-400 hover:text-amber-900 dark:hover:text-white"
                aria-label="Dismiss alert"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Input Area */}
          <div className="p-3 bg-white dark:bg-zinc-900 border-t border-slate-100 dark:border-zinc-800 flex gap-2 items-center">
            <input
              ref={inputRef}
              type="text"
              className="flex-1 border border-slate-300 dark:border-zinc-700 rounded-full px-4 py-2 text-xs sm:text-sm bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder={`Ask anything about ${tenantName}...`}
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                if (fallbackAlert) setFallbackAlert(null);
              }}
              onKeyDown={handleKeyDown}
              disabled={isTyping}
              aria-label="Ask institutional AI question"
            />
            <button
              onClick={handleSend}
              disabled={isTyping || !input.trim()}
              className="w-9 h-9 bg-blue-600 text-white rounded-full flex items-center justify-center hover:bg-blue-700 disabled:opacity-50 transition-colors cursor-pointer shrink-0"
              title="Submit query"
              aria-label="Submit query"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}

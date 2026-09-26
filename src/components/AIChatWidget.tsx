"use client";

import React, { useState, useRef, useEffect } from "react";
import { MessageSquare, X, Send, Bot, AlertCircle, RefreshCw } from "lucide-react";
import { apiClient } from "@/lib/api-client";

export default function AIChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<{ role: "user" | "ai"; text: string }[]>([
    { role: "ai", text: "Hello! I am your Institutional AI. How can I assist you with your tenant schema or institutional finances today?" }
  ]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [fallbackAlert, setFallbackAlert] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  const handleSend = async () => {
    const userMessage = input.trim();
    if (!userMessage) {
      setFallbackAlert("Please enter a query before submitting.");
      return;
    }
    
    setMessages(prev => [...prev, { role: "user", text: userMessage }]);
    setInput("");
    setFallbackAlert(null);
    setIsTyping(true);

    try {
      // Forward input strings to AI router stream using client interceptor
      const res = await apiClient.post("/api/v1/admin/ai-query", { prompt: userMessage });
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `AI router error (Status ${res.status})`);
      }
      
      const data = await res.json();
      const aiResponse = data?.response;
      
      // Safely catch empty/null feedback states with fallback UI alert
      if (!aiResponse || typeof aiResponse !== "string" || !aiResponse.trim()) {
        setFallbackAlert("Institutional AI router returned empty feedback. Please rephrase or query specific metrics like student enrollment or fees.");
        setMessages(prev => [
          ...prev, 
          { 
            role: "ai", 
            text: "⚠️ No analytical feedback was returned for this request. Try asking about 'total student count' or 'total fees collected'." 
          }
        ]);
      } else {
        setMessages(prev => [...prev, { role: "ai", text: aiResponse }]);
        setFallbackAlert(null);
      }
    } catch (error: any) {
      console.error("[AIChatWidget Error]:", error);
      const errorMessage = error?.message || "Failed to connect to the AI router stream.";
      setFallbackAlert(`AI Stream Alert: ${errorMessage}`);
      setMessages(prev => [
        ...prev, 
        { 
          role: "ai", 
          text: "An error occurred while connecting to the AI routing layer. Please verify your connection or ask about student count or finance totals." 
        }
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="fixed bottom-[90px] right-4 z-40 md:bottom-6 md:right-6 flex flex-col items-end">
      
      {isOpen && (
        <div className="w-80 md:w-96 bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-zinc-800 mb-4 flex flex-col overflow-hidden animate-in slide-in-from-bottom-5">
          {/* Header */}
          <div className="bg-slate-900 dark:bg-black text-white p-4 flex justify-between items-center border-b border-slate-800">
            <div className="flex items-center gap-2">
              <Bot className="w-5 h-5 text-blue-400" />
              <h3 className="font-semibold text-sm">Ask Institutional AI</h3>
            </div>
            <button 
              onClick={() => setIsOpen(false)}
              className="text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          
          {/* Chat Body */}
          <div className="flex-1 h-96 overflow-y-auto p-4 bg-slate-50 dark:bg-zinc-950/60 space-y-4">
            {messages.map((msg, idx) => (
              <div 
                key={idx} 
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div 
                  className={`max-w-[85%] p-3 rounded-2xl text-xs sm:text-sm leading-relaxed ${
                    msg.role === "user" 
                      ? "bg-blue-600 text-white rounded-tr-sm" 
                      : "bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-800 dark:text-zinc-100 rounded-tl-sm shadow-xs"
                  }`}
                >
                  {msg.text}
                </div>
              </div>
            ))}
            {isTyping && (
              <div className="flex justify-start">
                <div className="max-w-[85%] p-3 rounded-2xl text-xs bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 text-slate-500 rounded-tl-sm shadow-xs flex items-center gap-1.5">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-500" />
                  <span>Institutional AI processing...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Fallback Alert Banner */}
          {fallbackAlert && (
            <div className="px-3 py-2 bg-amber-50 dark:bg-amber-950/40 border-t border-amber-200 dark:border-amber-900/50 flex items-start gap-2 text-xs text-amber-800 dark:text-amber-300 animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div className="flex-1">{fallbackAlert}</div>
              <button 
                onClick={() => setFallbackAlert(null)}
                className="text-amber-600 dark:text-amber-400 hover:text-amber-900 dark:hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Input Area */}
          <div className="p-3 bg-white dark:bg-zinc-900 border-t border-slate-100 dark:border-zinc-800 flex gap-2">
            <input 
              type="text" 
              className="flex-1 border border-slate-300 dark:border-zinc-700 rounded-full px-4 py-2 text-xs sm:text-sm bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Ask anything about institutional metrics..."
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                if (fallbackAlert) setFallbackAlert(null);
              }}
              onKeyDown={handleKeyDown}
              disabled={isTyping}
            />
            <button 
              onClick={handleSend}
              disabled={isTyping || !input.trim()}
              className="w-10 h-10 bg-blue-600 text-white rounded-full flex items-center justify-center hover:bg-blue-700 disabled:opacity-50 transition-colors cursor-pointer shrink-0"
              title="Submit query"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Toggle Button */}
      {!isOpen && (
        <button 
          onClick={() => setIsOpen(true)}
          className="bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-5 py-3 rounded-full font-semibold shadow-xl hover:shadow-2xl hover:-translate-y-0.5 transition-all flex items-center gap-2 group border border-slate-700 dark:border-zinc-200 cursor-pointer text-sm"
        >
          <MessageSquare className="w-5 h-5 text-blue-400 dark:text-blue-600 group-hover:scale-110 transition-transform" />
          <span>Ask Institutional AI</span>
        </button>
      )}
    </div>
  );
}

"use client";

import React, { useState, useRef, useEffect } from "react";
import { MessageSquare, X, Send, Bot, AlertCircle, RefreshCw } from "lucide-react";
import { apiClient } from "@/lib/api-client";

const STORAGE_KEY = "institutional_ai_btn_pos";

export default function AIChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<{ role: "user" | "ai"; text: string }[]>([
    { role: "ai", text: "Hello! I am your Institutional AI. How can I assist you with your tenant schema or institutional finances today?" }
  ]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [fallbackAlert, setFallbackAlert] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Floating draggable position state
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const dragInfo = useRef({
    startX: 0,
    startY: 0,
    btnStartX: 0,
    btnStartY: 0,
    isDragging: false,
    hasMoved: false,
  });

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  // Restore position from sessionStorage during session
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed.x === "number" && typeof parsed.y === "number") {
          const btnWidth = buttonRef.current?.offsetWidth || 48;
          const btnHeight = buttonRef.current?.offsetHeight || 48;
          const clampedX = Math.min(Math.max(8, parsed.x), Math.max(8, window.innerWidth - btnWidth - 8));
          const clampedY = Math.min(Math.max(8, parsed.y), Math.max(8, window.innerHeight - btnHeight - 8));
          setPosition({ x: clampedX, y: clampedY });
        }
      }
    } catch {
      // Ignore sessionStorage issues
    }
  }, []);

  // Keep button within screen bounds on window resize
  useEffect(() => {
    const handleResize = () => {
      setPosition((prev) => {
        if (!prev) return null;
        const btnWidth = buttonRef.current?.offsetWidth || 48;
        const btnHeight = buttonRef.current?.offsetHeight || 48;
        const clampedX = Math.min(Math.max(8, prev.x), Math.max(8, window.innerWidth - btnWidth - 8));
        const clampedY = Math.min(Math.max(8, prev.y), Math.max(8, window.innerHeight - btnHeight - 8));
        if (clampedX !== prev.x || clampedY !== prev.y) {
          const next = { x: clampedX, y: clampedY };
          try {
            sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
          } catch {}
          return next;
        }
        return prev;
      });
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Mouse drag handler
  const handleMouseDown = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (e.button !== 0) return;
    const btn = buttonRef.current;
    if (!btn) return;
    const rect = btn.getBoundingClientRect();

    dragInfo.current = {
      startX: e.clientX,
      startY: e.clientY,
      btnStartX: rect.left,
      btnStartY: rect.top,
      isDragging: true,
      hasMoved: false,
    };

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!dragInfo.current.isDragging) return;
      const dx = moveEvent.clientX - dragInfo.current.startX;
      const dy = moveEvent.clientY - dragInfo.current.startY;

      if (!dragInfo.current.hasMoved && Math.hypot(dx, dy) > 5) {
        dragInfo.current.hasMoved = true;
        setIsDragging(true);
      }

      if (dragInfo.current.hasMoved) {
        const btnWidth = btn.offsetWidth;
        const btnHeight = btn.offsetHeight;
        const newX = dragInfo.current.btnStartX + dx;
        const newY = dragInfo.current.btnStartY + dy;

        const clampedX = Math.min(Math.max(8, newX), Math.max(8, window.innerWidth - btnWidth - 8));
        const clampedY = Math.min(Math.max(8, newY), Math.max(8, window.innerHeight - btnHeight - 8));

        setPosition({ x: clampedX, y: clampedY });
      }
    };

    const handleMouseUp = () => {
      if (dragInfo.current.isDragging) {
        if (dragInfo.current.hasMoved) {
          setPosition((latestPos) => {
            if (latestPos) {
              try {
                sessionStorage.setItem(STORAGE_KEY, JSON.stringify(latestPos));
              } catch {}
            }
            return latestPos;
          });
        }
        dragInfo.current.isDragging = false;
        setIsDragging(false);
      }

      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  };

  // Touch drag handler for mobile
  const handleTouchStart = (e: React.TouchEvent<HTMLButtonElement>) => {
    if (e.touches.length !== 1) return;
    const touch = e.touches[0];
    const btn = buttonRef.current;
    if (!btn) return;
    const rect = btn.getBoundingClientRect();

    dragInfo.current = {
      startX: touch.clientX,
      startY: touch.clientY,
      btnStartX: rect.left,
      btnStartY: rect.top,
      isDragging: true,
      hasMoved: false,
    };

    const handleTouchMove = (moveEvent: TouchEvent) => {
      if (!dragInfo.current.isDragging || moveEvent.touches.length !== 1) return;
      const curTouch = moveEvent.touches[0];
      const dx = curTouch.clientX - dragInfo.current.startX;
      const dy = curTouch.clientY - dragInfo.current.startY;

      if (!dragInfo.current.hasMoved && Math.hypot(dx, dy) > 5) {
        dragInfo.current.hasMoved = true;
        setIsDragging(true);
      }

      if (dragInfo.current.hasMoved) {
        if (moveEvent.cancelable) {
          moveEvent.preventDefault();
        }
        const btnWidth = btn.offsetWidth;
        const btnHeight = btn.offsetHeight;
        const newX = dragInfo.current.btnStartX + dx;
        const newY = dragInfo.current.btnStartY + dy;

        const clampedX = Math.min(Math.max(8, newX), Math.max(8, window.innerWidth - btnWidth - 8));
        const clampedY = Math.min(Math.max(8, newY), Math.max(8, window.innerHeight - btnHeight - 8));

        setPosition({ x: clampedX, y: clampedY });
      }
    };

    const handleTouchEnd = () => {
      if (dragInfo.current.isDragging) {
        if (dragInfo.current.hasMoved) {
          setPosition((latestPos) => {
            if (latestPos) {
              try {
                sessionStorage.setItem(STORAGE_KEY, JSON.stringify(latestPos));
              } catch {}
            }
            return latestPos;
          });
        }
        dragInfo.current.isDragging = false;
        setIsDragging(false);
      }

      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleTouchEnd);
      window.removeEventListener("touchcancel", handleTouchEnd);
    };

    window.addEventListener("touchmove", handleTouchMove, { passive: false });
    window.addEventListener("touchend", handleTouchEnd);
    window.addEventListener("touchcancel", handleTouchEnd);
  };

  const handleButtonClick = () => {
    // Suppress click trigger if this was a drag gesture
    if (dragInfo.current.hasMoved) {
      dragInfo.current.hasMoved = false;
      return;
    }
    setIsOpen((prev) => !prev);
  };

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

  // Button position style: fixed, z-index 50, bottom 90px, right 16px by default or persisted (x, y)
  const buttonStyle: React.CSSProperties = position
    ? {
        position: "fixed",
        left: `${position.x}px`,
        top: `${position.y}px`,
        bottom: "auto",
        right: "auto",
        zIndex: 50,
      }
    : {
        position: "fixed",
        bottom: "90px",
        right: "16px",
        zIndex: 50,
      };

  return (
    <>
      {/* Chat Window Dialog */}
      {isOpen && (
        <div 
          className="fixed bottom-[90px] right-4 z-50 w-[calc(100vw-32px)] max-w-sm sm:w-96 bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-zinc-800 flex flex-col overflow-hidden animate-in slide-in-from-bottom-5"
          role="dialog"
          aria-label="Ask Institutional AI"
        >
          {/* Header */}
          <div className="bg-slate-900 dark:bg-black text-white p-4 flex justify-between items-center border-b border-slate-800">
            <div className="flex items-center gap-2">
              <Bot className="w-5 h-5 text-blue-400" />
              <h3 className="font-semibold text-sm">Ask Institutional AI</h3>
            </div>
            <button 
              onClick={() => setIsOpen(false)}
              className="text-slate-400 hover:text-white transition-colors cursor-pointer"
              aria-label="Close AI dialog"
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

      {/* Draggable Floating Button: Full pill on desktop, circular icon on mobile */}
      {!isOpen && (
        <button 
          ref={buttonRef}
          style={buttonStyle}
          onClick={handleButtonClick}
          onMouseDown={handleMouseDown}
          onTouchStart={handleTouchStart}
          aria-label="Ask Institutional AI"
          title="Ask Institutional AI (Press and drag anywhere)"
          className={`select-none touch-none bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-full font-semibold shadow-xl border border-slate-700 dark:border-zinc-200 transition-shadow flex items-center justify-center gap-2 group ${
            isDragging 
              ? "cursor-grabbing scale-105 shadow-2xl opacity-90" 
              : "cursor-grab hover:shadow-2xl hover:-translate-y-0.5"
          } w-12 h-12 md:w-auto md:h-12 md:px-5 md:py-3 text-sm`}
        >
          <MessageSquare className="w-5 h-5 text-blue-400 dark:text-blue-600 group-hover:scale-110 transition-transform shrink-0" />
          <span className="hidden md:inline whitespace-nowrap">Ask Institutional AI</span>
        </button>
      )}
    </>
  );
}

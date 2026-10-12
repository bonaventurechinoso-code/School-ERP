"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { X } from "lucide-react";

interface SheetContextType {
  open: boolean;
  setOpen: (open: boolean) => void;
}

const SheetContext = createContext<SheetContextType | undefined>(undefined);

export function Sheet({
  children,
  open: controlledOpen,
  onOpenChange,
}: {
  children: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;

  const setOpen = (val: boolean) => {
    if (!isControlled) {
      setInternalOpen(val);
    }
    onOpenChange?.(val);
  };

  return (
    <SheetContext.Provider value={{ open, setOpen }}>
      {children}
    </SheetContext.Provider>
  );
}

export function SheetTrigger({
  asChild,
  children,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { asChild?: boolean }) {
  const ctx = useContext(SheetContext);
  if (!ctx) throw new Error("SheetTrigger must be used within Sheet");

  return (
    <button
      type="button"
      className={className}
      onClick={(e) => {
        props.onClick?.(e);
        ctx.setOpen(true);
      }}
      {...props}
    >
      {children}
    </button>
  );
}

export function SheetClose({
  children,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const ctx = useContext(SheetContext);
  if (!ctx) throw new Error("SheetClose must be used within Sheet");

  return (
    <button
      type="button"
      className={className}
      onClick={(e) => {
        props.onClick?.(e);
        ctx.setOpen(false);
      }}
      {...props}
    >
      {children}
    </button>
  );
}

export function SheetContent({
  side = "left",
  className = "",
  children,
}: {
  side?: "left" | "right" | "top" | "bottom";
  className?: string;
  children: React.ReactNode;
}) {
  const ctx = useContext(SheetContext);
  if (!ctx) throw new Error("SheetContent must be used within Sheet");

  // Lock body scroll when sheet is open
  useEffect(() => {
    if (ctx.open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [ctx.open]);

  // Handle ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && ctx.open) {
        ctx.setOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [ctx.open, ctx]);

  if (!ctx.open) return null;

  const sideClasses = {
    left: "inset-y-0 left-0 h-full w-[280px] sm:w-[320px] max-w-[85vw] border-r border-slate-800 animate-in slide-in-from-left duration-300",
    right: "inset-y-0 right-0 h-full w-[280px] sm:w-[320px] max-w-[85vw] border-l border-slate-800 animate-in slide-in-from-right duration-300",
    top: "inset-x-0 top-0 w-full border-b border-slate-800 animate-in slide-in-from-top duration-300",
    bottom: "inset-x-0 bottom-0 w-full border-t border-slate-800 animate-in slide-in-from-bottom duration-300",
  };

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm transition-opacity duration-300 animate-in fade-in"
        onClick={() => ctx.setOpen(false)}
        aria-hidden="true"
      />

      {/* Content panel */}
      <div
        className={`fixed z-50 bg-slate-950 text-slate-100 shadow-2xl transition ease-in-out flex flex-col ${sideClasses[side]} ${className}`}
        role="dialog"
        aria-modal="true"
      >
        <button
          type="button"
          onClick={() => ctx.setOpen(false)}
          className="absolute right-4 top-4 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors z-50"
          aria-label="Close panel"
        >
          <X className="w-5 h-5" />
        </button>
        {children}
      </div>
    </div>
  );
}

export function SheetHeader({
  className = "",
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`flex flex-col space-y-1.5 text-center sm:text-left ${className}`}>
      {children}
    </div>
  );
}

export function SheetTitle({
  className = "",
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <h3 className={`text-base font-semibold leading-none tracking-tight text-white ${className}`}>
      {children}
    </h3>
  );
}

export function SheetDescription({
  className = "",
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return <p className={`text-xs text-slate-400 ${className}`}>{children}</p>;
}

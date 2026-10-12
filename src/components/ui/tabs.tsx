"use client";

import React, { createContext, useContext, useState } from "react";

interface TabsContextType {
  value: string;
  onValueChange: (val: string) => void;
}

const TabsContext = createContext<TabsContextType | undefined>(undefined);

export function Tabs({
  defaultValue,
  value: controlledVal,
  onValueChange,
  className = "",
  children,
}: {
  defaultValue?: string;
  value?: string;
  onValueChange?: (val: string) => void;
  className?: string;
  children: React.ReactNode;
}) {
  const [internalVal, setInternalVal] = useState(defaultValue || "");
  const value = controlledVal !== undefined ? controlledVal : internalVal;
  const setValue = onValueChange || setInternalVal;

  return (
    <TabsContext.Provider value={{ value, onValueChange: setValue }}>
      <div className={className}>{children}</div>
    </TabsContext.Provider>
  );
}

export function TabsList({
  className = "",
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`inline-flex items-center justify-center rounded-xl bg-slate-100 p-1 text-slate-500 ${className}`}
    >
      {children}
    </div>
  );
}

export function TabsTrigger({
  value,
  className = "",
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { value: string }) {
  const ctx = useContext(TabsContext);
  const active = ctx?.value === value;

  return (
    <button
      type="button"
      onClick={() => ctx?.onValueChange(value)}
      className={`inline-flex items-center justify-center whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition-all focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 ${
        active
          ? "bg-white text-slate-950 shadow-sm"
          : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
      } ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export function TabsContent({
  value,
  className = "",
  children,
}: {
  value: string;
  className?: string;
  children: React.ReactNode;
}) {
  const ctx = useContext(TabsContext);
  if (ctx?.value !== value) return null;

  return <div className={`focus-visible:outline-none ${className}`}>{children}</div>;
}

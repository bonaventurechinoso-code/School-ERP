"use client";

import React, { useState, useRef, useEffect } from "react";
import { Search, ChevronDown, X, Check } from "lucide-react";

export interface MultiSelectOption {
  id: string;
  label: string;
}

export interface SearchableMultiSelectProps {
  options: MultiSelectOption[];
  selected: string[];
  onChange: (selected: string[]) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  disabled?: boolean;
  className?: string;
}

export function SearchableMultiSelect({
  options,
  selected,
  onChange,
  placeholder = "Select options...",
  searchPlaceholder = "Search...",
  disabled = false,
  className = "",
}: SearchableMultiSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen]);

  const toggleOption = (id: string) => {
    if (disabled) return;
    if (selected.includes(id)) {
      onChange(selected.filter((item) => item !== id));
    } else {
      onChange([...selected, id]);
    }
  };

  const removeChip = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (disabled) return;
    onChange(selected.filter((item) => item !== id));
  };

  const clearAll = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (disabled) return;
    onChange([]);
  };

  const filteredOptions = options.filter((opt) =>
    opt.label.toLowerCase().includes(searchTerm.toLowerCase().trim())
  );

  return (
    <div ref={containerRef} className={`relative w-full ${className}`}>
      {/* Trigger & Chips Container */}
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        onClick={() => !disabled && setIsOpen((prev) => !prev)}
        onKeyDown={(e) => {
          if (!disabled && (e.key === "Enter" || e.key === " ")) {
            e.preventDefault();
            setIsOpen((prev) => !prev);
          }
        }}
        className={`min-h-[42px] w-full p-2 bg-slate-50/50 dark:bg-zinc-950/50 border border-slate-200 dark:border-zinc-800 rounded-xl flex items-center justify-between gap-2 cursor-pointer transition focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none ${
          disabled ? "opacity-50 cursor-not-allowed" : "hover:border-slate-300 dark:hover:border-zinc-700"
        } ${isOpen ? "ring-2 ring-indigo-500 border-indigo-500" : ""}`}
      >
        <div className="flex flex-wrap items-center gap-1.5 flex-1 min-w-0">
          {selected.length === 0 ? (
            <span className="text-xs text-slate-400 dark:text-zinc-600 px-1 select-none">
              {placeholder}
            </span>
          ) : (
            selected.map((item) => {
              const matched = options.find((opt) => opt.id === item);
              const label = matched ? matched.label : item;
              return (
                <span
                  key={item}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60 transition-all select-none animate-in fade-in zoom-in-95 duration-100"
                >
                  <span className="truncate max-w-[200px]">{label}</span>
                  <button
                    type="button"
                    onClick={(e) => removeChip(item, e)}
                    disabled={disabled}
                    className="p-0.5 rounded-full hover:bg-indigo-200 dark:hover:bg-indigo-800/50 text-indigo-500 hover:text-indigo-800 dark:hover:text-indigo-200 transition-colors cursor-pointer"
                    aria-label={`Remove ${label}`}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              );
            })
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0 pr-1">
          {selected.length > 0 && !disabled && (
            <button
              type="button"
              onClick={clearAll}
              className="text-[11px] text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300 px-1 transition-colors cursor-pointer"
              title="Clear all"
            >
              Clear
            </button>
          )}
          <ChevronDown
            className={`w-4 h-4 text-slate-400 dark:text-zinc-500 transition-transform duration-200 ${
              isOpen ? "rotate-180 text-indigo-600 dark:text-indigo-400" : ""
            }`}
          />
        </div>
      </div>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute z-50 left-0 right-0 mt-1.5 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
          {/* Top Search Input */}
          <div className="p-2 border-b border-slate-100 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-950/40">
            <div className="relative flex items-center">
              <Search className="w-3.5 h-3.5 absolute left-2.5 text-slate-400 dark:text-zinc-500" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={searchPlaceholder}
                className="w-full pl-8 pr-7 py-1.5 text-xs bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-750 text-slate-900 dark:text-zinc-100 rounded-lg outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 placeholder-slate-400 dark:placeholder-zinc-500"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm("")}
                  className="absolute right-2 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300 p-0.5 cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>

          {/* Options List */}
          <div className="max-h-56 overflow-y-auto p-1.5 space-y-0.5">
            {filteredOptions.length === 0 ? (
              <div className="py-4 text-center text-xs text-slate-400 dark:text-zinc-500 italic">
                No matching options found
              </div>
            ) : (
              filteredOptions.map((opt) => {
                const isSelected = selected.includes(opt.id);
                return (
                  <div
                    key={opt.id}
                    onClick={() => toggleOption(opt.id)}
                    className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs cursor-pointer select-none transition-colors ${
                      isSelected
                        ? "bg-indigo-50 dark:bg-indigo-950/40 text-indigo-900 dark:text-indigo-200 font-medium"
                        : "text-slate-700 dark:text-zinc-300 hover:bg-slate-100/70 dark:hover:bg-zinc-800/60"
                    }`}
                  >
                    <span className="truncate pr-2">{opt.label}</span>
                    <div
                      className={`w-4 h-4 rounded flex items-center justify-center shrink-0 border transition-all ${
                        isSelected
                          ? "bg-indigo-600 border-indigo-600 text-white"
                          : "border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-950"
                      }`}
                    >
                      {isSelected && <Check className="w-3 h-3 stroke-[2.5]" />}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer Bar */}
          <div className="px-3 py-2 border-t border-slate-100 dark:border-zinc-800 bg-slate-50/70 dark:bg-zinc-950/60 flex items-center justify-between text-[11px] text-slate-500 dark:text-zinc-400">
            <span>
              {selected.length} of {options.length} selected
            </span>
            <div className="flex items-center gap-2">
              {selected.length < options.length && (
                <button
                  type="button"
                  onClick={() => onChange(options.map((o) => o.id))}
                  className="text-indigo-600 dark:text-indigo-400 hover:underline font-medium cursor-pointer"
                >
                  Select all
                </button>
              )}
              {selected.length > 0 && (
                <button
                  type="button"
                  onClick={() => onChange([])}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300 hover:underline cursor-pointer"
                >
                  Reset
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

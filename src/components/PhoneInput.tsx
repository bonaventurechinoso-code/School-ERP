"use client";

import React, { InputHTMLAttributes } from "react";
import { useNumericInput } from "@/hooks/useNumericInput";

interface PhoneInputProps extends InputHTMLAttributes<HTMLInputElement> {
  // If controlled
  onValueChange?: (val: string) => void;
}

export function PhoneInput({ onValueChange, onChange, ...props }: PhoneInputProps) {
  const { handleNumericChange } = useNumericInput();

  return (
    <input
      type="tel"
      inputMode="numeric"
      pattern="[0-9+]*"
      {...props}
      onChange={(e) => {
        handleNumericChange(e, (val) => {
          if (onValueChange) onValueChange(val);
        });
        if (onChange) onChange(e);
      }}
    />
  );
}

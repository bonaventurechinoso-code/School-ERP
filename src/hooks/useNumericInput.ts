import { ChangeEvent } from "react";

export function useNumericInput() {
  const handleNumericChange = (e: ChangeEvent<HTMLInputElement>, callback: (val: string) => void) => {
    // Hard regex replacement to block non-numeric keystrokes
    let sanitizedValue = e.target.value.replace(/[^0-9+]/g, '');
    
    // Strictly truncates and cuts off any extra digits instantly (max length 14)
    if (sanitizedValue.length > 14) {
      sanitizedValue = sanitizedValue.slice(0, 14);
    }
    
    e.target.value = sanitizedValue;
    callback(sanitizedValue);
  };

  return { handleNumericChange };
}

import React from "react";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
  size?: "default" | "sm" | "lg" | "icon";
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className = "", variant = "default", size = "default", ...props }, ref) => {
    const base =
      "inline-flex items-center justify-center whitespace-nowrap rounded-xl text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 disabled:pointer-events-none disabled:opacity-50 cursor-pointer";
    const variants = {
      default: "bg-slate-950 text-white shadow hover:bg-slate-800",
      destructive: "bg-rose-600 text-white shadow-sm hover:bg-rose-700",
      outline: "border border-slate-200 bg-white shadow-sm hover:bg-slate-50 text-slate-800",
      secondary: "bg-slate-100 text-slate-900 shadow-sm hover:bg-slate-200",
      ghost: "hover:bg-slate-100 hover:text-slate-900 text-slate-700",
      link: "text-blue-600 underline-offset-4 hover:underline",
    };
    const sizes = {
      default: "h-10 px-4 py-2",
      sm: "h-8 rounded-lg px-3 text-xs",
      lg: "h-11 rounded-xl px-8",
      icon: "h-9 w-9",
    };

    return (
      <button
        ref={ref}
        className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

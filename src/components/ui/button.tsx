import { forwardRef, type ButtonHTMLAttributes } from "react";

const variantStyles: Record<string, string> = {
  primary: "bg-mac-black text-mac-white hover:bg-mac-dark-gray",
  secondary: "bg-mac-white text-mac-black hover:bg-mac-highlight-soft",
  danger: "bg-mac-white text-severity-critical border-severity-critical hover:bg-severity-critical hover:text-mac-white",
  ghost: "bg-transparent text-mac-black hover:bg-mac-highlight-soft border-transparent",
};

const sizeStyles: Record<string, string> = {
  sm: "px-3 py-1 text-sm",
  md: "px-4 py-1.5 text-sm",
  lg: "px-6 py-2.5 text-base",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger" | "ghost";
  size?: "sm" | "md" | "lg";
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "primary", size = "md", className = "", disabled, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled}
        className={`inline-flex items-center justify-center rounded-lg border border-mac-border-strong font-bold font-[family-name:var(--font-pixel)] transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-mac-highlight/50 focus:ring-offset-1 focus:ring-offset-mac-cream disabled:text-mac-gray disabled:border-mac-gray disabled:bg-mac-light-gray disabled:pointer-events-none ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
        {...props}
      >
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";

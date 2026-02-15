import { forwardRef, type ButtonHTMLAttributes } from "react";

const variantStyles: Record<string, string> = {
  primary: "bg-mac-black text-mac-white hover:bg-mac-dark-gray",
  secondary: "bg-mac-white text-mac-black hover:bg-mac-light-gray",
  danger: "bg-mac-white text-[#CC0000] border-[#CC0000] hover:bg-[#CC0000] hover:text-mac-white",
  ghost: "bg-transparent text-mac-black hover:bg-mac-light-gray border-transparent",
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
        className={`inline-flex items-center justify-center rounded-[6px] border border-mac-black font-bold font-[family-name:var(--font-pixel)] transition-colors focus:outline-none focus:ring-2 focus:ring-mac-black focus:ring-offset-1 focus:ring-offset-mac-cream disabled:text-mac-gray disabled:border-mac-gray disabled:bg-mac-light-gray disabled:pointer-events-none ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
        {...props}
      >
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";

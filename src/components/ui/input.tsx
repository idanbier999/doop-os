import { forwardRef, type InputHTMLAttributes } from "react";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, className = "", id, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, "-");

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-sm font-bold text-mac-black mb-1 font-[family-name:var(--font-pixel)]"
          >
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={`block w-full rounded-md border bg-mac-white px-2 py-1.5 text-sm text-mac-black placeholder-mac-gray mac-inset focus:outline-none focus:ring-2 focus:ring-mac-highlight/50 ${
            error ? "border-severity-critical" : "border-mac-border"
          } ${className}`}
          {...props}
        />
        {error && (
          <p className="mt-1 text-sm text-severity-critical font-[family-name:var(--font-pixel)]">{error}</p>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";

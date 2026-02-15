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
          className={`block w-full rounded-[2px] border border-mac-black bg-mac-white px-2 py-1.5 text-sm text-mac-black placeholder-mac-gray shadow-[inset_1px_1px_0px_#555] focus:outline-none focus:ring-2 focus:ring-mac-black ${
            error ? "border-[#CC0000]" : "border-mac-black"
          } ${className}`}
          {...props}
        />
        {error && (
          <p className="mt-1 text-sm text-[#CC0000] font-[family-name:var(--font-pixel)]">{error}</p>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";

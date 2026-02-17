import { forwardRef, type SelectHTMLAttributes } from "react";

export interface SelectOption {
  label: string;
  value: string;
}

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options: SelectOption[];
  placeholder?: string;
  error?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, options, placeholder, error, className = "", id, ...props }, ref) => {
    const selectId = id ?? label?.toLowerCase().replace(/\s+/g, "-");

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={selectId}
            className="block text-sm font-bold text-mac-black mb-1 font-[family-name:var(--font-pixel)]"
          >
            {label}
          </label>
        )}
        <select
          ref={ref}
          id={selectId}
          className={`block w-full rounded-md border bg-mac-white px-2 py-1.5 text-sm text-mac-black mac-inset focus:outline-none focus:ring-2 focus:ring-mac-highlight/50 ${
            error ? "border-severity-critical" : "border-mac-border"
          } ${className}`}
          {...props}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        {error && (
          <p className="mt-1 text-sm text-severity-critical font-[family-name:var(--font-pixel)]">{error}</p>
        )}
      </div>
    );
  }
);

Select.displayName = "Select";

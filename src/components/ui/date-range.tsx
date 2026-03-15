"use client";

import { Input } from "@/components/ui/input";

interface DateRangeProps {
  fromDate: string;
  toDate: string;
  onFromChange: (date: string) => void;
  onToChange: (date: string) => void;
}

export function DateRange({ fromDate, toDate, onFromChange, onToChange }: DateRangeProps) {
  return (
    <div className="flex items-end gap-2 w-full sm:w-auto">
      <div className="flex-1 sm:w-40 sm:flex-none">
        <label className="block text-sm font-bold text-mac-black mb-1 font-[family-name:var(--font-pixel)]">
          From
        </label>
        <Input type="date" value={fromDate} onChange={(e) => onFromChange(e.target.value)} />
      </div>
      <div className="flex-1 sm:w-40 sm:flex-none">
        <label className="block text-sm font-bold text-mac-black mb-1 font-[family-name:var(--font-pixel)]">
          To
        </label>
        <Input type="date" value={toDate} onChange={(e) => onToChange(e.target.value)} />
      </div>
    </div>
  );
}

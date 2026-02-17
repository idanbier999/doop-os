"use client";

import { useState, useRef, useEffect } from "react";

const TAG_COLORS = ['#0055CC', '#007700', '#7722AA', '#CC6600', '#CC0000', '#007777', '#CC0077', '#886600'];

function getTagColor(tag: string): string {
  let hash = 0;
  for (let i = 0; i < tag.length; i++) {
    hash = tag.charCodeAt(i) + ((hash << 5) - hash);
  }
  return TAG_COLORS[Math.abs(hash) % TAG_COLORS.length];
}

interface TagFilterProps {
  availableTags: string[];
  selectedTags: string[];
  onChange: (tags: string[]) => void;
}

export function TagFilter({ availableTags, selectedTags, onChange }: TagFilterProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function toggleTag(tag: string) {
    if (selectedTags.includes(tag)) {
      onChange(selectedTags.filter(t => t !== tag));
    } else {
      onChange([...selectedTags, tag]);
    }
  }

  let buttonLabel = "Tags: All";
  if (selectedTags.length === 1) {
    buttonLabel = `Tags: ${selectedTags[0]}`;
  } else if (selectedTags.length === 2) {
    buttonLabel = `Tags: ${selectedTags.join(", ")}`;
  } else if (selectedTags.length > 2) {
    buttonLabel = `Tags: ${selectedTags.length} selected`;
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-1 rounded-[2px] border border-mac-black bg-mac-white px-2 py-1.5 text-sm text-mac-black font-[family-name:var(--font-pixel)] shadow-[1px_1px_0px_#000] active:shadow-none active:translate-x-[1px] active:translate-y-[1px]"
      >
        {buttonLabel}
        <span className="ml-1 text-[10px]">&#9660;</span>
      </button>
      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 min-w-[200px] rounded-[2px] border border-mac-black bg-mac-white shadow-[2px_2px_0px_#000]">
          {availableTags.length === 0 ? (
            <div className="px-3 py-2 text-sm text-mac-dark-gray font-[family-name:var(--font-pixel)]">
              No tags available
            </div>
          ) : (
            <>
              <div className="max-h-[240px] overflow-y-auto">
                {availableTags.map(tag => {
                  const checked = selectedTags.includes(tag);
                  const color = getTagColor(tag);
                  return (
                    <label
                      key={tag}
                      className="flex cursor-pointer items-center gap-2 px-3 py-1.5 hover:bg-mac-highlight hover:text-mac-highlight-text transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleTag(tag)}
                        className="accent-mac-black"
                      />
                      <span
                        className="h-2 w-2 rounded-full shrink-0"
                        style={{ backgroundColor: color }}
                      />
                      <span className="text-sm font-[family-name:var(--font-pixel)]">
                        {tag}
                      </span>
                    </label>
                  );
                })}
              </div>
              {selectedTags.length > 0 && (
                <div className="border-t border-mac-black px-3 py-1.5">
                  <button
                    type="button"
                    onClick={() => onChange([])}
                    className="text-xs text-mac-dark-gray hover:text-mac-black font-[family-name:var(--font-pixel)]"
                  >
                    Clear all
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

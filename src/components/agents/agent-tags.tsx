"use client";

const TAG_COLORS = ['#0055CC', '#007700', '#7722AA', '#CC6600', '#CC0000', '#007777', '#CC0077', '#886600'];

function getTagColor(tag: string): string {
  let hash = 0;
  for (let i = 0; i < tag.length; i++) {
    hash = tag.charCodeAt(i) + ((hash << 5) - hash);
  }
  return TAG_COLORS[Math.abs(hash) % TAG_COLORS.length];
}

interface AgentTagsProps {
  tags: string[] | null;
  size?: "sm" | "md";
  maxVisible?: number;
}

export function AgentTags({ tags, size = "sm", maxVisible }: AgentTagsProps) {
  if (!tags || tags.length === 0) return null;

  const visible = maxVisible ? tags.slice(0, maxVisible) : tags;
  const remaining = maxVisible ? Math.max(0, tags.length - maxVisible) : 0;

  return (
    <div className="flex items-center gap-1 flex-wrap">
      {visible.map(tag => {
        const color = getTagColor(tag);
        return (
          <span
            key={tag}
            className={`inline-flex items-center border border-mac-black bg-mac-white font-[family-name:var(--font-pixel)] ${
              size === "sm" ? "px-1.5 py-0 text-[10px]" : "px-2 py-0.5 text-xs"
            }`}
            style={{ borderLeftWidth: "3px", borderLeftColor: color, color }}
          >
            {tag}
          </span>
        );
      })}
      {remaining > 0 && (
        <span className={`text-mac-dark-gray font-[family-name:var(--font-pixel)] ${
          size === "sm" ? "text-[10px]" : "text-xs"
        }`}>
          +{remaining}
        </span>
      )}
    </div>
  );
}

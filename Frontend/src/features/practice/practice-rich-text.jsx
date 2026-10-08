import { Fragment } from "react";

export const TEXT_COLORS = {
  red: "#ef4444",
  rose: "#f43f5e",
  pink: "#ec4899",
  magenta: "#d946ef",
  purple: "#a855f7",
  violet: "#8b5cf6",
  indigo: "#6366f1",
  blue: "#3b82f6",
  sky: "#0ea5e9",
  cyan: "#06b6d4",
  teal: "#14b8a6",
  emerald: "#10b981",
  green: "#22c55e",
  lime: "#84cc16",
  yellow: "#eab308",
  amber: "#f59e0b",
  orange: "#f97316",
  coral: "#fb7185",
  slate: "#64748b",
  gray: "#9ca3af",
};

// A small, bounded inline grammar. HTML and arbitrary CSS are always plain text.
export function PracticeRichText({ children, depth = 0 }) {
  const text = String(children ?? "");
  if (depth >= 8) return text;
  const pattern =
    /\*\*([^*]+)\*\*|\*([^*]+)\*|\[color=([a-z]+)\]([\s\S]*?)\[\/color\]/g;
  const pieces = [];
  let last = 0;
  for (const match of text.matchAll(pattern)) {
    pieces.push(text.slice(last, match.index));
    const content = (
      <PracticeRichText depth={depth + 1}>
        {match[1] ?? match[2] ?? match[4]}
      </PracticeRichText>
    );
    pieces.push(
      match[1] ? (
        <strong key={match.index}>{content}</strong>
      ) : match[2] ? (
        <em key={match.index}>{content}</em>
      ) : TEXT_COLORS[match[3]] ? (
        <span key={match.index} style={{ color: TEXT_COLORS[match[3]] }}>
          {content}
        </span>
      ) : (
        match[0]
      ),
    );
    last = match.index + match[0].length;
  }
  pieces.push(text.slice(last));
  return (
    <>
      {pieces.map((piece, i) => (
        <Fragment key={i}>{piece}</Fragment>
      ))}
    </>
  );
}

type Period = "day" | "week" | "month";

const LABELS: Record<Period, string> = { day: "Today", week: "This Week", month: "This Month" };

export function PeriodSelector({
  value,
  onChange,
}: {
  value: Period;
  onChange: (p: Period) => void;
}) {
  return (
    <div className="flex gap-1 bg-surface border border-border rounded-lg p-1">
      {(["day", "week", "month"] as Period[]).map((p) => (
        <button
          key={p}
          onClick={() => onChange(p)}
          className={`flex-1 py-1.5 px-3 rounded text-sm font-medium transition-colors ${
            value === p ? "bg-accent text-black" : "text-muted hover:text-white"
          }`}
        >
          {LABELS[p]}
        </button>
      ))}
    </div>
  );
}

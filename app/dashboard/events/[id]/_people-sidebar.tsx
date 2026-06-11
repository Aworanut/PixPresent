"use client";

import type { EventPerson } from "@/lib/people/queries";

type Props = {
  people: EventPerson[];
  activeId: string | null;
  onSelect: (personId: string | null) => void;
  layout: "vertical" | "horizontal";
};

// People in this event (named, confirmed). Click a name to filter the grid;
// click the active one (or "ทั้งหมด") to clear. Vertical = desktop aside,
// horizontal = mobile chip row.
export function PeopleSidebar({ people, activeId, onSelect, layout }: Props) {
  if (people.length === 0) return null;

  if (layout === "horizontal") {
    return (
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        <Chip active={activeId === null} onClick={() => onSelect(null)} label="ทั้งหมด" />
        {people.map((p) => (
          <Chip
            key={p.id}
            active={activeId === p.id}
            onClick={() => onSelect(activeId === p.id ? null : p.id)}
            label={`${p.name} ${p.count}`}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <p className="px-1 pb-1 text-xs font-semibold uppercase tracking-widest text-zinc-400 dark:text-zinc-500 font-mono">
        บุคคลในงานนี้
      </p>
      <Row active={activeId === null} onClick={() => onSelect(null)} name="ทั้งหมด" />
      {people.map((p) => (
        <Row
          key={p.id}
          active={activeId === p.id}
          onClick={() => onSelect(activeId === p.id ? null : p.id)}
          name={p.name}
          count={p.count}
        />
      ))}
    </div>
  );
}

function Row({
  active,
  onClick,
  name,
  count,
}: {
  active: boolean;
  onClick: () => void;
  name: string;
  count?: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors",
        active
          ? "bg-[#D4AF37]/15 ring-1 ring-[#D4AF37]"
          : "hover:bg-zinc-100 dark:hover:bg-zinc-800/60",
      ].join(" ")}
    >
      {count !== undefined && (
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-200 dark:bg-zinc-700 text-[10px] font-bold text-zinc-600 dark:text-zinc-300">
          {name.charAt(0)}
        </span>
      )}
      <span className="min-w-0 flex-1 truncate text-sm text-zinc-800 dark:text-zinc-200">{name}</span>
      {count !== undefined && (
        <span className={`text-xs tabular-nums ${active ? "text-[#D4AF37] font-bold" : "text-zinc-400"}`}>
          {count}
        </span>
      )}
    </button>
  );
}

function Chip({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors",
        active
          ? "bg-[#D4AF37] text-black"
          : "border border-zinc-300 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:border-[#D4AF37]",
      ].join(" ")}
    >
      {label}
    </button>
  );
}

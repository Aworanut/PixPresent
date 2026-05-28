"use client";

import { useState, useRef, useEffect, useTransition } from "react";
import { PencilSquareIcon } from "@heroicons/react/24/outline";
import { updateEventName } from "@/lib/actions/events";

export function EventTitleEditor({
  eventId,
  initialName,
}: {
  eventId: string;
  initialName: string;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(initialName);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when editing starts
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleSave = () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setName(initialName);
      setIsEditing(false);
      return;
    }

    if (trimmed === initialName) {
      setIsEditing(false);
      return;
    }

    setError(null);
    startTransition(async () => {
      const result = await updateEventName(eventId, trimmed);
      if (result?.error) {
        setError(result.error);
        setName(initialName); // Rollback
      }
      setIsEditing(false);
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleSave();
    } else if (e.key === "Escape") {
      setName(initialName);
      setIsEditing(false);
      setError(null);
    }
  };

  if (isEditing) {
    return (
      <div className="flex items-center min-w-0 max-w-sm sm:max-w-md">
        <input
          ref={inputRef}
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={handleSave}
          onKeyDown={handleKeyDown}
          disabled={pending}
          className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50 bg-transparent border-b border-zinc-300 dark:border-zinc-700 focus:border-[#D4AF37] outline-none max-w-full py-0.5 leading-tight font-heading dark:focus:border-[#D4AF37] transition-colors"
          maxLength={120}
        />
        {pending && (
          <span className="ml-2 text-xs text-zinc-400 animate-pulse font-mono">
            Saving...
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="group inline-flex items-center min-w-0 gap-1.5">
      <h1 
        onClick={() => setIsEditing(true)}
        className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50 truncate cursor-pointer hover:opacity-80 transition-opacity font-heading"
      >
        {name}
      </h1>
      <button
        type="button"
        onClick={() => setIsEditing(true)}
        title="คลิกเพื่อแก้ไขชื่อ event"
        className="flex-shrink-0 opacity-0 group-hover:opacity-100 focus:opacity-100 text-zinc-400 hover:text-[#D4AF37] transition-all duration-300 p-1 cursor-pointer rounded"
      >
        <PencilSquareIcon className="h-4 w-4 stroke-[1.5]" />
      </button>
      {error && (
        <span className="text-xs text-rose-500 font-mono self-center">
          {error}
        </span>
      )}
    </div>
  );
}

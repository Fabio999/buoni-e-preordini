import { Check, ChevronsUpDown, Plus } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { matchesText } from "@/lib/search";
import { cn } from "@/lib/utils";
import { selectClass } from "./SimpleDialogs";

export type SearchOption = {
  id: string;
  /** Main text shown in the list and matched first. */
  label: string;
  /** Small text shown on the right (e.g. price or date). */
  hint?: string;
  /** Extra words that make the option findable (e.g. game, type, reversed name). */
  keywords?: string[];
};

/**
 * Select with a search box: type letters to filter the list.
 * Filtering uses the shared matcher (accents and case ignored, every word must match,
 * reversed "cognome nome" accepted) so it behaves like the search boxes in the lists.
 * The panel is rendered inline (no portal) so it keeps working inside other dialogs.
 */
export function SearchSelect({
  label,
  options,
  value,
  onChange,
  onCreate,
  placeholder = "Seleziona…",
  searchPlaceholder,
  emptyHint,
  disabled = false,
  className = "",
}: {
  label: string;
  options: SearchOption[];
  value: string;
  onChange: (id: string) => void;
  onCreate?: () => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyHint?: string;
  disabled?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const wrap = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (event: PointerEvent) => {
      if (!wrap.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  const selected = options.find((option) => option.id === value);
  const filtered = useMemo(
    () => options.filter((option) => matchesText(option.label, query, option.keywords ?? [])),
    [options, query],
  );
  const createLabel = `Nuovo ${label.toLowerCase()}`;

  const pick = (id: string) => {
    onChange(id);
    setOpen(false);
    setQuery("");
  };

  return (
    <div
      ref={wrap}
      className={cn("relative min-w-0", className)}
      onKeyDown={(event) => {
        if (event.key === "Escape" && open) {
          event.stopPropagation();
          setOpen(false);
        }
      }}
    >
      <button
        type="button"
        disabled={disabled}
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={cn(selectClass, "justify-between gap-2 text-left", !selected && "text-muted-foreground")}
        onClick={() => {
          setOpen((o) => !o);
          setQuery("");
          requestAnimationFrame(() => input.current?.focus());
        }}
      >
        <span className="truncate">{selected ? selected.label : placeholder}</span>
        <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
      </button>

      {open && (
        <div
          className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md"
          onPointerDown={(event) => event.preventDefault()}
        >
          <Command shouldFilter={false}>
            <CommandInput
              ref={input}
              value={query}
              onValueChange={setQuery}
              placeholder={searchPlaceholder ?? `Cerca per ${label.toLowerCase()}…`}
            />
            <CommandList className="max-h-56">
              <CommandEmpty>{emptyHint ?? "Nessun risultato."}</CommandEmpty>
              <CommandGroup>
                {onCreate && !disabled && (
                  <CommandItem
                    value="__create__"
                    className="font-medium text-secondary"
                    onSelect={() => {
                      setOpen(false);
                      setQuery("");
                      onCreate();
                    }}
                  >
                    <Plus className="h-4 w-4" /> {createLabel}
                  </CommandItem>
                )}
                {filtered.map((option) => (
                  <CommandItem key={option.id} value={option.id} onSelect={() => pick(option.id)}>
                    <span className="min-w-0 flex-1 truncate">{option.label}</span>
                    {option.hint && (
                      <span className="shrink-0 pl-2 text-xs text-muted-foreground">{option.hint}</span>
                    )}
                    <Check
                      className={cn("h-4 w-4 shrink-0", value === option.id ? "opacity-100" : "opacity-0")}
                    />
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </div>
      )}
    </div>
  );
}

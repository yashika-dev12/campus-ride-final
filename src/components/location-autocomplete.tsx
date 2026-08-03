import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AlertCircle, Loader2, MapPin, SearchX } from "lucide-react";
import { MIN_QUERY_LENGTH, searchLocations, type PhotonLocation } from "../lib/photon";

export type { PhotonLocation };

type Status = "idle" | "loading" | "error" | "done";

type LocationAutocompleteProps = {
  /** Controlled text shown in the input (the selected/typed location name). */
  value: string;
  /** Fired while the user types — clears any previously selected coordinates. */
  onValueChange: (value: string) => void;
  /** Fired when a suggestion is chosen — carries name + latitude + longitude. */
  onSelect: (location: PhotonLocation) => void;
  placeholder?: string;
  /** Applied to the underlying <input> so callers can match existing styling. */
  inputClassName?: string;
  minChars?: number;
  /** Debounce window in ms (default 350). */
  debounceMs?: number;
};

/**
 * Reusable location search field backed by Photon (OpenStreetMap). Debounces
 * input, cancels superseded requests, and surfaces loading / error / empty
 * states in a dropdown. Rendered as a bare relative container + input so it can
 * be dropped into any existing layout without changing surrounding markup.
 */
export function LocationAutocomplete({
  value,
  onValueChange,
  onSelect,
  placeholder,
  inputClassName,
  minChars = MIN_QUERY_LENGTH,
  debounceMs = 350,
}: LocationAutocompleteProps) {
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<PhotonLocation[]>([]);
  const [status, setStatus] = useState<Status>("idle");
  const [active, setActive] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [rect, setRect] = useState<{ left: number; top: number; width: number } | null>(null);
  const listboxId = useId();

  const query = value.trim();
  const canSearch = query.length >= minChars;

  // Debounced Photon search with request cancellation on every keystroke.
  useEffect(() => {
    if (!open || !canSearch) {
      if (!canSearch) setStatus("idle");
      return;
    }
    setStatus("loading");
    const controller = new AbortController();
    const timer = setTimeout(() => {
      searchLocations(query, controller.signal)
        .then((found) => {
          setResults(found);
          setActive(-1);
          setStatus("done");
        })
        .catch(() => {
          if (controller.signal.aborted) return; // superseded / cancelled — ignore
          setResults([]);
          setStatus("error");
        });
    }, debounceMs);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, open, canSearch, debounceMs]);

  // Keep the portaled dropdown pinned directly below the input, tracking scroll/resize.
  useEffect(() => {
    if (!open || !canSearch) return;
    const update = () => {
      const el = containerRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      setRect({ left: r.left, top: r.bottom + 8, width: r.width });
    };
    update();
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [open, canSearch]);

  // Dismiss the dropdown when clicking outside the field.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        containerRef.current &&
        !containerRef.current.contains(target) &&
        !(listRef.current && listRef.current.contains(target))
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  const choose = (loc: PhotonLocation) => {
    onSelect(loc);
    setOpen(false);
    setResults([]);
    setStatus("idle");
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!open) setOpen(true);
      else setActive((a) => Math.min(a + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      if (open && active >= 0 && results[active]) {
        e.preventDefault();
        choose(results[active]);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <input
        type="text"
        value={value}
        onChange={(e) => {
          onValueChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => {
          if (canSearch) setOpen(true);
        }}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        className={inputClassName}
        role="combobox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-autocomplete="list"
        autoComplete="off"
      />

      {open &&
        canSearch &&
        rect &&
        createPortal(
          <div
            ref={listRef}
            id={listboxId}
            role="listbox"
            style={{
              position: "fixed",
              left: rect.left,
              top: rect.top,
              width: rect.width,
              zIndex: 9999,
            }}
            className="glass rounded-2xl p-1 max-h-64 overflow-y-auto shadow-[var(--shadow-soft)]"
          >
          {status === "loading" && (
            <div className="flex items-center gap-2 px-3 py-3 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Searching locations…
            </div>
          )}
          {status === "error" && (
            <div className="flex items-center gap-2 px-3 py-3 text-xs text-destructive">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" /> Couldn&apos;t load locations. Check
              your connection and try again.
            </div>
          )}
          {status === "done" && results.length === 0 && (
            <div className="flex items-center gap-2 px-3 py-3 text-xs text-muted-foreground">
              <SearchX className="h-3.5 w-3.5 shrink-0" /> No locations found
            </div>
          )}
          {status === "done" &&
            results.map((loc, i) => (
              <button
                key={`${loc.name}-${loc.lat}-${loc.lng}`}
                type="button"
                role="option"
                aria-selected={i === active}
                onMouseEnter={() => setActive(i)}
                onClick={() => choose(loc)}
                className={`w-full text-left flex items-start gap-2 px-3 py-2.5 rounded-xl transition ${
                  i === active ? "bg-white/70" : "hover:bg-white/50"
                }`}
              >
                <MapPin className="h-4 w-4 mt-0.5 text-[color:var(--primary)] shrink-0" />
                <span className="text-sm font-medium leading-snug">{loc.name}</span>
              </button>
            ))}
          </div>,
          document.body,
        )}
    </div>
  );
}

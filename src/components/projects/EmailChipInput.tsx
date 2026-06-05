import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { X } from "lucide-react";
import { apiFetch } from "../../lib/api";
import type { UserSearchHit } from "../../types/users";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface EmailChipInputProps {
  emails: string[];
  onChange: (emails: string[]) => void;
  placeholder?: string;
  id?: string;
  autoFocus?: boolean;
}

function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

export function EmailChipInput({
  emails,
  onChange,
  placeholder = "Ingrese el Correo del Usuario",
  id,
  autoFocus = false,
}: EmailChipInputProps) {
  const [draft, setDraft] = useState("");
  const [suggestions, setSuggestions] = useState<UserSearchHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [listOpen, setListOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (autoFocus) {
      const t = window.setTimeout(() => inputRef.current?.focus(), 0);
      return () => window.clearTimeout(t);
    }
  }, [autoFocus]);

  useEffect(() => {
    const query = draft.trim();
    if (query.length < 1) {
      setSuggestions([]);
      setSearching(false);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setSearching(true);
      try {
        const hits = await apiFetch<UserSearchHit[]>(
          `/api/users/search?q=${encodeURIComponent(query)}`,
          { signal: controller.signal }
        );
        const filtered = hits.filter((h) => !emails.includes(h.email));
        setSuggestions(filtered);
        setListOpen(filtered.length > 0);
      } catch {
        if (!controller.signal.aborted) setSuggestions([]);
      } finally {
        if (!controller.signal.aborted) setSearching(false);
      }
    }, 280);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [draft, emails]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setListOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function addEmail(raw: string) {
    const email = normalizeEmail(raw);
    if (!email || !EMAIL_RE.test(email)) return false;
    if (emails.includes(email)) return false;
    onChange([...emails, email]);
    setDraft("");
    setSuggestions([]);
    setListOpen(false);
    inputRef.current?.focus();
    return true;
  }

  function pickSuggestion(hit: UserSearchHit) {
    addEmail(hit.email);
  }

  function removeEmail(email: string) {
    onChange(emails.filter((e) => e !== email));
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      e.stopPropagation();
      const q = normalizeEmail(draft);
      const exact = suggestions.find((s) => s.email === q);
      if (exact) pickSuggestion(exact);
      else if (suggestions.length > 0) pickSuggestion(suggestions[0]);
      else addEmail(draft);
      return;
    }
    if (e.key === "," || e.key === " ") {
      e.preventDefault();
      addEmail(draft);
    }
    if (e.key === "Backspace" && !draft && emails.length > 0) {
      onChange(emails.slice(0, -1));
    }
    if (e.key === "Escape") {
      setListOpen(false);
      e.stopPropagation();
    }
  }

  const showList = listOpen && draft.trim().length > 0;

  return (
    <div className="email-chips" id={id} ref={rootRef}>
      <div className="email-chips__box">
        {emails.map((email) => (
          <span key={email} className="email-chips__chip">
            <span className="email-chips__chip-text">{email}</span>
            <button
              type="button"
              className="email-chips__chip-remove"
              onClick={() => removeEmail(email)}
              aria-label={`Quitar ${email}`}
            >
              <X size={14} aria-hidden />
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          type="text"
          inputMode="email"
          autoComplete="off"
          className="email-chips__input"
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            setListOpen(true);
          }}
          onFocus={() => {
            if (suggestions.length > 0) setListOpen(true);
          }}
          onKeyDown={handleKeyDown}
          placeholder={emails.length === 0 ? placeholder : ""}
          aria-label={placeholder}
          aria-expanded={showList}
          aria-controls={showList ? "email-suggest-list" : undefined}
          role="combobox"
        />
      </div>

      {showList ? (
        <ul id="email-suggest-list" className="email-chips__suggest" role="listbox">
          {searching && suggestions.length === 0 ? (
            <li className="email-chips__suggest-item email-chips__suggest-item--muted">Buscando…</li>
          ) : null}
          {!searching && suggestions.length === 0 ? (
            <li className="email-chips__suggest-item email-chips__suggest-item--muted">
              Sin coincidencias
            </li>
          ) : null}
          {suggestions.map((hit) => (
            <li key={hit.id} role="option">
              <button
                type="button"
                className="email-chips__suggest-item"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pickSuggestion(hit)}
              >
                {hit.label}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

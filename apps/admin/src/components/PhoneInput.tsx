import { Check, ChevronDown, Search } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { COUNTRIES, composePhone, maskNational, parsePhone } from "../lib/phone";
import type { Country } from "../lib/phone";

interface Props {
  id: string;
  value: string;
  onChange: (value: string) => void;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
}

const MENU_WIDTH = 288;

/** Remove acentos e caixa para a busca ("colombia" acha "Colômbia"). */
const fold = (v: string) => v.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/**
 * Telefone num campo unico: seletor de pais (bandeira, com busca) + numero com mascara, so digitos.
 * Valor gravado: "+55 (22) 99999-9999".
 */
export function PhoneInput({ id, value, onChange, ...aria }: Props) {
  const initial = parsePhone(value);
  const [iso, setIso] = useState(initial.country.iso);
  const country = COUNTRIES.find((c) => c.iso === iso) ?? initial.country;
  const digits = value.replace(/\D/g, "");
  const national =
    value.startsWith("+") && digits.startsWith(country.dial) ? maskNational(country, digits.slice(country.dial.length)) : parsePhone(value).national;

  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  const filtered = useMemo(() => {
    const q = fold(query.trim()).replace(/^\+/, "");
    if (!q) return COUNTRIES;
    return COUNTRIES.filter((c) => fold(c.name).includes(q) || c.dial.startsWith(q) || c.iso.toLowerCase() === q);
  }, [query]);

  function openMenu() {
    const rect = wrapRef.current?.getBoundingClientRect();
    if (!rect) return;
    const width = Math.min(Math.max(rect.width, MENU_WIDTH), window.innerWidth - 16);
    const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8));
    const openUp = rect.bottom + 300 > window.innerHeight && rect.top > 300;
    setPos({ top: openUp ? rect.top - 4 - 292 : rect.bottom + 4, left, width });
    setQuery("");
    setActive(Math.max(0, COUNTRIES.findIndex((c) => c.iso === country.iso)));
  }

  function closeMenu(focus: "button" | "input" | null = "button") {
    setPos(null);
    if (focus === "button") buttonRef.current?.focus();
    if (focus === "input") inputRef.current?.focus();
  }

  function pick(next: Country) {
    setIso(next.iso);
    onChange(composePhone(next, maskNational(next, national)));
    closeMenu("input");
  }

  useEffect(() => {
    if (!pos) return;
    searchRef.current?.focus();
    const onDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (menuRef.current?.contains(target) || buttonRef.current?.contains(target)) return;
      setPos(null);
    };
    const onScroll = (event: Event) => {
      if (menuRef.current?.contains(event.target as Node)) return;
      setPos(null);
    };
    document.addEventListener("mousedown", onDown);
    window.addEventListener("resize", onScroll);
    document.addEventListener("scroll", onScroll, true);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("resize", onScroll);
      document.removeEventListener("scroll", onScroll, true);
    };
  }, [pos]);

  useEffect(() => {
    menuRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active, pos]);

  const invalid = Boolean(aria["aria-invalid"]);

  return (
    <>
      <div
        ref={wrapRef}
        className={`mt-1.5 flex w-full items-stretch rounded-btn-admin border bg-surface text-sm transition focus-within:ring-2 ${
          invalid ? "border-red-400 focus-within:ring-red-400/20" : "border-line focus-within:border-brand-500 focus-within:ring-brand-500/20"
        }`}
      >
        <button
          ref={buttonRef}
          type="button"
          aria-label={`País do telefone: ${country.name} (+${country.dial})`}
          aria-haspopup="listbox"
          aria-expanded={Boolean(pos)}
          onClick={() => (pos ? closeMenu() : openMenu())}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown" && !pos) {
              e.preventDefault();
              openMenu();
            }
          }}
          className="flex shrink-0 items-center gap-1.5 rounded-l-btn-admin py-2.5 pl-3 pr-2 text-ink outline-none hover:bg-canvas focus-visible:bg-canvas"
        >
          <span className="text-base leading-none" aria-hidden>
            {country.flag}
          </span>
          <ChevronDown size={14} className={`text-muted transition ${pos ? "rotate-180" : ""}`} aria-hidden />
        </button>
        <span className="flex select-none items-center pr-1 text-muted" aria-hidden>
          +{country.dial}
        </span>
        <input
          {...aria}
          ref={inputRef}
          id={id}
          type="tel"
          inputMode="numeric"
          autoComplete="off"
          placeholder={country.iso === "BR" ? "(00) 00000-0000" : "000 000 000"}
          className="min-w-0 flex-1 rounded-r-btn-admin bg-transparent py-2.5 pl-1 pr-3 text-ink outline-none placeholder:text-[#a1adc0]"
          value={national}
          onChange={(e) => onChange(composePhone(country, e.target.value.replace(/\D/g, "")))}
        />
      </div>

      {pos && (
        <div
          ref={menuRef}
          className="fixed z-[60] flex h-[292px] flex-col overflow-hidden rounded-xl border border-line bg-surface shadow-xl"
          style={{ top: pos.top, left: pos.left, width: pos.width }}
        >
          <div className="flex items-center gap-2 border-b border-line px-3 py-2.5">
            <Search size={15} className="shrink-0 text-muted" aria-hidden />
            <input
              ref={searchRef}
              type="text"
              role="combobox"
              aria-label="Buscar país"
              aria-controls={listId}
              aria-expanded="true"
              aria-activedescendant={filtered[active] ? `${listId}-${filtered[active].iso}` : undefined}
              placeholder="Buscar país ou código"
              className="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-[#a1adc0]"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setActive(0);
              }}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  e.preventDefault();
                  e.stopPropagation();
                  closeMenu();
                } else if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setActive((i) => Math.min(i + 1, filtered.length - 1));
                } else if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setActive((i) => Math.max(i - 1, 0));
                } else if (e.key === "Enter") {
                  e.preventDefault();
                  const next = filtered[active];
                  if (next) pick(next);
                } else if (e.key === "Tab") {
                  closeMenu(null);
                }
              }}
            />
          </div>
          <ul id={listId} role="listbox" aria-label="Países" className="flex-1 overflow-y-auto py-1">
            {filtered.length === 0 && <li className="px-3 py-3 text-sm text-muted">Nenhum país encontrado.</li>}
            {filtered.map((c, index) => {
              const selected = c.iso === country.iso;
              return (
                <li
                  key={c.iso}
                  id={`${listId}-${c.iso}`}
                  data-index={index}
                  role="option"
                  aria-selected={selected}
                  onMouseDown={(e) => e.preventDefault()}
                  onMouseEnter={() => setActive(index)}
                  onClick={() => pick(c)}
                  className={`flex cursor-pointer items-center gap-3 px-3 py-2 text-sm ${index === active ? "bg-canvas" : ""}`}
                >
                  <span className="text-base leading-none" aria-hidden>
                    {c.flag}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-ink">{c.name}</span>
                  <span className="font-semibold tabular-nums text-navy-900">+{c.dial}</span>
                  <Check size={14} className={selected ? "text-brand-500" : "invisible"} aria-hidden />
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </>
  );
}

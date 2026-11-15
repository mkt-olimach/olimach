import { useState } from "react";
import { COUNTRIES, composePhone, maskNational, parsePhone } from "../lib/phone";
import { inputClass } from "./ui";

interface Props {
  id: string;
  value: string;
  onChange: (value: string) => void;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
}

/** Telefone com seletor de pais (bandeira + codigo) e mascara; aceita so digitos. Valor: "+55 (22) 99999-9999". */
export function PhoneInput({ id, value, onChange, ...aria }: Props) {
  const initial = parsePhone(value);
  const [iso, setIso] = useState(initial.country.iso);
  const country = COUNTRIES.find((c) => c.iso === iso) ?? initial.country;
  const digits = value.replace(/\D/g, "");
  const national = value.startsWith("+") && digits.startsWith(country.dial) ? maskNational(country, digits.slice(country.dial.length)) : parsePhone(value).national;

  return (
    <div className="mt-1.5 flex gap-2">
      <select
        aria-label="País do telefone"
        className={`${inputClass} !mt-0 w-[7.5rem] shrink-0`}
        value={country.iso}
        onChange={(e) => {
          const next = COUNTRIES.find((c) => c.iso === e.target.value) ?? country;
          setIso(next.iso);
          onChange(composePhone(next, maskNational(next, national)));
        }}
      >
        {COUNTRIES.map((c) => (
          <option key={c.iso} value={c.iso}>
            {c.flag} +{c.dial}
          </option>
        ))}
      </select>
      <input
        {...aria}
        id={id}
        type="tel"
        inputMode="numeric"
        autoComplete="off"
        placeholder={country.iso === "BR" ? "(00) 00000-0000" : "000 000 000"}
        className={`${inputClass} !mt-0 min-w-0 flex-1`}
        value={national}
        onChange={(e) => onChange(composePhone(country, e.target.value.replace(/\D/g, "")))}
      />
    </div>
  );
}

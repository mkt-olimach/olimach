import { useEffect, useState } from "react";

/**
 * Exibe o logo da marca. Padrao: /assets/brand/logo.png (logo oficial, nunca redesenhado).
 * Em instalacoes white label, passe `src` (logo enviada no modulo White Label) e `name`.
 * Se a imagem falhar, mostra o nome em texto.
 */
export function BrandLogo({
  src = "/assets/brand/logo.png",
  name = "OLIMACH",
  className = "h-9",
}: {
  src?: string;
  name?: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);

  if (failed) {
    return <span className="font-heading text-xl font-extrabold text-navy-900">{name.toUpperCase()}</span>;
  }
  return <img src={src} alt={name} className={className} onError={() => setFailed(true)} />;
}

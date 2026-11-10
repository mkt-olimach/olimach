import { useState } from "react";

/**
 * Exibe o logo oficial servido de /assets/brand (nunca redesenhado).
 * Enquanto o arquivo oficial nao estiver no repositorio, mostra apenas o nome da marca em texto.
 */
export function BrandLogo({
  src = "/assets/brand/logo.png",
  className = "h-9",
}: {
  src?: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return <span className="font-heading text-xl font-extrabold text-navy-900">OLIMACH</span>;
  }
  return <img src={src} alt="OLIMACH" className={className} onError={() => setFailed(true)} />;
}

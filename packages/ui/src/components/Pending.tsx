/**
 * Placeholder [PENDENTE: ...] para dado ainda nao confirmado.
 * Visivel apenas em desenvolvimento; em producao nao renderiza nada.
 */
export function Pending({ children }: { children: string }) {
  if (!import.meta.env.DEV) return null;
  return (
    <span className="rounded bg-safety px-1.5 py-0.5 text-xs font-semibold text-navy-900">
      [PENDENTE: {children}]
    </span>
  );
}

export type ClassStatus = "planned" | "ongoing" | "completed" | "cancelled";

export const classStatusLabel: Record<ClassStatus, string> = {
  planned: "Planejada",
  ongoing: "Em andamento",
  completed: "Concluída",
  cancelled: "Cancelada",
};

export const classStatusTone = {
  planned: "neutral",
  ongoing: "warning",
  completed: "success",
  cancelled: "danger",
} as const;

/** Data "yyyy-mm-dd" (coluna date) para pt-BR, sem deslocar por fuso. */
export function formatDay(value: string): string {
  const [y, m, d] = value.split("-");
  return y && m && d ? `${d}/${m}/${y}` : value;
}

export function formatPeriod(start: string, end: string): string {
  return start === end ? formatDay(start) : `${formatDay(start)} a ${formatDay(end)}`;
}

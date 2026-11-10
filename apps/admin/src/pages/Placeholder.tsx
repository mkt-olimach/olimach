import { Card } from "@olimach/ui";

export function Placeholder({ title }: { title: string }) {
  return (
    <div>
      <h1 className="text-2xl">{title}</h1>
      <Card className="mt-6 text-sm text-muted">Tela ainda não implementada nesta etapa.</Card>
    </div>
  );
}

import { Card } from "@/components/ui/card";
import { Construction } from "lucide-react";

export default function Placeholder({ title, description }: { title: string; description?: string }) {
  return (
    <div className="max-w-3xl space-y-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
        {description && <p className="text-muted-foreground mt-1">{description}</p>}
      </header>
      <Card className="p-12 border-dashed border-border bg-surface-muted text-center shadow-none">
        <Construction className="h-8 w-8 mx-auto text-muted-foreground" />
        <h3 className="font-semibold mt-3">Coming in the next phase</h3>
        <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
          This area is scaffolded and ready. Full workflows ship in the next build phase.
        </p>
      </Card>
    </div>
  );
}
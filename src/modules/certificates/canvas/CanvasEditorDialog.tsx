import { Dialog, DialogContent } from "@/components/ui/dialog";
import { CanvasEditor } from "./CanvasEditor";
import type { CanvasDesign } from "./types";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  workspaceId: string;
  initial?: {
    id?: string;
    name?: string;
    is_default?: boolean;
    design_json?: CanvasDesign | null;
  } | null;
  onSaved: () => void;
}

export function CanvasEditorDialog({ open, onOpenChange, workspaceId, initial, onSaved }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[98vw] w-[98vw] h-[95vh] p-0 overflow-hidden gap-0 flex flex-col [&>button.absolute]:hidden">
        {open && (
          <CanvasEditor
            workspaceId={workspaceId}
            templateId={initial?.id ?? null}
            initialName={initial?.name}
            initialIsDefault={initial?.is_default}
            initialDesign={initial?.design_json ?? null}
            onClose={() => onOpenChange(false)}
            onSaved={onSaved}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
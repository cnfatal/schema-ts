import { ThemeToggle } from "@/components/theme";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface TopBarProps {
  examples?: { name: string }[];
  selectedExample?: string;
  onSelectExample: (name: string) => void;
  onReset: () => void;
}

/** Application title bar. */
export function TopBar({
  examples,
  selectedExample,
  onSelectExample,
  onReset,
}: TopBarProps) {
  return (
    <header className="flex h-11 shrink-0 items-center justify-between gap-3 border-b px-3">
      <div className="flex items-center gap-2">
        <div className="flex size-6 items-center justify-center rounded bg-primary text-xs font-bold text-primary-foreground">
          S
        </div>
        <span className="text-sm font-semibold tracking-tight">
          Schema-TS{" "}
          <span className="font-normal text-muted-foreground">Playground</span>
        </span>
      </div>
      <div className="flex items-center gap-2">
        <Select value={selectedExample ?? ""} onValueChange={onSelectExample}>
          <SelectTrigger className="w-[210px]" aria-label="Select example">
            <SelectValue placeholder="Select example" />
          </SelectTrigger>
          <SelectContent>
            {examples?.map((example) => (
              <SelectItem key={example.name} value={example.name}>
                {example.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="ghost" size="sm" onClick={onReset}>
          Reset
        </Button>
        <ThemeToggle />
      </div>
    </header>
  );
}

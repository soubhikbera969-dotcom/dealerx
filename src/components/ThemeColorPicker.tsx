import { Check, Palette } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Props {
  collapsed?: boolean;
}

export function ThemeColorPicker({ collapsed }: Props) {
  const { palette, accent, setAccentById } = useTheme();

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size={collapsed ? "icon" : "default"}
          className="w-full justify-start"
          title="Theme color"
        >
          <Palette className="h-4 w-4" />
          {!collapsed && <span className="ml-2">Theme color</span>}
          {!collapsed && (
            <span
              className="ml-auto h-4 w-4 rounded-full border border-border"
              style={{ background: accent.hex }}
            />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent side="right" align="end" className="w-56 p-3">
        <p className="text-xs font-medium text-muted-foreground mb-2">Accent color</p>
        <div className="grid grid-cols-3 gap-2">
          {palette.map((c) => {
            const active = c.id === accent.id;
            return (
              <button
                key={c.id}
                onClick={() => setAccentById(c.id)}
                className={cn(
                  "group flex flex-col items-center gap-1 rounded-lg p-2 transition-colors hover:bg-muted",
                  active && "bg-muted"
                )}
                title={c.label}
              >
                <span
                  className="relative flex h-8 w-8 items-center justify-center rounded-full ring-2 ring-offset-2 ring-offset-background transition-all"
                  style={{
                    background: c.hex,
                    boxShadow: `0 0 0 2px ${active ? c.hex : "transparent"}`,
                  }}
                >
                  {active && <Check className="h-4 w-4 text-white drop-shadow" strokeWidth={3} />}
                </span>
                <span className="text-[10px] text-muted-foreground leading-tight text-center">
                  {c.label}
                </span>
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

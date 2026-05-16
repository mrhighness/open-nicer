import { Phone, Battery, Wifi } from "lucide-react";

export function StatusBar() {
  return (
    <div className="lg:hidden flex items-center justify-between px-6 pt-3 pb-1 text-xs font-medium text-foreground/90">
      <span>9:41</span>
      <div className="flex items-center gap-1">
        <Phone className="size-3" strokeWidth={2.5} />
        <Wifi className="size-3" strokeWidth={2.5} />
        <Battery className="size-4" strokeWidth={2.5} />
      </div>
    </div>
  );
}

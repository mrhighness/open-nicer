import { Phone, Battery, Wifi } from "lucide-react";

export function StatusBar() {
  return (
    <div className="lg:hidden flex items-center justify-between px-[max(1rem,env(safe-area-inset-left,0px))] pr-[max(1rem,env(safe-area-inset-right,0px))] pt-[max(0.25rem,env(safe-area-inset-top,0px))] pb-1 text-xs font-medium text-foreground/90">
      <span>9:41</span>
      <div className="flex items-center gap-1">
        <Phone className="size-3" strokeWidth={2.5} />
        <Wifi className="size-3" strokeWidth={2.5} />
        <Battery className="size-4" strokeWidth={2.5} />
      </div>
    </div>
  );
}

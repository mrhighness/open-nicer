import { createFileRoute, Outlet, useRouterState } from "@tanstack/react-router";
import { AnimatePresence, motion } from "framer-motion";
import { ResponsiveLayout } from "@/components/ResponsiveLayout";

export const Route = createFileRoute("/chat/$chatId")({
  component: ChatIdLayout,
});

function ChatIdLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isGroupInfo = pathname.endsWith("/group");

  return (
    <ResponsiveLayout>
      <div className="relative flex flex-col flex-1 min-h-0 overflow-hidden">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={isGroupInfo ? "group-info" : "chat-thread"}
            className="absolute inset-0 flex flex-col"
            initial={{ x: isGroupInfo ? "100%" : 0, opacity: isGroupInfo ? 0.92 : 1 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: isGroupInfo ? "100%" : "-18%", opacity: isGroupInfo ? 0.92 : 0.85 }}
            transition={{ type: "spring", damping: 30, stiffness: 340 }}
          >
            <Outlet />
          </motion.div>
        </AnimatePresence>
      </div>
    </ResponsiveLayout>
  );
}

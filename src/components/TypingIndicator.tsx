import { motion } from "framer-motion";

export function TypingIndicator({ name }: { name: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 6 }}
      className="flex justify-start px-3 mb-2"
    >
      <div className="max-w-[78%] rounded-2xl rounded-bl-md px-4 py-2.5 bg-bubble-them text-bubble-them-foreground shadow-sm flex items-center gap-2">
        <span className="text-xs text-muted-foreground">{name} is typing</span>
        <span className="flex items-center gap-1 h-4">
          {[0, 1, 2].map((i) => (
            <motion.span
              key={i}
              className="size-1.5 rounded-full bg-primary"
              animate={{ y: [0, -4, 0], opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.15 }}
            />
          ))}
        </span>
      </div>
    </motion.div>
  );
}

import { readFileSync, writeFileSync } from "fs";

let s = readFileSync("src/components/MessageBubble.tsx", "utf8");
s = s.replaceAll("</motion.div>", "</div>");
// Restore legitimate motion.div closings (motion components)
const motionOpens = (s.match(/<motion\.motion.div/g) || []).length;
// Re-apply motion.div closings by re-reading - simpler: only fix known broken file

writeFileSync("src/components/MessageBubble.tsx", s);
console.log("Replaced all </motion.div> with </div> - need manual motion restore");

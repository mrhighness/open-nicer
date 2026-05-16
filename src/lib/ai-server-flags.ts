/** Public build flags: AI keys live on the server only (same-origin /api/* proxies). */
export function useServerDeepAiProxy(): boolean {
  return import.meta.env.VITE_SERVER_AI_DEEPAI === "1";
}

export function useServerPixazoProxy(): boolean {
  return import.meta.env.VITE_SERVER_AI_PIXAZO === "1";
}

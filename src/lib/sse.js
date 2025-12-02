// src/lib/sse.js
const EVENTS_BASE = import.meta.env.VITE_EVENTS_BASE || import.meta.env.VITE_API_BASE || "http://localhost:4200";
export function createSSE(path, onMessage, onOpen, onError) {
  const url = `${EVENTS_BASE}${path}`;
  try {
    const es = new EventSource(url);
    es.onmessage = (e) => {
      try { onMessage(JSON.parse(e.data)); } catch (err) { onMessage(e.data); }
    };
    es.onopen = onOpen || (() => console.debug("[SSE] open", url));
    es.onerror = (err) => {
      console.error("[SSE] error", url, err);
      if (typeof onError === "function") onError(err);
      // do not attempt aggressive reconnect here; let the caller implement backoff
    };
    return es;
  } catch (err) {
    console.error("[SSE] failed to create EventSource", url, err);
    return null;
  }
}

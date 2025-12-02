import { useEffect, useRef, useState } from "react";

/**
 * useSSE(url, { onMessage })
 * - url: full URL to SSE endpoint (e.g. `${API_BASE}/events/sse`)
 * - returns { connected, lastEvent, events }
 */
export default function useSSE(url, { onMessage } = {}) {
  const evtSourceRef = useRef(null);
  const [connected, setConnected] = useState(false);
  const [events, setEvents] = useState([]);
  const [lastEvent, setLastEvent] = useState(null);

  useEffect(() => {
    if (!url) return;
    let es;
    try {
      es = new EventSource(url);
      evtSourceRef.current = es;
      es.onopen = () => setConnected(true);
      es.onmessage = (e) => {
        let data = e.data;
        try { data = JSON.parse(e.data); } catch (_) {}
        setLastEvent(data);
        setEvents((s) => [data, ...s].slice(0, 200));
        if (onMessage) onMessage(data);
      };
      es.onerror = () => {
        setConnected(false);
        // keep eventsource open — it will try to reconnect automatically
      };
    } catch (err) {
      console.error("SSE init error", err);
    }
    return () => {
      if (es) es.close();
      evtSourceRef.current = null;
      setConnected(false);
    };
  }, [url]);

  return { connected, lastEvent, events };
}

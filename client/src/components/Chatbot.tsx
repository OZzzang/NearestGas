/**
 * Chatbot — relays messages to POST /api/chat and renders Gemini's conversational
 * recommendation. All the actual price math (effective ¢/L per station, given the
 * user's selected programs) happens server-side in chatService; this component just
 * sends the current search context (location/radius/fuel) + selected program ids along
 * with each message, and shows the reply.
 */
import { useState, type FormEvent } from "react";
import { ApiError, postChat } from "../lib/api";
import type { ChatMessage, FuelType, LatLng } from "../types";

interface ChatbotProps {
  location: LatLng;
  radius: number;
  fuel: FuelType;
  selectedProgramIds: Set<string>;
}

export function Chatbot({ location, radius, fuel, selectedProgramIds }: ChatbotProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const message = input.trim();
    if (!message || loading) return;

    setMessages((prev) => [...prev, { role: "user", text: message }]);
    setInput("");
    setLoading(true);
    setError(null);

    try {
      const result = await postChat({
        message,
        subscriptions: [...selectedProgramIds],
        lat: location.lat,
        lng: location.lng,
        radius,
        fuel,
      });
      setMessages((prev) => [...prev, { role: "assistant", text: result.reply }]);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to get a response");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="chatbot">
      <h2 className="chatbot__title">Ask about nearby gas</h2>
      <div className="chatbot__messages">
        {messages.length === 0 && (
          <p className="chatbot__hint">
            Try "which station is cheapest for me?" or "is the Costco discount worth the
            detour?"
          </p>
        )}
        {messages.map((msg, i) => (
          <p key={i} className={`chatbot__message chatbot__message--${msg.role}`}>
            {msg.text}
          </p>
        ))}
        {loading && <p className="chatbot__message chatbot__message--assistant chatbot__message--pending">Thinking…</p>}
      </div>
      {error && <p className="chatbot__error">{error}</p>}
      <form className="chatbot__form" onSubmit={handleSubmit}>
        <input
          type="text"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Ask about the stations shown…"
          disabled={loading}
        />
        <button type="submit" disabled={loading || !input.trim()}>
          Send
        </button>
      </form>
    </div>
  );
}

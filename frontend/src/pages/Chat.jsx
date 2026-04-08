import { useState, useRef, useEffect } from "react";
import Markdown from "react-markdown";

export default function Chat() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send() {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg = { role: "user", content: text };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          history: messages,
        }),
      });

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop(); // keep incomplete line in buffer

        for (const line of lines) {
          if (!line.startsWith("data: ") || line === "data: [DONE]") continue;
          const payload = JSON.parse(line.slice(6));
          accumulated += payload.token;
          const content = accumulated;
          setMessages((prev) => {
            const last = prev[prev.length - 1];
            if (last?.role === "assistant") {
              return [...prev.slice(0, -1), { ...last, content }];
            }
            return [...prev, { role: "assistant", content }];
          });
        }
      }
    } catch {
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        // If we already streamed some content, keep the partial response
        if (last?.role === "assistant" && last.content) return prev;
        // Otherwise replace the empty bubble (or append) with an error
        const base = last?.role === "assistant" ? prev.slice(0, -1) : prev;
        return [
          ...base,
          { role: "assistant", content: "Sorry, something went wrong." },
        ];
      });
    } finally {
      setLoading(false);
    }
  }

  async function exportChat() {
    try {
      const res = await fetch("/api/conversations/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages }),
      });
      const data = await res.json();
      alert(`Conversation saved to conversations/${data.file}`);
    } catch {
      alert("Failed to export conversation.");
    }
  }

  function handleKey(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  return (
    <div className="page">
      <div className="chat-container">
        <div className="chat-messages">
          {messages.length === 0 && (
            <p
              style={{ color: "#999", textAlign: "center", marginTop: "2rem" }}
            >
              Ask me about your yarn stash, describe a pattern, or get project
              suggestions!
            </p>
          )}
          {messages.map((m, i) => (
            <div key={i} className={`chat-bubble ${m.role}`}>
              {m.role === "assistant" ? (
                <Markdown>{m.content}</Markdown>
              ) : (
                m.content
              )}
            </div>
          ))}
          {loading && messages[messages.length - 1]?.role !== "assistant" && (
            <div className="chat-bubble assistant" style={{ opacity: 0.6 }}>
              Thinking...
            </div>
          )}
          <div ref={bottomRef} />
        </div>
        <div className="chat-input-row">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Ask about your yarn stash..."
            disabled={loading}
          />
          <button className="btn-primary" onClick={send} disabled={loading}>
            Send
          </button>
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "flex-start",
            paddingBottom: "0.5rem",
          }}
        >
          <button
            className="btn-secondary"
            onClick={exportChat}
            disabled={messages.length === 0}
            style={{
              fontSize: "0.8rem",
              padding: "0.35rem 0.75rem",
              opacity: messages.length === 0 ? 0.4 : 1,
            }}
          >
            Export
          </button>
        </div>
      </div>
    </div>
  );
}

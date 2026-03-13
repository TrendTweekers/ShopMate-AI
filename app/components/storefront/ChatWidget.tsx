import { useState, useEffect, useRef } from "react";
import { MessageCircle, X, Package, Sparkles, RotateCcw, Send, ArrowLeft, ShoppingCart, RefreshCw, ExternalLink } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

type View = "home" | "tracking" | "recommendations" | "chat";

interface Product {
  id: string;
  title: string;
  price: string;
  image: string | null;
  url: string;
}

interface Message {
  role: "bot" | "user";
  text: string;
  products?: Product[];
  error?: boolean;
}

interface ChatWidgetProps {
  shop?: string;
  /** Override the bot display name (from setup wizard / dashboard settings) */
  botName?: string;
  /** Override the initial greeting message */
  greeting?: string;
}

const SESSION_KEY = "shopmate_conversation_id";

function TypingIndicator() {
  return (
    <div className="flex justify-start">
      <div className="bg-muted px-3 py-2 rounded-xl rounded-bl-sm flex items-center gap-1">
        <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:0ms]" />
        <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:150ms]" />
        <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:300ms]" />
      </div>
    </div>
  );
}

function ProductCard({ product }: { product: Product }) {
  return (
    <a
      href={product.url || "#"}
      target="_blank"
      rel="noopener noreferrer"
      className="border border-border rounded-lg p-2.5 flex items-center gap-2.5 hover:bg-muted/50 transition-colors no-underline"
    >
      <div className="w-10 h-10 rounded-md bg-muted flex items-center justify-center flex-shrink-0 overflow-hidden">
        {product.image ? (
          <img src={product.image} alt={product.title} className="w-full h-full object-cover" />
        ) : (
          <ShoppingCart className="w-4 h-4 text-muted-foreground" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-foreground truncate">{product.title}</p>
        <p className="text-xs font-semibold text-primary mt-0.5">{product.price}</p>
      </div>
      <ExternalLink className="w-3 h-3 text-muted-foreground flex-shrink-0" />
    </a>
  );
}

export default function ChatWidget({ shop, botName = "ShopMate AI", greeting = "Hi! 👋 How can I help you today?" }: ChatWidgetProps) {
  const [open, setOpen] = useState(true);
  const [view, setView] = useState<View>("home");
  const [messages, setMessages] = useState<Message[]>([
    { role: "bot", text: greeting },
  ]);
  const [input, setInput] = useState("");
  const [orderNumber, setOrderNumber] = useState("");
  const [orderEmail, setOrderEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load conversationId from sessionStorage on mount
  useEffect(() => {
    const saved = sessionStorage.getItem(SESSION_KEY);
    if (saved) setConversationId(saved);
  }, []);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const sendMessageToAPI = async (text: string, retryCount = 0): Promise<void> => {
    setIsLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          conversationId,
          shop,
        }),
      });

      if (!res.ok) {
        throw new Error(`Server error: ${res.status}`);
      }

      const data = await res.json();

      // Persist conversationId
      if (data.conversationId) {
        setConversationId(data.conversationId);
        sessionStorage.setItem(SESSION_KEY, data.conversationId);
      }

      setMessages((m) => [
        ...m,
        {
          role: "bot",
          text: data.reply,
          products: data.products,
        },
      ]);
    } catch (err) {
      console.error("Chat error:", err);
      setMessages((m) => [
        ...m,
        {
          role: "bot",
          text: "Sorry, I'm having trouble connecting right now.",
          error: true,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const sendMessage = () => {
    if (!input.trim() || isLoading) return;
    const text = input.trim();
    setMessages((m) => [...m, { role: "user", text }]);
    setInput("");
    if (view === "home") setView("chat");
    sendMessageToAPI(text);
  };

  const handleRetry = (text: string) => {
    // Remove the error message and resend
    setMessages((m) => m.slice(0, -1));
    sendMessageToAPI(text);
  };

  const handleTrackOrder = () => {
    if (!orderNumber.trim()) return;
    const trackingMessage = `Track order ${orderNumber}${orderEmail ? ` for email ${orderEmail}` : ""}`;
    setMessages((m) => [...m, { role: "user", text: trackingMessage }]);
    setView("chat");
    sendMessageToAPI(trackingMessage);
    setOrderNumber("");
    setOrderEmail("");
  };

  const handleQuickAction = (label: string) => {
    setMessages((m) => [...m, { role: "user", text: label }]);
    setView("chat");
    sendMessageToAPI(label);
  };

  return (
    <div className="relative w-full h-full flex items-end justify-end p-4">
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="absolute bottom-20 right-4 w-[340px] h-[520px] bg-card rounded-2xl shadow-xl border border-border flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="bg-primary px-4 py-3 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-2">
                {view !== "home" && (
                  <button
                    onClick={() => setView("home")}
                    className="text-primary-foreground/80 hover:text-primary-foreground"
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                )}
                <div className="w-8 h-8 rounded-full bg-primary-foreground flex items-center justify-center flex-shrink-0">
                  <span className="text-xs font-bold text-primary">SM</span>
                </div>
                <div>
                  <p className="text-sm font-bold text-primary-foreground">{botName}</p>
                  <p className="text-[10px] text-primary-foreground/80">Shop Assistant</p>
                </div>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="text-primary-foreground/80 hover:text-primary-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-4">
              {view === "home" && (
                <div className="space-y-4 animate-fade-in">
                  <div className="bg-muted rounded-lg p-3">
                    <p className="text-sm text-foreground">Hi! 👋 How can I help you today?</p>
                  </div>

                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Quick Actions
                  </p>
                  <div className="space-y-2">
                    {[
                      {
                        label: "Track my order",
                        icon: Package,
                        action: () => setView("tracking"),
                      },
                      {
                        label: "Product recommendations",
                        icon: Sparkles,
                        action: () => handleQuickAction("Show me some product recommendations"),
                      },
                      {
                        label: "Returns & exchanges",
                        icon: RotateCcw,
                        action: () => handleQuickAction("I need help with a return or exchange"),
                      },
                    ].map((a) => (
                      <button
                        key={a.label}
                        onClick={a.action}
                        className="w-full flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors text-left"
                      >
                        <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center flex-shrink-0">
                          <a.icon className="w-4 h-4 text-accent-foreground" />
                        </div>
                        <span className="text-sm font-medium text-foreground">{a.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {view === "tracking" && (
                <div className="space-y-4 animate-fade-in">
                  <p className="text-sm text-foreground font-medium">Track Your Order</p>
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs font-medium text-muted-foreground">
                        Order Number
                      </label>
                      <input
                        value={orderNumber}
                        onChange={(e) => setOrderNumber(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleTrackOrder()}
                        placeholder="#1234"
                        className="w-full mt-1 px-3 py-2 text-sm border border-border rounded-lg bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground">
                        Email Address (optional)
                      </label>
                      <input
                        value={orderEmail}
                        onChange={(e) => setOrderEmail(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleTrackOrder()}
                        placeholder="you@email.com"
                        className="w-full mt-1 px-3 py-2 text-sm border border-border rounded-lg bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                      />
                    </div>
                    <button
                      onClick={handleTrackOrder}
                      disabled={!orderNumber.trim() || isLoading}
                      className="w-full py-2 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isLoading ? "Tracking..." : "Track Order"}
                    </button>
                  </div>
                </div>
              )}

              {view === "chat" && (
                <div className="space-y-3 animate-fade-in">
                  {messages.map((m, i) => (
                    <div key={i}>
                      <div
                        className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
                      >
                        <div
                          className={`max-w-[85%] px-3 py-2 rounded-xl text-sm ${
                            m.role === "user"
                              ? "bg-primary text-primary-foreground rounded-br-sm"
                              : m.error
                              ? "bg-destructive/10 text-destructive rounded-bl-sm"
                              : "bg-muted text-foreground rounded-bl-sm"
                          }`}
                        >
                          {m.text}
                          {m.error && (
                            <button
                              onClick={() => {
                                const lastUser = [...messages]
                                  .reverse()
                                  .find((msg) => msg.role === "user");
                                if (lastUser) handleRetry(lastUser.text);
                              }}
                              className="flex items-center gap-1 mt-1 text-xs text-destructive hover:underline"
                            >
                              <RefreshCw className="w-3 h-3" />
                              Retry
                            </button>
                          )}
                        </div>
                      </div>
                      {/* Product cards */}
                      {m.products && m.products.length > 0 && (
                        <div className="mt-2 space-y-1.5 max-w-[90%]">
                          {m.products.map((p) => (
                            <ProductCard key={p.id} product={p} />
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                  {isLoading && <TypingIndicator />}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>

            {/* Input */}
            {(view === "chat" || view === "home") && (
              <div className="p-3 border-t border-border flex-shrink-0">
                <div className="flex gap-2">
                  <input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                    onFocus={() => view === "home" && setView("chat")}
                    placeholder="Type a message..."
                    disabled={isLoading}
                    className="flex-1 px-3 py-2 text-sm border border-border rounded-lg bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
                  />
                  <button
                    onClick={sendMessage}
                    disabled={!input.trim() || isLoading}
                    className="p-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Launcher */}
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setOpen(!open)}
        className="w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center hover:bg-primary/90 transition-colors"
      >
        {open ? <X className="w-5 h-5" /> : <MessageCircle className="w-5 h-5" />}
      </motion.button>
    </div>
  );
}

import { useState } from "react";
import { MessageCircle, X, Package, Sparkles, RotateCcw, Send, ArrowLeft, ShoppingCart } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

type View = "home" | "tracking" | "recommendations" | "chat";

const sampleProducts = [
  { id: 1, name: "Classic Hoodie", price: "$59.00", image: "🧥", rating: "4.8" },
  { id: 2, name: "Canvas Sneakers", price: "$89.00", image: "👟", rating: "4.6" },
  { id: 3, name: "Leather Belt", price: "$35.00", image: "🪢", rating: "4.9" },
];

export default function ChatWidget() {
  const [open, setOpen] = useState(true);
  const [view, setView] = useState<View>("home");
  const [messages, setMessages] = useState<{ role: "bot" | "user"; text: string }[]>([
    { role: "bot", text: "Hi! 👋 I'm ShopMate. How can I help you today?" },
  ]);
  const [input, setInput] = useState("");
  const [orderNumber, setOrderNumber] = useState("");
  const [orderEmail, setOrderEmail] = useState("");

  const sendMessage = () => {
    if (!input.trim()) return;
    setMessages((m) => [...m, { role: "user", text: input }]);
    setInput("");
    setTimeout(() => {
      setMessages((m) => [
        ...m,
        { role: "bot", text: "Thanks for your message! Let me look into that for you." },
      ]);
    }, 800);
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
                  <button onClick={() => setView("home")} className="text-primary-foreground/80 hover:text-primary-foreground">
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                )}
                <div className="w-7 h-7 rounded-full bg-primary-foreground/20 flex items-center justify-center">
                  <MessageCircle className="w-3.5 h-3.5 text-primary-foreground" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-primary-foreground">ShopMate</p>
                  <p className="text-[10px] text-primary-foreground/70">Always here to help</p>
                </div>
              </div>
              <button onClick={() => setOpen(false)} className="text-primary-foreground/80 hover:text-primary-foreground">
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

                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Quick Actions</p>
                  <div className="space-y-2">
                    {[
                      { label: "Track my order", icon: Package, action: () => setView("tracking") },
                      { label: "Product recommendations", icon: Sparkles, action: () => setView("recommendations") },
                      { label: "Returns & exchanges", icon: RotateCcw, action: () => setView("chat") },
                    ].map((a) => (
                      <button
                        key={a.label}
                        onClick={a.action}
                        className="w-full flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-surface-hover transition-colors text-left"
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
                      <label className="text-xs font-medium text-muted-foreground">Order Number</label>
                      <input
                        value={orderNumber}
                        onChange={(e) => setOrderNumber(e.target.value)}
                        placeholder="#1234"
                        className="w-full mt-1 px-3 py-2 text-sm border border-border rounded-lg bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground">Email Address</label>
                      <input
                        value={orderEmail}
                        onChange={(e) => setOrderEmail(e.target.value)}
                        placeholder="you@email.com"
                        className="w-full mt-1 px-3 py-2 text-sm border border-border rounded-lg bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                      />
                    </div>
                    <button className="w-full py-2 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:bg-primary/90 transition-colors">
                      Track Order
                    </button>
                  </div>

                  {/* Sample result */}
                  <div className="border border-border rounded-lg p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-foreground">Order #2847</p>
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-accent text-accent-foreground">In Transit</span>
                    </div>
                    <div className="space-y-1.5">
                      {[
                        { step: "Confirmed", done: true },
                        { step: "Shipped", done: true },
                        { step: "In Transit", done: true },
                        { step: "Delivered", done: false },
                      ].map((s, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${s.done ? "bg-primary" : "bg-border"}`} />
                          <span className={`text-xs ${s.done ? "text-foreground" : "text-muted-foreground"}`}>{s.step}</span>
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground">Estimated delivery: Tomorrow, 5 PM</p>
                  </div>
                </div>
              )}

              {view === "recommendations" && (
                <div className="space-y-4 animate-fade-in">
                  <p className="text-sm text-foreground font-medium">Recommended for You</p>
                  <div className="space-y-3">
                    {sampleProducts.map((p) => (
                      <div key={p.id} className="border border-border rounded-lg p-3 flex items-center gap-3">
                        <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center text-2xl flex-shrink-0">
                          {p.image}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground">{p.name}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-sm font-semibold text-foreground">{p.price}</span>
                            <span className="text-[10px] text-muted-foreground">⭐ {p.rating}</span>
                          </div>
                        </div>
                        <button className="p-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors flex-shrink-0">
                          <ShoppingCart className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {view === "chat" && (
                <div className="space-y-3 animate-fade-in">
                  {messages.map((m, i) => (
                    <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                      <div
                        className={`max-w-[85%] px-3 py-2 rounded-xl text-sm ${
                          m.role === "user"
                            ? "bg-primary text-primary-foreground rounded-br-sm"
                            : "bg-muted text-foreground rounded-bl-sm"
                        }`}
                      >
                        {m.text}
                      </div>
                    </div>
                  ))}
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
                    placeholder="Type a message..."
                    className="flex-1 px-3 py-2 text-sm border border-border rounded-lg bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    onFocus={() => view === "home" && setView("chat")}
                  />
                  <button
                    onClick={sendMessage}
                    className="p-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
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

"use client";

import { useMemo, useState, useTransition } from "react";
import { recordSale } from "@/lib/actions";

type Product = { id: string; name: string; category: string; price: number; stock: number };
type Client = { id: string; name: string };

const money = (n: number) => "₹" + Number(n || 0).toLocaleString("en-IN");

export default function PosCart({ products, clients }: { products: Product[]; clients: Client[] }) {
  const [cart, setCart] = useState<Record<string, number>>({});
  const [method, setMethod] = useState("Cash");
  const [clientId, setClientId] = useState("");
  const [guest, setGuest] = useState("");
  const [discount, setDiscount] = useState(0);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  const byId = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const lines = Object.entries(cart).filter(([, q]) => q > 0);
  const subtotal = lines.reduce((s, [id, q]) => s + (byId.get(id)?.price ?? 0) * q, 0);
  const total = Math.max(0, subtotal - discount);

  const add = (p: Product) => setCart((c) => {
    const cur = c[p.id] ?? 0;
    if (cur >= p.stock) return c;
    return { ...c, [p.id]: cur + 1 };
  });
  const setQty = (id: string, q: number) => setCart((c) => ({ ...c, [id]: Math.max(0, Math.min(q, byId.get(id)?.stock ?? 0)) }));

  const checkout = () => {
    setMsg(null);
    const fd = new FormData();
    fd.set("cart", JSON.stringify(lines.map(([id, qty]) => ({ id, qty }))));
    fd.set("method", method);
    fd.set("discount", String(discount));
    if (clientId) fd.set("client_id", clientId);
    if (guest) fd.set("guest_name", guest);
    start(async () => {
      const res = await recordSale(fd);
      if (res?.ok) {
        setMsg({ ok: true, text: `Sale complete — ${money(res.total ?? total)} (${method})` });
        setCart({}); setDiscount(0); setGuest(""); setClientId("");
      } else {
        setMsg({ ok: false, text: res?.error ?? "Sale failed" });
      }
    });
  };

  const box: React.CSSProperties = { background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", boxShadow: "var(--shadow)" };
  const input: React.CSSProperties = { padding: "0 10px", border: "1px solid var(--border)", borderRadius: 8, fontSize: 14, background: "#fff" , height: 36, boxSizing: "border-box" };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 16, alignItems: "start" }}>
      {/* product grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 10 }}>
        {products.map((p) => {
          const inCart = cart[p.id] ?? 0;
          const out = p.stock <= 0;
          return (
            <button key={p.id} type="button" onClick={() => add(p)} disabled={out || inCart >= p.stock}
              style={{ ...box, textAlign: "left", padding: 12, cursor: out ? "not-allowed" : "pointer", opacity: out ? 0.5 : 1, position: "relative" }}>
              <div style={{ fontSize: 11, color: "var(--muted)" }}>{p.category}</div>
              <div style={{ fontWeight: 600, fontSize: 14, margin: "2px 0 6px" }}>{p.name}</div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontWeight: 700, color: "var(--brand-text)" }}>{money(p.price)}</span>
                <span style={{ fontSize: 11, color: out ? "var(--red)" : "var(--muted)" }}>{out ? "out" : `${p.stock} left`}</span>
              </div>
              {inCart > 0 && <span style={{ position: "absolute", top: 8, right: 8, background: "var(--brand-fill)", color: "#fff", borderRadius: 999, minWidth: 20, height: 20, fontSize: 12, display: "grid", placeItems: "center", padding: "0 5px" }}>{inCart}</span>}
            </button>
          );
        })}
        {products.length === 0 && <div style={{ color: "var(--muted)", fontSize: 13 }}>No active products. Add some below.</div>}
      </div>

      {/* cart */}
      <div style={{ ...box, padding: 14, position: "sticky", top: 12 }}>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>Cart</div>
        {lines.length === 0 && <div style={{ color: "var(--muted)", fontSize: 13, padding: "10px 0" }}>Tap products to add.</div>}
        {lines.map(([id, q]) => {
          const p = byId.get(id)!;
          return (
            <div key={id} style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 0", borderBottom: "1px solid var(--border)" }}>
              <div style={{ flex: 1, fontSize: 13 }}>{p.name}<div style={{ color: "var(--muted)", fontSize: 11 }}>{money(p.price)}</div></div>
              <input type="number" min={0} max={p.stock} value={q} onChange={(e) => setQty(id, Number(e.target.value))} style={{ ...input, width: 52, padding: "4px 6px" }} />
              <div style={{ width: 60, textAlign: "right", fontSize: 13, fontWeight: 600 }}>{money(p.price * q)}</div>
            </div>
          );
        })}

        <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
          <select style={input} value={clientId} onChange={(e) => setClientId(e.target.value)}>
            <option value="">Walk-in / guest</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          {!clientId && <input style={input} placeholder="Guest name (optional)" value={guest} onChange={(e) => setGuest(e.target.value)} />}
          <div style={{ display: "flex", gap: 8 }}>
            <select style={{ ...input, flex: 1 }} value={method} onChange={(e) => setMethod(e.target.value)}>
              <option>Cash</option><option>Card</option><option>UPI</option><option>Bank</option>
            </select>
            <input style={{ ...input, width: 100 }} type="number" min={0} placeholder="Discount" value={discount || ""} onChange={(e) => setDiscount(Number(e.target.value) || 0)} />
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 12, fontSize: 13, color: "var(--muted)" }}><span>Subtotal</span><span>{money(subtotal)}</span></div>
        {discount > 0 && <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "var(--muted)" }}><span>Discount</span><span>−{money(discount)}</span></div>}
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4, fontWeight: 700, fontSize: 16 }}><span>Total</span><span>{money(total)}</span></div>

        <button type="button" onClick={checkout} disabled={pending || lines.length === 0}
          style={{ width: "100%", marginTop: 12, background: "var(--ink)", color: "#fff", border: "none", borderRadius: 10, padding: "11px 0", fontSize: 14, fontWeight: 700, cursor: pending || lines.length === 0 ? "not-allowed" : "pointer", opacity: pending || lines.length === 0 ? 0.6 : 1 }}>
          {pending ? "Processing…" : `Charge ${money(total)}`}
        </button>
        {msg && <div style={{ marginTop: 10, fontSize: 13, color: msg.ok ? "var(--brand-text)" : "var(--red)" }}>{msg.text}</div>}
      </div>
    </div>
  );
}

import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { canSee } from "@/lib/roles";
import { todayISO } from "@/lib/today";
import { restockProduct } from "@/lib/actions";
import RealtimeRefresh from "@/components/RealtimeRefresh";
import StatCard from "@/components/StatCard";
import PosCart from "@/components/PosCart";
import ProductForm from "@/components/ProductForm";

export const dynamic = "force-dynamic";

const money = (n: number) => "₹" + Number(n || 0).toLocaleString("en-IN");

export default async function StorePage() {
  const me = await getProfile();
  if (!me || !canSee(me.role, "/pos")) redirect("/dashboard");

  const supabase = createClient();
  const [productsR, clientsR, salesR] = await Promise.all([
    supabase.from("products").select("id, sku, name, category, price, stock, active").order("category").order("name"),
    supabase.from("clients").select("id, name").order("name"),
    supabase.from("sales").select("id, total, created_at").gte("created_at", todayISO()),
  ]);

  const products = (productsR.data ?? []) as { id: string; sku: string | null; name: string; category: string; price: number; stock: number; active: boolean }[];
  const clients = (clientsR.data ?? []) as { id: string; name: string }[];
  const sales = (salesR.data ?? []) as { id: string; total: number; created_at: string }[];

  const activeProducts = products.filter((p) => p.active);
  const todayRevenue = sales.reduce((s, x) => s + Number(x.total), 0);
  const lowStock = products.filter((p) => p.active && p.stock <= 5).length;

  const box: React.CSSProperties = { background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", boxShadow: "var(--shadow)" };
  const th: React.CSSProperties = { padding: "10px 16px", textAlign: "left", color: "var(--muted)", fontSize: 12 };
  const td: React.CSSProperties = { padding: "10px 16px" };
  const stat = (label: string, value: string, color = "var(--brand-text)") => <StatCard label={label} value={value} color={color} />;

  return (
    <div style={{ maxWidth: 1120 }}>
      <RealtimeRefresh tables={["products", "sales"]} />
      <Link href="/dashboard" style={{ color: "var(--brand-text)", fontSize: 13, textDecoration: "none", display: "inline-block", marginBottom: 10 }}>← Dashboard</Link>
      <h1 style={{ fontSize: 20, margin: "0 0 4px" }}>Retail Store</h1>
      <p style={{ color: "var(--muted)", fontSize: 13, margin: "0 0 18px" }}>Point-of-sale for supplements, merchandise &amp; accessories. Every sale posts a paid invoice into Billing.</p>

      <div style={{ display: "flex", gap: 12, marginBottom: 22 }}>
        {stat("Today's sales", money(todayRevenue))}
        {stat("Transactions today", String(sales.length))}
        {stat("Low stock", String(lowStock), lowStock ? "var(--red)" : "var(--brand-text)")}
      </div>

      {/* ---- Retail POS ---- */}
      <h2 style={{ fontSize: 15, margin: "0 0 10px" }}>Checkout</h2>
      <div style={{ marginBottom: 28 }}><PosCart products={activeProducts} clients={clients} /></div>

      {/* ---- Products / stock ---- */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "0 0 8px" }}>
        <h2 style={{ fontSize: 15, margin: 0 }}>Products &amp; stock</h2>
        <span style={{ flex: 1 }} />
        <ProductForm />
      </div>
      <div style={{ ...box, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
          <thead><tr><th style={th}>Product</th><th style={th}>SKU</th><th style={th}>Category</th><th style={th}>Price</th><th style={th}>Stock</th><th style={th}>Restock</th></tr></thead>
          <tbody>
            {products.map((p) => (
              <tr key={p.id} style={{ borderTop: "1px solid var(--border)" }}>
                <td style={{ ...td, fontWeight: 600 }}>{p.name}</td>
                <td style={{ ...td, color: "var(--muted)", fontSize: 13 }}>{p.sku ?? "—"}</td>
                <td style={{ ...td, color: "var(--muted)", fontSize: 13 }}>{p.category}</td>
                <td style={td}>{money(p.price)}</td>
                <td style={{ ...td, fontWeight: 600, color: p.stock <= 5 ? "var(--red)" : "inherit" }}>{p.stock}</td>
                <td style={td}>
                  <div style={{ display: "flex", gap: 6 }}>
                    <form action={restockProduct}><input type="hidden" name="id" value={p.id} /><input type="hidden" name="delta" value="10" /><button type="submit" style={{ border: "1px solid var(--border)", background: "#fff", borderRadius: 8, padding: "4px 10px", fontSize: 12, cursor: "pointer" }}>+10</button></form>
                    <form action={restockProduct}><input type="hidden" name="id" value={p.id} /><input type="hidden" name="delta" value="-1" /><button type="submit" style={{ border: "1px solid var(--border)", background: "#fff", borderRadius: 8, padding: "4px 10px", fontSize: 12, cursor: "pointer" }}>−1</button></form>
                  </div>
                </td>
              </tr>
            ))}
            {products.length === 0 && <tr><td colSpan={6} style={{ ...td, textAlign: "center", color: "var(--muted)", padding: "22px 16px" }}>No products yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

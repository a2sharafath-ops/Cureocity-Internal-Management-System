import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { canSee, canClasses } from "@/lib/roles";
import { todayISO } from "@/lib/today";
import { cancelBookingStaff, deleteClass } from "@/lib/actions";
import RealtimeRefresh from "@/components/RealtimeRefresh";
import ClassForm from "@/components/ClassForm";
import BookClientSelect from "@/components/BookClientSelect";

export const dynamic = "force-dynamic";

function fmtHour(h: number) { const am = h < 12; const hr = h % 12 === 0 ? 12 : h % 12; return `${hr}:00 ${am ? "AM" : "PM"}`; }

export default async function ClassesPage() {
  const me = await getProfile();
  if (!me || !canSee(me.role, "/classes")) redirect("/dashboard");
  const editable = canClasses(me.role);

  const supabase = createClient();
  const [{ data: roomData }, { data: trainerData }, { data: classData }, { data: clientData }] = await Promise.all([
    supabase.from("rooms").select("id, name, capacity").order("id"),
    supabase.from("staff").select("id, name").eq("is_trainer", true).order("name"),
    supabase.from("classes").select("id, title, date, hour, capacity, rooms(name), staff(name)").gte("date", todayISO()).order("date").order("hour"),
    supabase.from("clients").select("id, name").order("name"),
  ]);
  const rooms = (roomData ?? []) as { id: string; name: string; capacity: number }[];
  const trainers = (trainerData ?? []) as { id: string; name: string }[];
  const classes = (classData ?? []) as unknown as { id: string; title: string; date: string; hour: number; capacity: number; rooms: { name: string } | null; staff: { name: string } | null }[];
  const clients = (clientData ?? []) as { id: string; name: string }[];

  const ids = classes.map((c) => c.id);
  const { data: bookingData } = ids.length
    ? await supabase.from("class_bookings").select("id, class_id, clients(id, name)").in("class_id", ids)
    : { data: [] };
  const bookings = (bookingData ?? []) as unknown as { id: string; class_id: string; clients: { id: string; name: string } | null }[];
  const byClass = new Map<string, typeof bookings>();
  for (const b of bookings) { const a = byClass.get(b.class_id) ?? []; a.push(b); byClass.set(b.class_id, a); }

  return (
    <div style={{ maxWidth: 1000 }}>
      <RealtimeRefresh tables={["classes", "class_bookings"]} />
      <div style={{ display: "flex", alignItems: "center", marginBottom: 4 }}>
        <h1 style={{ fontSize: 20, margin: 0 }}>Group Classes</h1>
        <span style={{ flex: 1 }} />
      </div>
      <p style={{ color: "var(--muted)", fontSize: 13, margin: "6px 0 16px" }}>Studio &amp; recovery bookings · {classes.length} upcoming</p>

      {editable && <ClassForm rooms={rooms} trainers={trainers} />}

      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {classes.map((c) => {
          const bk = byClass.get(c.id) ?? [];
          const full = bk.length >= c.capacity;
          const bookedIds = new Set(bk.map((b) => b.clients?.id));
          const available = clients.filter((cl) => !bookedIds.has(cl.id));
          return (
            <div key={c.id} style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", boxShadow: "var(--shadow)", padding: "16px 18px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <b style={{ fontSize: 15 }}>{c.title}</b>
                <span style={{ background: "var(--brand-tint)", color: "var(--brand-text)", borderRadius: 999, padding: "2px 9px", fontSize: 12, fontWeight: 600 }}>{c.rooms?.name ?? "—"}</span>
                <span style={{ color: "var(--muted)", fontSize: 13 }}>{c.date} · {fmtHour(c.hour)} · {c.staff?.name ?? "—"}</span>
                <span style={{ flex: 1 }} />
                <span style={{ background: full ? "var(--amber-bg)" : "var(--neutral-bg)", color: full ? "var(--amber-text)" : "var(--muted)", borderRadius: 999, padding: "2px 10px", fontSize: 12, fontWeight: 600 }}>{bk.length} / {c.capacity} booked</span>
                {editable && (
                  <form action={deleteClass}>
                    <input type="hidden" name="id" value={c.id} />
                    <button type="submit" style={{ border: "1px solid var(--border)", background: "#fff", borderRadius: 8, padding: "4px 10px", fontSize: 12, cursor: "pointer", color: "var(--red)" }}>Delete</button>
                  </form>
                )}
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10, alignItems: "center" }}>
                {bk.map((b) => (
                  <span key={b.id} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "#f1f5f4", borderRadius: 999, padding: "3px 6px 3px 10px", fontSize: 12 }}>
                    {b.clients?.name ?? "—"}
                    {editable && (
                      <form action={cancelBookingStaff}>
                        <input type="hidden" name="id" value={b.id} />
                        <button type="submit" title="Remove" style={{ border: "none", background: "transparent", cursor: "pointer", color: "var(--muted)", fontSize: 13, lineHeight: 1 }}>✕</button>
                      </form>
                    )}
                  </span>
                ))}
                {bk.length === 0 && <span style={{ color: "var(--muted)", fontSize: 13 }}>No bookings yet.</span>}
                {editable && <BookClientSelect classId={c.id} clients={available} disabled={full} />}
              </div>
            </div>
          );
        })}
        {classes.length === 0 && (
          <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", boxShadow: "var(--shadow)", padding: "18px 20px", color: "var(--muted)", fontSize: 13 }}>
            No upcoming classes. {editable ? "Create one above." : ""}
          </div>
        )}
      </div>
    </div>
  );
}

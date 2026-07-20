// Shown the instant a nav link is clicked, while the server component fetches.
//
// Without this file Next keeps the *previous* page on screen until the new one
// has finished rendering on the server, so every click felt like a freeze —
// nothing acknowledged the click for as long as the queries took. This is the
// single biggest perceived-speed fix in the app; it doesn't make anything
// faster, it makes the wait visible and located.

const bar = (w: string | number, h = 12, mt = 0): React.CSSProperties => ({
  width: w, height: h, marginTop: mt, borderRadius: 6,
  background: "linear-gradient(90deg, var(--neutral-bg) 25%, #f4f6f6 50%, var(--neutral-bg) 75%)",
  backgroundSize: "200% 100%",
  animation: "cure-shimmer 1.2s ease-in-out infinite",
});

const card: React.CSSProperties = {
  background: "var(--card)", border: "1px solid var(--border)",
  borderRadius: "var(--radius)", padding: "14px 16px", flex: 1, minWidth: 150,
};

export default function Loading() {
  return (
    <div style={{ maxWidth: 1120 }} aria-busy="true" aria-live="polite">
      <span style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}>Loading</span>

      <div style={bar(180, 20)} />
      <div style={bar(300, 12, 10)} />

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", margin: "22px 0 18px" }}>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} style={card}>
            <div style={bar("55%", 10)} />
            <div style={bar("40%", 20, 8)} />
            <div style={bar("70%", 10, 8)} />
          </div>
        ))}
      </div>

      <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "var(--radius)", overflow: "hidden" }}>
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 16, padding: "14px 16px", borderTop: i ? "1px solid var(--border)" : "none" }}>
            <div style={bar("22%", 12)} />
            <div style={bar("16%", 12)} />
            <div style={bar("12%", 12)} />
            <span style={{ flex: 1 }} />
            <div style={bar(70, 12)} />
          </div>
        ))}
      </div>
    </div>
  );
}

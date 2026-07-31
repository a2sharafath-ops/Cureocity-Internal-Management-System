import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { canHr } from "@/lib/roles";
import { getAppSettings, brandLogo } from "@/lib/settings";
import PrintTrigger from "@/components/PrintTrigger";

export const dynamic = "force-dynamic";

const money = (n: number) => `₹${Math.round(Number(n || 0)).toLocaleString("en-IN")}`;

// Whole-rupee amount → words (Indian system), for the payslip's "In words" line.
function rupeesInWords(n: number): string {
  n = Math.round(n);
  if (n === 0) return "Rupees Zero Only";
  const ones = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
  const two = (x: number): string => x < 20 ? ones[x] : `${tens[Math.floor(x / 10)]}${x % 10 ? " " + ones[x % 10] : ""}`;
  const three = (x: number): string => x >= 100 ? `${ones[Math.floor(x / 100)]} Hundred${x % 100 ? " and " + two(x % 100) : ""}` : two(x);
  const parts: string[] = [];
  const crore = Math.floor(n / 10000000); n %= 10000000;
  const lakh = Math.floor(n / 100000); n %= 100000;
  const thousand = Math.floor(n / 1000); n %= 1000;
  if (crore) parts.push(`${three(crore)} Crore`);
  if (lakh) parts.push(`${three(lakh)} Lakh`);
  if (thousand) parts.push(`${three(thousand)} Thousand`);
  if (n) parts.push(three(n));
  return `Rupees ${parts.join(" ")} Only`;
}

export default async function PayslipPrintPage({
  params, searchParams,
}: { params: { staff: string }; searchParams: { month?: string; auto?: string } }) {
  const me = await getProfile();
  if (!me || !canHr(me.role)) redirect("/dashboard");

  const month = searchParams.month || new Date().toISOString().slice(0, 7); // YYYY-MM
  const supabase = createClient();
  const [{ data: s }, { data: sal }, { data: pay }] = await Promise.all([
    supabase.from("staff").select("id, name, designation, role, department, work_location, date_of_joining, emp_code, bank_name, bank_account, ifsc").eq("id", params.staff).maybeSingle(),
    supabase.from("salary_structures").select("basic, hra, allowances, gst, pf, esi, pt, tds").eq("staff_id", params.staff).maybeSingle(),
    supabase.from("payroll").select("lop_days").eq("staff_id", params.staff).eq("month", month).maybeSingle(),
  ]);
  if (!s) notFound();
  const st = s as { name: string; designation: string | null; role: string; department: string | null; work_location: string | null; date_of_joining: string | null; emp_code: string | null; bank_name: string | null; bank_account: string | null; ifsc: string | null };
  const sr = (sal ?? {}) as { basic?: number; hra?: number; allowances?: number; gst?: number; pf?: number; esi?: number; pt?: number; tds?: number };

  const settings = await getAppSettings();
  const logo = brandLogo(settings);
  const companyName = (settings.letterhead.name || "Cureocity Healthtech").toUpperCase();

  const [y, m] = month.split("-").map(Number);
  const totalDays = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const monthLabel = new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" }).toUpperCase();
  const lop = Number((pay as { lop_days?: number } | null)?.lop_days ?? 0);
  const paidDays = Math.max(0, totalDays - lop);

  const basic = sr.basic ?? 0, hra = sr.hra ?? 0, allow = sr.allowances ?? 0, gst = sr.gst ?? 0;
  const pf = sr.pf ?? 0, esi = sr.esi ?? 0, pt = sr.pt ?? 0, tds = sr.tds ?? 0;
  const gross = basic + hra + allow + gst;
  const lopAmount = Math.round(lop * (gross / 30));
  const totalDeductions = pf + esi + pt + tds + lopAmount;
  const net = Math.max(0, gross - totalDeductions);

  const earnings: [string, number][] = [
    ["Basic Salary + DA", basic], ["House Rent Allowances", hra], ["Company Allowance", allow],
    ["GST", gst], ["Other Allowance", 0], ["Training Commission", 0], ["Sales Commission", 0], ["Over time work", 0],
  ];
  const deductions: [string, number][] = [
    ["EPF", pf], ["Health Insurance/ESI", esi], ["Professional Tax", pt], ["Advance Salary", 0],
    ["LOP Amount", lopAmount], ["Other Deductions", 0], ["Loan/EMI", 0], ["TDS", tds],
  ];

  const empId = st.emp_code || `CUR-${params.staff.slice(0, 6).toUpperCase()}`;
  const doj = st.date_of_joining ? new Date(st.date_of_joining + "T00:00:00Z").toLocaleDateString("en-GB", { timeZone: "UTC" }) : "—";

  const cell: React.CSSProperties = { border: "1px solid #333", padding: "5px 10px", fontSize: 12.5, verticalAlign: "top" };
  const lbl: React.CSSProperties = { ...cell, width: "22%", fontWeight: 600 };

  return (
    <div style={{ background: "#f3f4f6", minHeight: "100vh", padding: "24px 0" }}>
      <style>{`@media print { .no-print { display: none !important; } body { background:#fff !important; } .sheet { box-shadow:none !important; margin:0 !important; } @page { size: A4; margin: 12mm; } }`}</style>

      <div className="no-print" style={{ maxWidth: 800, margin: "0 auto 14px", display: "flex", justifyContent: "flex-end", padding: "0 8px" }}>
        <PrintTrigger auto={searchParams.auto === "1"} />
      </div>

      <div className="sheet" style={{ maxWidth: 800, margin: "0 auto", background: "#fff", boxShadow: "0 1px 6px rgba(0,0,0,.12)", color: "#111", fontFamily: "system-ui, -apple-system, sans-serif" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 14, borderBottom: "2px solid #111", padding: "16px 18px" }}>
          <img src={logo} alt="Cureocity" width={46} height={46} style={{ display: "block", maxWidth: 54, maxHeight: 54, borderRadius: 8 }} />
          <div style={{ textAlign: "center", flex: 1 }}>
            <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: "-.3px" }}>{companyName}</div>
            <div style={{ fontSize: 13, fontWeight: 700 }}>PAYSLIP FOR THE MONTH OF {monthLabel}</div>
          </div>
        </div>

        {/* Employee + bank details */}
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <tbody>
            {([
              ["Employee Name", st.name.toUpperCase(), "Total Working Days", String(totalDays)],
              ["Employee ID", empId, "LOP Days", lop.toFixed(1)],
              ["Designation", (st.designation ?? st.role ?? "").toUpperCase(), "Paid Days", paidDays.toFixed(1)],
              ["Department", (st.department ?? "—").toUpperCase(), "Bank Name", st.bank_name ?? "—"],
              ["Work Location", (st.work_location ?? "Kochi").toUpperCase(), "Bank A/c No", st.bank_account ?? "—"],
              ["Date of Joining", doj, "IFSC", st.ifsc ?? "—"],
            ] as [string, string, string, string][]).map((r, i) => (
              <tr key={i}>
                <td style={lbl}>{r[0]}</td><td style={cell}>{r[1]}</td>
                <td style={lbl}>{r[2]}</td><td style={cell}>{r[3]}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Earnings / Deductions */}
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th colSpan={2} style={{ ...cell, textAlign: "center", background: "#f6f7f8", fontWeight: 700 }}>Earnings</th>
              <th colSpan={2} style={{ ...cell, textAlign: "center", background: "#f6f7f8", fontWeight: 700 }}>Deductions</th>
            </tr>
          </thead>
          <tbody>
            {earnings.map((e, i) => (
              <tr key={i}>
                <td style={cell}>{e[0]}</td><td style={{ ...cell, textAlign: "right", width: "18%" }}>{money(e[1])}</td>
                <td style={cell}>{deductions[i][0]}</td><td style={{ ...cell, textAlign: "right", width: "18%" }}>{money(deductions[i][1])}</td>
              </tr>
            ))}
            <tr>
              <td style={{ ...cell, fontWeight: 700 }}>Total Gross Salary</td><td style={{ ...cell, textAlign: "right", fontWeight: 700 }}>{money(gross)}</td>
              <td style={{ ...cell, fontWeight: 700 }}>Total Deductions</td><td style={{ ...cell, textAlign: "right", fontWeight: 700 }}>{money(totalDeductions)}</td>
            </tr>
            <tr>
              <td style={{ ...cell, fontWeight: 700 }}>Net Salary</td>
              <td colSpan={3} style={{ ...cell, fontWeight: 800, color: "#15803d" }}>{money(net)}</td>
            </tr>
            <tr>
              <td style={{ ...cell, fontWeight: 700 }}>In words</td>
              <td colSpan={3} style={{ ...cell, fontWeight: 700 }}>{rupeesInWords(net)}</td>
            </tr>
          </tbody>
        </table>

        <div style={{ textAlign: "center", fontSize: 11, color: "#777", padding: "14px 0 18px" }}>
          **This is a computer generated payslip and does not require signature and stamp
        </div>
      </div>
    </div>
  );
}

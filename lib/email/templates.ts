// Transactional email templates. Each returns { subject, html }. Kept simple
// and inline-styled for broad email-client compatibility.

const money = (n: number) => "₹" + Number(n || 0).toLocaleString("en-IN");

function shell(title: string, body: string) {
  return `<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:520px;margin:0 auto;color:#0f172a">
    <div style="background:#0f766e;color:#fff;padding:18px 22px;border-radius:12px 12px 0 0">
      <div style="font-size:18px;font-weight:700">✚ Cureocity</div>
    </div>
    <div style="border:1px solid #e2e8f0;border-top:none;border-radius:0 0 12px 12px;padding:22px">
      <h1 style="font-size:18px;margin:0 0 12px">${title}</h1>
      ${body}
      <p style="color:#64748b;font-size:12px;margin-top:22px">This is an automated message from Cureocity. Please do not reply.</p>
    </div>
  </div>`;
}

export type Template = { subject: string; html: string };

export function tplWelcome(name: string): Template {
  return {
    subject: "Welcome to Cureocity",
    html: shell(`Welcome, ${name}!`, `<p>Your membership is active. You can log in to your portal to view sessions, reports and invoices.</p>`),
  };
}

export function tplInvoiceCreated(name: string, num: string, amount: number, desc: string): Template {
  return {
    subject: `Invoice ${num} — ${money(amount)}`,
    html: shell(`New invoice ${num}`, `<p>Hi ${name},</p><p>An invoice has been raised on your account:</p>
      <p style="font-size:15px"><b>${desc}</b><br/>Amount due: <b>${money(amount)}</b></p>
      <p>You can pay online or at the front desk.</p>`),
  };
}

export function tplPaymentReceived(name: string, num: string, amount: number): Template {
  return {
    subject: `Payment received — ${num}`,
    html: shell("Payment received", `<p>Hi ${name},</p><p>We've received your payment of <b>${money(amount)}</b> for invoice <b>${num}</b>. Thank you!</p>`),
  };
}

export function tplAppointmentReminder(name: string, when: string): Template {
  return {
    subject: "Reminder: your upcoming session",
    html: shell("Session reminder", `<p>Hi ${name},</p><p>This is a reminder for your session on <b>${when}</b>. See you there!</p>`),
  };
}

export function tplBlueprintReady(name: string): Template {
  return {
    subject: "Your BluePrint report is ready",
    html: shell("Your BluePrint is ready", `<p>Hi ${name},</p><p>Your personalised BluePrint health report is now available in your portal.</p>`),
  };
}

export const TEMPLATE_CHOICES = [
  { key: "welcome", label: "Welcome" },
  { key: "invoice", label: "Invoice created (sample)" },
  { key: "payment", label: "Payment received (sample)" },
  { key: "reminder", label: "Appointment reminder (sample)" },
  { key: "blueprint", label: "BluePrint ready" },
] as const;

export function renderChoice(key: string, name: string): Template {
  switch (key) {
    case "invoice": return tplInvoiceCreated(name, "INV-000", 2500, "Sample service");
    case "payment": return tplPaymentReceived(name, "INV-000", 2500);
    case "reminder": return tplAppointmentReminder(name, "tomorrow at 6:00 PM");
    case "blueprint": return tplBlueprintReady(name);
    default: return tplWelcome(name);
  }
}

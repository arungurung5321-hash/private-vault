import dotenv from "dotenv";
dotenv.config();

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = process.env.FROM_EMAIL || "noreply@my-privatevault.com";
const FROM_NAME = process.env.FROM_NAME || "Private Vault";
const APP_URL = process.env.CLIENT_URL || "https://my-privatevault.com";

export async function sendEmail(opts: { to: string; subject: string; html: string }): Promise<void> {
  if (!RESEND_API_KEY) { console.warn("[email] No RESEND_API_KEY — skipping email to:", opts.to); return; }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Authorization": `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: `${FROM_NAME} <${FROM_EMAIL}>`, to: [opts.to], subject: opts.subject, html: opts.html })
  });
  if (!res.ok) { const err = await res.text(); throw new Error(`Resend ${res.status}: ${err}`); }
}

export async function sendAccessRequestEmail(opts: { ownerEmail: string; ownerName: string; accessorEmail: string; accessorName: string; itemTitle: string; itemType: string; requestId: string; ipAddress: string; }): Promise<void> {
  const approveUrl = `${APP_URL}/?action=approve&requestId=${opts.requestId}`;
  const denyUrl = `${APP_URL}/?action=deny&requestId=${opts.requestId}`;
  await sendEmail({ to: opts.ownerEmail, subject: `⚠️ Access request for "${opts.itemTitle}"`, html: `<p>Hi ${opts.ownerName},</p><p><b>${opts.accessorName}</b> (${opts.accessorEmail}) wants to access <b>${opts.itemTitle}</b>. IP: ${opts.ipAddress}</p><p><a href="${approveUrl}" style="padding:10px 20px;background:#4ade80;color:#000;border-radius:6px;text-decoration:none;margin-right:8px">✓ Approve</a><a href="${denyUrl}" style="padding:10px 20px;background:#e05252;color:#fff;border-radius:6px;text-decoration:none">✕ Deny</a></p>` });
}

export async function sendAccessApprovedEmail(opts: { accessorEmail: string; accessorName: string; ownerName: string; itemTitle: string; itemType: string; accessUrl: string; }): Promise<void> {
  await sendEmail({ to: opts.accessorEmail, subject: `✅ Access approved — "${opts.itemTitle}"`, html: `<p>Hi ${opts.accessorName},</p><p>${opts.ownerName} approved your access to <b>${opts.itemTitle}</b>.</p><p><a href="${opts.accessUrl}" style="padding:12px 24px;background:#c9a84c;color:#000;border-radius:6px;text-decoration:none;font-weight:bold">View Item →</a></p>` });
}

export async function sendAccessDeniedEmail(opts: { accessorEmail: string; ownerName: string; itemTitle: string; }): Promise<void> {
  await sendEmail({ to: opts.accessorEmail, subject: `Access denied — "${opts.itemTitle}"`, html: `<p>${opts.ownerName} denied your access request for <b>${opts.itemTitle}</b>.</p>` });
}

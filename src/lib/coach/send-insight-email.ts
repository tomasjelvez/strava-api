import { Resend } from "resend";

import { clerkClient } from "@clerk/nextjs/server";

const SUBJECT = "Your workout analysis is ready 🏃‍♂️";

async function resolveUserEmail(userId: string): Promise<string | null> {
  const client = await clerkClient();
  const user = await client.users.getUser(userId);
  const primary =
    user.emailAddresses.find((e) => e.id === user.primaryEmailAddressId) ??
    user.emailAddresses[0];
  const addr = primary?.emailAddress?.trim();
  return addr && addr.length > 0 ? addr : null;
}

export async function sendInsightEmail(userId: string, bodyText: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.RESEND_FROM_EMAIL?.trim();
  if (!apiKey || !from) {
    console.warn(
      "[coach] skipping email: RESEND_API_KEY or RESEND_FROM_EMAIL not configured"
    );
    return;
  }

  const to = await resolveUserEmail(userId);
  if (!to) {
    console.warn("[coach] skipping email: no Clerk email for user", { userId });
    return;
  }

  const resend = new Resend(apiKey);
  const html = `<pre style="font-family: system-ui, sans-serif; white-space: pre-wrap;">${escapeHtml(bodyText)}</pre>`;

  const { error } = await resend.emails.send({
    from,
    to,
    subject: SUBJECT,
    text: bodyText,
    html,
  });

  if (error) {
    console.error("[coach] Resend send failed", error);
    throw error;
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

import { getSettings } from '@/lib/settings';

async function credentials() {
  const settings = await getSettings();
  if (!settings.whatsappApiEnabled || !settings.whatsappAccessToken || !settings.whatsappPhoneNumberId) {
    throw new Error('WhatsApp API is not configured');
  }
  return { phoneNumberId: String(settings.whatsappPhoneNumberId), accessToken: String(settings.whatsappAccessToken) };
}

async function callMessagesApi(payload: Record<string, unknown>) {
  const { phoneNumberId, accessToken } = await credentials();
  const res = await fetch(`https://graph.facebook.com/v20.0/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ messaging_product: 'whatsapp', ...payload })
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error?.message || `WhatsApp send failed (${res.status})`);
  return json;
}

export async function sendWhatsAppTemplate(to: string, bodyParams: string[]) {
  const settings = await getSettings();
  return callMessagesApi({
    to,
    type: 'template',
    template: {
      name: settings.whatsappReminderTemplateName,
      language: { code: settings.whatsappReminderTemplateLang },
      components: [{ type: 'body', parameters: bodyParams.map((text) => ({ type: 'text', text })) }]
    }
  });
}

// Free-form text reply — only deliverable within the 24-hour window after the customer's last
// message (Meta's "customer service window"), which is always true here since this is only ever
// called in direct response to an inbound message from the same number.
export async function sendWhatsAppText(to: string, body: string) {
  return callMessagesApi({ to, type: 'text', text: { body } });
}

// Up to 3 tappable quick-reply buttons alongside the body text — the customer can still type a
// free-text reply instead of tapping one.
export async function sendWhatsAppButtons(to: string, body: string, buttons: { id: string; title: string }[]) {
  return callMessagesApi({
    to,
    type: 'interactive',
    interactive: {
      type: 'button',
      body: { text: body },
      action: { buttons: buttons.map((b) => ({ type: 'reply', reply: { id: b.id, title: b.title } })) }
    }
  });
}

// A native WhatsApp "dropdown" — tapping the button opens a scrollable list of rows to pick from.
export async function sendWhatsAppList(
  to: string,
  body: string,
  buttonLabel: string,
  sectionTitle: string,
  rows: { id: string; title: string; description?: string }[]
) {
  return callMessagesApi({
    to,
    type: 'interactive',
    interactive: {
      type: 'list',
      body: { text: body },
      action: { button: buttonLabel, sections: [{ title: sectionTitle, rows }] }
    }
  });
}

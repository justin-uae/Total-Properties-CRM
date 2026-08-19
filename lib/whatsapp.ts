import { getSettings } from '@/lib/settings';

async function callMessagesApi(phoneNumberId: string, accessToken: string, payload: Record<string, unknown>) {
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
  if (!settings.whatsappApiEnabled || !settings.whatsappAccessToken || !settings.whatsappPhoneNumberId) {
    throw new Error('WhatsApp API is not configured');
  }
  return callMessagesApi(String(settings.whatsappPhoneNumberId), String(settings.whatsappAccessToken), {
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
  const settings = await getSettings();
  if (!settings.whatsappApiEnabled || !settings.whatsappAccessToken || !settings.whatsappPhoneNumberId) {
    throw new Error('WhatsApp API is not configured');
  }
  return callMessagesApi(String(settings.whatsappPhoneNumberId), String(settings.whatsappAccessToken), {
    to,
    type: 'text',
    text: { body }
  });
}

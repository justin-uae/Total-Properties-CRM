import { getSettings } from '@/lib/settings';

export async function sendWhatsAppTemplate(to: string, bodyParams: string[]) {
  const settings = await getSettings();
  if (!settings.whatsappApiEnabled || !settings.whatsappAccessToken || !settings.whatsappPhoneNumberId) {
    throw new Error('WhatsApp API is not configured');
  }
  const res = await fetch(`https://graph.facebook.com/v20.0/${settings.whatsappPhoneNumberId}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${settings.whatsappAccessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'template',
      template: {
        name: settings.whatsappReminderTemplateName,
        language: { code: settings.whatsappReminderTemplateLang },
        components: [{ type: 'body', parameters: bodyParams.map((text) => ({ type: 'text', text })) }]
      }
    })
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error?.message || `WhatsApp send failed (${res.status})`);
  return json;
}

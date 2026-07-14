// One-off / re-runnable script to store WhatsApp Cloud API credentials in the
// Setting table, since there is no admin UI for Settings in this build.
//
// Usage:
//   node scripts/configure-whatsapp.js <phoneNumberId> <accessToken> [businessAccountId] [templateName] [templateLang]
//
// Example:
//   node scripts/configure-whatsapp.js 109876543210 EAAxxxxACCESS_TOKENxxxx 123456789012345 expiry_reminder en_US

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const [, , phoneNumberId, accessToken, businessAccountId, templateName, templateLang] = process.argv;
  if (!phoneNumberId || !accessToken) {
    console.log('Usage: node scripts/configure-whatsapp.js <phoneNumberId> <accessToken> [businessAccountId] [templateName] [templateLang]');
    process.exit(1);
  }
  const entries = {
    whatsappApiEnabled: true,
    whatsappPhoneNumberId: phoneNumberId,
    whatsappAccessToken: accessToken,
    whatsappBusinessAccountId: businessAccountId || '',
    whatsappReminderTemplateName: templateName || 'expiry_reminder',
    whatsappReminderTemplateLang: templateLang || 'en_US'
  };
  for (const [key, value] of Object.entries(entries)) {
    await prisma.setting.upsert({ where: { key }, update: { value }, create: { key, value } });
  }
  console.log('WhatsApp settings updated:', { ...entries, whatsappAccessToken: '(hidden)' });
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

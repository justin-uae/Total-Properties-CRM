import { prisma } from '@/lib/db';

export const defaultSettings = {
  companyName: 'Total Business Center',
  appName: '',
  defaultTheme: 'warm-sunset',
  addressLocation1: '',
  addressLocation2: '',
  smtpEnabled: false,
  whatsappApiEnabled: false,
  whatsappPhoneNumberId: '',
  whatsappBusinessAccountId: '',
  whatsappAccessToken: '',
  whatsappReminderTemplateName: 'expiry_reminder',
  whatsappReminderTemplateLang: 'en_US',
  documentExpiryReminderDays: 7,
  requirePasswordChange: true,
  emailTemplates: {
    quotation: {
      subject: 'Quotation {{quoteNumber}} from {{companyName}}',
      bodyHtml:
        '<p>Dear {{clientName}},</p>' +
        '<p>Trust all is well.</p>' +
        '<p>Greetings from {{companyName}}.</p>' +
        '<p>Thank you for your interest in our services. Please find the attached quotation for your kind review.</p>' +
        '<p>You may also review the quotation through the link provided, where you can conveniently accept it online should you wish to proceed:</p>' +
        '<p><a href="{{link}}">{{link}}</a></p>' +
        '<p>If you have any questions or require further clarification, please do not hesitate to contact us. We will be pleased to assist you.</p>' +
        '<p>Thank you for considering {{companyName}}. We look forward to the opportunity to support your business.</p>' +
        '<p>Warm regards,<br>{{companyName}}</p>'
    },
    invoice: {
      subject: 'Invoice {{invoiceNumber}} from {{companyName}}',
      bodyHtml:
        '<p>Dear {{clientName}},</p>' +
        '<p>Trust all is well.</p>' +
        '<p>Greetings from {{companyName}}.</p>' +
        '<p>Please find the attached invoice for your kind reference.</p>' +
        '<p>You may also access the invoice through the link provided, where you can review the invoice details and print a copy if required:</p>' +
        '<p><a href="{{link}}">{{link}}</a></p>' +
        '<p>Should you wish to proceed with the payment, you may settle the invoice either by bank transfer using the bank details provided on the invoice or by cash or cheque, as per the agreed payment terms.</p>' +
        '<p>Should you have any questions or require further clarification, please do not hesitate to contact us. We will be pleased to assist you.</p>' +
        '<p>Thank you for choosing {{companyName}}. We appreciate your business and look forward to serving you.</p>' +
        '<p>Warm regards,<br>{{companyName}}</p>'
    }
  },
  bankDetails: {
    bankName: 'ADCB (Abu Dhabi Commercial Bank)',
    accountName: 'Total Property Solutions Real Estate LLC - OPC',
    accountNumber: '11880849820001',
    iban: 'AE200030011880849820001',
    swiftCode: '',
    branch: 'IBD-ABU Dhabi MAIN'
  }
};

export async function getSettings() {
  const rows = await prisma.setting.findMany();
  const merged: Record<string, unknown> = { ...defaultSettings };
  rows.forEach((row) => {
    merged[row.key] = row.value as unknown;
  });
  return merged;
}

export async function setSetting(key: string, value: unknown) {
  return prisma.setting.upsert({
    where: { key },
    update: { value: value as any },
    create: { key, value: value as any }
  });
}

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
    },
    contract: {
      subject: 'Contract {{contractNumber}} from {{companyName}}',
      bodyHtml:
        '<p>Dear {{clientName}},</p>' +
        '<p>Greetings from {{companyName}}.</p>' +
        '<p>Please find attached your Lease Agreement / Contract for your review.</p>' +
        '<p>You may review, digitally sign, or upload a signed copy of this contract at any time by logging in to your Tenant Account:</p>' +
        '<p><a href="{{link}}">{{link}}</a></p>' +
        '<p>Should you have any questions or require further clarification, please do not hesitate to contact us. Our team will be pleased to assist you.</p>' +
        '<p>Thank you for choosing {{companyName}}. We appreciate your continued trust and look forward to serving you.</p>' +
        '<p>Kind regards,<br>{{companyName}}<br>Business Centre Management</p>'
    },
    contractRenewalReminder: {
      subject: 'Contract Renewal Reminder – {{clientName}}',
      bodyHtml:
        '<p>Dear Valued Tenant,</p>' +
        '<p>Greetings from Total Property Solutions Real Estate LLC – OPC.</p>' +
        '<p>We hope this email finds you well.</p>' +
        '<p>This is a reminder that your Lease Agreement is scheduled to expire in approximately three (3) months.</p>' +
        '<p>To ensure uninterrupted occupancy and sufficient time to complete the renewal process, we kindly request that you inform us of your intention to renew or not renew your lease at your earliest convenience.</p>' +
        '<p>If you wish to proceed with the renewal, our team will be pleased to prepare the necessary documentation and provide you with the renewal quotation and payment details.</p>' +
        '<p>If you do not intend to renew, kindly provide us with your written notice in accordance with the terms and conditions of your Lease Agreement. This will allow us to coordinate the necessary contract closure procedures, including office handover, Tawtheeq cancellation (where applicable), and the refund of your Security Deposit, subject to the terms of the agreement.</p>' +
        '<p>Should you have any questions or require assistance regarding your renewal options, please do not hesitate to contact us. Our team will be happy to assist you.</p>' +
        '<p>Thank you for choosing Total Property Solutions Real Estate LLC – OPC. We sincerely appreciate your continued trust and look forward to serving you.</p>' +
        '<p>Kind regards,<br>Total Property Solutions Real Estate LLC – OPC<br>Business Centre Management</p>'
    },
    contractExpired: {
      subject: 'Immediate Action Required - Lease Expired Today | {{clientName}}',
      bodyHtml:
        '<p>Dear Valued Tenant,</p>' +
        '<p>Greetings from Total Property Solutions Real Estate LLC – OPC.</p>' +
        '<p>This is an automated reminder that your Lease Agreement expires today.</p>' +
        '<p>If you have already completed your renewal or have finalized the renewal process with our team, please disregard this email and thanks for your continued tenancy.</p>' +
        '<p>If you have not yet renewed your Lease Agreement, we kindly request that you contact our Management Team immediately to avoid any interruption to your tenancy and to discuss the next steps.</p>' +
        '<p>You may reach us through any of the following:</p>' +
        '<p><strong>Email:</strong><br>karen@totalproperty.ae<br>info@totalproperty.ae</p>' +
        '<p><strong>Mobile:</strong><br>+971 58 502 0978<br>+971 58 504 2436</p>' +
        '<p>We encourage you to contact us as soon as possible so that we can assist you with your renewal or discuss your intentions regarding the tenancy. Prompt communication will help ensure a smooth process and avoid any unnecessary complications in accordance with the terms and conditions of your Lease Agreement.</p>' +
        '<p>If you have any questions or require assistance, please do not hesitate to get in touch. Our team will be pleased to assist you.</p>' +
        '<p>Thank you for choosing Total Property Solutions Real Estate LLC – OPC. We appreciate your continued trust and look forward to hearing from you.</p>' +
        '<p>Kind regards,<br>Total Property Solutions Real Estate LLC – OPC<br>Business Centre Management</p>'
    },
    chequeReminder: {
      subject: 'Cheque Deposit Reminder – Payment Due on {{chequeDate}} | {{clientName}}',
      bodyHtml:
        '<p>Dear Valued Tenant,</p>' +
        '<p>Greetings from Total Property Solutions Real Estate LLC – OPC.</p>' +
        '<p>This is an automated reminder that your post-dated cheque is scheduled to be deposited five (5) days from the date of this email, on {{chequeDate}}.</p>' +
        '<p>Kindly ensure that sufficient funds are available in your account before the cheque deposit date to avoid any inconvenience, returned cheque charges, or delays in your tenancy obligations.</p>' +
        '<p>If you wish to defer the cheque deposit, you are required to submit your cheque deferral request and settle the applicable cheque deferral fee at least three (3) days prior to the cheque date. Requests received after this period may not be accommodated due to bank processing timelines.</p>' +
        '<p>Please note that if we do not receive your cheque deferral request and the corresponding payment before the required deadline, your cheque will be deposited automatically on the scheduled cheque date ({{chequeDate}}).</p>' +
        '<p>Should you require assistance or wish to arrange a cheque deferral, please contact our Management Team through any of the following:</p>' +
        '<p><strong>Email:</strong><br>karen@totalproperty.ae<br>info@totalproperty.ae</p>' +
        '<p><strong>Mobile:</strong><br>+971 58 502 0978<br>+971 58 504 2436</p>' +
        '<p>If you have already coordinated this payment or submitted your cheque deferral request, kindly disregard this email.</p>' +
        '<p>Thank you for your cooperation and continued tenancy with Total Property Solutions Real Estate LLC – OPC.</p>' +
        '<p>Kind regards,<br>Total Property Solutions Real Estate LLC – OPC<br>Business Centre Management</p>'
    },
    chequeDepositNotice: {
      subject: 'Cheque Deposit Notice – Cheque Scheduled for {{chequeDate}} | {{clientName}}',
      bodyHtml:
        '<p>Dear Valued Tenant,</p>' +
        '<p>Greetings from Total Property Solutions Real Estate LLC – OPC.</p>' +
        '<p>This is to notify you that your post-dated cheque with {{bankName}} is scheduled to be deposited in twenty (20) days, on {{chequeDate}}.</p>' +
        '<p>Kindly ensure that sufficient funds are available in your account before the cheque deposit date to avoid any inconvenience, returned cheque charges, or delays in your tenancy obligations.</p>' +
        '<p>If you wish to defer or hold this cheque, you may submit a Cheque Deferred/Hold request through your Tenant Account. Requests can only be submitted between twenty (20) and fifteen (15) days before the cheque date, and a Cheque Deferred/Hold fee of AED 525 applies to all approved requests. Requests submitted outside this window cannot be accommodated due to bank processing timelines.</p>' +
        '<p><a href="{{link}}">{{link}}</a></p>' +
        '<p>Should you require any assistance, please contact our Management Team through any of the following:</p>' +
        '<p><strong>Email:</strong><br>karen@totalproperty.ae<br>info@totalproperty.ae</p>' +
        '<p><strong>Mobile:</strong><br>+971 58 502 0978<br>+971 58 504 2436</p>' +
        '<p>Thank you for your cooperation and continued tenancy with Total Property Solutions Real Estate LLC – OPC.</p>' +
        '<p>Kind regards,<br>Total Property Solutions Real Estate LLC – OPC<br>Business Centre Management</p>'
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

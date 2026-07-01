import { prisma } from '@/lib/db';

export const defaultSettings = {
  companyName: 'Total Business Centres',
  appName: 'Total Business Centres CRM',
  defaultTheme: 'warm-sunset',
  addressLocation1: 'Address Location 1',
  addressLocation2: 'Address Location 2',
  stripeEnabled: false,
  stripePublishableKey: '',
  stripeSecretKey: '',
  smtpEnabled: false,
  whatsappApiEnabled: false,
  whatsappPhoneNumberId: '',
  whatsappBusinessAccountId: '',
  whatsappAccessToken: '',
  requirePasswordChange: true
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

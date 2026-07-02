import { PrismaClient, PermissionAction } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { modules } from '../lib/modules';

const prisma = new PrismaClient();

async function main() {
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminEmail || !adminPassword) {
    throw new Error('Set ADMIN_EMAIL and ADMIN_PASSWORD in your .env before seeding.');
  }

  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      name: 'Master Admin',
      email: adminEmail,
      role: 'MASTER_ADMIN',
      status: 'ACTIVE',
      theme: 'warm-sunset',
      passwordHash: await bcrypt.hash(adminPassword, 12),
      mustChangePassword: true
    }
  });

  for (const module of modules.filter((m) => m.slug !== 'dashboard')) {
    for (const action of Object.values(PermissionAction)) {
      await prisma.permission.upsert({
        where: { userId_module_action: { userId: admin.id, module: module.slug, action } },
        update: {},
        create: { userId: admin.id, module: module.slug, action }
      });
    }
  }

  const settings = {
    companyName: process.env.COMPANY_NAME || '',
    appName: process.env.APP_NAME || '',
    defaultTheme: 'warm-sunset',
    addressLocation1: process.env.ADDRESS_LOCATION_1 || '',
    addressLocation2: process.env.ADDRESS_LOCATION_2 || '',
    stripeEnabled: false,
    stripePublishableKey: '',
    stripeSecretKey: '',
    whatsappApiEnabled: false
  };
  for (const [key, value] of Object.entries(settings)) {
    await prisma.setting.upsert({ where: { key }, update: { value: value as any }, create: { key, value: value as any } });
  }

  const sampleCount = await prisma.record.count();
  if (!sampleCount) {
    await prisma.record.createMany({
      data: [
        {
          module: 'leads', title: 'Ahmed Khan - Private Office', status: 'New', source: 'Website', location: 'Address Location 1', createdById: admin.id,
          data: { fullName: 'Ahmed Khan', companyName: 'AK Consulting', telephone: '+971501234567', email: 'ahmed@example.com', serviceType: 'Private Office', location: 'Address Location 1', source: 'Website', nextFollowUp: new Date().toISOString(), notes: 'Needs office for 4 people.' } as any
        },
        {
          module: 'services-offices', title: 'Suite 1205', status: 'Available', location: 'Address Location 1', createdById: admin.id,
          data: { serviceType: 'Private Office', unitName: 'Suite 1205', location: 'Address Location 1', floor: '12', capacity: 4, sizeSqFt: 280, monthlyRate: 6500, availableFrom: new Date().toISOString().slice(0,10), description: 'Furnished private office with city view.' } as any
        },
        {
          module: 'meeting-rooms', title: 'Boardroom A', status: 'Available', location: 'Address Location 1', createdById: admin.id,
          data: { roomName: 'Boardroom A', roomCode: 'BR-A', location: 'Address Location 1', capacity: 12, hourlyRate: 250, amenities: 'Screen, Wi-Fi, water, conference table.' } as any
        },
        {
          module: 'clients', title: 'Bright Future LLC', status: 'Active', location: 'Address Location 2', createdById: admin.id,
          data: { companyName: 'Bright Future LLC', contactName: 'Sara Ali', email: 'sara@example.com', telephone: '+971551112222', tradeLicenseNumber: 'TL-123456', serviceType: 'Virtual Office', location: 'Address Location 2' } as any
        },
        {
          module: 'invoices', title: 'INV-2026-001', status: 'Sent', publicToken: 'inv_demo_token', createdById: admin.id,
          data: { invoiceNumber: 'INV-2026-001', clientName: 'Bright Future LLC', email: 'sara@example.com', description: 'Virtual office monthly package', amount: 1200, vatAmount: 60, issueDate: new Date().toISOString().slice(0,10), dueDate: new Date(Date.now() + 7*86400000).toISOString().slice(0,10) } as any
        },
        {
          module: 'visitors', title: 'David Smith', status: 'Checked In', createdById: admin.id,
          data: { visitorName: 'David Smith', company: 'DS Trading', hostName: 'Bright Future LLC', purpose: 'Client meeting', badgeNumber: 'V-102', checkInAt: new Date().toISOString() } as any
        },
        {
          module: 'mail-parcels', title: 'Parcel for Bright Future LLC', status: 'Received', createdById: admin.id,
          data: { clientName: 'Bright Future LLC', itemType: 'Parcel', sender: 'DHL', trackingNumber: 'DHL123456', receivedAt: new Date().toISOString() } as any
        },
        {
          module: 'maintenance', title: 'AC issue - Suite 1205', status: 'Open', createdById: admin.id,
          data: { ticketNumber: 'REQ-2026-001', clientName: 'Bright Future LLC', category: 'AC', priority: 'High', reportedAt: new Date().toISOString(), issue: 'AC not cooling properly.' } as any
        }
      ]
    });
  }
}

main().finally(async () => prisma.$disconnect());

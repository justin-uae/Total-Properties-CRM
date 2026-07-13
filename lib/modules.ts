import {
  LayoutDashboard,
  Users,
  UserPlus,
  Building2,
  CalendarDays,
  FileText,
  Receipt,
  CreditCard,
  Wrench,
  FolderOpen,
  ClipboardSignature,
  PackagePlus,
  DoorOpen,
  ShieldCheck,
  Mail,
  KeyRound,
  UserCheck,
  RefreshCcw,
  BellRing,
  Map,
  BriefcaseBusiness
} from 'lucide-react';

export type FieldType = 'text' | 'email' | 'tel' | 'number' | 'money' | 'textarea' | 'select' | 'date' | 'time' | 'datetime' | 'checkbox' | 'checkbox-group' | 'file' | 'file-multi' | 'password';

export type ModuleField = {
  name: string;
  label: string;
  type: FieldType;
  required?: boolean;
  options?: string[];
  /** Module slug to pull live options from, instead of a static options array. */
  optionsSource?: string;
  /** If set, options use record.data[optionsValueField] as both value and label (a string, e.g. company name) instead of record.id/record.title. */
  optionsValueField?: string;
  /** When this field's value changes, copy the matching record's data[sourceDataField] into form[targetField] (e.g. auto-fill email from the selected company). */
  autofill?: { targetField: string; sourceDataField: string };
  /** Hide this field while the named field has (or lacks) a value. */
  hideWhen?: { field: string; notEmpty?: boolean };
  /** For type 'checkbox-group': several independent checkboxes rendered inline on one row, each storing its own boolean under form[name]. */
  groupFields?: { name: string; label: string }[];
  placeholder?: string;
  colSpan?: 1 | 2;
};

export type ModuleConfig = {
  slug: string;
  title: string;
  singular: string;
  group: 'Dashboard' | 'Sales' | 'Operations' | 'Spaces' | 'Clients' | 'Finance' | 'Admin';
  description: string;
  icon: any;
  defaultStatus?: string;
  statuses: string[];
  fields: ModuleField[];
  tableFields: string[];
  systemOnly?: boolean;
};

export const serviceTypes = ['Virtual Office', 'Co Working Office', 'Private Office', 'Meeting Room'];
export const leadSources = ['Website', 'Telephone', 'WhatsApp', 'Walk-in', 'Google Ads', 'SEO', 'Referral', 'Instagram', 'Facebook', 'Agent/Broker', 'Existing Customer'];
export const themes = [
  { id: 'modern-blue', name: 'Modern Blue' },
  { id: 'purple-elegance', name: 'Purple Elegance' },
  { id: 'green-fresh', name: 'Green Fresh' },
  { id: 'warm-sunset', name: 'Warm Sunset' },
  { id: 'dark-mode', name: 'Dark Mode' },
  { id: 'minimal-clean', name: 'Minimal Clean' }
];

export const modules: ModuleConfig[] = [
  {
    slug: 'dashboard',
    title: 'Dashboard',
    singular: 'Dashboard',
    group: 'Dashboard',
    description: 'Role based overview of leads, finance, operations and tasks.',
    icon: LayoutDashboard,
    statuses: [],
    fields: [],
    tableFields: [],
    systemOnly: true
  },
  {
    slug: 'web-form-leads',
    title: 'Web Form Leads',
    singular: 'Web Form Lead',
    group: 'Sales',
    description: 'Website form enquiries submitted from Total Business Centres websites.',
    icon: UserPlus,
    defaultStatus: 'Contacted',
    statuses: ['New', 'Contacted', 'Quoted', 'Arrange for viewing', 'Closed'],
    tableFields: ['fullName', 'telephone', 'email', 'enquiry', 'source', 'status'],
    fields: [
      { name: 'fullName', label: 'Full Name', type: 'text', required: true },
      { name: 'email', label: 'Email', type: 'email' },
      { name: 'telephone', label: 'Telephone', type: 'tel', required: true },
      { name: 'serviceType', label: 'Service Type', type: 'select', options: serviceTypes },
      { name: 'location', label: 'Location', type: 'text' },
      { name: 'source', label: 'Source', type: 'select', options: leadSources },
      { name: 'enquiry', label: 'Enquiry', type: 'textarea', colSpan: 2 },
      { name: 'remarks', label: 'Remarks', type: 'textarea', colSpan: 2 }
    ]
  },
  {
    slug: 'leads',
    title: 'Leads',
    singular: 'Lead',
    group: 'Sales',
    description: 'All telephone, WhatsApp, walk-in and converted website enquiries.',
    icon: Users,
    defaultStatus: 'New',
    statuses: ['New', 'Contacted', 'Viewing Booked', 'Quotation Sent', 'Negotiation', 'Won', 'Lost', 'Transferred to Quotation'],
    tableFields: ['fullName', 'telephone', 'serviceType', 'source', 'nextFollowUp', 'status'],
    fields: [
      { name: 'fullName', label: 'Full Name', type: 'text', required: true },
      { name: 'companyName', label: 'Company Name', type: 'text' },
      { name: 'email', label: 'Email', type: 'email' },
      { name: 'telephone', label: 'Telephone', type: 'tel', required: true },
      { name: 'serviceType', label: 'Service Type', type: 'select', options: serviceTypes, required: true },
      { name: 'location', label: 'Location', type: 'text' },
      { name: 'source', label: 'Lead Source', type: 'select', options: leadSources },
      { name: 'budget', label: 'Budget', type: 'money' },
      { name: 'moveInDate', label: 'Move-in Date', type: 'date' },
      { name: 'nextFollowUp', label: 'Next Follow-up', type: 'date' },
      { name: 'lostReason', label: 'Lost Reason', type: 'select', options: ['Price too high', 'Location not suitable', 'No availability', 'Chose competitor', 'No response', 'Looking later', 'Wrong enquiry', 'Duplicate enquiry'] },
      { name: 'notes', label: 'Notes', type: 'textarea', colSpan: 2 }
    ]
  },
  {
    slug: 'quotations',
    title: 'Quotations',
    singular: 'Quotation',
    group: 'Sales',
    description: 'Create proposals with public acceptance links and follow-up tracking.',
    icon: ClipboardSignature,
    defaultStatus: 'Draft',
    statuses: ['Draft', 'Sent', 'Viewed', 'Accepted', 'Rejected', 'Expired'],
    tableFields: ['quoteNumber', 'clientName', 'serviceType', 'amount', 'validUntil', 'status'],
    fields: [
      { name: 'quoteNumber', label: 'Quote Number', type: 'text', required: true },
      { name: 'clientName', label: 'Client / Company', type: 'select', optionsSource: 'clients', optionsValueField: 'companyName', required: true },
      { name: 'email', label: 'Email', type: 'email' },
      { name: 'serviceType', label: 'Service Type', type: 'select', options: serviceTypes },
      { name: 'location', label: 'Location', type: 'text' },
      { name: 'amount', label: 'Amount', type: 'money', required: true },
      { name: 'validUntil', label: 'Valid Until', type: 'date' },
      { name: 'description', label: 'Proposal Details', type: 'textarea', colSpan: 2 },
      { name: 'attachment', label: 'Attachment (PDF / Image)', type: 'file', colSpan: 2 }
    ]
  },
  {
    slug: 'viewings',
    title: 'Viewings',
    singular: 'Viewing',
    group: 'Sales',
    description: 'Viewing appointments for offices, coworking and meeting rooms.',
    icon: CalendarDays,
    defaultStatus: 'Booked',
    statuses: ['Booked', 'Completed', 'No Show', 'Cancelled', 'Followed Up'],
    tableFields: ['clientName', 'serviceType', 'location', 'viewingDate', 'status'],
    fields: [
      { name: 'clientName', label: 'Client Name', type: 'text', required: true },
      { name: 'telephone', label: 'Telephone', type: 'tel' },
      { name: 'serviceType', label: 'Service Type', type: 'select', options: serviceTypes },
      { name: 'location', label: 'Location', type: 'text' },
      { name: 'viewingDate', label: 'Viewing Date', type: 'date', required: true },
      { name: 'viewingTime', label: 'Viewing Time', type: 'time', required: true },
      { name: 'staffMember', label: 'Staff Member', type: 'text' },
      { name: 'notes', label: 'Notes', type: 'textarea', colSpan: 2 }
    ]
  },
  {
    slug: 'reception-dashboard',
    title: 'Reception Dashboard',
    singular: 'Reception Dashboard',
    group: 'Operations',
    description: 'Daily reception view: visitors, mail, meeting rooms, maintenance and tasks.',
    icon: UserCheck,
    statuses: [],
    fields: [],
    tableFields: [],
    systemOnly: true
  },
  {
    slug: 'visitors',
    title: 'Visitors',
    singular: 'Visitor',
    group: 'Operations',
    description: 'Visitor check-in/check-out, host and badge tracking.',
    icon: UserCheck,
    defaultStatus: 'Checked In',
    statuses: ['Expected', 'Checked In', 'Checked Out', 'Cancelled'],
    tableFields: ['visitorName', 'company', 'hostName', 'purpose', 'checkInAt', 'status'],
    fields: [
      { name: 'visitorName', label: 'Visitor Name', type: 'text', required: true },
      { name: 'company', label: 'Visitor Company', type: 'text' },
      { name: 'hostName', label: 'Host / Tenant', type: 'text', required: true },
      { name: 'purpose', label: 'Purpose', type: 'text' },
      { name: 'idReference', label: 'ID / Passport Reference', type: 'text' },
      { name: 'officeNumber', label: 'Office Number', type: 'text' },
      { name: 'visitDate', label: 'Date', type: 'date' },
      { name: 'checkInAt', label: 'Check-in Time', type: 'time' },
      { name: 'checkOutAt', label: 'Check-out Time', type: 'time' },
      { name: 'notes', label: 'Notes', type: 'textarea', colSpan: 2 }
    ]
  },
  {
    slug: 'mail-parcels',
    title: 'Mail & Parcels',
    singular: 'Mail / Parcel',
    group: 'Operations',
    description: 'Mail handling for virtual office and office tenants.',
    icon: Mail,
    defaultStatus: 'Received',
    statuses: ['Received', 'Client Notified', 'Collected', 'Forwarded', 'Returned', 'Archived'],
    tableFields: ['clientName', 'itemType', 'sender', 'trackingNumber', 'receivedAt', 'status'],
    fields: [
      { name: 'clientName', label: 'Tenant / Company', type: 'select', optionsSource: 'clients', optionsValueField: 'companyName', required: true },
      { name: 'itemType', label: 'Item Type', type: 'select', options: ['Letter', 'Parcel', 'Courier', 'Document', 'Cheque'] },
      { name: 'sender', label: 'Sender', type: 'text' },
      { name: 'trackingNumber', label: 'Tracking Number', type: 'text' },
      { name: 'receivedAt', label: 'Received At', type: 'datetime' },
      { name: 'notes', label: 'Notes', type: 'textarea', colSpan: 2 }
    ]
  },
  {
    slug: 'access-cards-keys',
    title: 'Access Cards & Keys',
    singular: 'Access Item',
    group: 'Operations',
    description: 'Track office keys, access cards, parking passes and deposits.',
    icon: KeyRound,
    defaultStatus: 'Issued',
    statuses: ['Issued', 'Due Return', 'Returned', 'Lost', 'Charged'],
    tableFields: ['clientName', 'itemType', 'identifier', 'issuedAt', 'numberOfItems', 'status'],
    fields: [
      { name: 'clientName', label: 'Tenant / Company', type: 'select', optionsSource: 'clients', optionsValueField: 'companyName', required: true },
      { name: 'itemType', label: 'Item Type', type: 'select', options: ['Access Card', 'Office Key', 'Parking Card', 'Building Pass'] },
      { name: 'identifier', label: 'Card / Key Number', type: 'text', required: true },
      { name: 'numberOfItems', label: 'Number of Items', type: 'number' },
      { name: 'issuedAt', label: 'Issued At', type: 'date' },
      { name: 'returnedAt', label: 'Returned At', type: 'date' },
      { name: 'notes', label: 'Notes', type: 'textarea', colSpan: 2 }
    ]
  },
  {
    slug: 'maintenance',
    title: 'Maintenance Tickets',
    singular: 'Maintenance Ticket',
    group: 'Operations',
    description: 'Tenant and staff support tickets with priority and assignment.',
    icon: Wrench,
    defaultStatus: 'Open',
    statuses: ['Open', 'In Progress', 'Waiting Tenant', 'Completed', 'Closed'],
    tableFields: ['ticketNumber', 'clientName', 'category', 'reportedAt', 'status'],
    fields: [
      { name: 'clientName', label: 'Tenant / Company', type: 'select', optionsSource: 'clients', optionsValueField: 'companyName' },
      { name: 'category', label: 'Category', type: 'select', options: ['AC', 'Maintenance', 'Electricity', 'Other'] },
      { name: 'issue', label: 'Details', type: 'textarea', colSpan: 2 },
      { name: 'resolution', label: 'Attach Photos', type: 'file-multi', colSpan: 2 }
    ]
  },
  {
    slug: 'services-offices',
    title: 'Services & Offices',
    singular: 'Service / Office',
    group: 'Spaces',
    description: 'Virtual offices, co-working offices, private offices and office images.',
    icon: Building2,
    defaultStatus: 'Available',
    statuses: ['Available', 'Reserved', 'Occupied', 'Maintenance', 'Inactive'],
    tableFields: ['serviceType', 'unitName', 'location', 'capacity', 'monthlyRate', 'status'],
    fields: [
      { name: 'serviceType', label: 'Service Type', type: 'select', options: serviceTypes, required: true },
      { name: 'unitName', label: 'Unit / Package Name', type: 'text', required: true },
      { name: 'location', label: 'Address Location', type: 'text', required: true },
      { name: 'floor', label: 'Floor / Zone', type: 'text' },
      { name: 'capacity', label: 'Capacity', type: 'number' },
      { name: 'sizeSqFt', label: 'Size Sq Ft', type: 'number' },
      { name: 'monthlyRate', label: 'Monthly Rate', type: 'money' },
      { name: 'hourlyRate', label: 'Hourly Rate', type: 'money' },
      { name: 'availableFrom', label: 'Available From', type: 'date' },
      { name: 'photo', label: 'Private Office Photo', type: 'file' },
      { name: 'description', label: 'Description', type: 'textarea', colSpan: 2 }
    ]
  },
  {
    slug: 'meeting-rooms',
    title: 'Meeting Rooms',
    singular: 'Meeting Room',
    group: 'Spaces',
    description: 'Meeting room products with location, capacity and hourly pricing.',
    icon: BriefcaseBusiness,
    defaultStatus: 'Available',
    statuses: ['Available', 'Maintenance', 'Inactive'],
    tableFields: ['roomName', 'location', 'capacity', 'hourlyRate', 'status'],
    fields: [
      { name: 'roomName', label: 'Room Name', type: 'text', required: true },
      { name: 'roomCode', label: 'Room Code', type: 'text' },
      { name: 'location', label: 'Location', type: 'text' },
      { name: 'capacity', label: 'Maximum People', type: 'number', required: true },
      { name: 'hourlyRate', label: 'Hourly Rate', type: 'money', required: true },
      { name: 'amenities', label: 'Amenities', type: 'textarea', colSpan: 2 }
    ]
  },
  {
    slug: 'meeting-room-bookings',
    title: 'Meeting Room Bookings',
    singular: 'Meeting Room Booking',
    group: 'Spaces',
    description: 'Hourly bookings with clash checking, people count and invoice links.',
    icon: CalendarDays,
    defaultStatus: 'Requested',
    statuses: ['Requested', 'Confirmed', 'Paid', 'Completed', 'Cancelled'],
    tableFields: ['bookingType', 'customerName', 'roomName', 'bookingDate', 'startTime', 'endTime', 'totalCharge', 'status'],
    fields: [
      { name: 'bookingType', label: 'Booking Type', type: 'select', options: ['Tenant', 'Public'] },
      { name: 'customerName', label: 'Customer Name', type: 'text', required: true },
      { name: 'telephone', label: 'Telephone', type: 'tel' },
      { name: 'email', label: 'Email', type: 'email' },
      { name: 'roomName', label: 'Room Name', type: 'text', required: true },
      { name: 'location', label: 'Location', type: 'text' },
      { name: 'bookingDate', label: 'Booking Date', type: 'date', required: true },
      { name: 'startTime', label: 'Start Time', type: 'time', required: true },
      { name: 'endTime', label: 'End Time', type: 'time', required: true },
      { name: 'numberOfPeople', label: 'Number of People', type: 'number' },
      { name: 'hourlyRate', label: 'Hourly Rate', type: 'money' },
      { name: 'totalCharge', label: 'Total Charge', type: 'money' },
      { name: 'notes', label: 'Notes', type: 'textarea', colSpan: 2 }
    ]
  },
  {
    slug: 'calendar',
    title: 'Calendar',
    singular: 'Calendar Event',
    group: 'Spaces',
    description: 'Viewings, meeting room bookings, renewals and reminders in one calendar.',
    icon: CalendarDays,
    statuses: [],
    fields: [],
    tableFields: [],
    systemOnly: true
  },
  {
    slug: 'floor-plan',
    title: 'Floor Plan',
    singular: 'Floor Plan',
    group: 'Spaces',
    description: 'Visual unit map showing available, occupied, expiring and maintenance spaces.',
    icon: Map,
    statuses: [],
    fields: [],
    tableFields: [],
    systemOnly: true
  },
  {
    slug: 'clients',
    title: 'Clients / Tenants',
    singular: 'Client',
    group: 'Clients',
    description: 'Tenant profiles, company details, timeline and linked records.',
    icon: Users,
    defaultStatus: 'Active',
    statuses: ['Prospect', 'Active', 'On Hold', 'Leaving', 'Former'],
    tableFields: ['companyName', 'contactName', 'telephone', 'email', 'location', 'status'],
    fields: [
      { name: 'companyName', label: 'Company Name', type: 'text', required: true },
      { name: 'contactName', label: 'Contact Name', type: 'text', required: true },
      { name: 'email', label: 'Email', type: 'email' },
      { name: 'telephone', label: 'Telephone', type: 'tel' },
      { name: 'tradeLicenseNumber', label: 'Trade Licence Number', type: 'text' },
      { name: 'serviceType', label: 'Service Type', type: 'select', options: serviceTypes },
      { name: 'location', label: 'Location', type: 'text' },
      { name: 'notes', label: 'Notes', type: 'textarea', colSpan: 2 }
    ]
  },
  {
    slug: 'contracts',
    title: 'Contracts',
    singular: 'Contract',
    group: 'Clients',
    description: 'Contract dates, renewal reminders, e-signature status and expiry alerts.',
    icon: FileText,
    defaultStatus: 'Draft',
    statuses: ['Draft', 'Sent', 'Signed By Client', 'Signed By Company', 'Active', 'Expired', 'Cancelled'],
    tableFields: ['contractNumber', 'clientName', 'serviceType', 'startDate', 'endDate', 'status'],
    fields: [
      { name: 'contractNumber', label: 'Contract Number', type: 'text', required: true },
      { name: 'clientName', label: 'Client / Company', type: 'select', optionsSource: 'clients', optionsValueField: 'companyName', required: true },
      { name: 'serviceType', label: 'Service Type', type: 'select', options: serviceTypes },
      { name: 'location', label: 'Location', type: 'text' },
      { name: 'startDate', label: 'Start Date', type: 'date', required: true },
      { name: 'endDate', label: 'End Date', type: 'date', required: true },
      { name: 'renewalReminderAt', label: 'Renewal Reminder', type: 'date' },
      { name: 'expiryReminderAt', label: 'Expiry Reminder', type: 'date' },
      { name: 'monthlyRent', label: 'Monthly Rent', type: 'money' },
      { name: 'depositAmount', label: 'Deposit Amount', type: 'money' },
      { name: 'signedDocument', label: 'Signed Contract PDF', type: 'file' },
      { name: 'notes', label: 'Notes', type: 'textarea', colSpan: 2 }
    ]
  },
  {
    slug: 'documents',
    title: 'Documents',
    singular: 'Document',
    group: 'Clients',
    description: 'Private client documents with expiry tracking and secure download.',
    icon: FolderOpen,
    defaultStatus: 'Valid',
    statuses: ['Valid', 'Expiring Soon', 'Expired', 'Missing', 'Archived'],
    tableFields: ['clientName', 'documentType', 'expiryDate', 'status'],
    fields: [
      { name: 'clientName', label: 'Client / Company', type: 'select', optionsSource: 'clients', optionsValueField: 'companyName', required: true },
      { name: 'documentType', label: 'Document Type', type: 'select', options: ['Trade Licence', 'Passport', 'Emirates ID', 'Contract', 'Tenancy Agreement', 'Payment Receipt', 'Other'] },
      { name: 'documentNumber', label: 'Document Number', type: 'text' },
      { name: 'expiryDate', label: 'Expiry Date', type: 'date' },
      { name: 'file', label: 'Upload Documents', type: 'file-multi' },
      { name: 'notes', label: 'Notes', type: 'textarea', colSpan: 2 }
    ]
  },
  {
    slug: 'deposits',
    title: 'Deposits',
    singular: 'Deposit',
    group: 'Clients',
    description: 'Track deposits, deductions and refunds.',
    icon: CreditCard,
    defaultStatus: 'Held',
    statuses: ['Requested', 'Paid', 'Held', 'Partially Refunded', 'Refunded', 'Deducted'],
    tableFields: ['clientName', 'amount', 'paidDate', 'refundDueDate', 'status'],
    fields: [
      { name: 'clientName', label: 'Client / Company', type: 'select', optionsSource: 'clients', optionsValueField: 'companyName', required: true },
      { name: 'amount', label: 'Deposit Amount', type: 'money', required: true },
      { name: 'paidDate', label: 'Paid Date', type: 'date' },
      { name: 'deductionAmount', label: 'Deduction Amount', type: 'money' },
      { name: 'refundAmount', label: 'Refund Amount', type: 'money' },
      { name: 'refundDueDate', label: 'Refund Due Date', type: 'date' },
      { name: 'notes', label: 'Notes', type: 'textarea', colSpan: 2 }
    ]
  },
  {
    slug: 'move-outs',
    title: 'Move-Outs',
    singular: 'Move-Out',
    group: 'Clients',
    description: 'Exit process for final invoice, inspection, keys and deposit return.',
    icon: DoorOpen,
    defaultStatus: 'Notice Received',
    statuses: ['Notice Received', 'Inspection Due', 'Final Invoice Due', 'Keys Due', 'Deposit Review', 'Completed', 'Cancelled'],
    tableFields: ['clientName', 'officeUnit', 'moveOutDate', 'finalInvoiceStatus', 'status'],
    fields: [
      { name: 'clientName', label: 'Client / Company', type: 'select', optionsSource: 'clients', optionsValueField: 'companyName', required: true },
      { name: 'officeUnit', label: 'Office Unit', type: 'text' },
      { name: 'moveOutDate', label: 'Move-Out Date', type: 'date' },
      { name: 'inspectionDate', label: 'Inspection Date', type: 'date' },
      { name: 'numberOfKeysReturned', label: 'Number of Keys Returned', type: 'select', options: ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10'] },
      {
        name: 'moveOutChecklist',
        label: 'Checklist',
        type: 'checkbox-group',
        colSpan: 2,
        groupFields: [
          { name: 'keysReturned', label: 'Keys Returned' },
          { name: 'tawtheeqClosed', label: 'Tawtheeq Closed' },
          { name: 'goodConditionOffice', label: 'Good Conditioned Office' }
        ]
      },
      { name: 'finalInvoiceStatus', label: 'Final Invoice Status', type: 'select', options: ['Not Created', 'Created', 'Paid', 'Disputed'] },
      { name: 'depositRefundStatus', label: 'Deposit Refund Status', type: 'select', options: ['Pending', 'Approved', 'Paid', 'Deducted'] },
      { name: 'notes', label: 'Notes', type: 'textarea', colSpan: 2 }
    ]
  },
  {
    slug: 'invoices',
    title: 'Invoices',
    singular: 'Invoice',
    group: 'Finance',
    description: 'Invoice links, view tracking, Stripe payments and email sending.',
    icon: Receipt,
    defaultStatus: 'Draft',
    statuses: ['Draft', 'Sent', 'Viewed', 'Part Paid', 'Paid', 'Overdue', 'Cancelled'],
    tableFields: ['invoiceNumber', 'clientName', 'amount', 'dueDate', 'viewCount', 'status'],
    fields: [
      { name: 'invoiceNumber', label: 'Invoice Number', type: 'text', required: true },
      { name: 'clientName', label: 'Client / Company', type: 'text', required: true },
      { name: 'email', label: 'Customer Email', type: 'email' },
      { name: 'description', label: 'Description', type: 'textarea', colSpan: 2 },
      { name: 'amount', label: 'Amount', type: 'money', required: true },
      { name: 'vatAmount', label: 'VAT / Tax', type: 'money' },
      { name: 'issueDate', label: 'Issue Date', type: 'date' },
      { name: 'dueDate', label: 'Due Date', type: 'date' }
    ]
  },
  {
    slug: 'payments',
    title: 'Payments',
    singular: 'Payment',
    group: 'Finance',
    description: 'Record manual, bank, cash, card and Stripe payments.',
    icon: CreditCard,
    defaultStatus: 'Received',
    statuses: ['Received', 'Pending', 'Failed', 'Refunded'],
    tableFields: ['clientName', 'invoiceNumber', 'amount', 'method', 'paidAt', 'status'],
    fields: [
      { name: 'clientName', label: 'Client / Company', type: 'text', required: true },
      { name: 'invoiceNumber', label: 'Invoice Number', type: 'text' },
      { name: 'amount', label: 'Amount', type: 'money', required: true },
      { name: 'method', label: 'Payment Method', type: 'select', options: ['Stripe', 'Bank Transfer', 'Cash', 'Card Terminal', 'Cheque'] },
      { name: 'reference', label: 'Reference', type: 'text' },
      { name: 'paidAt', label: 'Paid At', type: 'datetime' },
      { name: 'notes', label: 'Notes', type: 'textarea', colSpan: 2 }
    ]
  },
  {
    slug: 'recurring-billing',
    title: 'Recurring Billing',
    singular: 'Recurring Billing Rule',
    group: 'Finance',
    description: 'Auto-generate invoices for monthly/quarterly/yearly services.',
    icon: RefreshCcw,
    defaultStatus: 'Active',
    statuses: ['Active', 'Paused', 'Cancelled', 'Completed'],
    tableFields: ['clientName', 'serviceName', 'amount', 'frequency', 'nextRunAt', 'status'],
    fields: [
      { name: 'clientName', label: 'Client / Company', type: 'text', required: true },
      { name: 'serviceName', label: 'Service Name', type: 'text', required: true },
      { name: 'amount', label: 'Amount', type: 'money', required: true },
      { name: 'frequency', label: 'Frequency', type: 'select', options: ['Weekly', 'Monthly', 'Quarterly', 'Yearly'] },
      { name: 'nextRunAt', label: 'Next Invoice Date', type: 'date' },
      { name: 'emailInvoice', label: 'Email Invoice Automatically', type: 'checkbox' },
      { name: 'notes', label: 'Notes', type: 'textarea', colSpan: 2 }
    ]
  },
  {
    slug: 'add-on-services',
    title: 'Add-On Services',
    singular: 'Add-On Service',
    group: 'Finance',
    description: 'Extra services such as mail handling, parking, printing and PRO services.',
    icon: PackagePlus,
    defaultStatus: 'Active',
    statuses: ['Active', 'Inactive'],
    tableFields: ['serviceName', 'category', 'unitPrice', 'recurring', 'status'],
    fields: [
      { name: 'serviceName', label: 'Service Name', type: 'text', required: true },
      { name: 'category', label: 'Category', type: 'select', options: ['Mail Handling', 'Phone Answering', 'Parking', 'Printing', 'Access Card', 'Locker', 'PRO Service', 'Company Formation', 'Other'] },
      { name: 'unitPrice', label: 'Unit Price', type: 'money' },
      { name: 'recurring', label: 'Recurring Service', type: 'checkbox' },
      { name: 'description', label: 'Description', type: 'textarea', colSpan: 2 }
    ]
  },
  {
    slug: 'payment-alerts',
    title: 'Payment Alerts',
    singular: 'Payment Alert',
    group: 'Finance',
    description: 'Overdue, due today and upcoming invoice alerts.',
    icon: BellRing,
    statuses: [],
    fields: [],
    tableFields: [],
    systemOnly: true
  },
  {
    slug: 'staff-users',
    title: 'Staff Users',
    singular: 'Staff User',
    group: 'Admin',
    description: 'Master Admin creates staff accounts and grants granular permissions.',
    icon: ShieldCheck,
    defaultStatus: 'Active',
    statuses: ['Active', 'Suspended'],
    tableFields: ['name', 'email', 'role', 'status'],
    fields: [
      { name: 'clientRecordId', label: 'Linked Company (Tenant accounts only)', type: 'select', optionsSource: 'clients', autofill: { targetField: 'email', sourceDataField: 'email' } },
      { name: 'name', label: 'Name', type: 'text', required: true, hideWhen: { field: 'clientRecordId', notEmpty: true } },
      { name: 'email', label: 'Email', type: 'email', required: true },
      { name: 'role', label: 'Role', type: 'select', options: ['MASTER_ADMIN', 'RECEPTION', 'TENANT'] },
      { name: 'password', label: 'Temporary Password', type: 'password' }
    ]
  },
];

export const moduleMap = Object.fromEntries(modules.map((m) => [m.slug, m]));

export const moduleGroups = ['Dashboard', 'Sales', 'Operations', 'Spaces', 'Clients', 'Finance', 'Admin'] as const;

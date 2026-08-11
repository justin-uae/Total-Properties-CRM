'use client';

import { useEffect, useState } from 'react';
import { Spinner } from '@/components/ui/Spinner';

type EmailTemplate = { subject: string; bodyHtml: string };
type TemplateKey = 'quotation' | 'invoice' | 'contract' | 'contractRenewalReminder' | 'contractExpired' | 'chequeReminder' | 'chequeDepositNotice';
type EmailTemplates = Record<TemplateKey, EmailTemplate>;
type BankDetails = {
  bankName: string;
  accountName: string;
  accountNumber: string;
  iban: string;
  swiftCode: string;
  branch: string;
};

const TOKENS: Record<TemplateKey, string[]> = {
  quotation: ['{{clientName}}', '{{companyName}}', '{{quoteNumber}}', '{{link}}', '{{amount}}', '{{validUntil}}'],
  invoice: ['{{clientName}}', '{{companyName}}', '{{invoiceNumber}}', '{{link}}', '{{amount}}', '{{dueDate}}'],
  contract: ['{{clientName}}', '{{companyName}}', '{{contractNumber}}', '{{link}}', '{{endDate}}'],
  contractRenewalReminder: ['{{clientName}}', '{{companyName}}', '{{contractNumber}}', '{{endDate}}'],
  contractExpired: ['{{clientName}}', '{{companyName}}', '{{contractNumber}}', '{{endDate}}'],
  chequeReminder: ['{{clientName}}', '{{companyName}}', '{{chequeDate}}', '{{amount}}', '{{bankName}}'],
  chequeDepositNotice: ['{{clientName}}', '{{companyName}}', '{{chequeDate}}', '{{amount}}', '{{bankName}}', '{{link}}']
};

const TEMPLATE_LABELS: Record<TemplateKey, string> = {
  quotation: 'Quotation Email',
  invoice: 'Invoice Email',
  contract: 'Contract Email',
  contractRenewalReminder: 'Contract Renewal Reminder',
  chequeReminder: 'Cheque Deposit Reminder',
  chequeDepositNotice: 'Cheque Deposit Notice (20-Day)',
  contractExpired: 'Contract Expired'
};

const BANK_FIELDS: { name: keyof BankDetails; label: string }[] = [
  { name: 'bankName', label: 'Bank Name' },
  { name: 'accountName', label: 'Account Name' },
  { name: 'accountNumber', label: 'Account Number' },
  { name: 'iban', label: 'IBAN' },
  { name: 'swiftCode', label: 'SWIFT / BIC Code' },
  { name: 'branch', label: 'Branch' }
];

export function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [templates, setTemplates] = useState<EmailTemplates | null>(null);
  const [bankDetails, setBankDetails] = useState<BankDetails | null>(null);
  const [activeTemplate, setActiveTemplate] = useState<TemplateKey>('quotation');
  const [savingTemplates, setSavingTemplates] = useState(false);
  const [savingBank, setSavingBank] = useState(false);
  const [templateSaved, setTemplateSaved] = useState(false);
  const [bankSaved, setBankSaved] = useState(false);

  useEffect(() => {
    fetch('/api/settings').then((r) => r.json()).then((json) => {
      setTemplates(json.settings.emailTemplates);
      setBankDetails(json.settings.bankDetails);
      setLoading(false);
    });
  }, []);

  async function saveTemplates() {
    setSavingTemplates(true);
    setTemplateSaved(false);
    try {
      await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emailTemplates: templates })
      });
      setTemplateSaved(true);
    } finally {
      setSavingTemplates(false);
    }
  }

  async function saveBankDetails() {
    setSavingBank(true);
    setBankSaved(false);
    try {
      await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bankDetails })
      });
      setBankSaved(true);
    } finally {
      setSavingBank(false);
    }
  }

  if (loading || !templates || !bankDetails) {
    return (
      <div className="flex items-center gap-3 p-10">
        <Spinner size="sm" color="muted" />
        <span className="text-sm text-slate-500">Loading settings…</span>
      </div>
    );
  }

  const template = templates[activeTemplate];

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-bold uppercase tracking-widest text-[rgb(var(--accent))]">Admin</p>
        <h1 className="mt-1 text-2xl font-black sm:text-3xl">Settings</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-500">Email templates and bank details used automatically on quotations, invoices and contracts.</p>
      </div>

      <div className="card p-6">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-bold">Email Templates</h2>
          <div className="flex flex-wrap gap-2">
            {(['quotation', 'invoice', 'contract', 'contractRenewalReminder', 'contractExpired', 'chequeReminder', 'chequeDepositNotice'] as const).map((key) => (
              <button
                key={key}
                onClick={() => setActiveTemplate(key)}
                className={activeTemplate === key ? 'btn-primary px-3 py-1.5 text-sm' : 'btn-secondary px-3 py-1.5 text-sm'}
              >
                {TEMPLATE_LABELS[key]}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="label">Subject</label>
            <input
              className="input"
              value={template.subject}
              onChange={(e) => setTemplates((t) => t && { ...t, [activeTemplate]: { ...t[activeTemplate], subject: e.target.value } })}
            />
          </div>
          <div>
            <label className="label">Body</label>
            <textarea
              className="input min-h-40 font-mono text-xs"
              value={template.bodyHtml}
              onChange={(e) => setTemplates((t) => t && { ...t, [activeTemplate]: { ...t[activeTemplate], bodyHtml: e.target.value } })}
            />
            <p className="mt-2 text-xs text-slate-500">
              Available placeholders: {TOKENS[activeTemplate].map((tok) => (
                <code key={tok} className="mr-1.5 rounded bg-slate-100 px-1.5 py-0.5 text-slate-600">{tok}</code>
              ))}
            </p>
            <p className="mt-1 text-xs text-slate-400">
              {activeTemplate === 'invoice'
                ? 'The Pay Now button (when applicable) and bank details are appended automatically after this body.'
                : activeTemplate === 'quotation'
                ? 'The quotation PDF is attached automatically; any optional file attached on the quotation is sent alongside it.'
                : activeTemplate === 'contract'
                ? 'Sent when a contract is manually sent from the Contracts module; the contract document is attached automatically.'
                : activeTemplate === 'contractRenewalReminder'
                ? 'Sent automatically 3 months before a contract’s end date.'
                : activeTemplate === 'contractExpired'
                ? 'Sent automatically on a contract’s end date.'
                : activeTemplate === 'chequeReminder'
                ? 'Sent automatically 5 days before a cheque’s deposit date.'
                : 'Sent automatically 20 days before a cheque’s deposit date — also opens the tenant’s deferral/hold request window (20–15 days before).'}
            </p>
            <p className="mt-1 text-xs text-slate-400">All emails are automatically CC’d to karen@totalproperty.ae and info@totalproperty.ae.</p>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-end gap-3 border-t border-slate-100 pt-5">
          {templateSaved && <span className="text-sm font-medium text-green-600">Saved</span>}
          <button onClick={saveTemplates} disabled={savingTemplates} className="btn-primary flex items-center gap-2">
            {savingTemplates ? <><Spinner size="sm" color="white" /><span>Saving…</span></> : 'Save Templates'}
          </button>
        </div>
      </div>

      <div className="card p-6">
        <h2 className="mb-5 text-xl font-bold">Bank Details</h2>
        <p className="mb-4 text-sm text-slate-500">Shown on every invoice PDF and invoice email as an alternative to online payment.</p>
        <div className="grid gap-4 md:grid-cols-2">
          {BANK_FIELDS.map((f) => (
            <div key={f.name}>
              <label className="label">{f.label}</label>
              <input
                className="input"
                value={bankDetails[f.name]}
                onChange={(e) => setBankDetails((b) => b && { ...b, [f.name]: e.target.value })}
              />
            </div>
          ))}
        </div>
        <div className="mt-6 flex items-center justify-end gap-3 border-t border-slate-100 pt-5">
          {bankSaved && <span className="text-sm font-medium text-green-600">Saved</span>}
          <button onClick={saveBankDetails} disabled={savingBank} className="btn-primary flex items-center gap-2">
            {savingBank ? <><Spinner size="sm" color="white" /><span>Saving…</span></> : 'Save Bank Details'}
          </button>
        </div>
      </div>
    </div>
  );
}

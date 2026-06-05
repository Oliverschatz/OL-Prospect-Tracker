import { supabase } from './supabase';
import { generateId } from './helpers';
import type { Customer, Invoice, InvoiceItem, SellerSettings } from './invoice-types';
import { SELLER_DEFAULTS } from './invoice-types';

async function getUserId(): Promise<string | null> {
  if (!supabase) return null;
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id ?? null;
}

// ─── Seller settings ───
export async function loadSellerSettings(): Promise<SellerSettings> {
  if (!supabase) return { ...SELLER_DEFAULTS };
  const { data } = await supabase.from('seller_settings').select('*').maybeSingle();
  if (!data) return { ...SELLER_DEFAULTS };
  return { ...SELLER_DEFAULTS, ...(data as Partial<SellerSettings>) };
}

export async function saveSellerSettings(settings: SellerSettings): Promise<void> {
  if (!supabase) return;
  const userId = await getUserId();
  if (!userId) return;
  const { user_id, ...rest } = settings;
  void user_id;
  await supabase.from('seller_settings').upsert({ ...rest, user_id: userId, updated_at: new Date().toISOString() });
}

export function suggestInvoiceNumber(settings: SellerSettings): string {
  return `${settings.invoice_prefix || ''}${settings.next_invoice_seq || 1}`;
}

export async function bumpInvoiceSeq(usedNumber: string): Promise<void> {
  if (!supabase) return;
  const settings = await loadSellerSettings();
  // Only advance the counter if the saved number matches the suggested one.
  const numeric = parseInt(String(usedNumber).replace(/\D/g, ''), 10);
  const next = Number.isFinite(numeric) ? numeric + 1 : (settings.next_invoice_seq || 1) + 1;
  if (next > (settings.next_invoice_seq || 1)) {
    await saveSellerSettings({ ...settings, next_invoice_seq: next });
  }
}

// ─── Customers ───
export async function loadCustomers(): Promise<Customer[]> {
  if (!supabase) return [];
  const { data } = await supabase.from('customers').select('*').order('name');
  return (data || []) as Customer[];
}

export async function saveCustomer(customer: Customer): Promise<void> {
  if (!supabase) return;
  const userId = await getUserId();
  if (!userId) return;
  const { created_at, ...row } = customer;
  void created_at;
  await supabase.from('customers').upsert({ ...row, id: row.id || generateId(), user_id: userId });
}

export async function deleteCustomer(id: string): Promise<void> {
  if (!supabase) return;
  await supabase.from('customers').delete().eq('id', id);
}

export async function bulkImportCustomers(customers: Customer[]): Promise<number> {
  if (!supabase || customers.length === 0) return 0;
  const userId = await getUserId();
  if (!userId) return 0;
  const rows = customers.map(c => ({ ...c, id: c.id || generateId(), user_id: userId, created_at: undefined }));
  const { error } = await supabase.from('customers').insert(rows);
  return error ? 0 : rows.length;
}

// ─── Invoices ───
type InvoiceRow = Omit<Invoice, 'items'>;

export async function loadInvoices(): Promise<Invoice[]> {
  if (!supabase) return [];
  const [invRes, itemRes] = await Promise.all([
    supabase.from('invoices').select('*').order('issue_date', { ascending: false }),
    supabase.from('invoice_items').select('*').order('position', { ascending: true }),
  ]);
  const invoices = (invRes.data || []) as InvoiceRow[];
  const items = (itemRes.data || []) as Array<InvoiceItem & { invoice_id: string }>;
  const byInvoice: Record<string, InvoiceItem[]> = {};
  for (const it of items) (byInvoice[it.invoice_id] ||= []).push(it);
  return invoices.map(inv => ({ ...inv, items: byInvoice[inv.id] || [] }));
}

export async function saveInvoice(invoice: Invoice): Promise<void> {
  if (!supabase) return;
  const userId = await getUserId();
  if (!userId) return;
  const { items, created_at, ...row } = invoice;
  void created_at;
  await supabase.from('invoices').upsert({
    ...row,
    customer_id: row.customer_id || null,
    company_id: row.company_id || null,
    contact_id: row.contact_id || null,
    billing_start: row.billing_start || null,
    billing_end: row.billing_end || null,
    due_date: row.due_date || null,
    paid_date: row.paid_date || null,
    user_id: userId,
    updated_at: new Date().toISOString(),
  });

  await supabase.from('invoice_items').delete().eq('invoice_id', invoice.id);
  const extras = (items || []).filter(it => it.description || it.unit_price);
  if (extras.length > 0) {
    await supabase.from('invoice_items').insert(extras.map((it, i) => ({
      id: it.id || generateId(),
      user_id: userId,
      invoice_id: invoice.id,
      position: i,
      description: it.description,
      quantity: it.quantity,
      unit: it.unit,
      unit_price: it.unit_price,
    })));
  }
}

export async function deleteInvoice(id: string): Promise<void> {
  if (!supabase) return;
  await supabase.from('invoices').delete().eq('id', id);
}

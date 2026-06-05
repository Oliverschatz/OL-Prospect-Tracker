import { supabase } from './supabase';
import { generateId } from './helpers';
import type { Invoice, InvoiceItem, SellerSettings } from './invoice-types';
import { EMPTY_SELLER } from './invoice-types';

async function getUserId(): Promise<string | null> {
  if (!supabase) return null;
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id ?? null;
}

// ─── Seller settings ───

export async function loadSellerSettings(): Promise<SellerSettings> {
  if (!supabase) return { ...EMPTY_SELLER };
  const { data } = await supabase.from('seller_settings').select('*').maybeSingle();
  if (!data) return { ...EMPTY_SELLER };
  return { ...EMPTY_SELLER, ...(data as Partial<SellerSettings>) };
}

export async function saveSellerSettings(settings: SellerSettings): Promise<void> {
  if (!supabase) return;
  const userId = await getUserId();
  if (!userId) return;
  const { user_id, ...rest } = settings;
  void user_id;
  await supabase.from('seller_settings').upsert({
    ...rest,
    user_id: userId,
    updated_at: new Date().toISOString(),
  });
}

/** Suggest the next invoice number from the seller's prefix + running sequence. */
export function suggestInvoiceNumber(settings: SellerSettings): string {
  const year = new Date().getFullYear();
  const seq = String(settings.next_invoice_seq || 1).padStart(4, '0');
  return `${settings.invoice_prefix || ''}${year}-${seq}`;
}

/** Bump the running sequence after an invoice number is committed. */
export async function bumpInvoiceSeq(): Promise<void> {
  if (!supabase) return;
  const settings = await loadSellerSettings();
  await saveSellerSettings({ ...settings, next_invoice_seq: (settings.next_invoice_seq || 1) + 1 });
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
  for (const it of items) {
    (byInvoice[it.invoice_id] ||= []).push(it);
  }
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
    company_id: row.company_id || null,
    contact_id: row.contact_id || null,
    delivery_date: row.delivery_date || null,
    due_date: row.due_date || null,
    user_id: userId,
    updated_at: new Date().toISOString(),
  });

  // Replace line items wholesale (simplest correct sync for a small set).
  await supabase.from('invoice_items').delete().eq('invoice_id', invoice.id);
  if (items.length > 0) {
    await supabase.from('invoice_items').insert(
      items.map((it, i) => ({
        id: it.id || generateId(),
        user_id: userId,
        invoice_id: invoice.id,
        position: i,
        description: it.description,
        quantity: it.quantity,
        unit: it.unit,
        unit_price: it.unit_price,
        vat_rate: it.vat_rate,
        vat_category: it.vat_category,
      }))
    );
  }
}

export async function deleteInvoice(id: string): Promise<void> {
  if (!supabase) return;
  await supabase.from('invoices').delete().eq('id', id);
}

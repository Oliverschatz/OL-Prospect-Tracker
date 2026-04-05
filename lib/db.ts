import { supabase } from './supabase';
import type { Company, Contact, Activity, Template, StageKey, FitScores } from './types';
import { generateId, today } from './helpers';

// ─── Load all data ───

export async function loadAllCompanies(): Promise<Company[]> {
  if (!supabase) return [];

  const [companiesRes, contactsRes, activitiesRes] = await Promise.all([
    supabase.from('companies').select('*').order('name'),
    supabase.from('contacts').select('*'),
    supabase.from('activities').select('*').order('date', { ascending: true }),
  ]);

  const companies = (companiesRes.data || []) as Array<Omit<Company, 'contacts' | 'activities'>>;
  const contacts = (contactsRes.data || []) as Array<Omit<Contact, 'activities'> & { company_id: string }>;
  const activities = (activitiesRes.data || []) as Array<Activity & { company_id: string; contact_id: string | null }>;

  // Group contacts by company
  const contactsByCompany: Record<string, Contact[]> = {};
  for (const ct of contacts) {
    if (!contactsByCompany[ct.company_id]) contactsByCompany[ct.company_id] = [];
    const contactActivities = activities.filter(a => a.contact_id === ct.id);
    contactsByCompany[ct.company_id].push({ ...ct, activities: contactActivities });
  }

  // Group company-level activities
  const companyActivities: Record<string, Activity[]> = {};
  for (const a of activities) {
    if (!a.contact_id) {
      if (!companyActivities[a.company_id]) companyActivities[a.company_id] = [];
      companyActivities[a.company_id].push(a);
    }
  }

  return companies.map(c => ({
    ...c,
    fit_scores: (c.fit_scores || {}) as FitScores,
    contacts: contactsByCompany[c.id] || [],
    activities: companyActivities[c.id] || [],
  }));
}

export async function loadTemplates(): Promise<Template[]> {
  if (!supabase) return [];
  const { data } = await supabase.from('templates').select('*').order('sort_order');
  return (data || []) as Template[];
}

// ─── Company CRUD ───

export async function createCompany(company: Company): Promise<void> {
  if (!supabase) return;
  const { contacts, activities, ...row } = company;
  await supabase.from('companies').insert({
    ...row,
    parent_id: row.parent_id || null,
    follow_up_date: row.follow_up_date || null,
  });
}

export async function updateCompanyFields(
  id: string,
  fields: Partial<Omit<Company, 'id' | 'contacts' | 'activities'>>
): Promise<void> {
  if (!supabase) return;
  const row: Record<string, unknown> = { ...fields, updated_at: today() };
  if ('parent_id' in row) row.parent_id = row.parent_id || null;
  if ('follow_up_date' in row) row.follow_up_date = row.follow_up_date || null;
  await supabase.from('companies').update(row).eq('id', id);
}

export async function deleteCompanyFromDb(id: string): Promise<void> {
  if (!supabase) return;
  await supabase.from('companies').delete().eq('id', id);
}

// ─── Contact CRUD ───

export async function upsertContact(companyId: string, contact: Contact): Promise<void> {
  if (!supabase) return;
  const { activities, ...row } = contact;
  await supabase.from('contacts').upsert({ ...row, company_id: companyId });
}

export async function deleteContactFromDb(id: string): Promise<void> {
  if (!supabase) return;
  await supabase.from('contacts').delete().eq('id', id);
}

// ─── Activity CRUD ───

export async function createActivity(
  companyId: string,
  contactId: string | null,
  activity: Activity
): Promise<void> {
  if (!supabase) return;
  await supabase.from('activities').insert({
    id: activity.id,
    company_id: companyId,
    contact_id: contactId,
    date: activity.date,
    text: activity.text,
  });
}

export async function updateActivity(id: string, text: string): Promise<void> {
  if (!supabase) return;
  await supabase.from('activities').update({ text }).eq('id', id);
}

export async function deleteActivityFromDb(id: string): Promise<void> {
  if (!supabase) return;
  await supabase.from('activities').delete().eq('id', id);
}

// ─── Template CRUD ───

export async function saveAllTemplates(templates: Template[]): Promise<void> {
  if (!supabase) return;
  // Delete all, then insert fresh
  await supabase.from('templates').delete().neq('id', '');
  if (templates.length > 0) {
    await supabase.from('templates').insert(
      templates.map((t, i) => ({ ...t, sort_order: i }))
    );
  }
}

// ─── Bulk import (for JSON/XLSX import) ───

export async function bulkImportCompanies(companies: Company[]): Promise<void> {
  if (!supabase) return;

  for (const company of companies) {
    const { contacts, activities, ...row } = company;
    await supabase.from('companies').upsert({
      ...row,
      parent_id: row.parent_id || null,
      follow_up_date: row.follow_up_date || null,
    });

    for (const contact of contacts) {
      const { activities: ctActivities, ...ctRow } = contact;
      await supabase.from('contacts').upsert({ ...ctRow, company_id: company.id });
      for (const activity of ctActivities) {
        await supabase.from('activities').upsert({
          id: activity.id,
          company_id: company.id,
          contact_id: contact.id,
          date: activity.date,
          text: activity.text,
        });
      }
    }

    for (const activity of activities) {
      await supabase.from('activities').upsert({
        id: activity.id,
        company_id: company.id,
        contact_id: null,
        date: activity.date,
        text: activity.text,
      });
    }
  }
}

import { supabase } from './supabase';
import type { Company, Contact, Activity, PlannedEvent, Template, FitScores } from './types';
import { generateId, today } from './helpers';
import { DUMMY_COMPANIES, DUMMY_TAG } from './dummies';
import { DEFAULT_TEMPLATES } from './default-templates';

// ─── Dummy/demo data ───

function offsetDate(offset: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
}

export async function loadDummyCompanies(): Promise<number> {
  if (!supabase) return 0;
  const userId = await getUserId();
  if (!userId) return 0;
  const todayStr = today();

  let count = 0;
  for (const dc of DUMMY_COMPANIES) {
    const companyId = generateId();
    await supabase.from('companies').insert({
      id: companyId,
      user_id: userId,
      name: dc.name,
      hq: dc.hq,
      country: dc.country,
      employees: dc.employees,
      sector: dc.sector,
      website: dc.website,
      stage: dc.stage,
      fit_scores: {},
      pain_points: dc.pain_points,
      entry_angle: dc.entry_angle,
      notes: dc.notes,
      parent_id: null,
      tags: [...dc.tags, DUMMY_TAG],
      created_at: todayStr,
      updated_at: todayStr,
    });

    for (const a of dc.activities) {
      await supabase.from('activities').insert({
        id: generateId(),
        user_id: userId,
        company_id: companyId,
        contact_id: null,
        date: offsetDate(a.dayOffset),
        text: a.text,
      });
    }
    for (const e of dc.planned_events) {
      await supabase.from('planned_events').insert({
        id: generateId(),
        user_id: userId,
        company_id: companyId,
        contact_id: null,
        event_date: offsetDate(e.dayOffset),
        title: e.title,
        description: e.description,
        done: false,
      });
    }

    for (const ct of dc.contacts) {
      const contactId = generateId();
      await supabase.from('contacts').insert({
        id: contactId,
        user_id: userId,
        company_id: companyId,
        name: ct.name,
        title: ct.title,
        department: ct.department,
        email: ct.email,
        phone: ct.phone,
        linkedin: ct.linkedin,
        role: ct.role,
        notes: ct.notes,
      });

      for (const a of ct.activities) {
        await supabase.from('activities').insert({
          id: generateId(),
          user_id: userId,
          company_id: companyId,
          contact_id: contactId,
          date: offsetDate(a.dayOffset),
          text: a.text,
        });
      }
      for (const e of ct.planned_events) {
        await supabase.from('planned_events').insert({
          id: generateId(),
          user_id: userId,
          company_id: companyId,
          contact_id: contactId,
          event_date: offsetDate(e.dayOffset),
          title: e.title,
          description: e.description,
          done: false,
        });
      }
    }
    count++;
  }
  return count;
}

export async function removeDummyCompanies(): Promise<number> {
  if (!supabase) return 0;
  const userId = await getUserId();
  if (!userId) return 0;
  const { data } = await supabase
    .from('companies')
    .select('id, tags')
    .eq('user_id', userId);
  const ids = (data || [])
    .filter((c: { tags?: unknown }) => Array.isArray(c.tags) && (c.tags as string[]).includes(DUMMY_TAG))
    .map((c: { id: string }) => c.id);
  if (ids.length === 0) return 0;
  await supabase.from('companies').delete().in('id', ids);
  return ids.length;
}

// ─── Get current user id ───

async function getUserId(): Promise<string | null> {
  if (!supabase) return null;
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id ?? null;
}

// ─── Load all data ───

export async function loadAllCompanies(): Promise<Company[]> {
  if (!supabase) return [];

  const [companiesRes, contactsRes, activitiesRes, eventsRes] = await Promise.all([
    supabase.from('companies').select('*').order('name'),
    supabase.from('contacts').select('*'),
    supabase.from('activities').select('*').order('date', { ascending: true }),
    supabase.from('planned_events').select('*').order('event_date', { ascending: true }),
  ]);

  const companies = (companiesRes.data || []) as Array<Omit<Company, 'contacts' | 'activities' | 'planned_events'>>;
  const contacts = (contactsRes.data || []) as Array<Omit<Contact, 'activities' | 'planned_events'> & { company_id: string }>;
  const activities = (activitiesRes.data || []) as Array<Activity & { company_id: string; contact_id: string | null }>;
  const events = (eventsRes.data || []) as Array<PlannedEvent & { user_id?: string }>;
  // Backfill title for legacy rows that predate the title column
  for (const e of events) if (e.title == null) e.title = '';

  // Group contacts by company
  const contactsByCompany: Record<string, Contact[]> = {};
  for (const ct of contacts) {
    if (!contactsByCompany[ct.company_id]) contactsByCompany[ct.company_id] = [];
    const contactActivities = activities.filter(a => a.contact_id === ct.id);
    const contactEvents = events.filter(e => e.contact_id === ct.id);
    contactsByCompany[ct.company_id].push({ ...ct, activities: contactActivities, planned_events: contactEvents });
  }

  // Group company-level activities and events
  const companyActivities: Record<string, Activity[]> = {};
  for (const a of activities) {
    if (!a.contact_id) {
      if (!companyActivities[a.company_id]) companyActivities[a.company_id] = [];
      companyActivities[a.company_id].push(a);
    }
  }
  const companyEvents: Record<string, PlannedEvent[]> = {};
  for (const e of events) {
    if (!e.contact_id) {
      if (!companyEvents[e.company_id]) companyEvents[e.company_id] = [];
      companyEvents[e.company_id].push(e);
    }
  }

  return companies.map(c => {
    const r = c as unknown as Record<string, unknown>;
    return {
      ...c,
      fit_scores: (c.fit_scores || {}) as FitScores,
      tags: (Array.isArray(r.tags) ? r.tags : []) as string[],
      attachments: (Array.isArray(r.attachments) ? r.attachments : []) as { label: string; url: string }[],
      contacts: contactsByCompany[c.id] || [],
      activities: companyActivities[c.id] || [],
      planned_events: companyEvents[c.id] || [],
    };
  });
}

export async function bulkDeleteCompanies(ids: string[]): Promise<void> {
  if (!supabase || ids.length === 0) return;
  await supabase.from('companies').delete().in('id', ids);
}

export async function bulkUpdateStage(ids: string[], stage: string): Promise<void> {
  if (!supabase || ids.length === 0) return;
  await supabase.from('companies').update({ stage, updated_at: today() }).in('id', ids);
}

export async function bulkAddTag(ids: string[], tag: string): Promise<void> {
  if (!supabase || ids.length === 0 || !tag) return;
  // Fetch existing tags, merge, write back
  const { data } = await supabase.from('companies').select('id, tags').in('id', ids);
  for (const row of (data || []) as { id: string; tags: string[] | null }[]) {
    const tags = Array.isArray(row.tags) ? row.tags : [];
    if (!tags.includes(tag)) {
      await supabase.from('companies').update({ tags: [...tags, tag], updated_at: today() }).eq('id', row.id);
    }
  }
}

export async function loadTemplates(): Promise<Template[]> {
  if (!supabase) return [];
  const { data } = await supabase.from('templates').select('*').order('sort_order');
  const rows = (data || []) as Template[];
  if (rows.length > 0) return rows;

  // First-time tenant: seed default templates
  const userId = await getUserId();
  if (!userId) return [];
  const seeded: Template[] = DEFAULT_TEMPLATES.map((t, i) => ({
    id: generateId(),
    name: t.name,
    body: t.body,
    sort_order: i,
  }));
  await supabase.from('templates').insert(
    seeded.map(t => ({ ...t, user_id: userId }))
  );
  return seeded;
}

// ─── Company CRUD ───

export async function createCompany(company: Company): Promise<void> {
  if (!supabase) return;
  const userId = await getUserId();
  const { contacts, activities, planned_events, ...row } = company;
  void contacts; void activities; void planned_events;
  await supabase.from('companies').insert({
    ...row,
    user_id: userId,
    parent_id: row.parent_id || null,
  });
}

export async function updateCompanyFields(
  id: string,
  fields: Partial<Omit<Company, 'id' | 'contacts' | 'activities'>>
): Promise<void> {
  if (!supabase) return;
  const row: Record<string, unknown> = { ...fields, updated_at: today() };
  if ('parent_id' in row) row.parent_id = row.parent_id || null;
  await supabase.from('companies').update(row).eq('id', id);
}

export async function deleteCompanyFromDb(id: string): Promise<void> {
  if (!supabase) return;
  await supabase.from('companies').delete().eq('id', id);
}

// ─── Contact CRUD ───

export async function upsertContact(companyId: string, contact: Contact): Promise<void> {
  if (!supabase) return;
  const userId = await getUserId();
  const { activities, planned_events, ...row } = contact;
  void activities; void planned_events;
  const dbRow = { ...row, company_id: companyId, user_id: userId };
  await supabase.from('contacts').upsert(dbRow);
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
  const userId = await getUserId();
  await supabase.from('activities').insert({
    id: activity.id,
    company_id: companyId,
    contact_id: contactId,
    user_id: userId,
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

// ─── Planned Event CRUD ───

export async function upsertPlannedEvent(event: PlannedEvent): Promise<void> {
  if (!supabase) return;
  const userId = await getUserId();
  await supabase.from('planned_events').upsert({ ...event, user_id: userId });
}

export async function deletePlannedEvent(id: string): Promise<void> {
  if (!supabase) return;
  await supabase.from('planned_events').delete().eq('id', id);
}

// ─── Template CRUD ───

export async function saveAllTemplates(templates: Template[]): Promise<void> {
  if (!supabase) return;
  const userId = await getUserId();
  // Delete all user's templates, then insert fresh
  await supabase.from('templates').delete().neq('id', '');
  if (templates.length > 0) {
    await supabase.from('templates').insert(
      templates.map((t, i) => ({ ...t, user_id: userId, sort_order: i }))
    );
  }
}

// ─── Bulk import (for JSON file import) ───

export async function bulkImportCompanies(companies: Company[]): Promise<void> {
  if (!supabase) return;
  const userId = await getUserId();

  for (const company of companies) {
    const { contacts, activities, planned_events, ...row } = company;
    void activities; void planned_events;
    await supabase.from('companies').upsert({
      ...row,
      user_id: userId,
      parent_id: row.parent_id || null,
    });

    for (const contact of contacts) {
      const { activities: ctActivities, planned_events: ctEvents, ...ctRow } = contact;
      void ctEvents;
      await supabase.from('contacts').upsert({ ...ctRow, company_id: company.id, user_id: userId });
      for (const activity of ctActivities) {
        await supabase.from('activities').upsert({
          id: activity.id,
          company_id: company.id,
          contact_id: contact.id,
          user_id: userId,
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
        user_id: userId,
        date: activity.date,
        text: activity.text,
      });
    }
  }
}

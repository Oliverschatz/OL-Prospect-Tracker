import type { StageInfo } from './types';

export const STAGES: StageInfo[] = [
  { key: 'researching', label: 'Researching', short: 'Research.', cls: 'stage-researching', color: '#4299e1' },
  { key: 'qualified', label: 'Qualified', short: 'Qualif.', cls: 'stage-qualified', color: '#9f7aea' },
  { key: 'contacted', label: 'Contacted', short: 'Contact.', cls: 'stage-contacted', color: '#ed8936' },
  { key: 'dialogue', label: 'In Dialogue', short: 'Dialogue', cls: 'stage-dialogue', color: '#48bb78' },
  { key: 'won', label: 'Won', short: 'Won', cls: 'stage-won', color: '#276749' },
  { key: 'lost', label: 'Lost', short: 'Lost', cls: 'stage-lost', color: '#c53030' },
];

export const STAGE_ORDER = ['researching', 'qualified', 'contacted', 'dialogue', 'won', 'lost'];

export const SECTORS = [
  'Construction / Civil Engineering',
  'Industrial / Plant Engineering',
  'IT Systems Integration',
  'Mixed / Multi-discipline EPC',
  'Defense / Aerospace',
  'Energy / Utilities',
  'Professional Services',
  'Other',
];

export const FIT_CRITERIA = [
  { key: 'projectBased', label: 'Project-based contractor organization' },
  { key: 'crossCorporate', label: 'Cross-corporate project work (contractor–customer)' },
  { key: 'rolesSplit', label: 'Roles have split / formalized communication' },
  { key: 'pmoPresent', label: 'PMO or central PM function present' },
  { key: 'scaleMatch', label: 'Size fits (10,000+ or mid-size with PM maturity)' },
];

export const CONTACT_ACTIVITIES = [
  'Sent LinkedIn connection request',
  'Connection request accepted',
  'Sent LinkedIn message',
  'Sent e-mail first contact',
  'Sent e-mail message',
  'Offered tryout',
  'Phone call',
  'Met at event',
  'Follow-up sent',
];

export const COMPANY_ACTIVITIES = [
  'Sent offer',
  'First order',
  'Uses tryout offer',
  'Meeting scheduled',
  'Proposal submitted',
  'Contract signed',
];

export const CONTACT_STAGE_TRIGGERS: Record<string, string[]> = {
  'contacted': [
    'Sent LinkedIn connection request', 'Connection request accepted', 'Sent LinkedIn message',
    'Sent e-mail first contact', 'Sent e-mail message', 'Follow-up sent',
  ],
  'dialogue': [
    'Phone call', 'Met at event', 'Offered tryout',
  ],
};

export const COMPANY_STAGE_TRIGGERS: Record<string, string[]> = {
  'dialogue': ['Meeting scheduled', 'Proposal submitted', 'Sent offer', 'Uses tryout offer'],
  'won': ['First order', 'Contract signed'],
};

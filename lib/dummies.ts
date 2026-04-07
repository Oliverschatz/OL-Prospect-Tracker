// Dummy/demo companies with contacts, activities and planned events.
// Dates are stored as day-offsets from the moment the user loads them, so
// some items are in the past, some today, some in the future.

export const DUMMY_TAG = '__dummy__';

export interface DummyActivity { dayOffset: number; text: string }
export interface DummyEvent { dayOffset: number; title: string; description: string }

export interface DummyContact {
  name: string;
  title: string;
  department: string;
  email: string;
  phone: string;
  linkedin: string;
  role: 'target' | 'decision_maker' | 'influencer' | 'blocker' | 'champion';
  notes: string;
  activities: DummyActivity[];
  planned_events: DummyEvent[];
}

export interface DummyCompany {
  name: string;
  hq: string;
  country: string;
  employees: string;
  sector: string;
  website: string;
  stage: string;
  pain_points: string;
  entry_angle: string;
  notes: string;
  tags: string[];
  contacts: DummyContact[];
  activities: DummyActivity[];
  planned_events: DummyEvent[];
}

export const DUMMY_COMPANIES: DummyCompany[] = [
  {
    name: 'Duck Enterprises',
    hq: 'Entenhausen',
    country: 'Germany',
    employees: '110000',
    sector: 'Other',
    website: 'https://duck.com',
    stage: 'researching',
    pain_points:
      'Chronic budget overruns on treasure-hunting expeditions. No formal contractor management despite heavy use of subcontractors for vault construction and security.',
    entry_angle:
      'Scrooge is cost-conscious but underestimates cross-corporate risk. PBP certification for the project office could save millions in mismanaged contractor relationships.',
    notes:
      'Family-run conglomerate. Decision-making is centralized around Scrooge McDuck. Donald handles operations but has limited authority. Gyro Gearloose runs an R&D lab with no formal project governance.',
    tags: ['family-business', 'high-potential', 'DACH'],
    contacts: [
      {
        name: 'Donald Duck',
        title: 'Operations Manager',
        department: 'Operations',
        email: 'donald@duck.com',
        phone: '+49 151 1234 5678',
        linkedin: 'https://linkedin.com/in/donald-duck',
        role: 'target',
        notes:
          'Enthusiastic but easily overwhelmed. Responds well to practical examples. Avoid jargon.',
        activities: [
          { dayOffset: -4, text: 'Completed: Initial LinkedIn connection request accepted' },
        ],
        planned_events: [
          {
            dayOffset: 2,
            title: 'Send bread',
            description:
              'Send introductory material about PBP certification – frame it around contractor management for construction projects.',
          },
        ],
      },
      {
        name: 'Scrooge McDuck',
        title: 'CEO & Chairman',
        department: 'Executive Board',
        email: 'scrooge@duck.com',
        phone: '+49 151 9876 5432',
        linkedin: 'https://linkedin.com/in/scrooge-mcduck',
        role: 'decision_maker',
        notes:
          'Ultimate budget authority. Will only engage if ROI is crystal clear. Hates wasting time.',
        activities: [
          { dayOffset: 0, text: 'Completed: Talk with Scrooge – discussed vault expansion project overruns' },
        ],
        planned_events: [
          {
            dayOffset: 7,
            title: 'Send ROI one-pager to Scrooge',
            description:
              'Send one-page ROI summary for PBP certification program – emphasize cost savings on contractor disputes.',
          },
        ],
      },
      {
        name: 'Gyro Gearloose',
        title: 'Head of R&D',
        department: 'Research & Development',
        email: 'gyro@duck.com',
        phone: '',
        linkedin: 'https://linkedin.com/in/gyro-gearloose',
        role: 'influencer',
        notes:
          "Brilliant inventor, runs projects with zero governance. Could benefit from project business tools but doesn't see the need yet.",
        activities: [],
        planned_events: [
          {
            dayOffset: 13,
            title: 'Webinar invitation for Gyro',
            description: 'Invite to a free webinar on managing R&D projects under contract.',
          },
        ],
      },
      {
        name: 'Daisy Duck',
        title: 'Head of Corporate Communications',
        department: 'Communications',
        email: 'daisy@duck.com',
        phone: '+49 151 5555 6666',
        linkedin: 'https://linkedin.com/in/daisy-duck',
        role: 'influencer',
        notes:
          'Interested in how PBF credentials could strengthen employer branding. Good internal champion potential.',
        activities: [
          { dayOffset: 0, text: 'Completed: Talk with Daisy – she sees potential for PBP as part of their L&D program' },
        ],
        planned_events: [],
      },
      {
        name: 'Huey Duck',
        title: 'Junior Project Manager',
        department: 'Project Office',
        email: 'huey@duck.com',
        phone: '',
        linkedin: '',
        role: 'target',
        notes:
          'One of three nephews in the project office. Eager to get certified. Could be a quick win for individual PBP enrollment.',
        activities: [
          { dayOffset: 0, text: 'Completed: Have a meeting with Huey, Dewey, and Louis – all three interested in certification' },
        ],
        planned_events: [
          {
            dayOffset: 4,
            title: 'Send PBP info to Huey',
            description: 'Send PBP exam prep material and coupon code.',
          },
        ],
      },
    ],
    activities: [
      { dayOffset: 0, text: 'Completed: Talk with Scrooge' },
      { dayOffset: 0, text: 'Completed: Have a meeting with Huey, Dewey, and Louis' },
      { dayOffset: 0, text: 'Completed: Talk with Daisy' },
      { dayOffset: -6, text: 'Completed: Initial company research – identified vault construction and treasure logistics as key project areas' },
    ],
    planned_events: [
      {
        dayOffset: 0,
        title: 'Send a pack of bread crumbs',
        description: "Ducks are always hungry. Give them something they'll enjoy.",
      },
      {
        dayOffset: 14,
        title: 'Propose PBP pilot program',
        description: 'Propose a pilot: PBP certification for 5 project managers in the vault construction division.',
      },
    ],
  },
  {
    name: 'Marvel Universe, Inc.',
    hq: 'New York',
    country: 'United States',
    employees: '85000',
    sector: 'Defense & Security',
    website: 'https://marvel-universe.example.com',
    stage: 'qualified',
    pain_points:
      'Massive cross-organizational projects (Avengers initiatives) with no standardized contractor management. Each hero team operates independently with ad-hoc agreements. Collateral damage disputes remain unresolved for months.',
    entry_angle:
      'The Avengers Initiative is essentially a multi-contractor program with no formal project business governance. PBP certification for S.H.I.E.L.D. project managers could bring structure to cross-corporate hero deployment.',
    notes:
      'Complex stakeholder landscape. Nick Fury controls strategy but Tony Stark controls the budget for key technology projects. Pepper Potts is the actual operational decision-maker at Stark Industries.',
    tags: ['enterprise', 'US-market', 'defense'],
    contacts: [
      {
        name: 'Nick Fury',
        title: 'Director of Operations',
        department: 'S.H.I.E.L.D. Program Office',
        email: 'fury@marvel-universe.example.com',
        phone: '+1 212 555 0199',
        linkedin: 'https://linkedin.com/in/nick-fury',
        role: 'decision_maker',
        notes:
          'Extremely secretive. Prefers brief, high-impact communication. Will only meet if he sees strategic value.',
        activities: [
          { dayOffset: -13, text: 'Completed: Cold LinkedIn message sent – no response yet' },
          { dayOffset: -5, text: 'Completed: Follow-up message – Fury viewed profile but did not respond' },
        ],
        planned_events: [
          {
            dayOffset: 3,
            title: 'Indirect approach via Pepper',
            description: 'Try reaching Fury through Pepper Potts instead. Send a short case study on contractor dispute resolution.',
          },
        ],
      },
      {
        name: 'Pepper Potts',
        title: 'CEO',
        department: 'Stark Industries Division',
        email: 'pepper@marvel-universe.example.com',
        phone: '+1 212 555 0200',
        linkedin: 'https://linkedin.com/in/pepper-potts',
        role: 'decision_maker',
        notes:
          'Runs the business side of Stark Industries. Understands contracts and vendor management. Most likely to see immediate value in PBP.',
        activities: [
          { dayOffset: -6, text: 'Completed: LinkedIn connection accepted – brief exchange about contractor management challenges' },
        ],
        planned_events: [
          {
            dayOffset: 5,
            title: 'Send PBP intro to Pepper',
            description: "Send PBP intro and link to certification page. Mention relevance for Stark Industries' subcontractor network.",
          },
        ],
      },
      {
        name: 'Tony Stark',
        title: 'CTO & Head of Technology Programs',
        department: 'Stark Industries Division',
        email: 'tony@marvel-universe.example.com',
        phone: '',
        linkedin: 'https://linkedin.com/in/tony-stark',
        role: 'influencer',
        notes:
          'Brilliant but difficult to pin down. Prefers to build everything in-house. Skeptical of certifications but respects data-driven arguments.',
        activities: [],
        planned_events: [],
      },
      {
        name: 'Peter Parker',
        title: 'Junior Project Coordinator',
        department: 'S.H.I.E.L.D. Program Office',
        email: 'peter@marvel-universe.example.com',
        phone: '+1 212 555 0201',
        linkedin: 'https://linkedin.com/in/peter-parker',
        role: 'target',
        notes:
          'Young, eager to learn. Would be a great PBP candidate. Reports to Fury but has good rapport with Pepper.',
        activities: [
          { dayOffset: -2, text: 'Completed: Connected on LinkedIn – Peter asked about PBP certification requirements' },
        ],
        planned_events: [
          {
            dayOffset: 2,
            title: 'Send PBP details to Peter',
            description: 'Send PBP exam details and prep guide. Mention student-friendly pricing.',
          },
        ],
      },
    ],
    activities: [
      { dayOffset: -18, text: 'Completed: Company research – identified Avengers Initiative as a textbook case for cross-corporate project business management' },
      { dayOffset: -4, text: 'Completed: Strategy call – decided to approach via Pepper Potts as primary entry point' },
    ],
    planned_events: [
      {
        dayOffset: 8,
        title: 'Prepare Sokovia case study',
        description: 'Prepare tailored case study: how structured contractor management could have prevented the Sokovia incident cost overruns.',
      },
      {
        dayOffset: 24,
        title: 'Propose S.H.I.E.L.D. PBP pilot',
        description: 'Propose corporate PBP pilot for 10 S.H.I.E.L.D. program managers.',
      },
    ],
  },
  {
    name: 'Sesame Street',
    hq: 'New York',
    country: 'United States',
    employees: '450',
    sector: 'Education & Media',
    website: 'https://sesame-street.example.com',
    stage: 'researching',
    pain_points:
      'Growing number of externally funded education projects (grants, sponsorships, government contracts) but no formal project business management. Each project is run informally by whoever had the idea. Cookie Monster keeps eating the project budgets.',
    entry_angle:
      'Sesame Street is transitioning from a purely internal production model to externally funded, contract-based education projects. They need project business fundamentals – especially around managing grant-funded deliverables and sponsor expectations.',
    notes:
      'Small but influential organization. Very collaborative culture – decisions are made by consensus, which slows everything down. Count von Count tracks all metrics but has no framework for applying them.',
    tags: ['SMB', 'education', 'US-market'],
    contacts: [
      {
        name: 'Kermit the Frog',
        title: 'Managing Director',
        department: 'Executive Office',
        email: 'kermit@sesame-street.example.com',
        phone: '+1 212 555 0300',
        linkedin: 'https://linkedin.com/in/kermit-the-frog',
        role: 'decision_maker',
        notes:
          "Calm, thoughtful leader. Open to new ideas but cautious about budget commitments. Says 'it's not easy' a lot.",
        activities: [
          { dayOffset: -4, text: "Completed: LinkedIn connection – Kermit accepted and mentioned they're struggling with project governance" },
        ],
        planned_events: [
          {
            dayOffset: 3,
            title: 'Send PBP intro to Kermit',
            description: 'Send follow-up with link to PBP overview page. Keep it simple – Kermit appreciates clarity over jargon.',
          },
        ],
      },
      {
        name: 'Count von Count',
        title: 'Head of Analytics & Reporting',
        department: 'Data & Metrics',
        email: 'count@sesame-street.example.com',
        phone: '',
        linkedin: 'https://linkedin.com/in/count-von-count',
        role: 'influencer',
        notes:
          'Obsessed with counting and measurement. Would love Cash Radar. Gets excited about any tool with numbers in it.',
        activities: [],
        planned_events: [
          {
            dayOffset: 6,
            title: 'Cash Radar demo for the Count',
            description: 'Demo Cash Radar tool – the Count will appreciate the scenario modeling. Ah ah ah.',
          },
        ],
      },
      {
        name: 'Grover',
        title: 'Project Manager',
        department: 'Education Programs',
        email: 'grover@sesame-street.example.com',
        phone: '+1 212 555 0301',
        linkedin: 'https://linkedin.com/in/grover-monster',
        role: 'target',
        notes:
          'Runs multiple education outreach projects simultaneously. Overcommitted and understructured. Classic PBP candidate.',
        activities: [
          { dayOffset: -1, text: "Completed: Brief LinkedIn exchange – Grover mentioned he's managing 4 grant-funded projects with no PM framework" },
        ],
        planned_events: [
          {
            dayOffset: 4,
            title: 'Send PBP info to Grover',
            description: 'Send PBP certification details – emphasize practical applicability for grant-funded, contract-based projects.',
          },
        ],
      },
      {
        name: 'Oscar the Grouch',
        title: 'Facilities & Vendor Manager',
        department: 'Operations',
        email: 'oscar@sesame-street.example.com',
        phone: '',
        linkedin: '',
        role: 'blocker',
        notes:
          'Skeptical of everything new. Will actively push back on any training investment. Needs to be managed, not convinced.',
        activities: [
          { dayOffset: -3, text: 'Completed: Connection request sent – Oscar declined with a grumpy message' },
        ],
        planned_events: [],
      },
    ],
    activities: [
      { dayOffset: -5, text: 'Completed: Initial research – Sesame Street has 12 active externally funded education projects with no formal PM methodology' },
      { dayOffset: -1, text: 'Completed: Identified Grover and Count von Count as best entry points – Kermit for final sign-off' },
    ],
    planned_events: [
      {
        dayOffset: 11,
        title: 'Prepare bundled PBP + Cash Radar proposal',
        description: 'Prepare a mini-proposal: PBP certification for Grover + Cash Radar trial for Count von Count as a bundled offer.',
      },
    ],
  },
];

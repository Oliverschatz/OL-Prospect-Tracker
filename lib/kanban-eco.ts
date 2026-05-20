// PMP Examination Content Outline — July 2026
// Source: PMI PMP Examination Content Outline 2026 (PDF, 14 pages).
// Domain → Task → Enablers.

export type EcoEnabler = string;
export type EcoTask = { id: string; name: string; enablers: EcoEnabler[] };
export type EcoDomain = { id: string; name: string; weight: string; tasks: EcoTask[] };

export const ECO_DOMAINS: EcoDomain[] = [
  {
    id: 'people',
    name: 'I. People',
    weight: '33%',
    tasks: [
      {
        id: 'p1',
        name: 'Task 1 — Develop a common vision',
        enablers: [
          'Help ensure a shared vision with key stakeholders.',
          'Promote the shared vision.',
          'Keep the vision current.',
          'Break down situations to identify the root cause of a misunderstanding of the vision.',
        ],
      },
      {
        id: 'p2',
        name: 'Task 2 — Manage conflicts',
        enablers: [
          'Identify conflict sources.',
          'Analyze the context for the conflict.',
          'Implement an agreed-on resolution strategy.',
          'Communicate conflict management principles with the team and external stakeholders.',
          'Establish an environment that fosters adherence to common ground rules.',
          'Manage and rectify ground rule violations.',
        ],
      },
      {
        id: 'p3',
        name: 'Task 3 — Lead the project team',
        enablers: [
          'Establish expectations at the team level.',
          'Empower the team.',
          'Solve problems.',
          "Represent the voice of the team.",
          "Support the team's varied experiences, skills, and perspectives.",
          'Determine an appropriate leadership style.',
          'Establish clear roles and responsibilities within the team.',
        ],
      },
      {
        id: 'p4',
        name: 'Task 4 — Engage stakeholders',
        enablers: [
          'Identify stakeholders.',
          'Analyze stakeholders.',
          'Analyze and tailor communication to stakeholder needs.',
          'Execute the stakeholder engagement plan.',
          'Optimize alignment among stakeholder needs, expectations, and project objectives.',
          'Build trust and influence stakeholders to accomplish project objectives.',
        ],
      },
      {
        id: 'p5',
        name: 'Task 5 — Align stakeholder expectations',
        enablers: [
          'Categorize stakeholders.',
          'Identify stakeholder expectations.',
          'Facilitate discussions to align expectations.',
          'Organize and act on mentoring opportunities.',
        ],
      },
      {
        id: 'p6',
        name: 'Task 6 — Manage stakeholder expectations',
        enablers: [
          'Identify internal and external customer expectations.',
          'Align and maintain outcomes to internal and external customer expectations.',
          'Monitor internal and external customer satisfaction/expectations and respond as needed.',
        ],
      },
      {
        id: 'p7',
        name: 'Task 7 — Help ensure knowledge transfer',
        enablers: [
          'Identify knowledge critical to the project.',
          'Gather knowledge.',
          'Foster an environment for knowledge transfer.',
        ],
      },
      {
        id: 'p8',
        name: 'Task 8 — Plan and manage communication',
        enablers: [
          'Define a communication strategy.',
          'Promote transparency and collaboration.',
          'Establish a feedback loop.',
          'Understand reporting requirements.',
          'Create reports aligned with sponsors and stakeholder expectations.',
          'Support reporting and governance processes.',
        ],
      },
    ],
  },
  {
    id: 'process',
    name: 'II. Process',
    weight: '41%',
    tasks: [
      {
        id: 'pr1',
        name: 'Task 1 — Develop an integrated project management plan and plan delivery',
        enablers: [
          'Assess project needs, complexity, and magnitude.',
          'Recommend a project management development approach (i.e., predictive, adaptive/agile, or hybrid management).',
          'Determine critical information requirements (e.g., sustainability).',
          'Recommend a project execution strategy.',
          'Create an integrated project management plan.',
          'Estimate work effort and resource requirements.',
          'Assess consolidated project plans for dependencies, gaps, and continued business value.',
          'Maintain the integrated project management plan.',
          'Collect and analyze data to make informed project decisions.',
        ],
      },
      {
        id: 'pr2',
        name: 'Task 2 — Develop and manage project scope',
        enablers: [
          'Define scope.',
          'Obtain stakeholder agreement on project scope.',
          'Break down scope.',
        ],
      },
      {
        id: 'pr3',
        name: 'Task 3 — Help ensure value-based delivery',
        enablers: [
          'Identify value components with key stakeholders.',
          'Prioritize work based on value and stakeholder feedback.',
          'Assess opportunities to deliver value incrementally.',
          'Examine the business value throughout the project.',
          'Verify a measurement system is in place to track benefits.',
          'Evaluate delivery options to demonstrate value.',
        ],
      },
      {
        id: 'pr4',
        name: 'Task 4 — Plan and manage resources',
        enablers: [
          'Define and plan resources based on requirements.',
          'Manage and optimize resource needs and availability.',
        ],
      },
      {
        id: 'pr5',
        name: 'Task 5 — Plan and manage procurement',
        enablers: [
          'Plan procurement.',
          'Execute a procurement management plan.',
          'Select preferred contract types.',
          'Evaluate vendor performance.',
          'Verify objectives of the procurement agreement are met.',
          'Participate in agreement negotiations.',
          'Determine a negotiation strategy.',
          'Manage suppliers and contracts.',
          'Plan and manage the procurement strategy.',
          'Develop a delivery solution.',
        ],
      },
      {
        id: 'pr6',
        name: 'Task 6 — Plan and manage finance',
        enablers: [
          'Analyze project financial needs.',
          'Quantify risk and contingency financial allocations.',
          'Plan spend tracking throughout the project life cycle.',
          'Plan financial reporting.',
          'Anticipate future finance challenges.',
          'Monitor financial variations and work with the governance process.',
          'Manage financial reserves.',
        ],
      },
      {
        id: 'pr7',
        name: 'Task 7 — Plan and optimize quality of products/deliverables',
        enablers: [
          'Gather quality requirements for project deliverables.',
          'Plan quality processes and tools.',
          'Execute a quality management plan.',
          'Help ensure regulatory compliance.',
          'Manage cost of quality (CoQ) and sustainability.',
          'Conduct ongoing quality reviews.',
          'Implement continuous improvement.',
        ],
      },
      {
        id: 'pr8',
        name: 'Task 8 — Plan and manage schedule',
        enablers: [
          'Prepare a schedule based on the selected development approach.',
          'Coordinate with other projects and operations.',
          'Estimate project tasks (milestones, dependencies, story points).',
          'Utilize benchmarks and historical data.',
          'Create a project schedule.',
          'Baseline a project schedule.',
          'Execute a schedule management plan.',
          'Analyze schedule variation.',
        ],
      },
      {
        id: 'pr9',
        name: 'Task 9 — Evaluate project status',
        enablers: [
          'Develop project metrics, analysis, and reconciliation.',
          'Identify and tailor needed artifacts.',
          'Help ensure artifacts are created, reviewed, updated, and documented.',
          'Help ensure accessibility of artifacts.',
          'Assess current progress.',
          'Measure, analyze, and update project metrics.',
          'Communicate project status.',
          'Continually assess the effectiveness of artifact management.',
        ],
      },
      {
        id: 'pr10',
        name: 'Task 10 — Manage project closure',
        enablers: [
          'Obtain project stakeholder approval of project completion.',
          'Determine criteria to successfully close the project or phase.',
          'Validate readiness for transition (e.g., to operations team or next phase).',
          'Conclude activities to close the project or phase (e.g., final lessons learned, retrospectives, procurement, financials, resources).',
        ],
      },
    ],
  },
  {
    id: 'business',
    name: 'III. Business Environment',
    weight: '26%',
    tasks: [
      {
        id: 'b1',
        name: 'Task 1 — Define and establish project governance',
        enablers: [
          'Describe and establish the structure, rules, procedures, reporting, ethics, and policies through the use of organizational process assets (OPAs).',
          'Define success metrics.',
          'Outline governance escalation paths and thresholds.',
        ],
      },
      {
        id: 'b2',
        name: 'Task 2 — Plan and manage project compliance',
        enablers: [
          'Confirm project compliance requirements (e.g., security, health and safety, sustainability, regulatory compliance).',
          'Classify compliance categories.',
          'Determine potential threats to compliance.',
          'Use methods to support compliance.',
          'Analyze the consequences of noncompliance.',
          'Determine the necessary approach and action(s) to address compliance needs.',
          'Measure the extent to which the project is in compliance.',
        ],
      },
      {
        id: 'b3',
        name: 'Task 3 — Manage and control changes',
        enablers: [
          'Execute the change control process.',
          'Communicate the status of proposed changes.',
          'Implement approved changes to the project.',
          'Update project documentation to reflect changes.',
        ],
      },
      {
        id: 'b4',
        name: 'Task 4 — Remove impediments and manage issues',
        enablers: [
          'Evaluate the impact of impediments.',
          'Prioritize and highlight impediments.',
          'Determine and apply an intervention strategy to remove/minimize impediments.',
          'Reassess continually to help ensure impediments, obstacles, and blockers for the team are being addressed.',
          'Recognize when a risk becomes an issue.',
          'Collaborate with relevant stakeholders on an approach to resolve the issues.',
        ],
      },
      {
        id: 'b5',
        name: 'Task 5 — Plan and manage risk',
        enablers: [
          'Identify risks.',
          'Analyze risks.',
          'Monitor and control risks.',
          'Develop a risk management plan.',
          'Maintain a risk register (e.g., poor IT security).',
          'Execute a risk management plan (e.g., risk response for security and managing sustainability risks).',
          'Communicate the status of a risk impact on the project.',
        ],
      },
      {
        id: 'b6',
        name: 'Task 6 — Continuous improvement',
        enablers: [
          'Utilize lessons learned.',
          'Help ensure continuous improvement processes are updated.',
          'Update organizational process assets (OPAs).',
        ],
      },
      {
        id: 'b7',
        name: 'Task 7 — Support organizational change',
        enablers: [
          'Assess organizational culture.',
          'Evaluate the impact of organizational change on the project and determine required actions.',
        ],
      },
      {
        id: 'b8',
        name: 'Task 8 — Evaluate external business environment changes',
        enablers: [
          'Survey changes to the external business environment (e.g., regulations, technology, geopolitical, market).',
          'Assess and prioritize the impact on project scope/backlog based on changes in the external business environment.',
          'Continually review the external business environment for impacts on project scope/backlog.',
        ],
      },
    ],
  },
];

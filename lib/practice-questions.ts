export type PracticeQuestion = {
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation?: string;
};

export const practiceQuestions: PracticeQuestion[] = [
  {
    id: 'pbp-1',
    question: 'What does PBP stand for in the context of Oliver F. Lehmann\'s training programs?',
    options: [
      'Project Budget Planning',
      'Project Business Professional',
      'Professional Business Process',
      'Project Bidding Procedure',
    ],
    correctIndex: 1,
    explanation: 'PBP stands for Project Business Professional — a certification focused on the contractor side of project business.',
  },
  {
    id: 'pbp-2',
    question: 'In a customer project, which party typically issues the Request for Proposal (RFP)?',
    options: [
      'The contractor',
      'The subcontractor',
      'The customer',
      'The regulatory authority',
    ],
    correctIndex: 2,
    explanation: 'The customer issues the RFP to solicit proposals from potential contractors.',
  },
  {
    id: 'pbp-3',
    question: 'Which contract type places the highest cost risk on the contractor?',
    options: [
      'Cost-plus-fixed-fee',
      'Time and materials',
      'Firm fixed price',
      'Cost reimbursable',
    ],
    correctIndex: 2,
    explanation: 'In a firm fixed price contract, the contractor bears the risk of cost overruns.',
  },
  {
    id: 'pbp-4',
    question: 'What is the primary purpose of a "go / no-go" decision during the bid phase?',
    options: [
      'To select the project manager',
      'To decide whether to invest resources into preparing a proposal',
      'To approve the final contract',
      'To trigger payment to subcontractors',
    ],
    correctIndex: 1,
    explanation: 'A go/no-go decision determines whether pursuing the opportunity is worth the cost of bidding.',
  },
  {
    id: 'pbp-5',
    question: 'In a typical CRM pipeline, which stage comes immediately after "Qualified"?',
    options: [
      'Researching',
      'Won',
      'Contacted',
      'Lost',
    ],
    correctIndex: 2,
    explanation: 'After qualifying a prospect, the next step is to make initial contact.',
  },
  {
    id: 'pbp-6',
    question: 'Which role in a buying organisation has formal authority to approve a purchase?',
    options: [
      'Champion',
      'Influencer',
      'Decision Maker',
      'Gatekeeper',
    ],
    correctIndex: 2,
    explanation: 'The Decision Maker holds formal authority. A Champion advocates internally but does not necessarily sign off.',
  },
  {
    id: 'pbp-7',
    question: 'What is the main reason to track "pain points" for a prospect?',
    options: [
      'To estimate the contract value',
      'To tailor the value proposition to their actual needs',
      'To comply with GDPR',
      'To rank competitors',
    ],
    correctIndex: 1,
    explanation: 'Understanding pain points lets you frame the offering as a solution to a specific problem the prospect cares about.',
  },
  {
    id: 'pbp-8',
    question: 'In project business, what does the term "claim" typically refer to?',
    options: [
      'A marketing slogan',
      'A request for additional time or money due to a change in scope or conditions',
      'A patent filing',
      'An employee expense report',
    ],
    correctIndex: 1,
    explanation: 'A claim is a formal assertion by one contracting party seeking compensation or relief from the other.',
  },
  {
    id: 'pbp-9',
    question: 'What is the purpose of a fit assessment when qualifying a prospect?',
    options: [
      'To check whether the prospect has paid previous invoices',
      'To score how well the prospect matches your ideal customer profile',
      'To calculate the commission for the sales rep',
      'To translate the website into the prospect\'s language',
    ],
    correctIndex: 1,
    explanation: 'A fit assessment quantifies alignment with your ideal customer profile, so effort is focused on high-probability deals.',
  },
  {
    id: 'pbp-10',
    question: 'Which document formally describes what the contractor will deliver under a contract?',
    options: [
      'Statement of Work (SoW)',
      'Non-Disclosure Agreement (NDA)',
      'Letter of Intent (LoI)',
      'Memorandum of Understanding (MoU)',
    ],
    correctIndex: 0,
    explanation: 'The Statement of Work defines the deliverables, schedule, and acceptance criteria for the contracted work.',
  },
];

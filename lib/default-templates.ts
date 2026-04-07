// Default message templates seeded for every new tenant.
// Users can freely edit, remove, or extend this list.

export interface DefaultTemplate {
  name: string;
  body: string;
}

export const DEFAULT_TEMPLATES: DefaultTemplate[] = [
  {
    name: 'Cold Connection Request',
    body: `Hello [FirstName],

I represent Oliver F. Lehmann Project Business Training and the Project Business Foundation.

We support organizations that run projects for external customers under contract – with training, certification, consulting, assessments, and digital tools for cross-corporate project management.

I'm reaching out because [Company] looks like a company where this discipline matters. If that's the case, I'd be happy to share what we offer.

Best regards,
[AmbassadorName]`,
  },
  {
    name: 'Follow-up After Connection',
    body: `Hello [FirstName],

thank you for connecting! I represent Oliver F. Lehmann Project Business Training and the Project Business Foundation.

We work with organizations that run projects for external customers under contract – helping them professionalize the management of these projects across organizational boundaries.

If that's relevant to what you do at [Company], I'd welcome a short conversation.

Best regards,
[AmbassadorName]`,
  },
  {
    name: 'Intro to PBP',
    body: `Hello [FirstName],

following up on our earlier exchange – I wanted to share something that might be valuable for you or your team at [Company].

The Project Business Professional (PBP) qualification and certification, developed by Oliver F. Lehmann and the Project Business Foundation, focuses on a gap most PM credentials ignore: managing projects that cross organizational boundaries and run under contract. Think contractor–customer dynamics, incentive structures, bid strategy, and contract-level risk.

If you'd like to take a look: https://oliverlehmann.com/pm-training/individual-pbp-certification/

Happy to answer any questions or set up a conversation with Oliver directly.

Best regards,
[AmbassadorName]`,
  },
];

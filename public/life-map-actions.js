// Match the specific outcome, never an unrelated parent action.
const actions = [
 [/surgery|procedure|operation\b/i, 'Contact the care team to confirm the next step for the planned procedure'],
 [/root canal/i, 'Contact the dental practice to book the next root canal appointment'],
 [/dental|dentist|tooth|gum /i, 'Contact the dental practice to book an appointment'],
 [/test result/i, 'Contact the care team to request the outstanding test results'],
 [/referral/i, 'Contact the referred clinic to check the referral and book an appointment'],
 [/refill|medication|prescription/i, 'Contact the pharmacy to check the prescription and request the needed refill'],
 [/screening|vaccin|check-up|checkup/i, 'Contact the clinic to ask which preventive appointment is due and book it'],
 [/appointment|specialist|follow.up/i, 'Contact the relevant clinic to book the appointment'],
 [/symptom|pain|health concern|condition|vision|hearing/i, 'Contact the care team to arrange an assessment of the concern'],
 [/therapy|counsel|mental health/i, 'Contact a counseling provider to ask about an initial appointment'],
 [/declutter|clutter|organize.*room|organization|cupboard|storage/i, title=>`Clear one surface or drawer in: ${title}`],
 [/repair|leak|plumbing|electrical|appliance|heating|roof/i, title=>`Request a repair quote for: ${title}`],
 [/laundry/i, 'Wash, dry, and put away one load of laundry'],
 [/grocer|shopping|supplies/i, title=>`Make a shopping list for: ${title}`],
 [/cleaning|clean /i, title=>`Clean one area in: ${title}`],
 [/mortgage|bill|payment|tax/i, title=>`Open the latest statement or notice and record the amount and due date for: ${title}`],
 [/subscription|recurring charge/i, 'Open the account and check the next renewal date and cancellation terms'],
 [/insurance|coverage|beneficiar/i, 'Open the current policy and check its coverage and renewal date'],
 [/budget|cash flow|spending/i, 'List last month’s income and expenses in one place'],
 [/debt|loan|credit card/i, 'Open the latest statement and record the balance, interest rate, and next payment date'],
 [/passport|visa|residency|oci|real id|license|registration|renewal/i, title=>`Check the official application requirements and list the missing documents for: ${title}`],
 [/application|paperwork|form|claim/i, title=>`Open the required form and list the documents needed for: ${title}`],
 [/backup/i, 'Run a backup and check that a saved file can be opened'],
 [/password|account recovery|two.factor|security/i, 'Open the account security settings and check recovery access and two-factor authentication'],
 [/photo|files|records|documents/i, title=>`Gather the relevant files into one folder for: ${title}`],
 [/job search|applications|resume|portfolio/i, 'Update the resume or portfolio for one specific job opening'],
 [/feedback|mentor/i, 'Send a message requesting a feedback or mentoring conversation'],
 [/course|lesson|learn|skill|qualification|practice/i, title=>`Find an introductory lesson and reserve time to try it for: ${title}`],
 [/writing|script|story|draft/i, title=>`Write the next paragraph or scene for: ${title}`],
 [/film|shoot|recording|production/i, title=>`List the people, location, and equipment needed for: ${title}`],
 [/publish|submit|festival/i, title=>`Open the submission page and record the deadline and required materials for: ${title}`],
 [/rehears/i, 'Send participants two proposed rehearsal times'],
 [/travel|trip|holiday|destination/i, title=>`List possible travel dates and compare transport prices for: ${title}`],
 [/celebration|birthday|anniversary|gathering/i, title=>`Send guests a proposed date for: ${title}`],
 [/emergency|backup caregiver/i, 'Write down emergency contacts and share them with the person who may need them'],
 [/will\b|estate|legal|agreement|contract/i, 'Gather the relevant documents and request an appointment with a qualified adviser'],
 [/volunteer|community|group/i, title=>`Contact the organizer to ask about the next meeting or activity for: ${title}`]
];

export function concreteAction(topic, answer={}) {
 if(answer.next?.trim())return answer.next.trim();
 const title=topic.title?.trim()||'';
 if(!title)return '';
 if(answer.status==='unsure'||answer.support==='information')return '';
 if(answer.support==='decision')return `Write the options and one advantage and drawback of each for: ${title}`;
 if(answer.support==='waiting')return `Send a follow-up requesting an update on: ${title}`;
 if(topic.personName)return `Message ${topic.personName} to arrange a time to discuss: ${title}`;
 const rule=actions.find(([pattern])=>pattern.test(title));
 return rule ? (typeof rule[1]==='function'?rule[1](title):`${rule[1]} — ${title}`) : '';
}

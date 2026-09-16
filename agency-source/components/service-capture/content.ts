export const problems = [
  ["Unanswered calls", "Customers may reach voicemail when the office is closed or the team is already handling other work."],
  ["Incomplete information", "Staff may need several conversations just to learn the service requested, location and urgency."],
  ["Scattered inquiries", "Website forms, phone notes and callbacks can end up in different places."],
  ["Unclear follow-up", "Without an assigned next action, an otherwise valuable request can be forgotten or delayed."],
];
export const stages = [
  ["Capture", "Collect structured information from website forms, unanswered calls and approved after-hours call flows."],
  ["Categorize", "Organize the service requested, location, customer type, urgency and preferred callback time."],
  ["Route", "Assign the request to the correct team and create the approved notification or escalation."],
  ["Track", "Keep the inquiry, notes, callback status and next action visible in one workflow."],
];
export const included = ["One existing inquiry-process review", "One website estimate or service-request form", "One after-hours and unanswered-call intake workflow", "Up to six inquiry categories", "One approved service-area and routing setup", "Notifications for up to three staff recipients", "One compatible CRM or inquiry-pipeline connection", "Customized intake scripts and FAQs based on client-approved information", "Up to ten scripted test scenarios", "Two revision rounds before launch", "One staff handover session and written documentation", "30 days of post-launch support and tuning"];
export const launchSupport = ["Fixing implementation problems", "Minor script adjustments", "Minor category and routing adjustments", "Minor notification changes", "Assistance using the delivered workflow"];
export const separateQuote = ["Additional website forms", "Additional phone or intake workflows", "Additional business locations", "Additional CRM or software integrations", "Major website development", "New functionality outside the approved implementation", "Continued management after the 30-day period"];
export const goodFit = ["Independent residential HVAC company", "Receives website or phone inquiries", "Staff sometimes miss or delay calls", "Wants a structured callback process", "Has someone responsible for reviewing inquiries", "Will approve scripts, routing and escalation rules"];
export const poorFit = ["Wants the agency to generate leads", "Has almost no existing inquiry volume", "Expects software to replace the entire office team", "Wants automatic HVAC diagnosis", "Wants unapproved dispatch or pricing promises", "Will not participate in testing and approval"];
export const process = [
  ["System Review", "We map how inquiries arrive, where information is lost and what the team currently uses."],
  ["Build and Configure", "We create the intake flow, categories, scripts, routing rules and required connections."],
  ["Test and Approve", "We run fictional website and call scenarios, document the results and obtain approval before launch."],
  ["Launch and Tune", "We activate the approved workflow, train staff and adjust it during the first 30 days."],
];
export const boundaries = ["The system does not diagnose HVAC equipment.", "It does not promise technician availability.", "It does not quote unauthorized prices.", "It does not confirm dispatch unless connected to an approved live scheduling process.", "Urgent inquiries follow client-approved safety and escalation language.", "The HVAC company remains responsible for service decisions and customer follow-up."];
export const faqs = [
  ["What exactly is included in the CAD $2,500 implementation?", "The one-time implementation includes one process review, one website form, one after-hours and unanswered-call intake workflow, up to six inquiry categories, one approved service-area and routing setup, notifications for up to three staff recipients, and one compatible CRM or inquiry-pipeline connection. It also includes client-approved scripts and FAQs, up to ten scripted test scenarios, two revision rounds before launch, one staff handover session, written documentation and 30 days of post-launch support. Final scope is confirmed after the System Review."],
  ["What happens if we need additional forms or integrations?", "Additional forms, phone or intake workflows, business locations and software integrations require a separate quote. The same applies to major website development, new functionality outside the approved implementation and continued management after the 30-day period. Integrations depend on compatibility, access, testing and client approval."],
  ["What does the 30-day support period cover?", "The 30 days after launch cover fixing implementation problems, minor script, category, routing and notification adjustments, and assistance using the delivered workflow. New functionality and continued management after this period require a separate quote."],
  ["Are software and phone charges included?", "No. Third-party calling software, phone numbers, CRM subscriptions and usage charges are selected and paid for separately by the client. The CAD $2,500 price is for the approved one-time implementation."],

  ["Does Service Capture Co. generate HVAC leads?", "No. We build the system that captures and organizes inquiries your business already receives. Advertising and lead generation are outside the core offer."],
  ["Is this a replacement for our receptionist or dispatcher?", "No. The system supports staff by collecting information and creating follow-up tasks, especially after hours or when calls go unanswered."],
  ["Can we keep our existing phone number?", "That depends on your current provider and routing setup. We review the phone system before recommending a configuration."],
  ["Does the system automatically book appointments?", "Booking can only be enabled when the company has approved availability rules and a compatible scheduling system. Otherwise, the workflow creates a callback task for staff."],
  ["What software do you use?", "Software is selected based on the company’s existing phone system, CRM, budget and requirements. The client owns and pays for third-party subscriptions directly."],
  ["What happens with urgent calls?", "We configure client-approved safety language, urgency categories and human escalation rules. The system does not diagnose equipment or guarantee emergency service."],
  ["Is EverWarm a real client?", "No. EverWarm Home Comfort is a fictional interactive demonstration created to show how the workflow can operate."],
  ["How long does implementation take?", "The implementation schedule is confirmed after the System Review and depends on access, integrations, testing and approvals."],
];
export const demoNotice = "EverWarm Home Comfort is a fictional HVAC company created to demonstrate the system. Enter fictional information only. No real calls, messages, bookings or CRM actions occur.";
export const demoFeatures = ["Website estimate form", "After-hours call simulation", "Missed-call recovery", "Unified inquiry tracker"];

// --- Services -------------------------------------------------------------
// Every price, inclusion and exclusion below is supplied by the business.
// Nothing here promises leads, rankings, traffic or revenue.
export type ServiceOffer = {
  id: string; name: string; price: string; priceNote: string; badge?: string;
  // `offer` mirrors the displayed price for structured data: amount in CAD, or a quote.
  offer: {kind: "from" | "fixed" | "monthly" | "quote"; amount?: number};
  summary: string; cta: string; includes: string[]; excludes: string[];
  excludesNote: string; who: string[];
};
export const services: ServiceOffer[] = [
  {
    id: "website-launch", name: "HVAC Website Launch", price: "Starting at CAD $999", priceNote: "One-time build", offer: {kind: "from", amount: 999},
    summary: "A focused, mobile-friendly website for independent HVAC companies that need a clearer and more professional way for homeowners to understand their services and request help.",
    cta: "Review My Website",
    includes: ["Up to five standard pages", "Responsive desktop, tablet and mobile layout", "Clear service-request calls to action", "Contact or quote-request form", "Google booking-link integration when requested", "Basic technical search setup, page titles and metadata", "SSL and deployment configuration", "One structured revision round", "Launch testing"],
    excludes: ["Custom branding or logo design", "E-commerce", "Advanced CRM integrations", "Custom applications", "Paid advertising", "Ongoing SEO", "Large content-writing projects", "Third-party software or subscription costs"],
    excludesNote: "These items are not part of the starting package and require a separate quote.",
    who: ["Has no website, or one that is dated or difficult to use on a phone", "Wants homeowners to understand the services offered", "Needs a clear way for visitors to request service or a quote", "Is comfortable starting with a focused five-page site"],
  },
  {
    id: "growth-care", name: "Website Growth & Care", price: "CAD $250", priceNote: "Per month · optional ongoing support", offer: {kind: "monthly", amount: 250},
    summary: "Optional ongoing support for a site we host and look after: monitoring, small changes and a monthly check of the pathway a customer uses to reach you.",
    cta: "Review My Website",
    includes: ["Managed website hosting", "Uptime and security monitoring", "Contact-form and booking-link checks", "Up to 60 minutes of minor website changes each month", "Monthly review of the main inquiry pathway", "Routine dependency and security updates", "Broken-link and form-delivery checks", "Basic monthly website and inquiry summary when the required data is available"],
    excludes: ["Unused editing time (it does not accumulate)", "Major redesigns", "New pages", "Custom features and integrations", "Advertising and premium software", "Third-party usage charges"],
    excludesNote: "Unused editing time does not carry over to the next month. Major redesigns, new pages, custom features and integrations require a separate quote. We do not promise rankings, traffic, leads or revenue.",
    who: ["Wants someone responsible for hosting, updates and monitoring", "Makes small content or service-area changes through the year", "Wants the contact form and booking link checked regularly", "Prefers a predictable monthly cost over ad-hoc requests"],
  },
  {
    id: "inquiry-capture", name: "HVAC Inquiry Capture System", price: "CAD $2,500", priceNote: "One-time implementation", badge: "Most Complete", offer: {kind: "fixed", amount: 2500},
    summary: "The flagship build: capture, categorize, route and track the inquiries your company already receives, with approved scripts, notifications and human escalation rules.",
    cta: "Book a System Review",
    includes: ["Inquiry-process review", "Website inquiry form", "After-hours and unanswered-call workflow planning", "Scripts and approved FAQs", "Inquiry categorization", "Routing and human escalation rules", "Notifications for the approved staff recipients", "Approved CRM connection when included in the final scope", "Testing and handover", "30 days of launch support and tuning"],
    excludes: ["Additional forms, intake workflows or business locations", "Additional CRM or software integrations", "Major website development", "New functionality outside the approved implementation", "Continued management after the 30-day period", "Third-party phone, CRM, messaging and usage costs"],
    excludesNote: "Final scope follows the System Review. Third-party phone, CRM, messaging and usage costs are paid separately by the client.",
    who: ["Already receives website or phone inquiries", "Loses track of requests after hours or during busy periods", "Wants one place where follow-up is visible", "Will approve scripts, routing and escalation rules"],
  },
  {
    id: "workflow-automation", name: "Custom Workflow Automation", price: "Custom quote", priceNote: "After a workflow review", offer: {kind: "quote"},
    summary: "For HVAC companies with a repetitive administrative task that does not fit one of the standard packages, Service Capture Co. can review the process and propose a clearly scoped automation.",
    cta: "Discuss a Workflow",
    includes: ["Routing inquiries to the appropriate person", "Internal notifications", "Follow-up reminders", "Moving approved information between existing systems", "Organizing incoming requests", "Basic CRM handoffs", "Reducing repetitive data entry"],
    excludes: ["Work that starts before the workflow has been reviewed", "Automation that removes human review where it is needed", "Software subscriptions and usage fees", "Any automation presented as complete before it has been tested"],
    excludesNote: "Not every task can or should be automated. Feasibility depends on the tools you already use, and you approve the workflow, access requirements and final scope before work begins.",
    who: ["Repeats the same administrative task every week", "Already uses tools that can exchange information", "Wants a person to stay in the loop for exceptions", "Can describe the current steps and who performs them"],
  },
];
export const serviceComparison: [string, string, string, string][] = [
  ["HVAC Website Launch", "Starting at CAD $999 one-time", "Homeowners can’t easily find or understand your services online", "A focused five-page site with a working request form"],
  ["Website Growth & Care", "CAD $250 per month", "You want the site hosted, monitored and kept current", "Ongoing support, monitoring and up to 60 minutes of changes monthly"],
  ["HVAC Inquiry Capture System", "CAD $2,500 one-time", "Inquiries arrive but follow-up is scattered or delayed", "One connected capture, routing and tracking workflow"],
  ["Custom Workflow Automation", "Custom quote after a workflow review", "One repetitive admin task doesn’t fit the packages above", "A scoped, tested automation for that specific workflow"],
];
export const serviceFaqs: [string, string][] = [
  ["Which service should we start with?", "If homeowners cannot easily find or understand your services online, start with the HVAC Website Launch. If inquiries already arrive but follow-up is scattered, start with the HVAC Inquiry Capture System. If a single repetitive administrative task is the problem, start with a workflow review. A 20-minute review is usually enough to decide."],
  ["Can services be combined?", "Yes. A website launch and an inquiry capture system are often built together, and Website Growth & Care can be added afterwards. Combined work is quoted as its own scope rather than added automatically."],
  ["Why is the website price a starting price?", "CAD $999 covers the base scope listed above: up to five standard pages, a request form, responsive layouts, basic technical search setup, SSL and deployment, one revision round and launch testing. Custom branding, e-commerce, advanced integrations, custom applications, advertising, ongoing SEO and large content projects are quoted separately."],
  ["Is Website Growth & Care just hosting?", "No. It includes managed hosting, but also uptime and security monitoring, contact-form and booking-link checks, routine dependency and security updates, a monthly review of the main inquiry pathway and up to 60 minutes of minor changes. Unused editing time does not accumulate."],
  ["Do you guarantee more leads or better rankings?", "No. We do not promise rankings, traffic, leads or revenue. The work improves how customers find you, request service and move through the inquiry process; results depend on your market, pricing, capacity and follow-up."],
  ["Who pays for software and subscriptions?", "The client selects and pays for third-party phone, CRM, messaging, hosting add-ons and usage charges directly. Our prices cover the implementation and, for Growth & Care, the ongoing support described above."],
  ["Will an automation replace our office staff?", "No. These systems support your team. Human review and escalation stay available where appropriate, and your staff remain responsible for service decisions and customer follow-up."],
  ["What happens in the 20-minute review?", "We look at how customers currently reach you, where requests are lost and which of the four services fits. If none of them fits, we say so."],
];
// Short homepage summaries. Full scope lives on the Services page.
export const homeServices: [string, string, string][] = [
  ["HVAC Website Launch", "Starting at CAD $999", "A focused, mobile-friendly site that explains your services and makes requesting help simple."],
  ["HVAC Inquiry Capture System", "CAD $2,500", "Capture, categorize, route and track the inquiries you already receive, with approved escalation rules."],
  ["Custom Workflow Automation", "Custom quote", "A repetitive administrative task reviewed first, then scoped, built and tested with your approval."],
];

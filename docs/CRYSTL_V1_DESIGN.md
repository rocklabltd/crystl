# Crystl V1 Design File

## 1. Product Name

Crystl V1

## 2. Product Purpose

Crystl V1 is a multi workspace request to quote system.

Its purpose is to turn messy inbound enquiries into structured quote opportunities that can be reviewed, clarified, priced, quoted, and tracked through to outcome.

Crystl V1 is not a generic CRM.

Crystl V1 is the operational layer between:
1. an incoming enquiry
2. requirement clarification
3. supplier pricing
4. customer quote creation
5. won or lost outcome tracking

The first live workspace is Supplement Lab.

---

## 3. Core Product Promise

A prospect submits a request.

The system turns that request into a managed opportunity.

The internal team reviews and structures the requirement.

The team creates supplier RFQs.

Supplier responses are logged.

A customer quote is built.

The opportunity is tracked until won or lost.

---

## 4. V1 Product Scope

### In scope

1. Hosted public request forms
2. Multi workspace structure
3. Contact creation and matching
4. Raw request capture
5. Opportunity auto creation
6. Structured requirement editing
7. Supplier RFQ creation
8. Supplier response logging
9. Customer quote creation
10. Opportunity stage tracking
11. Workspace settings
12. Team member roles
13. Activity logging
14. Basic file attachment support

### Out of scope

1. Generic CRM features
2. Marketing site builder
3. Customer portal
4. Supplier portal
5. AI requirement summarisation
6. AI quote drafting
7. PDF export
8. Deep analytics
9. Email automation
10. Embedded widget script builder

---

## 5. First Live Use Case

### Workspace
Supplement Lab

### Use case
A visitor on supplementlab.uk wants a supplement product manufactured.

They click a call to action and open a hosted Crystl request form.

They submit the details of the product they want.

The Supplement Lab team receives that submission inside Crystl as a new opportunity.

The team reviews the request, clarifies what is needed, gets supplier pricing, and issues a quote.

---

## 6. Product Principles

1. Request first, not contact first  
The primary object is the quote request, not the contact record.

2. Clear before clever  
The system should prioritise speed, structure, and usability over flashy features.

3. Flexible underneath  
The product must support future non supplement workspaces.

4. Supplement Lab is a template, not the whole product  
Supplement specific fields must live in the form template and structured requirement layer, not in the global app model.

5. Low friction internal workflow  
Internal users should be able to move from request to quote quickly with minimal admin overhead.

6. Production usable MVP  
V1 must be usable for real live opportunities, not just as a demo.

---

## 7. User Types

### Public prospect
A person submitting a request through a hosted form.

### Workspace owner
Full control of workspace, users, forms, settings, opportunities, RFQs, and quotes.

### Manager
Can manage operational workflow across requests, opportunities, RFQs, supplier responses, and quotes.

### Sales user
Can work opportunities and quotes.

### Viewer
Read only access to opportunity and quote data.

---

## 8. Main Domain Objects

### Workspace
A business using Crystl.

### Contact
The person or company making the enquiry.

### Form Template
The hosted public form configuration.

### Request
The raw inbound submission.

### Opportunity
The internal managed quote job.

### Structured Requirement
The internal cleaned version of what is actually being priced.

### Supplier RFQ
The outbound request for supplier pricing.

### Supplier Response
The commercial and production details returned by a supplier.

### Customer Quote
The outward facing quote sent to the customer.

### Activity Log
The audit trail for key actions.

### File
Any uploaded attachment linked to a request or opportunity.

---

## 9. Core Workflow

### Step 1
Prospect opens hosted public form.

### Step 2
Prospect submits request.

### Step 3
System creates or matches contact by email within the workspace.

### Step 4
System stores the raw request payload.

### Step 5
System auto creates an opportunity.

### Step 6
Internal user reviews the request.

### Step 7
Internal user edits the structured requirement.

### Step 8
Internal user creates one or more supplier RFQs.

### Step 9
Supplier responses are logged.

### Step 10
Internal user creates customer quote.

### Step 11
Opportunity is progressed to won or lost.

---

## 10. Default Opportunity Stages

The V1 default stages are:

1. new
2. reviewing
3. awaiting_info
4. sent_for_pricing
5. supplier_response_received
6. quote_ready
7. quote_sent
8. won
9. lost

These should be displayed with human friendly labels in the UI.

---

## 11. Supplement Lab V1 Request Form

### Form Name
Supplement Lab Product Request

### Form Goal
Capture enough structured information to avoid unnecessary back and forth before quoting.

### Fields

#### Section A: About you
1. Full name
2. Email address
3. Phone number
4. Brand or company name
5. Country

#### Section B: Product overview
6. Product type
7. Product goal

#### Section C: Formula direction
8. Formula direction
9. Ingredients and dosages if known

#### Section D: Commercial detail
10. Target quantity
11. Pack size
12. Packaging preference
13. Budget positioning
14. Target market
15. Launch timeline

#### Section E: Support needed
16. Needs formulation help
17. Needs packaging or label help
18. Extra notes

### Conditional logic
Show “Ingredients and dosages if known” only when formula direction indicates the user already has a formula or has ingredients in mind.

---

## 12. Public Experience Design

### Public page goal
Help prospects complete a serious product request quickly and confidently.

### Public page structure
1. Workspace branding
2. Clear headline
3. Short explanatory text
4. Dynamic structured form
5. Reassurance text
6. Submit action
7. Success confirmation

### Headline recommendation
Tell us what you want to create

### Intro recommendation
Give us the key details of your product idea and we’ll review your brief and come back with the best next step for formulation and manufacturing.

### UX rules
1. Mobile first form layout
2. Clear field labels
3. Minimal clutter
4. Helpful placeholders
5. Logical grouping
6. Progress feels short and manageable
7. Submit success state is clear and calm

---

## 13. Internal App Design

### App goal
Make it easy for internal users to move an opportunity from incoming request to sent quote.

### Navigation
The authenticated app should include:

1. Dashboard
2. Opportunities
3. Requests
4. Contacts
5. Forms
6. Workspace Settings
7. Team Settings

### Design style
1. Clean SaaS interface
2. Light neutral background
3. Clear cards and panels
4. Strong spacing rhythm
5. Minimal visual noise
6. Use badges for stage and status
7. Fast to scan and operate

---

## 14. Screen Specs

## 14.1 Dashboard

### Purpose
Provide a quick operational overview.

### Must show
1. Opportunity counts by stage
2. Recent requests
3. Recent activity
4. Quick links into active work

### Key actions
1. View opportunities
2. View new requests
3. Create manual opportunity if needed

---

## 14.2 Opportunities List

### Purpose
Primary working inbox for quote jobs.

### Columns
1. Ref code
2. Title
3. Contact
4. Company
5. Stage
6. Priority
7. Owner
8. Last updated

### Filters
1. Stage
2. Owner
3. Priority
4. Search by ref code, contact, or company

### Behaviour
Clicking a row opens the opportunity detail page.

---

## 14.3 Opportunity Detail

### Purpose
Main working screen for the full request to quote process.

### Layout
Use a header plus tab structure.

### Header content
1. Ref code
2. Opportunity title
3. Stage selector
4. Owner selector
5. Priority
6. Quick actions

### Tabs
1. Overview
2. Raw Request
3. Structured Requirement
4. Supplier RFQs
5. Supplier Responses
6. Customer Quotes
7. Activity

---

## 14.4 Opportunity Overview Tab

### Must show
1. Contact summary
2. Company summary
3. Key requirement summary
4. Current stage
5. Latest supplier response summary
6. Latest quote summary
7. Internal notes snapshot

### Goal
Provide a quick summary without forcing the user to dig into each tab.

---

## 14.5 Raw Request Tab

### Purpose
Preserve and display the original submission exactly as the prospect entered it.

### Rules
1. Read only
2. Easy to scan
3. Clearly labelled by field
4. Show submission date and source
5. Show uploaded files if present

---

## 14.6 Structured Requirement Tab

### Purpose
Turn the raw request into a clean quotable brief.

### Supplement Lab fields
1. Product type
2. Format
3. Target benefit
4. Market
5. Quantity units
6. Pack size
7. Packaging type
8. Formulation support needed
9. Target positioning
10. Timeline
11. Flexible requirement JSON support
12. Cleaned summary

### UX rules
1. Split into logical sections
2. Save changes quickly
3. Keep the cleaned summary visible
4. Make this the main operational editing area

---

## 14.7 Supplier RFQs Tab

### Purpose
Create and manage outbound supplier pricing requests.

### Must support
1. New RFQ
2. Edit RFQ draft
3. Duplicate RFQ
4. Mark RFQ sent
5. View status

### RFQ fields
1. Supplier name
2. Supplier contact name
3. Supplier email
4. RFQ subject
5. RFQ body
6. Status
7. Sent timestamp

### UX rules
1. Prefill from structured requirement where possible
2. Keep the edit flow quick
3. Allow copyable text output

---

## 14.8 Supplier Responses Tab

### Purpose
Capture pricing and commercial details from suppliers.

### Must support
1. Add response
2. Edit response
3. Mark preferred response
4. Compare multiple responses at a glance

### Response fields
1. MOQ
2. Unit price
3. Currency
4. Tooling cost
5. Formulation cost
6. Lead time in days
7. Shipping notes
8. Compliance notes
9. Response notes
10. Raw supplier response text

### UX rules
1. Easy data entry
2. Preferred response clearly marked
3. Pricing visible without opening every record

---

## 14.9 Customer Quotes Tab

### Purpose
Build outward facing quotes for the prospect.

### Must support
1. New quote
2. Prefill from preferred supplier response
3. Save draft
4. Mark sent
5. Versioning

### Quote fields
1. Quote number
2. Version number
3. Title
4. Currency
5. Unit price
6. MOQ
7. Estimated lead time days
8. Included items
9. Assumptions
10. Quote notes
11. Valid until
12. Status

### UX rules
1. Quote should feel clean and professional
2. Make version numbers obvious
3. Keep assumptions and notes easy to edit

---

## 14.10 Activity Tab

### Purpose
Provide an audit trail of meaningful actions.

### Show entries for
1. Request created
2. Opportunity created
3. Stage changed
4. Structured requirement updated
5. RFQ created
6. RFQ marked sent
7. Supplier response logged
8. Quote created
9. Quote marked sent
10. Opportunity marked won or lost

### Format
Chronological timeline with actor, action, and timestamp.

---

## 14.11 Requests List

### Purpose
Show raw inbound submissions independent of opportunity workflow.

### Columns
1. Submission date
2. Contact
3. Company
4. Source
5. Linked opportunity
6. Status

---

## 14.12 Contacts List

### Purpose
Provide a basic contact directory tied to opportunities.

### Must show
1. Name
2. Email
3. Company
4. Country
5. Related opportunity count

This should stay lightweight in V1.

---

## 14.13 Forms List

### Purpose
Manage hosted form templates by workspace.

### Must show
1. Form name
2. Slug
3. Status
4. Updated at

### Actions
1. Open form settings
2. Preview hosted form

---

## 14.14 Form Settings

### Purpose
Allow workspace users to manage the public form template.

### V1 functionality
1. Edit headline
2. Edit intro text
3. Edit success message
4. Enable or disable fields
5. Change field labels
6. Change required state
7. Change field order
8. Configure options
9. Configure simple conditional logic

This does not need to be drag and drop in V1.

---

## 14.15 Workspace Settings

### Purpose
Manage tenant level defaults.

### Fields
1. Workspace name
2. Slug
3. Industry type
4. Brand name
5. Default currency
6. Quote prefix
7. Primary colour
8. Logo URL

---

## 14.16 Team Settings

### Purpose
Manage workspace members and roles.

### Must support
1. View team members
2. Invite team member placeholder flow if implemented
3. Update role
4. Remove member if needed

---

## 15. Data and Architecture Rules

1. All tenant data must be scoped by workspace_id  
2. Supplement specific logic must stay in template configuration and requirement UI  
3. Do not hardcode supplement language into the global data model  
4. Use structured data where possible  
5. Preserve raw request data exactly as submitted  
6. Quotes and RFQs must be tied to an opportunity  
7. Every important action must be logged in activity

---

## 16. Naming Rules

### Opportunity ref code
Use workspace specific prefixed format.

For Supplement Lab:
SL0001
SL0002
SL0003

### Quote number
Use workspace specific quote number format.

For Supplement Lab:
SL-Q-0001-V1

Version should increment on quote revision.

---

## 17. Validation and Error Handling

### Public form
1. Required fields enforced
2. Email format validated
3. Clear inline errors
4. Friendly failure state
5. No data loss on validation failure

### Internal app
1. Required operational fields validated
2. Stage changes checked
3. Won and lost stage requires outcome reason
4. Quote data must be structurally valid before save

---

## 18. Files and Attachments

### V1 support
Allow optional file attachments for public requests and internal opportunities.

### Rules
1. Link files to request or opportunity
2. Show files in raw request or overview where relevant
3. Keep upload experience simple
4. Restrict to sensible document and image types

---

## 19. Mobile and Responsive Behaviour

### Public form
Must be strongly mobile friendly.

### Internal app
Must be usable on laptop and tablet.
Mobile admin use is nice to have but not the design priority.

### Responsive rules
1. Tables should degrade gracefully
2. Tabs should remain usable on narrow widths
3. Forms should stack cleanly
4. Buttons should stay accessible

---

## 20. Accessibility Rules

1. Use semantic labels
2. Inputs must be keyboard accessible
3. Error states must be visible
4. Colour should not be the only status signal
5. Buttons and links should have clear text

---

## 21. Success Criteria

Crystl V1 design is considered successfully implemented when:

1. A public user can submit a Supplement Lab request
2. The request becomes a contact, request, and opportunity
3. The internal team can review the raw request
4. The internal team can structure the requirement
5. The internal team can create supplier RFQs
6. The internal team can log supplier responses
7. The internal team can build a customer quote
8. The opportunity can be progressed to won or lost
9. All of this works inside a workspace scoped system
10. The design feels clear, practical, and production usable

---

## 22. Future Expansion Path

This design should support later expansion into full Crystl without structural rewrite.

Future directions may include:
1. AI requirement clarification
2. AI quote drafting
3. Industry specific templates
4. Supplier comparison views
5. Customer portal
6. PDF quote generation
7. Email workflows
8. Analytics and conversion reporting

These are not part of V1.

---

## 23. Final Product Positioning

Crystl V1 is a request to quote workspace.

It helps businesses turn vague enquiries into clear, quotable opportunities.

Supplement Lab is the first live template, not the limit of the product.

# Product Requirements Document (PRD)

**Product:** Campus Lost & Found Management System  
**Version:** 1.0  
**Status:** Course-project baseline  
**Task issue:** [#2 — Add project PRD, SRS, and TDD documentation](https://github.com/Ishmam2222/Campus-Lost-Found-Management-System/issues/2)  
**Pull request:** Pending

## 1. Product summary

The Campus Lost & Found Management System is a web application for a campus
community to publish lost-item notices, report found property, and coordinate
the return of items. It uses a React.js and TypeScript frontend, a FastAPI
Python backend, and REST APIs. The application must authenticate users and
enforce role-based permissions and security scopes on the server.

The repository currently contains the full-stack starter and API connectivity
examples. The workflows and requirements in this document describe the
intended course-project product; they are not claims that those features have
already been implemented.

## 2. Problem and opportunity

Lost-property information is often scattered across informal chats, notice
boards, and in-person inquiries. This makes it hard to find current reports,
contact the right person, and safely verify a claimant. A shared, searchable
system can make reports easier to discover while keeping claimant details and
administrative actions appropriately restricted.

## 3. Goals

- Give campus members one place to create and find lost- and found-item reports.
- Support a clear, auditable claim and return-coordination workflow.
- Protect report ownership and account data through authentication,
  authorization, RBAC, and permission scopes.
- Demonstrate end-to-end integration between a typed React frontend and
  documented FastAPI REST endpoints.
- Provide administrators with narrowly scoped moderation capabilities.

## 4. Users and roles

| User | Needs |
| --- | --- |
| Visitor | Understand the service and sign in or register. |
| Campus member | Search reports, manage their own reports, and submit or manage claims. |
| Administrator | Review reports and claims that require moderation and manage access where necessary. |

The first release assumes a single campus and two application roles:
`member` and `admin`. Campus affiliation verification, additional roles, and
integration with institutional identity providers are outside the initial
scope unless the course team approves them.

## 5. Scope

### In scope

- Account registration, login, and logout.
- Create and manage a lost-item or found-item report.
- Browse and filter open reports by type, category, and location.
- Submit and track a claim against a found-item report.
- Let the found-item reporter review claims and mark a report resolved.
- Admin moderation of inappropriate reports and claims.
- Server-side role and scope enforcement for protected operations.
- Responsive user interface, REST API validation, and automated tests.

### Out of scope for the initial release

- Payments, shipping, or automated identity-provider integration.
- Automated image recognition or automatic lost/found matching.
- Public display of private contact information.
- Native mobile applications, real-time chat, and push notifications.
- Photo upload, unless storage, retention, and abuse controls are separately
  designed and approved.

## 6. Primary user journeys

1. **Find a report:** A visitor or member opens the report list, filters by
   lost/found type, category, or location, and views a report's public details.
2. **Publish a report:** A signed-in member submits a validated report. The
   report is associated with that member and appears as open.
3. **Claim found property:** A signed-in member submits a claim with
   non-sensitive identifying details. The reporter reviews it privately and
   approves or rejects it.
4. **Complete a return:** After arranging the handoff, the reporter marks the
   found report resolved. The report is no longer presented as open.
5. **Moderate content:** An administrator reviews reported or inappropriate
   content and takes an authorized action. The action is recorded for audit.

## 7. Product requirements

- Provide a consistent, responsive interface for registration, authentication,
  report discovery, report management, and claims.
- Clearly distinguish lost reports from found reports and open reports from
  resolved or archived reports.
- Keep claim descriptions and account contact details visible only to
  authorized participants and administrators.
- Show users actionable validation and authorization errors without exposing
  stack traces or internal data.
- Make protected actions unavailable in the interface when the current user's
  permissions do not allow them; the backend remains the authority.
- Provide API documentation and a health endpoint for development and
  deployment checks.

## 8. Success criteria

- A member can register, log in, create a report, find it in the list, edit or
  close their own report, and cannot modify another member's report.
- A member can submit a claim against a found report; only the report owner or
  an authorized administrator can review it.
- Requests without valid authentication or the required permission are rejected
  by the API, including requests made outside the UI.
- The frontend builds with TypeScript checks enabled, and backend tests cover
  successful and denied access paths.
- The core flows work through the browser against the FastAPI service without
  hard-coded cross-origin production URLs.

## 9. Risks and assumptions

- The course brief does not specify campus identity verification. The initial
  design treats registration as application-level identity and should not be
  represented as institutional verification.
- Users may submit misleading or sensitive descriptions. Validation, moderation,
  privacy-conscious defaults, and a report-resolution path are required.
- A lost-and-found application may attract spam or fraudulent claims.
  Rate-limiting, audit records, and moderation are recommended before public
  deployment.
- Product details such as retention duration and whether visitors may browse
  reports should be confirmed with the instructor or project stakeholders.

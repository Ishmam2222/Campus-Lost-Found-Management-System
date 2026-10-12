# Product Requirements Document (PRD)

**Product:** Campus Lost & Found Management System  
**Version:** 1.1
**Status:** Course-project plan
**Task issue:** [#2 — Add project PRD, SRS, and TDD](https://github.com/Ishmam2222/Campus-Lost-Found-Management-System/issues/2)
**Pull request:** [#3 — Add project PRD, SRS, and TDD](https://github.com/Ishmam2222/Campus-Lost-Found-Management-System/pull/3)

## 1. Product summary

The Campus Lost & Found Management System gives a campus community one place
to publish, find, and manage lost- and found-item reports. It uses a React and
TypeScript web frontend and a Python FastAPI REST backend.

The work is split into two course milestones. **MVP** demonstrates report CRUD
through REST APIs with the application running locally. **Beta** builds on
that foundation with authentication, roles/RBAC, a user profile dashboard,
security scopes/permissions, and deployment. The current repository is a
framework scaffold; the report and account workflows in this document are
planned work.

## 2. Problem

Lost-item information is often scattered across chats, notice boards, and
in-person inquiries. This makes reports difficult to find and keep current.
A simple shared catalog can help campus members publish and search reports;
later access controls can protect accounts and administrative actions.

## 3. Goals and non-goals

### Goals

- **[MVP]** Demonstrate a complete, locally runnable React + TypeScript and
  FastAPI + Python application.
- **[MVP]** Let users create, view, update, and delete lost/found reports
  through REST APIs.
- **[Beta]** Authenticate users and enforce member/admin roles and permissions
  on the backend.
- **[Beta]** Provide an authenticated user profile dashboard and deploy the
  application for the final demo.

### Non-goals

- **[MVP and Beta]** Payments, shipping, live chat, native mobile apps,
  automatic image matching, and institutional SSO.
- **[MVP and Beta]** Photo upload. It can be considered later if storage,
  privacy, and abuse controls are designed.
- **[MVP and Beta]** A large moderation or notification platform. Keep the
  assignment focused on report CRUD and the specified Beta requirements.

## 4. Users

| User | MVP | Beta |
| --- | --- | --- |
| Campus member | Uses the locally running report catalog. MVP does not require an account. | Registers/signs in, manages a profile, and uses permitted report functions. |
| Administrator | Not part of MVP. | Uses administrator-only functions governed by RBAC and scopes. |

The application is for one campus. Institutional identity verification is
outside the planned scope.

## 5. Release scope and features

### MVP — mid-term demo

- **[MVP]** Run the frontend and backend locally.
- **[MVP]** Create a lost or found report with title, description, category,
  location, and type.
- **[MVP]** List and view reports; filter by report type and category.
- **[MVP]** Update and delete a report through REST endpoints.
- **[MVP]** Validate input and show loading, success, empty, and error states.
- **[MVP]** Store report data in a local development database.
- **[MVP]** Document and test the REST API.
- **[MVP]** No login, roles, permissions, production deployment, or claims
  workflow is required for this milestone.

### Beta — final demo

- **[Beta]** Register, log in, and log out.
- **[Beta]** Assign `member` and `admin` roles through trusted server-side
  administration; public registration must never grant admin access.
- **[Beta]** Enforce RBAC, security scopes/permissions, and report ownership
  in FastAPI endpoints.
- **[Beta]** Provide a profile dashboard for the signed-in user and their
  reports.
- **[Beta]** Deploy the integrated frontend and backend.
- **[Beta]** Configure secrets and production HTTPS without committing
  credentials.

## 6. Primary user journeys

1. **[MVP] Create a report:** A user submits a report in the web form; the
   frontend sends it to FastAPI; the validated report is saved and appears in
   the report list.
2. **[MVP] Find and maintain reports:** A user browses/filters reports, opens
   a detail view, edits a report, or deletes it.
3. **[Beta] Sign in and manage profile:** A member registers or logs in,
   opens their dashboard, and views their own profile and reports.
4. **[Beta] Enforce permissions:** A member makes an authorized request; a
   request without authentication or the necessary scope is rejected by the
   API, even if issued outside the UI.
5. **[Beta] Demonstrate deployment:** A user accesses the deployed application
   over HTTPS and the frontend communicates with the backend through the
   configured API routes.

## 7. Product requirements

- **[MVP]** Keep the report workflow small enough to complete and demonstrate
  locally by the mid-term.
- **[MVP]** Use React + TypeScript for the interface and FastAPI + Python for
  REST endpoints.
- **[MVP]** Keep report data and forms consistent between the frontend and
  backend.
- **[Beta]** Make the backend the authority for authentication, roles,
  permissions, and ownership checks.
- **[Beta]** Show profile and report information appropriate to the signed-in
  user.
- **[Beta]** Deploy the application without exposing secrets in source or
  browser code.

## 8. Success criteria

- **[MVP]** The app runs locally using documented commands.
- **[MVP]** Create, read, update, and delete report operations work end to end
  through the browser and REST API.
- **[MVP]** Invalid report input is rejected and the UI displays an error
  instead of falsely reporting success.
- **[Beta]** Missing/invalid credentials receive `401`; authenticated users
  lacking permission receive `403`.
- **[Beta]** A member cannot use the API to access or change another member's
  protected profile/report data.
- **[Beta]** Admin-only operations require the appropriate role and scope.
- **[Beta]** The final demonstration is available from the deployed app over
  HTTPS.

## 9. Risks and assumptions

- **[MVP]** Local persistence technology should remain easy to run for the
  mid-term demo; deployment-grade data storage is not a prerequisite.
- **[Beta]** Role assignment must use a trusted administrative path, not a
  user-editable registration field.
- **[Beta]** Hosting configuration and database availability must be confirmed
  before final deployment.
- **[MVP and Beta]** The project does not verify institutional affiliation.
- **[MVP and Beta]** Keep personal contact details out of public report
  responses unless an explicit privacy decision is made.

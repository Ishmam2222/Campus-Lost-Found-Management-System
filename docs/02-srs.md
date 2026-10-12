# Software Requirements Specification (SRS)

**Product:** Campus Lost & Found Management System  
**Version:** 1.1
**Status:** Course-project plan
**Task issue:** [#2 — Add project PRD, SRS, and TDD documentation](https://github.com/Ishmam2222/Campus-Lost-Found-Management-System/issues/2)  
**Pull request:** [#3 — Add project PRD, SRS, and TDD](https://github.com/Ishmam2222/Campus-Lost-Found-Management-System/pull/3)

## 1. Purpose and scope

This specification defines testable requirements for the course project. The
system uses a React + TypeScript frontend and a FastAPI + Python REST backend.
Requirements are marked **MVP** for the locally running mid-term demo or
**Beta** for the final demo. The repository currently has only the framework
scaffold and API connectivity examples; these feature requirements are not
claims of completed functionality.

## 2. Users and operating environment

- **[MVP] User:** An unauthenticated local user who manages catalog reports.
- **[Beta] Member:** An authenticated user who has member permissions and a
  profile dashboard.
- **[Beta] Administrator:** An authenticated user with additional
  administrator permissions.
- **[MVP] Environment:** Frontend and FastAPI backend run locally; the
  frontend calls the backend through the Vite `/api` proxy.
- **[Beta] Environment:** The integrated application is deployed and accessed
  over HTTPS.

## 3. Functional requirements

### 3.1 Report management

- **FR-MVP-01:** The system shall allow a user to create a lost or found report
  with a type, title, description, category, and location.
- **FR-MVP-02:** The system shall validate required fields, maximum lengths,
  and allowed report types before storing a report.
- **FR-MVP-03:** The system shall list reports and allow filtering by type and
  category.
- **FR-MVP-04:** The system shall return an individual report by its identifier.
- **FR-MVP-05:** The system shall allow a user to update an existing report.
- **FR-MVP-06:** The system shall allow a user to delete an existing report.
- **FR-MVP-07:** Report create, read, update, and delete actions shall be
  available as REST API operations and usable from the React frontend.
- **FR-MVP-08:** The frontend shall show loading, empty, success, and error
  states for report operations; failed requests shall not appear successful.
- **FR-MVP-09:** Report operations and the frontend/backend integration shall
  work in local development without requiring user accounts.

### 3.2 Authentication and account management

- **FR-BETA-01:** The system shall allow an account to register with a unique,
  normalized email and password.
- **FR-BETA-02:** The system shall authenticate valid credentials and reject
  invalid credentials without revealing whether an email is registered.
- **FR-BETA-03:** The system shall provide logout that clears the active
  frontend authentication state.
- **FR-BETA-04:** The system shall provide an authenticated profile dashboard
  displaying the current user's safe profile data and reports.
- **FR-BETA-05:** The system shall reject requests with missing, malformed,
  expired, or otherwise invalid credentials.
- **FR-BETA-06:** Public registration shall assign only the `member` role.
  Role elevation shall require a trusted administrative mechanism.

### 3.3 Authorization, RBAC, and scopes

- **FR-BETA-07:** The system shall define `member` and `admin` roles and map
  each role to server-controlled security scopes.
- **FR-BETA-08:** Every protected endpoint shall enforce required scopes on
  the backend independently of frontend visibility or client-provided role
  data.
- **FR-BETA-09:** Protected report operations shall verify the user's
  permission and, where applicable, ownership of the report.
- **FR-BETA-10:** The system shall return `401 Unauthorized` for unauthenticated
  protected requests and `403 Forbidden` for authenticated requests without
  sufficient permission.

### 3.4 Deployment

- **FR-BETA-11:** The system shall be deployable with frontend and backend
  routes integrated so that browser API calls use the configured `/api` path.
- **FR-BETA-12:** Production access shall use HTTPS.
- **FR-BETA-13:** Deployment secrets shall be configured outside source
  control and shall not be included in frontend bundles.

## 4. Role and scope matrix

The backend is authoritative. A scope is a permission, not a role; a resource
ownership check may further restrict an operation.

| Role | Release | Proposed scopes |
| --- | --- | --- |
| Local user (no account) | MVP | No authentication scopes; local report CRUD only |
| `member` | Beta | `profile:read:own`, `items:read`, `items:create`, `items:update:own`, `items:delete:own` |
| `admin` | Beta | Member scopes plus `items:read:any`, `items:update:any`, `items:delete:any`, `users:manage` |

## 5. Interface requirements

- **[MVP]** The React frontend shall call FastAPI through relative `/api`
  paths, with Vite proxying requests during local development.
- **[MVP]** Requests and responses shall use JSON, with Pydantic schemas
  defining backend input validation.
- **[MVP]** The REST API shall use standard HTTP methods and status codes and
  expose OpenAPI documentation during development.
- **[Beta]** Protected API requests shall carry the configured authentication
  credential; frontend route guards shall be treated only as a usability aid.
- **[Beta]** The deployed frontend and backend shall communicate through
  configured routes over HTTPS.

## 6. Non-functional requirements

- **NFR-MVP-01 [MVP]:** The local setup shall be documented and small enough
  to start without production hosting credentials.
- **NFR-MVP-02 [MVP]:** Backend request and response data shall use typed
  schemas; invalid input shall produce a client error and no successful
  mutation.
- **NFR-MVP-03 [MVP]:** User-entered text shall be rendered as text, not
  trusted HTML.
- **NFR-BETA-01 [Beta]:** Passwords shall be stored only as hashes produced by
  a maintained adaptive password-hashing library.
- **NFR-BETA-02 [Beta]:** Signing keys and deployment credentials shall be
  read from protected environment configuration and never committed.
- **NFR-BETA-03 [Beta]:** All production traffic shall use HTTPS.
- **NFR-BETA-04 [Beta]:** Authorization shall follow least privilege and be
  tested for allowed and denied access, including cross-user resource access.
- **NFR-BETA-05 [Beta]:** API responses shall not disclose passwords, tokens,
  signing keys, or profile data the requester is not allowed to see.
- **NFR-BETA-06 [Beta]:** CORS, if needed, shall use explicitly configured
  origins; wildcard origins shall not be combined with credentials.
- **NFR-BETA-07 [Beta]:** The production app shall report dependency and
  request failures clearly without exposing stack traces to users.

## 7. Data and validation rules

- **[MVP]** A report shall have a unique identifier and required type, title,
  description, category, and location.
- **[MVP]** Report type shall be `lost` or `found`.
- **[MVP]** Text fields shall have documented maximum lengths and be validated
  by the backend.
- **[Beta]** An account email shall be normalized and unique; account role
  shall be controlled by the server.
- **[Beta]** A profile response shall exclude password hashes and other
  authentication secrets.

## 8. Acceptance tests

1. **[MVP]** Create a report through the frontend and confirm it appears in the
   list and its detail endpoint.
2. **[MVP]** Update a report and verify the returned and listed data reflect
   the change.
3. **[MVP]** Delete a report and verify it is no longer returned.
4. **[MVP]** Submit an invalid report and verify the API rejects it without
   creating or partially changing a record.
5. **[Beta]** Register and log in; verify invalid credentials are rejected and
   the profile dashboard shows only the authenticated user's permitted data.
6. **[Beta]** Attempt protected requests without a token and with insufficient
   scopes; verify `401` and `403` respectively.
7. **[Beta]** Attempt to modify another member's protected report and verify
   the backend denies the request.
8. **[Beta]** Verify admin-only permissions are unavailable to a member,
   including when the member directly calls the API.
9. **[Beta]** Verify the deployed site uses HTTPS and no secret is present in
   the frontend bundle.

## 9. Traceability

| Course goal | Requirements |
| --- | --- |
| React + TypeScript frontend | FR-MVP-07 to FR-MVP-09; MVP interface requirements |
| FastAPI + Python REST backend | FR-MVP-01 to FR-MVP-07; MVP interface requirements |
| Authentication | FR-BETA-01 to FR-BETA-06 |
| Roles and RBAC | FR-BETA-06 to FR-BETA-10 |
| Security scopes/permissions | FR-BETA-07 to FR-BETA-10; NFR-BETA-04 |
| Profile dashboard | FR-BETA-04 |
| Deployment | FR-BETA-11 to FR-BETA-13 |

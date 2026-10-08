# Software Requirements Specification (SRS)

**Product:** Campus Lost & Found Management System  
**Version:** 1.0  
**Status:** Course-project baseline  
**Task issue:** [#2 — Add project PRD, SRS, and TDD documentation](https://github.com/Ishmam2222/Campus-Lost-Found-Management-System/issues/2)  
**Pull request:** Pending

## 1. Purpose and scope

This specification defines the expected behavior and quality attributes of the
Campus Lost & Found Management System. The target implementation is a
TypeScript/React single-page application backed by a Python/FastAPI REST API.
Requirements describe the planned course-project product; the repository
currently provides a starter scaffold rather than these complete workflows.

The system supports campus members publishing and discovering lost/found
reports, coordinating claims, and administrators moderating content. It must
enforce authentication and authorization on the backend using roles and
security scopes.

## 2. User classes

- **Visitor:** Unauthenticated user. May view public report summaries and
  authentication pages.
- **Member:** Authenticated user who can create reports, manage their own
  reports, and submit claims.
- **Administrator:** Authenticated user with moderation permissions in
  addition to member capabilities where appropriate.

Administrative privileges must not be granted through public registration.

## 3. Functional requirements

### Authentication and accounts

- **FR-AUTH-01:** The system shall allow a user to register with a unique email
  address and password, and shall reject invalid or duplicate account data.
- **FR-AUTH-02:** The system shall authenticate credentials and return an
  expiring access token on success. Invalid credentials shall not reveal
  whether a particular email address has an account.
- **FR-AUTH-03:** The system shall provide a logout action that clears the
  frontend's active token. Because access tokens are stateless, logout shall
  not be represented as server-side token revocation unless a revocation
  mechanism is implemented.
- **FR-AUTH-04:** Passwords shall never be stored or returned in plaintext.
- **FR-AUTH-05:** The system shall reject requests using expired, malformed, or
  invalidated credentials.

### Reports

- **FR-ITEM-01:** A member shall create a report with type (`lost` or `found`),
  title, description, category, location, and an optional occurrence date.
- **FR-ITEM-02:** The system shall validate required fields, field lengths, and
  allowed enum values before storing a report.
- **FR-ITEM-03:** Users shall browse and filter reports by type, category,
  location, and status. List endpoints shall be paginated.
- **FR-ITEM-04:** A member shall view and update their own reports. A member
  shall not update another member's report.
- **FR-ITEM-05:** A report owner or authorized administrator shall be able to
  change report status to resolved or archived.
- **FR-ITEM-06:** Public report responses shall not expose the owner's email,
  private contact details, or internal moderation data.

### Claims

- **FR-CLAIM-01:** An authenticated member shall submit a claim for an open
  found-item report with a description of identifying details.
- **FR-CLAIM-02:** The system shall prevent a member from reviewing their own
  claim and shall enforce the defined duplicate-claim policy.
- **FR-CLAIM-03:** Only the found-report owner or an administrator with the
  appropriate scope shall view private claim details and approve or reject a
  claim.
- **FR-CLAIM-04:** Claim status shall be one of `pending`, `approved`,
  `rejected`, or `withdrawn`, and only permitted state transitions shall be
  accepted.
- **FR-CLAIM-05:** The system shall preserve the association between a claim,
  its claimant, and the report it concerns.

### Administration and authorization

- **FR-AUTHZ-01:** The system shall assign each account a server-controlled
  role. Public registration shall create only a `member` account.
- **FR-AUTHZ-02:** The API shall check required scopes for protected
  operations and shall perform ownership checks for user-owned resources.
- **FR-AUTHZ-03:** The system shall restrict moderation operations to
  administrators with the required moderation scope.
- **FR-AUTHZ-04:** The system shall record administrative moderation actions
  with actor, target, action, and timestamp.
- **FR-AUTHZ-05:** The frontend shall adapt available actions to the current
  user's permissions, but the API shall independently enforce every access
  decision.

### API and integration

- **FR-API-01:** The frontend shall communicate with the backend through
  same-origin `/api` REST endpoints in development and production.
- **FR-API-02:** The API shall use JSON request and response bodies except
  where standard HTTP semantics require otherwise.
- **FR-API-03:** The API shall return appropriate HTTP status codes and
  consistent error details; invalid request data shall not result in a
  successful response.
- **FR-API-04:** The service shall expose OpenAPI documentation and a health
  check endpoint.

## 4. Roles and security scopes

Scopes are permissions, not user-selectable role names. The server determines
the scope set from the account's assigned role and checks scopes on each
protected endpoint.

| Role | Initial scope set |
| --- | --- |
| `member` | `items:read`, `items:create`, `items:update:own`, `items:close:own`, `claims:create`, `claims:read:own` |
| `admin` | Member capabilities plus `items:moderate`, `claims:moderate`, `users:manage`, `audit:read` |

Resource ownership remains a separate check even when a general scope is
present. A user must not gain access to a resource by changing a client-side
role or request body. The final scope catalog may be refined during
implementation, but changes must preserve least privilege and be documented.

## 5. External interface requirements

### Web interface

- The frontend shall support current evergreen desktop and mobile browsers.
- Forms shall label inputs, expose validation messages to assistive technology,
  and indicate loading, success, empty, and error states.
- Authentication state shall not be inferred from client-provided role values.

### REST API

- API paths shall be versioned or kept under a stable `/api` prefix.
- Protected requests shall authenticate using the chosen token transport and
  shall return `401 Unauthorized` for missing/invalid credentials and
  `403 Forbidden` for insufficient permissions.
- Validation errors shall return `422 Unprocessable Entity` with field-level
  details where applicable.
- List responses shall have a documented pagination contract.

## 6. Non-functional requirements

- **NFR-SEC-01:** Passwords shall be hashed with a modern adaptive password
  hashing algorithm, such as Argon2id, using a maintained library.
- **NFR-SEC-02:** Signing keys, database credentials, and deployment secrets
  shall be provided through environment configuration and never committed.
- **NFR-SEC-03:** All production traffic shall use HTTPS. Deployment shall
  restrict cross-origin access; local development may use the Vite proxy.
- **NFR-SEC-04:** Inputs shall be validated and database access shall use
  parameterized ORM queries. Responses shall not disclose secrets or
  unnecessary personal data.
- **NFR-SEC-05:** Authorization checks shall be tested for both allowed and
  denied cases, including direct API requests and cross-user resource access.
- **NFR-PRIV-01:** Private claim details and account contact information shall
  be disclosed only to authorized participants and administrators.
- **NFR-REL-01:** Errors from API dependencies shall be visible as an error
  state; the UI shall not silently present failed operations as successful.
- **NFR-MAINT-01:** Frontend code shall pass TypeScript type checking and
  backend code shall use typed request/response schemas.
- **NFR-TEST-01:** Automated tests shall cover core report and claim workflows,
  authentication, scope enforcement, and ownership rules.
- **NFR-DEPLOY-01:** The application shall be configurable for local
  development and the intended hosting environment without committing
  environment-specific secrets.

## 7. Data and validation constraints

- Account email shall be normalized and unique.
- Report type and lifecycle state shall use enumerated values.
- A report must have an owner; a claim must reference an existing found report
  and a claimant.
- Dates shall use an unambiguous ISO 8601 representation at the API boundary.
- User-entered text shall have documented maximum lengths and be rendered as
  text, not trusted HTML.
- Deletion and retention behavior shall be specified before production use;
  the initial baseline favors status-based archival and preserves audit events.

## 8. Acceptance tests

1. Register two members, create a report as one, and verify the other member
   cannot edit or close it.
2. Send a protected request without a token and verify a `401`; send a valid
   token without the required scope and verify a `403`.
3. Create a found report, submit a claim from a second account, and verify that
   only the report owner or an appropriately scoped admin can review it.
4. Verify list filters and pagination return only matching reports and do not
   reveal private contact or claim information.
5. Verify that invalid payloads produce validation errors and do not create
   partial records.
6. Exercise the above paths through API tests and at least one browser-level
   frontend-to-backend flow.

## 9. Traceability

| Product goal | Requirements |
| --- | --- |
| Discover and manage lost/found reports | FR-ITEM-01 through FR-ITEM-06 |
| Coordinate a safe item return | FR-CLAIM-01 through FR-CLAIM-05 |
| Demonstrate authentication and RBAC | FR-AUTH-01 through FR-AUTH-05; FR-AUTHZ-01 through FR-AUTHZ-05 |
| Demonstrate integrated React and FastAPI | FR-API-01 through FR-API-04 |
| Protect user data and API access | NFR-SEC-01 through NFR-SEC-05; NFR-PRIV-01 |

**Tracking issue:** [#2](https://github.com/Ishmam2222/Campus-Lost-Found-Management-System/issues/2)  
**Documentation pull request:** Pending

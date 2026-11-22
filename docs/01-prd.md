# Product Requirements Document (PRD)
## Campus Lost & Found Management System

| **Field** | **Details** |
|---|---|
| Product | Campus Lost & Found Management System |
| Releases | MVP (Mid-term) and Beta (Final) |
| Status | Draft |
| Related Documents | SRS, TDD |
| Frontend | React with TypeScript |
| Backend | FastAPI with Python |

---

## 1. Purpose

Campus Lost & Found is a web-based application designed to help campus members report lost and found items and easily access information about reported belongings.

The frontend will be developed using **React with TypeScript**, while the backend will use **FastAPI with Python**.

The project will be developed in two releases:

- **MVP (Mid-term):** A basic application that supports lost-and-found report management and runs locally.
- **Beta (Final):** An enhanced version that introduces authentication, user profiles, role-based permissions, security scopes, and deployment.

## 2. Problem Statement

Information about lost and found items is often shared through group chats, social media, or physical notice boards. This makes it difficult for students to find relevant information and keep track of reported items.

Campus Lost & Found aims to solve this problem by providing a centralized platform where campus members can create, browse, view, update, and manage lost-and-found reports.

## 3. Project Goals

| Goal | Release |
|---|---|
| Create, view, update, and delete lost-and-found reports through REST APIs. | MVP |
| Run the frontend and backend locally as an integrated application. | MVP |
| Implement user authentication and a profile dashboard. | Beta |
| Introduce member and admin roles with permission checks. | Beta |
| Implement security scopes to protect API operations. | Beta |
| Deploy the application for the final demonstration. | Beta |

## 4. Target Users

| User | Description | Release |
|---|---|---|
| Campus Member | Can create, browse, and view lost-and-found reports. | MVP |
| Registered Member | Can sign in and manage their profile and own reports. | Beta |
| Administrator | Can manage reports and perform authorized administrative actions. | Beta |

### 4.1 User Stories

**MVP**

- As a campus member, I want to create a lost or found report so that others can find information about the item.
- As a campus member, I want to browse and view reports so that I can search for lost belongings.
- As a campus member, I want to update or delete a report so that I can correct or remove outdated information.

**Beta**

- As a member, I want to register and sign in so that I can access my personal account.
- As a member, I want to view my profile and reports through a dashboard so that I can manage my information.
- As an administrator, I want administrative permissions so that I can manage reports and users.
- As a member, I want the API to restrict unauthorized actions so that my account and the application remain secure.

## 5. Project Scope

### 5.1 MVP — Mid-term Release

The MVP will focus on the core lost-and-found report management functionality.

**Included Features:**

- Create lost and found reports.
- List and browse available reports.
- View individual report details.
- Update existing reports.
- Delete reports.
- Validate report information and return clear API error messages.
- Integrate the React frontend with the FastAPI REST API.
- Run the application locally.

**Limitations:**

- No user registration or login.
- No role-based permissions.
- No authentication requirements.

### 5.2 Beta — Final Release

The Beta release will extend the MVP by introducing authentication, authorization, and deployment.

**Included Features:**

- User registration and login.
- User logout.
- User profile dashboard.
- Member and administrator roles.
- Backend permission checks.
- Security scopes for protected API operations.
- Application deployment for the final demonstration.

## 6. Functional Features and Priorities

| Feature | Release | Priority |
|---|---|---|
| Create lost or found reports | MVP | Must Have |
| List and view reports | MVP | Must Have |
| Update and delete reports | MVP | Must Have |
| Input validation and error handling | MVP | Must Have |
| User registration and login | Beta | Must Have |
| User profile dashboard | Beta | Must Have |
| Member and admin roles | Beta | Must Have |
| Backend permission checks | Beta | Must Have |
| Security scopes | Beta | Must Have |
| Application deployment | Beta | Must Have |

## 7. Milestones and Deliverables

### 7.1 MVP — Mid-term

1. Complete project documentation (PRD, SRS, and TDD).
2. Design the report data model and configure the local database.
3. Implement and test report CRUD REST API endpoints.
4. Develop the React frontend.
5. Integrate the frontend with the FastAPI backend.
6. Test the core application functionality.
7. Demonstrate the application running locally.

### 7.2 Beta — Final

1. Implement user registration and login.
2. Develop user profiles and the dashboard.
3. Introduce member and administrator roles.
4. Implement backend permission checks.
5. Add security scopes and protect report operations.
6. Test authentication and authorization.
7. Deploy the integrated application.
8. Demonstrate the deployed application.

## 8. Success Criteria

### 8.1 MVP Success Criteria

The MVP will be considered successful when:

- The application runs successfully in a local environment.
- Users can create, view, update, and delete reports through the frontend.
- All report CRUD operations work correctly through the REST API.
- Invalid report information is rejected with appropriate error messages.
- The React frontend communicates successfully with the FastAPI backend.

### 8.2 Beta Success Criteria

The Beta release will be considered successful when:

- Users can register and log in successfully.
- Users can access their profile dashboard.
- Members can perform only the actions they are authorized to perform.
- Administrators have the required administrative permissions.
- Protected API operations enforce the appropriate security scopes.
- The application is deployed and accessible for the final demonstration.

## 9. Assumptions and Constraints

- The application is designed primarily for a single campus.
- MVP report management does not require user accounts.
- Authentication and authorization will be introduced in the Beta release.
- Member and administrator roles will be implemented in the Beta release.
- Deployment is planned for the final release.
- The project will remain focused on the core lost-and-found management requirements.

---

## 10. Milestones

### MVP — Mid-term

| Milestone | Deliverable |
|---|---|
| M1 — Docs | [PRD](01-prd.md), [SRS](02-srs.md) and [TDD](03-tdd.md) (covering MVP and Beta) approved |
| M2 — Data layer | Report item model and SQLite database connection |
| M3 — API | Core CRUD endpoints with validation |
| M4 — Mid demo | Live on Vercel, tagged 0.1.0 (MVP) |

### Beta — Final

| Milestone | Deliverable |
|---|---|
| B1 — Auth | Sign up, login, logout, refresh session, password change; items owned by a user; database migrations in place |
| B2 — RBAC + admin | user, moderator, and dmin roles, admin endpoints, admin dashboard stats, permission checks on every endpoint |
| B3 — Campus desks | Team Desks (Security Desk, Library Front Desk, IT Helpdesk) for staff |
| B4 — Security | Password hashing, token revocation blacklist, 5-attempt login lockout, security headers |
| B5 — Final demo | Beta live on Vercel, tagged 0.2.0 (Beta) |

## 11. Release dependencies

- The Beta is built on top of the MVP: the same /api/items endpoints remain, but in Beta they require login and enforce ownership rules (users can only edit/delete their own reports, while admins and desk moderators can manage all).
- Database migrations and schema evolution are introduced for Beta so the schema grows to support user accounts, security tokens, team desks, and report ownership.

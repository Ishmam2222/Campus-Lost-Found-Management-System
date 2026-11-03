# Product Requirements Document (PRD)
## Campus Lost & Found Management System

| **Field** | **Value** |
|---|---|
| Product | Campus Lost & Found Management System |
| Releases | MVP — Mid-term; Beta — Final |
| Status | Draft |
| Related Documents | SRS, TDD |

---

## 1. Purpose

Campus Lost & Found helps campus members report lost or found items and find information about reported belongings. The frontend uses React with TypeScript; the backend uses FastAPI with Python.

The project will be built in two releases: a simple, locally running MVP and a Beta that adds authentication, permissions, and deployment.

---

## 2. Problem

Lost-item information is often shared across chats or notice boards, making it hard to find and keep up to date. A shared application provides one place to create and view lost-and-found reports.

---

## 3. Goals

| **Goal** | **Release** |
|---|---|
| Create, view, update, and delete lost-and-found reports through REST APIs. | MVP |
| Run the frontend and backend locally as an integrated application. | MVP |
| Add account authentication and a user profile dashboard. | Beta |
| Protect actions using member/admin roles and security scopes. | Beta |
| Deploy the application for the final demonstration. | Beta |

---

## 4. Users

| **User** | **Need** | **Release** |
|---|---|---|
| Campus member | Create and browse lost-and-found reports. | MVP |
| Registered member | Sign in and manage their own profile and reports. | Beta |
| Administrator | Use authorized administrative permissions. | Beta |

---

## 5. User Stories

### 5.1 MVP

- As a campus member, I want to create a lost or found report so others can find the information.
- As a campus member, I want to browse and view reports so I can look for a lost item.
- As a campus member, I want to update or delete a report so I can correct or remove it.

### 5.2 Beta

- As a member, I want to register and sign in so I can access my account.
- As a member, I want to view my profile and reports in a dashboard.
- As an administrator, I want permissions to manage reports and users.
- As a member, I want the API to prevent me from performing actions I am not allowed to do.

---

## 6. Milestones

### 6.1 MVP — Mid-term

1. Complete project documentation.
2. Create the report data model and local database.
3. Implement and test report CRUD REST endpoints.
4. Connect the React frontend to the FastAPI backend.
5. Demonstrate the application running locally.

### 6.2 Beta — Final

1. Add registration, login, and user profiles.
2. Add member/admin roles and backend permission checks.
3. Add security scopes and protect report operations.
4. Deploy the integrated application.
5. Demonstrate the deployed application.

---

## 7. Scope

### 7.1 MVP — Mid-term

- Create, list, view, update, and delete lost/found reports.
- Validate report information and return clear API errors.
- Use the React frontend with the FastAPI REST API.
- Run the application locally.
- No login or role-based permissions are required in this release.

### 7.2 Beta — Final

- Register, log in, and log out.
- Provide a user profile dashboard.
- Add member and admin roles.
- Enforce permissions and security scopes in the backend.
- Deploy the application.

---

## 8. Features

| **Feature** | **Release** | **Priority** |
|---|---|---|
| Create a lost or found report | MVP | Must |
| List and view reports | MVP | Must |
| Update and delete reports | MVP | Must |
| Validate input and show errors | MVP | Must |
| User registration and login | Beta | Must |
| Profile dashboard | Beta | Must |
| Member/admin roles and permission checks | Beta | Must |
| Security scopes and deployment | Beta | Must |

---

## 9. Success Criteria

### 9.1 MVP

- The application runs locally.
- Users can create, view, update, and delete reports through the frontend and REST API.
- Invalid report data is rejected with a clear error.

### 9.2 Beta

- Users can register and log in.
- A member cannot perform actions they are not authorized to do.
- The application is deployed and available for the final demonstration.

---

## 10. Assumptions

- The application is intended for one campus.
- MVP report management does not require user accounts.
- Authentication, roles, permissions, and deployment are Beta features.
- The project will stay focused on the required lost-and-found features.

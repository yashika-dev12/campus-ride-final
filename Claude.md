# CLAUDE.md

# CampusRide

CampusRide is a student-only carpooling platform built for university students to share rides safely and efficiently.

---

# Tech Stack

- React
- TypeScript
- Vite
- TanStack Router
- Bun
- Tailwind CSS
- shadcn/ui

---

# Project Structure

src/
├── components/     # Reusable UI components
├── routes/         # Route pages
├── hooks/          # Custom React hooks
├── lib/            # Utilities, API functions, helpers
├── router.tsx      # Router configuration
├── server.ts       # Backend/server entry
├── start.ts        # App entry point

---

# Team Responsibilities

## Developer 1 (Frontend)

Owns:
- src/components

Responsible for:
- UI Components
- Forms
- Cards
- Buttons
- Modals
- Navigation

---

## Developer 2 (Pages)

Owns:
- src/routes

Responsible for:
- Landing Page
- Dashboard
- Login
- Profile
- Ride Pages

---

## Developer 3 (Backend)

Owns:
- src/lib
- src/hooks
- server.ts

Responsible for:
- APIs
- Authentication
- Database
- Business Logic

---

## Developer 4 (Integration)

Owns:
- router.tsx
- start.ts
- Deployment
- Testing

Responsible for:
- Connecting frontend & backend
- Bug fixes
- Route integration
- Deployment

---

# Coding Guidelines

- Always use TypeScript.
- Prefer functional React components.
- Reuse existing components before creating new ones.
- Keep components focused on a single responsibility.
- Avoid duplicate code.
- Use async/await instead of Promise chains.
- Follow the existing folder structure.
- Use meaningful variable and function names.
- Do not modify unrelated files.

---

# UI Guidelines

- Use shadcn/ui components whenever possible.
- Maintain a clean and modern interface.
- Mobile responsive by default.
- Keep spacing consistent.
- Use existing theme/colors.
- Avoid inline styles.

---

# Routing

- All pages belong inside src/routes.
- Do not manually edit generated route files.
- Use TanStack Router conventions.

---

# Components

Before creating a new component:

1. Check if one already exists.
2. Reuse whenever possible.
3. Keep components reusable.
4. Avoid page-specific logic inside reusable components.

---

# Backend Rules

- Keep API logic inside lib/.
- Separate API calls from UI.
- Validate user input.
- Handle loading and error states.

---

# Git Workflow

Never commit directly to main.

Create feature branches:

feature/login

feature/dashboard

feature/profile

feature/backend-auth

feature/rides

Merge only after testing.

---

# Before Completing Any Task

Claude should:

- Ensure TypeScript has no errors.
- Avoid breaking existing functionality.
- Keep imports organized.
- Remove unused code.
- Maintain formatting.
- Ensure responsive layouts.

---

# Important

Claude should make the **smallest possible changes** required to complete a task.

Avoid refactoring unrelated code.

Never rewrite files that are outside the scope of the current task unless explicitly requested.

Preserve existing architecture and naming conventions.
---
estimated_steps: 22
estimated_files: 5
skills_used: []
---

# T02: Create AuthProvider context + LoginPage + wire into app shell

Why: Frontend has no reactive auth state — components must call getUserRole() directly from localStorage, which is brittle and non-reactive. No login UI exists. Before any role-based UI work can happen, the app needs a React context that provides user, role, token, login(), and logout() reactively, plus a login page that gates the entire app.

Do:
1. Create src/components/providers/auth-provider.tsx:
   - Define AuthContext with: user (User | null), role (UserRole | null), token (string | null), isAuthenticated (boolean), login(username, password) => Promise<void>, logout() => void
   - On mount: check localStorage for existing auth_token; if found, call GET /api/auth/me to hydrate user info (handles page refresh)
   - login(): calls auth.login() from src/lib/auth.ts, stores token/role/username, then calls GET /api/auth/me to get full user object
   - logout(): calls auth.logout(), clears state
   - Export useAuth() hook that throws if used outside provider
2. Create src/components/app/login-page.tsx:
   - Username + password form with shadcn Input components
   - Submit calls useAuth().login()
   - Display error message on failure (invalid credentials, network error)
   - Visual: centered card on gradient/minimal background, app logo/title
   - Loading state on submit button during login
3. Modify src/app/layout.tsx: wrap children in <AuthProvider>
4. Modify src/app/page.tsx:
   - Import useAuth, LoginPage
   - If !isAuthenticated: render <LoginPage />
   - If isAuthenticated: render existing app shell (Sidebar + TopBar + AppContent)
   - Add logout button in top bar area (or sidebar footer)
5. Handle token expiration: apiFetch already attaches token; if a 401 response comes back, call logout() and redirect to login

Done when: Starting the frontend without a token shows the login page. Entering valid credentials (e.g., owner_user/test) renders the app. Logout clears state and returns to login page. Page refresh with valid token restores session via GET /users/me.

## Inputs

- `src/lib/auth.ts`
- `src/lib/api-client.ts`
- `src/types/fastapi.ts`
- `src/app/page.tsx`
- `src/app/layout.tsx`
- `src/components/app/app-sidebar.tsx`
- `src/store/app-store.ts`

## Expected Output

- `src/components/providers/auth-provider.tsx`
- `src/components/app/login-page.tsx`
- `src/app/page.tsx`
- `src/app/layout.tsx`

## Verification

cd src && npx tsc --noEmit --pretty 2>&1 | head -20

## Observability Impact

AuthProvider exposes isAuthenticated and role reactively via useAuth() hook. Login failures surface user-visible error messages in the form. Token expiration triggers automatic logout and redirect to login page. localStorage keys (auth_token, user_role, username) remain inspectable via browser DevTools.

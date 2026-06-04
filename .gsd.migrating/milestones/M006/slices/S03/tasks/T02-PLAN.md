---
estimated_steps: 6
estimated_files: 3
skills_used: []
---

# T02: Frontend API layer: TypeScript types, API method, and Next.js proxy route

Why: The frontend needs a typed API method and Next.js proxy to forward readiness requests from the browser to the FastAPI backend. This follows the exact same pattern as the existing projects proxy.

Do:
1. In src/types/fastapi.ts after ProjectResponse (line 50): add ProjectReadinessResponse interface with fields: project_id (number), project_name (string), readiness ('green' | 'yellow' | 'red'), ready_count (number), total_count (number), breakdown (Record<string, number>).
2. In src/lib/api/projects.ts after deleteProject (line 63): add fetchProjectReadiness() function that calls apiClient.get<ProjectReadinessResponse[]>('/api/projects/readiness'). Add to the projectsApi export object and default export.
3. Create src/app/api/projects/readiness/route.ts: Next.js App Router route handler. Export async function GET(request: NextRequest) that calls apiFetch from the server side with the incoming request's Authorization header forwarded as a custom header. The readiness response is already flat (no nested objects needing camelCase conversion), so the toCamelCase transform is optional — apply it for consistency but note that readiness/breakdown keys are already camelCase-friendly. Forward errors with appropriate status codes.

Done when: TypeScript compilation passes (npx tsc --noEmit), the proxy file exists and follows the projects/route.ts pattern, and the API method is callable from client components.

## Inputs

- `src/types/fastapi.ts`
- `src/lib/api/projects.ts`
- `src/lib/api-client.ts`
- `src/app/api/projects/route.ts`

## Expected Output

- `src/types/fastapi.ts`
- `src/lib/api/projects.ts`
- `src/app/api/projects/readiness/route.ts`

## Verification

test -f D:/CLAUDE/Project/zakuppro/zakuppro/src/app/api/projects/readiness/route.ts

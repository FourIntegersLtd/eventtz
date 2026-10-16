Task: ws14 client portal, piece 5 (welcome onboarding).
First read .qwen/ws14-common-rules.md (branch, rules, working method, done means). They apply in full.
## Scope: the client welcome onboarding
Baseline: frontend/app/client/(portal)/layout.tsx wraps the portal in
ClientOnboardingProvider and shows ClientWelcomeOnboardingModal; files in
frontend/features/client/onboarding/ (ClientOnboardingProvider.tsx,
ClientWelcomeOnboardingModal.tsx, OnboardingIconBadge.tsx, clientOnboardingCopy.ts,
clientOnboardingVisuals.ts), frontend/lib/clientOnboardingApi.ts, and the settings
section frontend/features/settings/SettingsClientOnboardingSection.tsx (the "show the
welcome tour again" control, now part of web/src/domains/settings).
API: GET and PATCH /api/v1/client/onboarding.
New domain: web/src/domains/client-onboarding. domains/settings may not import it: build
the settings section in client-onboarding and have the client settings route pass it
into SettingsView as a prop or child slot (the vendor settings route passes nothing). Pure logic to test: which step shows, when
the modal opens (first visit vs dismissed vs completed), and the PATCH request body.
Keep the step copy word for word from clientOnboardingCopy.ts. Visuals: use what web/
has; no Lottie or new packages (say what you left out).

## Allowed paths
web/src/app/client/(portal)/layout.tsx, web/src/domains/client-onboarding/**,
web/src/domains/settings/** (only the slot for the section),
web/src/app/client/(portal)/settings/page.tsx.
Commit: "web: client welcome onboarding (ws14)"

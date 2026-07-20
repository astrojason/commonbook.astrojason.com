# Cutover: recall.astrojason.com → commonbook

This app's code, local directory, and package name have been renamed to **commonbook**. The **live deployment is still on the old domain/project** (`recall.astrojason.com`, Vercel project `recall-astrojason-com`, Firebase project `recall-4899d`) until this cutover is deliberately performed. None of the steps below have been executed — they're documented here so the actual cutover is a conscious, confirmed action, not something bundled into a feature build.

## Steps

1. **Vercel**
   - Add the new custom domain (e.g. `commonbook.astrojason.com`) to the existing Vercel project (`recall-astrojason-com` — `.vercel/project.json`), or create a new Vercel project named `commonbook-astrojason-com` and redeploy there instead. Prefer adding the domain to the existing project unless there's a reason to start a fresh project (env vars, deploy history, etc. carry over more simply that way).
   - Add the required DNS record(s) at whatever registrar/DNS host manages `astrojason.com` (CNAME/A record per Vercel's instructions for the new domain).

2. **Firebase (`recall-4899d` project)**
   - Add the new domain to **Authentication → Settings → Authorized domains**, or Google sign-in will fail on the new domain.
   - Leave the old `recall.astrojason.com` domain authorized until the old domain is fully decommissioned (see step 5).

3. **Environment variables**
   - No Firebase project change — `recall-4899d` stays the backing project; only the domain in front of it changes. Existing `VITE_FIREBASE_*` env vars in Vercel are unaffected.
   - If a new Vercel project was created instead of reusing the existing one, copy over all existing env vars (`OPENAI_API_KEY`, `VITE_FIREBASE_*`, and anything added for the Turso/ScraperAPI integration in this build — see `CLAUDE.md`).

4. **Hardcoded references**
   - Search the codebase for any absolute `recall.astrojason.com` URLs (share links, canonical/OG meta tags, docs) and update them to the new domain.
   - Check `INTEGRATION.md`'s token-tracker call and any other cross-app reference for hardcoded old-domain assumptions (should be none — that integration is domain-agnostic — but worth a quick check).

5. **Decommission the old domain**
   - Once the new domain is confirmed working end-to-end (sign-in, Firestore reads/writes, PWA install), remove `recall.astrojason.com` from Vercel and from Firebase's authorized domains, or set up a redirect if inbound links/bookmarks need to keep working.

6. **Local/dev cleanup**
   - Update `.vercel/project.json` if a new Vercel project was created (re-run `vercel link`).
   - Update any bookmarks, saved links, or the password manager entry for this app's login page.

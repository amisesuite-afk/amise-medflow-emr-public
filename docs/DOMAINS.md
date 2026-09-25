# Using both domains: amisemedical.com and amisesuite.com

This guide is for the practice owner. Every step can be done on an iPad in Safari. It takes
about 20 minutes of clicking, then up to a few hours of waiting while the internet picks up the
change.

You own two addresses. The website (the "front-desk" project on Vercel) can answer on both of
them, and on the `www.` form of each:

- `amisemedical.com` and `www.amisemedical.com`
- `amisesuite.com` and `www.amisesuite.com`

One of them is the **primary** address. This guide assumes `amisemedical.com`. If you would
rather use `amisesuite.com`, swap the two names everywhere below.

> **Nothing here goes live until the code change is deployed.** The website code that understands
> two domains is on the branch `website-domains-healthinfo`. It reaches the live site only when that
> branch is merged into `main` and Vercel deploys it. That is your decision. You can do the Vercel
> steps (1 to 4) before or after; the site keeps working either way.

---

## Step 1. Add all four addresses in Vercel

1. Go to [vercel.com](https://vercel.com) and sign in.
2. Open the **front-desk** project (the public website, not the dashboard).
3. Tap **Settings**, then **Domains** in the left-hand list. (On a narrow screen the list may be
   behind a menu button at the top.)
4. Type `amisemedical.com` in the box and tap **Add**. Vercel usually offers to add
   `www.amisemedical.com` as well. Accept.
5. Do the same for `amisesuite.com` (and `www.amisesuite.com`).

You should now see four rows, each with a status such as "Invalid Configuration". That is
expected until Step 3 is done.

## Step 2. Choose what the second domain does

For each address that is **not** your primary, tap **Edit** on its row. You have two choices.

| Choice | What visitors see | Good for | Watch out for |
|---|---|---|---|
| **Redirect to** `amisemedical.com` (recommended) | Typing `amisesuite.com` takes them to `amisemedical.com`. The address bar changes. | Simplest. Best for Google: one address, no duplicates. A patient signed in on the site stays signed in, because there is only one address. | The address bar shows `amisemedical.com`, not the name they typed. |
| **Serve the site** on it too (no redirect) | The same website on `amisesuite.com`; the address bar keeps `amisesuite.com`. | Keeping both names visible, e.g. printed on different leaflets. | A sign-in on one address does not carry over to the other. Google still sees one address, because every page carries a "canonical" tag pointing at the primary, so this does not harm search ranking. |

Our recommendation: **redirect** `www.amisemedical.com`, `amisesuite.com` and
`www.amisesuite.com` to `amisemedical.com`. If Vercel asks which redirect type, choose
**308 Permanent** (or 301).

## Step 3. Enter the DNS records at your domain registrar

The "registrar" is the company where you bought each domain (for example GoDaddy, Namecheap,
Google Domains / Squarespace, Cloudflare).

1. In Vercel → front-desk → Settings → Domains, tap each row that says "Invalid Configuration".
   Vercel shows exactly which records to add, for example:
   - for the plain address (`amisemedical.com`): usually an **A** record with a number like `76.76.21.21`
   - for the `www.` address: usually a **CNAME** record with a value like `cname.vercel-dns.com`
2. **Copy exactly what Vercel shows on your screen.** Do not copy values from this guide or from
   another website. Vercel sometimes gives a project its own values, and those are the ones that
   work.
3. In another browser tab, sign in to the registrar and open the DNS settings for the domain
   ("DNS", "Manage DNS", "DNS records" or "Zone editor").
4. Add each record Vercel listed:
   - **Type**: A or CNAME, as Vercel says
   - **Name / Host**: `@` for the plain domain, `www` for the www address (Vercel shows this too)
   - **Value / Points to**: exactly as Vercel shows
   - **TTL**: leave the default
5. If there is already an A record for `@` or a CNAME for `www` pointing somewhere else (for
   example a "parked" page from the registrar), **edit or delete that old record**. Two
   conflicting records stop it working.
6. Repeat for the second domain.

Then wait. Most changes work within 30 minutes; some take up to 48 hours. Vercel re-checks by
itself. When a row turns to "Valid Configuration", Vercel also issues the security certificate
(the padlock) automatically. You do not need to buy one.

## Step 4. Tell the website which address is primary (Vercel)

1. Vercel → front-desk → **Settings** → **Environment Variables**.
2. Find `NEXT_PUBLIC_SITE_URL`. Until now it held the vercel.app address. Edit it to:

   ```
   https://amisemedical.com
   ```

   (no slash at the end). Tick Production, Preview and Development. Save.
   If it is not in the list, add it with that value.
3. This setting is baked in when the site is built, so it only takes effect after a new
   deployment: Vercel → front-desk → **Deployments** → the top (latest) deployment → the **⋯**
   menu → **Redeploy**.

What it controls: the address Google is told to use for every page (the canonical tag), the
sitemap, and the practice details Google shows in search results. It does not stop the other
addresses working.

## Step 5. Tell the API server about the new addresses (Render)

The booking forms and patient portal talk to the API server on Render. For security, it only
accepts requests from addresses on its list, and it uses the **first** address on that list in
links it sends to patients (text messages, WhatsApp replies, portal invitations).

Do this in two small edits, so that nothing breaks at any point.

**5a. Now (straight after Step 3).** Accept the new addresses, but keep patient links on the
address that already works:

1. Go to [dashboard.render.com](https://dashboard.render.com), open the API service.
2. Tap **Environment**.
3. Edit `PORTAL_URL` to this single line (commas, no spaces):

   ```
   https://front-desk-amisesuite-afks-projects.vercel.app,https://amisemedical.com,https://www.amisemedical.com,https://amisesuite.com,https://www.amisesuite.com
   ```

4. **Save Changes**. Render restarts the service by itself (about a minute).

Without this, a booking made on `amisemedical.com` would be refused by the API server as soon
as the domain starts working.

**5b. Once `https://amisemedical.com` loads with a padlock (Step 7).** Move the primary address
to the front, so links sent to patients use it:

```
https://amisemedical.com,https://www.amisemedical.com,https://amisesuite.com,https://www.amisesuite.com,https://front-desk-amisesuite-afks-projects.vercel.app
```

Keep the vercel.app address at the end. Save Changes again.

## Step 6. Allow patient sign-in on the new addresses (Supabase)

Patients sign in to the portal with an emailed link. Supabase only sends people back to
addresses it has been told about.

1. Go to [supabase.com](https://supabase.com), open the project, then **Authentication** →
   **URL Configuration**.
2. Under **Redirect URLs**, tap **Add URL** and add, one at a time:

   ```
   https://amisemedical.com/**
   https://www.amisemedical.com/**
   https://amisesuite.com/**
   https://www.amisesuite.com/**
   ```

   Keep the existing vercel.app entry.
3. Leave **Site URL** as it is unless the developer asks you to change it.

## Step 7. Check it works

On the iPad (and ideally on a phone using mobile data, not the practice Wi-Fi):

- [ ] `https://amisemedical.com` opens the website and shows a **padlock** in the address bar.
- [ ] `https://www.amisemedical.com` opens (or moves to `amisemedical.com` if you chose redirect).
- [ ] `https://amisesuite.com` and `https://www.amisesuite.com` open, or move to
      `amisemedical.com`.
- [ ] `http://amisemedical.com` (without the "s") moves to `https://` by itself.
- [ ] `https://amisemedical.com/sitemap.xml` shows a list of addresses that all start with
      `https://amisemedical.com`.
- [ ] Book a test request on `https://amisemedical.com/book`. It should submit without an error.
- [ ] Ask the developer to open `/api/healthz/env` on the API server: `portal.patientLinkBase`
      should read `https://amisemedical.com`.

If an address shows "This site can't be reached" or a certificate warning, the DNS change has
usually not spread yet. Wait an hour and try again. If it still fails after a day, check that
the registrar records match what Vercel shows, character for character.

---

## For the developer

- Canonical origin: `artifacts/front-desk/lib/site.ts` (`siteUrl()`, `NEXT_PUBLIC_SITE_URL`,
  default `https://amisemedical.com`). Each public page sets `alternates.canonical`; the root
  layout deliberately does not. `artifacts/front-desk/test/site.test.ts` checks both, and that no
  file under `app/` hard-codes an amisemedical/amisesuite origin.
- `.github/workflows/deploy-frontend.yml` no longer upserts `NEXT_PUBLIC_SITE_URL`, so the value
  set in Vercel (Step 4) is not overwritten on each deploy.
- API server: `artifacts/api-server/src/lib/site-urls.ts`. `PORTAL_URL`/`DASHBOARD_URL` are
  comma-separated origin lists for CORS; `patientSiteBaseUrl()` (first `PORTAL_URL` entry, then
  `FRONTEND_URL`, then the vercel.app default) builds every link sent to patients. Tested in
  `src/test/site-urls.test.ts`. `/api/healthz/env` shows `patientLinkBase` and `corsOrigins`.
- Sessions (patient portal, staff pages) are per address. Redirecting the secondary domains
  (Step 2) avoids "signed in on one, signed out on the other".

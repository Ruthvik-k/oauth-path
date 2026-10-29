# Manual setup attempts: checklist

Agents can't create provider accounts, pass phone or ID checks, or accept legal terms. A human runs these attempts so the curated guides can mark claims **Tested** and record corrections.

**Rules**
- Use personal or throwaway accounts. Don't register apps in your employer's tenant or org without permission.
- Never paste client secrets, tokens or verification codes anywhere, including notes and screenshots. Delete or rotate test apps afterwards.
- Use `https://example.com/oauth/callback` as the redirect URI. After you approve, the browser lands on example.com with `?code=...` in the URL. That proves the authorization step works without a server. Don't exchange the code.

**For each attempt, record**
- Date, total hands-on time, and outcome: succeeded, partially, blocked, or not attempted.
- What matched the guide, what differed, and any exact labels, warnings or error text you saw.
- Anything the guide is missing.

---

## GitHub (about 10 min)
1. Settings → Developer settings → OAuth Apps → New OAuth App. Note the required fields and how many callback URLs it accepts.
2. Open `https://github.com/login/oauth/authorize?client_id=<ID>&redirect_uri=https://example.com/oauth/callback&scope=repo` and approve. Did you land on example.com with a `code`?
3. Optional: do the same with a **GitHub App** (Settings → Developer settings → GitHub Apps). Note "Expire user authorization tokens" and the number of callback URLs.
4. Optional: if you own an org with OAuth app access restrictions, does the consent screen show "Request access" for that org?

## Slack (about 15 min)
1. https://api.slack.com/apps → Create New App → From scratch, in a free workspace.
2. OAuth & Permissions: add redirect URL `https://example.com/oauth/callback`. Does it reject `http://`? Add bot scopes `channels:history` and `chat:write`.
3. Manage Distribution: what does the checklist require before "Activate Public Distribution"? Is there any review step?
4. Use the Shareable URL to install into your workspace. Do you land on example.com with a `code`?

## Google Workspace (about 20 min)
1. console.cloud.google.com → new project → Google Auth Platform → Get started (Branding, Audience = External).
2. Data Access → Add scopes: add `gmail.readonly` and `gmail.send`. How is each labelled (sensitive or restricted)? What does the console say about verification?
3. Clients → Create client → Web application, redirect URI `https://example.com/oauth/callback`.
4. Add yourself as a test user, then open the authorize URL (`https://accounts.google.com/o/oauth2/v2/auth?client_id=<ID>&redirect_uri=...&response_type=code&scope=https://www.googleapis.com/auth/gmail.readonly&access_type=offline&prompt=consent`). Note the exact "Google hasn't verified this app" wording.
5. Audience → Publish app: what does it ask for, and does it block you?

## Meta (about 20 min)
1. developers.facebook.com → register as a developer. Note the phone or 2FA requirements.
2. Create app: which use cases are offered? Pick the one for managing Pages or Instagram.
3. Look at App Review / "Required actions" and Business verification. List what Advanced Access requires. Don't submit.
4. Optional: generate a token for your own account in Graph API Explorer (Development mode, as an app admin).

## LinkedIn (about 15 min)
1. linkedin.com/developers/apps → Create app. Does it require a Company Page? How does page verification work?
2. Products tab: which products are instant, such as "Sign In with LinkedIn using OpenID Connect" and "Share on LinkedIn"? Which need a request form, such as Community Management API? Note the form questions; don't submit.
3. Authorize with `openid profile email` against `https://example.com/oauth/callback`. Did it work immediately?

## Microsoft (optional, about 20 min; needs your own Entra tenant)
1. entra.microsoft.com → App registrations → New registration → "Accounts in any organizational directory and personal Microsoft accounts".
2. API permissions: add `Mail.Read` and `ChannelMessage.Read.All` (delegated). Which show "Admin consent required: Yes"?
3. Branding & properties → Publisher verification: what does it ask for?

## Zoom (about 15 min)
1. marketplace.zoom.us → Develop → Build App → General App, user-managed.
2. Note development vs production credentials, the OAuth allow list, and the scope picker (granular scopes).
3. Authorize with your own account against `https://example.com/oauth/callback`.
4. Look at the publish/submit flow (App Listing, Technical Design, Security review). List what it requires; don't submit.

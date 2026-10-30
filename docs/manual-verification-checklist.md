# Manual setup attempts: what to do and what to send back

## Why this exists

The app labels every claim in a guide with how we know it:

- **Tested**: a person actually did it and saw the result.
- **Official docs**: the provider's documentation says so.
- **Community-reported**: developers say so on forums and blogs.
- **Inferred**: our own reasoning.

Right now nothing is **Tested**, because an AI agent can't sign up for accounts, receive SMS codes, or click "Allow" on a consent screen. Your job is to be that person for a few providers: register a test OAuth app, connect your own account to it once, and write down what you saw. I then mark the matching steps as Tested and record anything the guide got wrong.

You don't build or run any code. Everything happens in your browser.

## The one trick you need: a fake redirect address

Every OAuth app asks for a **redirect URI** (also called callback URL): where the provider sends the user after they click "Allow". Normally that's your server. We don't have one, so use:

```
https://example.com/oauth/callback
```

When the test works, your browser ends up on an example.com page (a placeholder site) and the address bar contains `?code=...`. **That code in the address bar is the proof the OAuth app works.** You don't need to do anything with it.

## Safety rules

- Use your personal accounts or free throwaway accounts, not your employer's organization or tenant.
- **Never send me or paste anywhere: client secrets, the `code=` value, tokens, or passwords.** The client ID is fine to use in the browser, but you don't need to share it either.
- Delete the test apps when you're done.

---

## 1. GitHub (about 10 minutes): start here, it's the easiest

1. Go to https://github.com/settings/developers → **OAuth Apps** → **New OAuth App**.
2. Fill in:
   - Application name: `OAuth Path test`
   - Homepage URL: `https://example.com`
   - Authorization callback URL: `https://example.com/oauth/callback`
3. Click **Register application**. Copy the **Client ID** shown on the next page. You don't need to generate a client secret.
4. Paste this into your browser's address bar, replacing `YOUR_CLIENT_ID`:
   ```
   https://github.com/login/oauth/authorize?client_id=YOUR_CLIENT_ID&redirect_uri=https://example.com/oauth/callback&scope=repo
   ```
5. GitHub shows an "Authorize OAuth Path test" screen. Click **Authorize**.
6. Check the address bar: does it start with `https://example.com/oauth/callback?code=`?
7. Afterwards: delete the app (its settings page → **Delete application**), and revoke it under https://github.com/settings/applications → Authorized OAuth Apps.

**Send back:**
```
GitHub
- Worked end to end (landed on example.com with ?code=): yes / no
- Minutes it took:
- Did GitHub ask for any review, approval or verification? yes / no
- Anything surprising, confusing, or different from our guide:
```

## 2. Slack (about 15 minutes)

You need a Slack workspace where you can install apps. If you don't have one, create a free one at https://slack.com/get-started. While you set it up, Slack may show paid plans (Pro or Business+). You don't need them: look for an option to continue on the **Free** plan. If you closed that tab, the workspace usually exists anyway; check whether it appears in the workspace dropdown in step 1. Alternatively, join the free Slack Developer Program (https://api.slack.com/developer-program) and create a developer sandbox.

1. Go to https://api.slack.com/apps → **Create New App**. In the "Create new app" dialog, pick **Blank app** ("Empty app with minimal setup") under "Or start your own way" → **Continue** → name `OAuth Path test`, pick your workspace. (Slack renamed "From scratch" to "Blank app" in 2026. Skip the "AI agent" and "Starter app" templates.)
2. Left menu **OAuth & Permissions**:
   - Under **Redirect URLs**, add `https://example.com/oauth/callback` and save. Also try adding `http://example.com/x` (http, not https) and note whether Slack rejects it.
   - Under **Bot Token Scopes**, add `channels:history` and `chat:write`.
3. Left menu **Manage Distribution**: read the checklist on that page. Note what it requires before you can share the app with other workspaces, and whether it mentions any review. Don't activate anything.
4. Left menu **Basic Information**: copy the **Client ID**. Then open, replacing `YOUR_CLIENT_ID`:
   ```
   https://slack.com/oauth/v2/authorize?client_id=YOUR_CLIENT_ID&scope=channels:history,chat:write&redirect_uri=https://example.com/oauth/callback
   ```
5. Click **Allow**. Did you land on example.com with `?code=`?
6. Afterwards: **Basic Information** → **Delete App**.

**Send back:**
```
Slack
- Worked end to end: yes / no
- Minutes it took:
- Was http:// rejected for the redirect URL? yes / no / didn't try
- What the Manage Distribution page required (list):
- Did it mention any review before other workspaces can install? yes / no
- Anything surprising or different from our guide:
```

## 3. Google / Gmail (about 20 minutes)

1. Go to https://console.cloud.google.com → project picker at the top → **New Project** → name it `oauth-path-test`.
2. Search the top bar for **Google Auth Platform** and open it → **Get started**:
   - App name `OAuth Path test`, support email = your email
   - Audience: **External**
   - Contact email: your email → agree → **Create**
3. **Data Access** (left menu) → **Add or remove scopes** → filter for `gmail`. Add `.../auth/gmail.readonly` and `.../auth/gmail.send`. **Write down which section each lands in: "sensitive" or "restricted"**, and what the console says about verification. Save.
4. **Audience** (left menu) → under Test users click **Add users** → add your own Gmail address.
5. **Clients** (left menu) → **Create client** → Application type **Web application** → under Authorized redirect URIs add `https://example.com/oauth/callback` → **Create**. Copy the **Client ID**.
6. Wait about 5 minutes (Google says changes can take a while to apply), then open, replacing `YOUR_CLIENT_ID`:
   ```
   https://accounts.google.com/o/oauth2/v2/auth?client_id=YOUR_CLIENT_ID&redirect_uri=https://example.com/oauth/callback&response_type=code&scope=https://www.googleapis.com/auth/gmail.readonly&access_type=offline&prompt=consent
   ```
7. You should see a warning like **"Google hasn't verified this app"**. **Write down the exact wording.** Click **Continue**, then allow access. Did you land on example.com with `?code=`?
8. Optional: **Audience** → **Publish app**. Note what it asks for or warns about, then cancel.
9. Afterwards: delete the project (IAM & Admin → Settings → **Shut down**), and remove access at https://myaccount.google.com/permissions.

**Send back:**
```
Google
- Worked end to end: yes / no
- Minutes it took:
- gmail.readonly was listed as: sensitive / restricted
- gmail.send was listed as: sensitive / restricted
- Exact wording of the unverified-app warning:
- What "Publish app" asked for or warned about (if you tried):
- Anything surprising or different from our guide:
```

## 4. Zoom (about 15 minutes)

You need a free Zoom account (https://zoom.us/signup).

1. Go to https://marketplace.zoom.us → top right **Develop** → **Build App** → **General App** → **Create**.
2. On **Basics**: pick **User-managed** if asked. Note that the page shows separate **Development** and **Production** credentials.
3. Under OAuth information: set **OAuth Redirect URL** to `https://example.com/oauth/callback`, and add the same URL to the **OAuth Allow List**.
4. **Scopes**: click **Add Scopes**, add something simple (for example under Meeting: view your meetings). Note how the scope picker looks (granular scopes).
5. Find the **Local Test** / **Add App Now** button (usually in the left menu under development or testing). Click it and authorize with your own Zoom account. Did you land on example.com with `?code=`?
6. Look at the publish or submit section, if visible (App Listing, Technical Design, Security). List what it asks for. **Don't submit.**
7. Afterwards: delete the app from **Manage** → your app → delete.

**Send back:**
```
Zoom
- Worked end to end: yes / no
- Minutes it took:
- Development vs Production credentials shown separately? yes / no
- What the publish/submit section asked for (list):
- Anything surprising or different from our guide:
```

---

## If you get stuck

That's useful data too. Send back where you got stuck, the exact error message or screen text, and a screenshot with any secrets cropped out. Being blocked becomes a **Blocked** result in the guide, which is exactly what other developers want to know about.

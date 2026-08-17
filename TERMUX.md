# Running Mythos on Android (Termux + proot Ubuntu)

Mythos is a lightweight web app, so it runs fine on low-end hardware — including
a proot Ubuntu session inside Termux on an Android phone.

Two ways to use it:

1. **No install (recommended):** open the hosted app in your phone's browser
   (Chrome/Edge/Firefox). Everything — chat, coding, bug bounty, reports — works
   in any browser, and the backend (Convex) runs in the cloud.
2. **Local dev server inside Termux:** run the Vite dev server in proot Ubuntu
   and open `http://localhost:5173` in your browser. Useful when you want to
   hack on the app itself.

---

## Option 1 — Just use it (no install)

1. Install Termux from F-Droid (not the Play Store — it's outdated).
2. Open the Mythos URL in your browser.
3. Sign in (email OTP or guest), and paste your free Gemini key
   (`GOOGLE_API_KEY`) into the project's **Keys/API keys** tab once.
   Optional but recommended: also add `GROQ_API_KEY` — Mythos then
   automatically falls back to Groq's free tier whenever Gemini is
   rate-limited or down, so the free quota never stops you.

That's it. This is the zero-cost, zero-maintenance path.

---

## Option 2 — Local dev server in Termux

### 1. Install proot Ubuntu

```bash
pkg update && pkg upgrade -y
pkg install -y proot-distro
proot-distro install ubuntu
proot-distro login ubuntu
```

### 2. Inside Ubuntu: base tools + Bun

```bash
apt update && apt upgrade -y
apt install -y curl git unzip ca-certificates

# Bun (fast JS runtime + package manager)
curl -fsSL https://bun.sh/install | bash
source ~/.bashrc
bun --version
```

### 3. Get the project

Copy the Mythos project folder into Ubuntu (via git, a tarball, or `scp`), then:

```bash
cd mythos
bun install
```

### 4. Configure the backend

Mythos uses Convex as its database/backend, plus a Gemini API key for the agent.

```bash
# Login to Convex (device-code flow; follow the link it prints)
bunx convex login

# Point the app at your deployment (use the URL from your Convex dashboard,
# e.g. https://your-project.convex.cloud)
echo "VITE_CONVEX_URL=https://your-project.convex.cloud" > .env.local

# Store the Gemini key server-side
bunx convex env set GOOGLE_API_KEY "your-free-gemini-key"

# Optional: Groq free tier as automatic fallback when Gemini is
# rate-limited or down
bunx convex env set GROQ_API_KEY "your-free-groq-key"
```

### 5. Run it

```bash
# Terminal 1 — Convex dev backend (keep running)
bunx convex dev

# Terminal 2 — the app
bun run dev --host 0.0.0.0
```

Then open `http://localhost:5173` in the Android browser (or from another
device on your network, `http://<phone-ip>:5173`).

> Tip: proot Ubuntu is slower than native Termux. If the dev server feels
> sluggish, use Option 1 — the hosted app — and keep the Termux session for
> running security tooling (see below).

---

## Using Mythos for authorized security work from Termux

The **Bug bounty** mode in Mythos helps with the planning/reporting side:

- Paste the program's **scope and rules** into the *Findings* tab — the agent
  will not suggest anything outside that scope.
- Use the *Agent* tab to plan non-destructive tests and structure findings.
- Use the *Report* tab to generate HackerOne / Bugcrowd / Intigriti-style
  reports and copy them.

You can execute requests right from Termux with `curl` while Mythos plans and
documents. Example (in-scope target only):

```bash
# Always check the program's rules first: many ban automated scanning
curl -sS "https://TARGET/robots.txt"
curl -sSI "https://TARGET/"

# Log your request/response pairs — programs want to see your PoC
curl -sS -i "https://TARGET/api/search?q=test" | tee poc-1.txt
```

Then turn the evidence into a finding in Mythos and generate the report.

**Rules of engagement (non-negotiable):**
- Only test assets **in the program's declared scope**, and only with that
  program's permission.
- No stealth, no evasion, no log tampering, no "no trace" tricks. Authorized
  testing is visible by design; HackerOne/Bugcrowd/Intigriti ban researchers
  who hide their activity.
- No DoS, no destructive actions, no data exfiltration beyond a minimal PoC.
- Clean up **your own test artifacts** (test accounts, uploaded files, changed
  records) after confirming a finding — and report what you did.
- Respect rate limits and automation bans listed in each program's policy.

# Database Restore Runbook

Two backup sources are available. Use whichever is appropriate.

---

## Option A — Neon point-in-time recovery (fast, last 7 days)

Best for: accidental deletion, bad migration, data corruption within the past week.

1. Go to [Neon Console](https://console.neon.tech) → select the **gallery** project
2. Click **Branches** → select the `main` branch
3. Click **Restore** (or **Time Travel**)
4. Pick the point in time to restore to
5. Neon creates a new branch at that point — verify the data looks correct
6. Promote the restored branch to `main` once confirmed

No command line needed.

---

## Option B — GitHub Actions backup artifact (up to 90 days)

Best for: disaster recovery, data from more than a week ago, point-in-time not available.

### Step 1: Download the backup file

1. Go to [github.com/gaviteller/gallery/actions](https://github.com/gaviteller/gallery/actions)
2. Click **Daily DB Backup** in the left sidebar
3. Find the run closest to the date you want to restore from
4. Click it → scroll to **Artifacts** → download `db-backup-<run-id>`
5. Unzip — you'll have a file like `gallery-backup-2026-01-15_02-00-00.dump`

### Step 2: Restore to a fresh Neon branch (recommended)

Never restore directly to production. Create a branch first, verify, then promote.

```bash
# 1. Create a new Neon branch for the restore (via Neon console or CLI)
#    Then copy its connection string (direct, non-pooled URL)

# 2. Restore into the new branch
pg_restore \
  --dbname="<NEW_BRANCH_CONNECTION_STRING>" \
  --no-owner \
  --no-acl \
  --clean \
  --if-exists \
  gallery-backup-2026-01-15_02-00-00.dump

# 3. Verify the data in the new branch
psql "<NEW_BRANCH_CONNECTION_STRING>" -c "\dt"
psql "<NEW_BRANCH_CONNECTION_STRING>" -c "SELECT COUNT(*) FROM \"User\";"

# 4. If everything looks correct, promote the branch to main in Neon console
```

### Step 3: Update the app connection string (if needed)

If you promoted a restored branch to `main`, the connection string stays the same. If you're using a different branch, update `DATABASE_URL` in Vercel:

1. Vercel → gallery project → Settings → Environment Variables
2. Update `DATABASE_URL` and `DATABASE_URL_DIRECT` to the new branch URLs
3. Redeploy

---

## One-time setup: add secrets to GitHub

The backup workflow requires one GitHub secret:

| Secret | Value |
|--------|-------|
| `DATABASE_URL_DIRECT` | Neon **direct** (non-pooled) connection string |

**How to get the direct URL:**
1. Neon Console → gallery project → Connection Details
2. Set connection type to **Direct** (not Pooled)
3. Copy the connection string — it looks like: `postgresql://neondb_owner:<password>@ep-super-sky-apyhuih0.c-7.us-east-1.aws.neon.tech/neondb?sslmode=require`
   (note: no `-pooler` in the hostname)

**How to add it to GitHub:**
1. github.com/gaviteller/gallery → Settings → Secrets and variables → Actions
2. New repository secret → Name: `DATABASE_URL_DIRECT`, Value: paste the direct URL

Once added, the workflow runs automatically every night at 2 AM UTC. You can also trigger it manually from the Actions tab.

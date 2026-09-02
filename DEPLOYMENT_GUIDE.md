# Deploying Meyaad — step by step, no coding required

This mirrors the exact steps that worked for PSARA. Follow in order.

## 1. Create a Supabase project
1. Go to supabase.com, sign up/log in, click "New project."
2. Pick any name (e.g. "meyaad"), set a database password (save it somewhere), choose a region close to India (e.g. Singapore).
3. Wait ~2 minutes for it to finish setting up.

## 2. Run the database schema
1. In your Supabase project, go to the SQL Editor (left sidebar).
2. Click "New query."
3. Open `schema.sql` from this folder, copy its entire contents, paste into the editor.
4. Click "Run." You should see "Success. No rows returned."

## 3. Turn off email confirmation (important)
1. Go to Authentication > Providers (or Authentication > Settings) in Supabase.
2. Find "Confirm email" and turn it OFF.
   (Without this, signup breaks the same way it did for PSARA — no session exists yet when the org-creation trigger needs one.)

## 4. Get your API keys
1. Go to Project Settings > API.
2. Copy the "Project URL" and the "anon public" key — you'll need both in step 6.

## 5. Upload this project to GitHub
1. Go to github.com, create a new repository (e.g. "meyaad-app"), keep it private if you prefer.
2. Upload every file and folder from this project as-is — keep the folder structure flat, don't nest it inside an extra folder (this tripped up the PSARA upload the first time).

## 6. Deploy on Vercel
1. Go to vercel.com, sign up/log in with your GitHub account.
2. Click "Add New… > Project," select your repository.
3. Before deploying, click "Environment Variables" and add:
   - `NEXT_PUBLIC_SUPABASE_URL` = (the Project URL from step 4)
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = (the anon public key from step 4)
4. Confirm the Framework Preset shows "Next.js" (not "Other" — this broke the PSARA build initially).
5. Click "Deploy." Wait ~2 minutes.

## 7. Test it
1. Open the live URL Vercel gives you.
2. Sign up with a real email + password.
3. You should land on the Dashboard. Go to Records > Add a record type > add a record > add a category > add a document.
4. Refresh — everything should still be there (it's a real database now, not a mockup).

## What's built vs. what's stubbed
**Working**: signup/login, full 4-level Record Type → Record → Category → Document flow, real file upload to Supabase Storage, live dashboard with expiry status counts, org-level data isolation (one customer can never see another's data).

**Not yet built** (same as PSARA's MVP approach — noted honestly, not hidden):
- Email/WhatsApp reminder sending (Settings page shows the toggle UI but nothing actually sends yet)
- Billing/payment (Razorpay/UPI) — not connected
- Deleting/editing a record type or record's name after creation (deleting documents/categories works; renaming doesn't yet)

## Making future changes
Same workflow as PSARA: describe what you want changed, I'll give you the updated file(s), you paste them into GitHub, Vercel auto-redeploys.

# NagarSeva — Citizen Issue Reporting Portal

> A real-time geospatial civic issue reporting platform that connects citizens with local administration to resolve urban problems faster.

🌐 **Live App:** [nagarseva-mumbai.vercel.app](https://nagarseva-mumbai.vercel.app) &nbsp;|&nbsp; **Version:** v1.2 &nbsp;|&nbsp; **Status:** Production

[![Live App](https://img.shields.io/badge/Live-nagarseva--mumbai.vercel.app-00d4aa?style=flat)](https://nagarseva-mumbai.vercel.app)
[![GitHub](https://img.shields.io/badge/GitHub-Sakshiblip-181717?style=flat&logo=github)](https://github.com/Sakshiblip)
[![TypeScript](https://img.shields.io/badge/TypeScript-90.7%25-3178C6?style=flat&logo=typescript)](https://github.com/Sakshiblip/nagarseva)

---

## What is NagarSeva?

NagarSeva (meaning "City Service") is a full-stack civic tech web application that lets Mumbai citizens report urban issues — potholes, garbage, broken street lights, flooding — by dropping a pin directly on an interactive map. Administrators can monitor all reports in real time, update their status, and mark them resolved. Built as a production-grade capstone project with live deployment, real users, and a working admin panel.

---

## Features

### For Citizens

- Secure sign up and login with email and password
- Show/hide password toggle on all auth forms
- Forgot password flow with email reset link
- Real-time geolocation — map auto-centers on current location on load
- "Near Me" button to filter issues near your location
- Report civic issues by double-clicking directly on the map
- Auto-populated GPS coordinates on location click
- 3-step guided reporting flow: Map → Details → Media
- Upload photos of the issue
- View all city-wide reports on the interactive map
- Track status of your own submitted reports via My Reports
- Other users' identities kept anonymous — shown as "Anonymous Citizen"
- **My Account panel** — accessible from top-left navbar with user avatar
- **Edit Profile** — update display name and password; email is locked and cannot be changed
- Mobile-friendly layout with map always visible

### For Administrators

- Real-time issue feed with live updates via Supabase Realtime
- Filter issues by status and type
- Update issue status: Pending → In Progress → Resolved
- View exact coordinates and full reporter details including email
- Map pin color updates instantly when status changes
- Login activity log with email, role, and timestamp per session

### Map Pin Color System

| Color | Status |
|-------|--------|
| 🔴 Red | Reported — no action taken yet |
| 🟡 Yellow | In Progress — administration is working on it |
| 🟢 Green | Resolved — work completed |
| 🔵 Blue | Your current location |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + TypeScript + Vite |
| Styling | Tailwind CSS |
| Map | Leaflet.js + React-Leaflet + OpenStreetMap |
| Backend | Supabase (Auth + PostgreSQL + Realtime + Storage + Edge Functions) |
| Routing | React Router v6 |
| Deployment | Vercel (auto-deploy on push to `main`) |

---

## Database Schema

### `issues`

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | Primary key |
| `user_id` | uuid | FK to auth.users |
| `email` | text | Reporter email |
| `lat` | float | Latitude |
| `lng` | float | Longitude |
| `issue_type` | text | garbage / pothole / light / flooding / other |
| `description` | text | Issue description |
| `image_urls` | text[] | Uploaded image URLs |
| `status` | text | pending / in_progress / resolved |
| `created_at` | timestamptz | Submission time |
| `updated_at` | timestamptz | Last update time |

### `profiles`

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | FK to auth.users (PK) |
| `display_name` | text | Editable display name |
| `role` | text | citizen / admin (default: citizen) |
| `updated_at` | timestamptz | Last profile update |

### `admin_emails`

| Column | Type | Description |
|--------|------|-------------|
| `email` | text | Primary key — emails with admin access |

### `login_logs`

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | Primary key |
| `user_id` | uuid | FK to auth.users |
| `email` | text | Logged-in user email |
| `role` | text | admin / citizen |
| `logged_in_at` | timestamptz | Login timestamp |
| `ip_address` | text | User IP address |

---

## Getting Started

### Prerequisites

- Node.js v18+
- A Supabase project with the schema above

### Installation

```bash
git clone https://github.com/Sakshiblip/nagarseva.git
cd nagarseva
npm install
cp .env.example .env
```

### Environment Variables

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_publishable_key
```

### Supabase Setup

Run the following in your Supabase SQL Editor:

```sql
-- Issues table
create table issues (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users,
  email text,
  lat float,
  lng float,
  issue_type text,
  description text,
  image_urls text[],
  status text default 'pending',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Profiles table
create table public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  display_name text,
  role text default 'citizen',
  updated_at timestamptz default now()
);

-- Admin emails
create table admin_emails (
  email text primary key
);

-- Login logs
create table login_logs (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users,
  email text,
  role text,
  logged_in_at timestamptz default now(),
  ip_address text
);

-- Add your admin email
insert into admin_emails (email) values ('your-admin@email.com');

-- Enable Realtime
alter publication supabase_realtime add table issues;

-- RLS Policies
alter table public.profiles enable row level security;
create policy "Users can view own profile" on public.profiles for select using (auth.uid() = id);
create policy "Users can update own profile" on public.profiles for update using (auth.uid() = id);
create policy "Users can insert own profile" on public.profiles for insert with check (auth.uid() = id);

create policy "Users can insert issues" on issues for insert to authenticated with check (auth.uid() = user_id);
create policy "Users can read all issues" on issues for select to authenticated using (true);
create policy "Authenticated users can update issues" on issues for update to authenticated using (true);
create policy "Authenticated users can read admin_emails" on admin_emails for select to authenticated using (true);
create policy "Authenticated users can upload images" on storage.objects for insert to authenticated with check (bucket_id = 'issue-images');
create policy "Public can view images" on storage.objects for select to public using (bucket_id = 'issue-images');
create policy "Only authenticated users can insert login logs" on login_logs for insert to authenticated with check (auth.uid() = user_id);
create policy "Admins can read all login logs" on login_logs for select to authenticated using (true);
```

Also create a **public Storage bucket** named `issue-images` in Supabase → Storage.

### Supabase Auth Configuration

In Supabase → Authentication → URL Configuration:

- **Site URL:** `https://nagarseva-mumbai.vercel.app`
- **Redirect URLs:** `https://nagarseva-mumbai.vercel.app/reset-password`

### Run Locally

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

---

## Authentication & Routing

- Any email can sign up as a citizen user
- Emails listed in `admin_emails` are routed to the Admin Dashboard on login
- Forgot Password sends a reset link; `/reset-password` handles the new password flow
- Every login is recorded in `login_logs` with role and timestamp
- Display name and password are editable from the My Account panel; email cannot be changed

---

## Deployment

Deployed on **Vercel** with automatic redeployment on every push to `main`.

To deploy your own instance:

1. Fork this repository
2. Import on [vercel.com](https://vercel.com)
3. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` as environment variables
4. Ensure `vercel.json` contains:

```json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```

5. Deploy

---

## Project Structure

```
src/
├── components/        # MapComponent, ProfileSidebar, AdminPanel, UI primitives
├── pages/             # Auth, UserDashboard, AdminDashboard, ResetPassword
├── lib/               # Supabase client
├── hooks/             # Custom React hooks
└── types/             # TypeScript type definitions
supabase/
└── functions/
    └── notify-status-change/   # Edge function for status change notifications
```

---

## Changelog

### v1.2 — April 2026
- Added My Account icon to top navbar (outside sidebar panel)
- Edit Profile: users can update display name and password; email is locked
- Added `profiles` table with RLS policies
- Fixed ProfileSidebar syntax error causing Vercel build failure
- Display name now refreshes in UI immediately after save without page reload

### v1.1
- Admin login activity log with role, timestamp, and IP
- Realtime status updates reflected on map pins instantly
- Forgot password + reset password flow

### v1.0
- Initial release: citizen issue reporting, interactive Leaflet map, Supabase backend, admin dashboard

---

## Built By

**Sakshi Mishra** — Final Year CS Engineering Student  
Shree L.R. Tiwari College of Engineering, University of Mumbai

[![GitHub](https://img.shields.io/badge/GitHub-Sakshiblip-181717?style=flat&logo=github)](https://github.com/Sakshiblip)
[![LinkedIn](https://img.shields.io/badge/LinkedIn-sakshi--mishra-0A66C2?style=flat&logo=linkedin)](https://linkedin.com/in/sakshi-mishra-69623928a/)
[![Live App](https://img.shields.io/badge/Live-nagarseva--mumbai.vercel.app-00d4aa?style=flat)](https://nagarseva-mumbai.vercel.app)

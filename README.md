# NagarSeva — Citizen Issue Reporting Portal

> A real-time geospatial civic issue reporting platform that connects citizens with local administration to resolve urban problems faster.

🌐 **Live App:** [nagarseva-mumbai.vercel.app](https://nagarseva-mumbai.vercel.app)

---

## What is NagarSeva?

NagarSeva (meaning "City Service") is a full-stack web application that allows citizens to report civic issues — like potholes, garbage disposal problems, broken street lights, and flooding — directly on an interactive map. Administrators can monitor all reported issues in real time, update their status, and mark them as resolved.

---

## Features

### For Citizens
- Report civic issues by clicking directly on the map
- Auto-populated GPS coordinates on location click
- Upload photos of the issue
- Write a description of the problem
- View all issues reported across the city on the map
- Track the status of your own submitted reports
- Other users' identities are kept anonymous

### For Administrators
- Real-time issue feed with live updates
- Filter issues by status and type
- Update issue status (Pending → In Progress → Resolved)
- View exact coordinates and full reporter details
- Pin color changes instantly on the map when status is updated

### Map Pin System
| Color | Meaning |
|-------|---------|
| 🔴 Red | Issue reported — no action taken yet |
| 🟡 Yellow | Administration is actively working on it |
| 🟢 Green | Issue resolved and work completed |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React + TypeScript + Vite |
| Styling | Tailwind CSS |
| Map | Leaflet.js + React-Leaflet + OpenStreetMap |
| Backend | Supabase (Auth + Database + Realtime + Storage) |
| Routing | React Router v6 |
| Deployment | Vercel |

---

## Database Schema

### `issues` table
| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | Primary key |
| `user_id` | uuid | FK to auth.users |
| `email` | text | Reporter email |
| `lat` | float | Latitude coordinate |
| `lng` | float | Longitude coordinate |
| `issue_type` | text | garbage / pothole / light / flooding / other |
| `description` | text | Issue description |
| `image_urls` | text[] | Array of uploaded image URLs |
| `status` | text | pending / in_progress / resolved |
| `created_at` | timestamptz | Submission timestamp |
| `updated_at` | timestamptz | Last update timestamp |

### `admin_emails` table
| Column | Type | Description |
|--------|------|-------------|
| `email` | text | Primary key — emails with admin access |

---

## Getting Started

### Prerequisites
- Node.js v18+
- A Supabase project with the schema above

### Installation

```bash
# Clone the repository
git clone https://github.com/Sakshiblip/nagarseva.git
cd nagarseva

# Install dependencies
npm install

# Create environment file
cp .env.example .env
```

### Environment Variables

Create a `.env` file in the project root:

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_publishable_key
```

### Supabase Setup

Run the following SQL in your Supabase SQL Editor:

```sql
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

create table admin_emails (
  email text primary key
);

-- Add your admin email
insert into admin_emails (email) values ('your-admin@email.com');

-- Enable Realtime
alter publication supabase_realtime add table issues;

-- RLS Policies
create policy "Users can insert issues" on issues for insert to authenticated with check (auth.uid() = user_id);
create policy "Users can read all issues" on issues for select to authenticated using (true);
create policy "Authenticated users can update issues" on issues for update to authenticated using (true);
create policy "Authenticated users can read admin_emails" on admin_emails for select to authenticated using (true);
create policy "Authenticated users can upload images" on storage.objects for insert to authenticated with check (bucket_id = 'issue-images');
create policy "Public can view images" on storage.objects for select to public using (bucket_id = 'issue-images');
```

Also create a **public Storage bucket** named `issue-images` in Supabase → Storage.

### Run Locally

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## Authentication & Routing

- Any email can sign up as a citizen user
- Emails listed in the `admin_emails` table are routed to the Admin Dashboard on login
- Forgot Password flow supported via Supabase email reset

---

## Deployment

This project is deployed on **Vercel** with automatic redeployment on every push to the `main` branch.

To deploy your own instance:
1. Fork this repository
2. Import the repo on [vercel.com](https://vercel.com)
3. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` as environment variables
4. Deploy

---

## Project Structure

```
src/
├── components/        # Reusable UI components
├── pages/             # Auth, User Dashboard, Admin Dashboard
├── lib/               # Supabase client setup
├── hooks/             # Custom React hooks
└── types/             # TypeScript type definitions
```

---

## Built By

**Sakshi Mishra** — Final Year CS Engineering Student, Mumbai University

[![GitHub](https://img.shields.io/badge/GitHub-Sakshiblip-181717?style=flat&logo=github)](https://github.com/Sakshiblip)

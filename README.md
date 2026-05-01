<div align="center">


# NagarSeva

**Civic Issue Reporting Platform for Mumbai**

[![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](https://reactjs.org/)
[![Vite](https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white)](https://supabase.com/)
[![Vercel](https://img.shields.io/badge/Vercel-000000?style=for-the-badge&logo=vercel&logoColor=white)](https://vercel.com/)

[Live Demo](https://nagarseva.vercel.app) · [Report a Bug](../../issues) · [Request a Feature](../../issues)

</div>

---

## Overview

NagarSeva is a full-stack civic issue reporting web application designed for Mumbai residents. Citizens can report local infrastructure problems — potholes, broken streetlights, garbage overflow, water leakages — pin their exact location on an interactive map, and track resolution status. Ward administrators get a dedicated dashboard to manage and update reported issues.

The goal: bridge the gap between Mumbai's citizens and municipal authorities with a transparent, location-aware reporting system.

---

## Features

### Citizen Portal
- Submit civic issue reports with title, description, category, and photo upload
- Pin issue location interactively using Leaflet.js map
- Auto-detect current location via browser geolocation API
- View all reported issues on a live map
- Track issue status — Reported, In Progress, Resolved

### Admin Dashboard
- View all submitted reports with filter and sort controls
- Update issue status and add resolution notes
- Email notifications on status changes via Resend API
- Ward-level overview of active issues

### Platform
- Role-based access: Citizen and Admin routes (Supabase Auth)
- Fully responsive UI — mobile and desktop
- Deployed on Vercel with environment-based config

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite, Tailwind CSS |
| Maps | Leaflet.js |
| Backend / DB | Supabase (PostgreSQL + Auth + Storage) |
| Email | Resend API |
| Deployment | Vercel |
| Version Control | Git + GitHub |

---

## Project Structure

```
nagarseva/
├── public/
├── src/
│   ├── components/       # Reusable UI components
│   ├── pages/            # Route-level pages (Home, Report, Dashboard, etc.)
│   ├── lib/              # Supabase client and helpers
│   ├── hooks/            # Custom React hooks
│   └── main.jsx
├── .env.example
├── index.html
├── tailwind.config.js
├── vite.config.js
└── package.json
```

---

## Getting Started

### Prerequisites

- Node.js v18+
- A [Supabase](https://supabase.com) project (free tier works)
- A [Resend](https://resend.com) account for email notifications

### Installation

```bash
# Clone the repo
git clone https://github.com/Sakshiblip/nagarseva.git
cd nagarseva

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
```

### Environment Variables

Create a `.env` file in the root with:

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
RESEND_API_KEY=your_resend_api_key
```

> Note: Only variables prefixed with `VITE_` are exposed to the frontend. `RESEND_API_KEY` is server-side only.

### Run Locally

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## Deployment

This project is deployed on **Vercel**. To deploy your own instance:

1. Push the repo to GitHub
2. Import it into [Vercel](https://vercel.com)
3. Add the three environment variables under **Project Settings → Environment Variables**
4. Deploy

---

## Database Schema (Supabase)

Key tables:

- `profiles` — user metadata, role (citizen / admin)
- `issues` — reported civic issues (title, description, category, status, lat/lng, image_url)
- `wards` — Mumbai ward reference data

Row-Level Security (RLS) is enabled on all tables.

---

## Roadmap

- [ ] Push notifications for status updates
- [ ] Upvoting / community prioritisation of issues
- [ ] Ward-level heatmap analytics
- [ ] PWA support for offline reporting
- [ ] Integration with BMC complaint portal

---

## Contributing

Pull requests are welcome. For major changes, open an issue first to discuss what you'd like to change.

```bash
# Create a feature branch
git checkout -b feature/your-feature-name

# Commit changes
git commit -m "feat: add your feature"

# Push and open a PR
git push origin feature/your-feature-name
```

---

## License

Distributed under the MIT License. See `LICENSE` for details.

---

## Acknowledgements

- [Supabase](https://supabase.com) — backend as a service
- [Leaflet.js](https://leafletjs.com) — interactive maps
- [Tailwind CSS](https://tailwindcss.com) — utility-first styling
- [Resend](https://resend.com) — transactional email
- [Vercel](https://vercel.com) — deployment

---

<div align="center">
Built with intent for Mumbai, by <a href="https://github.com/Sakshiblip">Sakshi Mishra</a>
</div>

# STS — Sales Tracking System

STS is a multi-tenant SaaS platform for tracking a field sales / promoter team: managing employees, scheduling and logging client meetings, live GPS tracking of field staff, daily sales reports (DSR), and site-visit photo capture. It supports multiple companies (tenants) on one deployment, each with its own staff, subscription/trial status, and enabled modules.

## Who uses it

- **Super Admin** — platform owner. Approves/rejects 7-day free trial requests, manages all tenant companies (activate/suspend, view stats).
- **Admin** — a company's account owner. Manages employees, views dashboards, daily reports, meeting allocation, and company settings.
- **Employee / Field Sales** — logs client meetings, submits DSR entries, uploads site-visit photos, and (for field roles) broadcasts live GPS location.

## Key features

- JWT-based authentication with role-based access (SuperAdmin / Admin / Employee)
- Self-serve **7-Day Free Trial** request flow, reviewed and approved by the Super Admin, which auto-provisions a company + admin account
- Multi-tenant company management with subscription/trial expiry tracking
- Employee management (roles, departments, designations, profile pictures)
- Sales meeting scheduling and tracking board, Daily Sales Report (DSR) entries
- Site-visit photo uploads per sales record
- Live GPS tracking of field employees via SignalR (WebSocket hub)
- Automated transactional emails (welcome email with credentials, OTP for email change, trial-request notification to Super Admin) via SMTP
- Interactive API reference (Scalar UI) generated from the API's OpenAPI spec

## Tech stack

**Backend** — ASP.NET Core 10 Web API (C#), Entity Framework Core (SQL Server), JWT Bearer auth, SignalR, MailKit (SMTP email), Scalar (API docs).

**Frontend** — React 19 + Vite, React Router, React Hook Form, Axios, Tailwind CSS, Recharts (charts), Leaflet / React-Leaflet (maps), @microsoft/signalr (live GPS), react-hot-toast.

## Project structure

```
ideaspromowork/
├── backend/
│   ├── STS/STS/          # ASP.NET Core Web API (the actual backend service)
│   │   ├── Controllers/  # Auth, Admin, SuperAdmin, Employee, Profile, Settings, TrialRequest
│   │   ├── Data/         # AppDbContext (EF Core)
│   │   ├── Hubs/         # SignalR GpsHub (live location)
│   │   ├── Migrations/   # EF Core migrations
│   │   ├── Models/       # EF entities
│   │   ├── Services/     # AuthService, EmailService
│   │   └── appsettings.json
│   └── TestApp/          # Small standalone console app to test SMTP email sending in isolation
└── frontend/             # React + Vite single-page app
```

## Prerequisites

Make sure these are installed before running the project:

- [.NET 10 SDK](https://dotnet.microsoft.com/download)
- [SQL Server](https://www.microsoft.com/sql-server) (LocalDB, Express, or full edition) — reachable from your machine
- [Node.js](https://nodejs.org/) (includes npm)
- EF Core CLI tool (one-time): `dotnet tool install --global dotnet-ef`

## Backend setup (`backend/STS/STS`)

1. Open `appsettings.json` and set your own SQL Server connection string:
   ```json
   "ConnectionStrings": {
     "DefaultConnection": "Server=localhost;Database=STS_DB;Trusted_Connection=True;TrustServerCertificate=True;"
   }
   ```
   Adjust `Server=` to match your SQL Server instance (e.g. `.\SQLEXPRESS`, or a full connection string with SQL auth).

2. Configure email sending (optional but needed for welcome/OTP/trial-notification emails) under `EmailSettings`, and the Super Admin notification recipient under `Superadminmailid`:
   ```json
   "EmailSettings": {
     "SmtpServer": "mail.ideaspromotion.com",
     "Port": 587,
     "SenderName": "Ideas Promo Solution",
     "SenderEmail": "wecare-noreply@ideaspromotion.com",
     "Password": "<your-smtp-password>"
   },
   "Superadminmailid": "<super-admin-inbox>@example.com"
   ```
   You can verify SMTP credentials independently with `backend/TestApp` (`dotnet run` inside that folder) before wiring them into the main API.

3. Apply database migrations (creates `STS_DB` and all tables):
   ```bash
   cd backend/STS/STS
   dotnet ef database update
   ```

4. Run the API:
   ```bash
   dotnet run
   ```
   By default it listens on:
   - HTTP: `http://localhost:5066`
   - HTTPS: `https://localhost:7202`

   On first run it auto-seeds two accounts:
   - Admin: `stsadmin@gmail.com`
   - Super Admin: `superadmin@sts.com`

   (Check `Program.cs` for the seeded password hashes / see with your team for the actual login passwords.)

5. If the browser refuses `https://localhost:7202` due to a self-signed dev certificate, trust it once:
   ```bash
   dotnet dev-certs https --trust
   ```

6. Interactive API docs (Development environment only): open `https://localhost:7202/scalar/v1` in a browser, or fetch the raw OpenAPI spec at `https://localhost:7202/openapi/v1.json`.

## Frontend setup (`frontend`)

1. Install dependencies:
   ```bash
   cd frontend
   npm install
   ```

2. Configure the API base URL in `.env` so it matches wherever the backend is running:
   ```
   VITE_API_BASE_URL=https://localhost:7202/api
   ```

3. Run the dev server:
   ```bash
   npm run dev
   ```
   Opens at `http://localhost:5173`.

4. Build for production:
   ```bash
   npm run build
   ```
   Output goes to `dist/`, which can be served by any static file host or CDN.

## Notes for deployment

- CORS on the backend is currently wide open (`AllowAnyOrigin`), so the frontend can be deployed to any domain without extra backend config. Consider restricting it to your production frontend domain(s) once known.
- `VITE_API_BASE_URL` must always point at the backend's actual reachable URL for the environment you're deploying to (localhost for dev, your real API domain for production).
- SMTP credentials in `appsettings.json` must be valid or trial-request/welcome/OTP emails will silently fail (the failure is logged but does not block the underlying user action).
- Uploaded files (profile pictures, site-visit images) are stored on local disk under `backend/STS/STS/profilepics` and `backend/STS/STS/siteimages` — make sure these folders are writable and persisted (e.g. on a mounted volume) in your deployment environment.

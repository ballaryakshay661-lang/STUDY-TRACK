# STUDY-TRACK

📚 StudyTrack — Student Assignment & Deadline Tracker

A simple and responsive web application that helps students organize
assignments, manage deadlines, and track their academic progress.

🎯 About the Project

StudyTrack helps students manage their academic tasks in one place. It provides
a dashboard to add assignments, set due dates, prioritize work, and track
completion.

❗ Problem Statement

Students often forget deadlines and struggle to organize multiple assignments.
StudyTrack provides a centralized solution for managing assignments and
monitoring pending work.

✨ Features

- Add assignments with a name, subject, due date, and priority.
- View all assignments in a dashboard.
- Mark assignments as completed or pending.
- Edit and delete assignments.
- Filter assignments by status.
- Filter assignments by subject and priority.
- View a deadline- and priority-based Today's Study Plan.
- Use the Focus Timer with focus sessions and break modes.
- Record completed focus sessions separately from assignment data.
- Track pending, completed, and overdue tasks.
- Track assignments due today and total focus minutes.
- View completion, subject progress, and seven-day completion activity charts.
- Track overall completion with a percentage and progress bar.
- Save assignments using browser localStorage.
- Responsive interface for desktop and mobile devices.

Features listed above should be retained only if they are implemented and
working in your version.

🛠️ Technologies Used

- HTML5, CSS3, JavaScript, and browser localStorage
- Express.js, MongoDB, Mongoose, bcrypt, and JWT (backend API)
- Git, GitHub, and Visual Studio Code

📁 Project Structure

```text
STUDY-TRACK/
├── index.html
├── README.md
├── css/
│   └── style.css
├── js/
│   └── app.js
└── backend/
    ├── .env.example
    ├── package.json
    ├── package-lock.json
    └── src/
        ├── app.js
        ├── server.js
        ├── config/
        ├── controllers/
        ├── middleware/
        ├── models/
        ├── routes/
        └── utils/
```

🚀 Getting Started

### Prerequisites

- Node.js 20 or newer (for the backend)
- A modern web browser
- Live Server extension (recommended)

### Installation

1. Clone this repository:

   ```sh
   git clone YOUR_GITHUB_REPOSITORY_URL
   ```
2. Open the project folder in VS Code.
3. To run the frontend, open `index.html` with Live Server.

## Backend API

The Express API is in `backend/` and runs alongside the static frontend. It
provides a health check and MongoDB-backed user registration/login. The
frontend checks `/api/auth/me` before showing the planner, then uses the
HttpOnly cookie for signup, login, and logout. Assignment and focus-session
records still remain in browser localStorage; they are not synchronized to
MongoDB.

### Start the API locally

1. Install Node.js 20 or newer.
2. Open a terminal at the repository root and run `cd backend`.
3. Run `npm install` to install backend dependencies.
4. Copy `.env.example` to `.env` and set the environment variables below. Keep
   `.env` private; it is excluded from Git. Generate a secret locally with
   `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`.
5. Run `npm run dev` for development, or `npm start` to start the server.
6. Open `http://localhost:5000/api/health` to check that the API is responding.
7. Run `npm test` to exercise the auth endpoints without connecting to MongoDB.
8. Use the manual examples below to test against MongoDB before connecting the
   frontend.

### Run the frontend and backend together

1. Configure `backend/.env` as described above, including
   `FRONTEND_ORIGIN=http://localhost:5500`, and start MongoDB.
2. In a terminal, run `cd backend`, `npm.cmd install`, then `npm.cmd run dev`
   (on PowerShell, `npm.cmd` also works if script execution blocks `npm`).
3. In VS Code, open `index.html` with Live Server and use
   `http://localhost:5500/`. Use `localhost` for both servers so the browser
   sends the same-site auth cookie. Do not open the page as `file://`.
4. To use a different API URL or port, edit the public
   `studytrack-api-base` meta value in `index.html`; it contains no secret.
   Add the frontend's exact origin to `FRONTEND_ORIGIN` and restart the API.
5. Create an account, refresh to test session restoration, then log out. The
   assignment planner remains hidden until the API confirms a valid session.

Changed files for the authentication integration:

- `index.html` — accessible login/signup form, account controls, protected
  planner landmark, and public API URL configuration.
- `css/style.css` — responsive auth card, tabs, account controls, and the
  unauthenticated planner gate.
- `js/auth.js` — client-side validation, cookie-credentialed requests,
  loading/error states, session checks, expiry handling, and logout.
- `js/app.js` — per-account local planner storage and one-time migration of
  pre-authentication local data to the first account that signs in.
- `backend/src/controllers/authController.js`,
  `backend/src/middleware/requireAuth.js`, and `backend/src/utils/jwt.js` —
  server-verified session expiry returned to the client so it can lock the
  planner when the short-lived cookie expires.
- `backend/test/auth.test.js` — endpoint coverage for cookie auth and the
  session expiry response.
- `README.md` — setup instructions, browser integration notes, and endpoint
  testing commands.

The frontend contains no MongoDB URI or server/JWT secrets. The backend
continues to enforce authentication for `/api/auth/me`; private planner data
is still local to this browser and has no server-side assignment API yet.

### Backend environment variables

- `MONGODB_URI` — required MongoDB connection string.
- `JWT_SECRET` — required, unique random secret of at least 32 bytes.
- `JWT_EXPIRES_IN` — optional JWT and cookie lifetime such as `15m` or `1h`;
  defaults to `15m` and cannot exceed 24 hours.
- `FRONTEND_ORIGIN` — comma-separated list of exact frontend origins, including
  scheme and port (no wildcards). Defaults to the local Live Server origins
  shown in `.env.example`.
- `PORT` — optional API port; defaults to `5000`.
- `NODE_ENV` — set to `production` in production to enable the cookie's
  `Secure` flag. Production must use HTTPS.

The API puts the short-lived JWT in an HttpOnly, SameSite=Lax cookie; it never
returns tokens in JSON or stores them in browser localStorage. Auth responses
are not cached. Browser registration, login, and logout requests must include
an `Origin` matching `FRONTEND_ORIGIN`; credentialed CORS allows only those
exact origins. The exact-Origin check protects state-changing auth requests
from CSRF. Keep the frontend and API same-site so the Lax cookie is sent.
Authentication endpoints are rate-limited. Passwords are bcrypt-hashed and
never returned. When the frontend is connected, send credentialed requests
with `credentials: "include"`; never copy an authentication token into
localStorage.

### Test every auth endpoint with curl

Run these PowerShell examples after starting the API. Set `$origin` to one
exact value in `FRONTEND_ORIGIN`. The cookie jar models browser cookie handling;
the HttpOnly cookie is not available to frontend JavaScript.

```powershell
$origin = "http://127.0.0.1:5500"
$api = "http://127.0.0.1:5000"

# Register (201); saves the HttpOnly cookie to the jar.
curl.exe -i -c cookies.txt -H "Origin: $origin" -H "Content-Type: application/json" `
  --data '{"name":"Alex Student","email":"alex@example.com","password":"correct-horse-42"}' `
  "$api/api/auth/register"

# Duplicate registration (409).
curl.exe -i -H "Origin: $origin" -H "Content-Type: application/json" `
  --data '{"name":"Alex Student","email":"ALEX@example.com","password":"correct-horse-42"}' `
  "$api/api/auth/register"

# Invalid credentials (401, generic email/password error).
curl.exe -i -H "Origin: $origin" -H "Content-Type: application/json" `
  --data '{"email":"alex@example.com","password":"not-the-password"}' `
  "$api/api/auth/login"

# Login (200); updates the cookie jar.
curl.exe -i -b cookies.txt -c cookies.txt -H "Origin: $origin" `
  -H "Content-Type: application/json" `
  --data '{"email":"alex@example.com","password":"correct-horse-42"}' `
  "$api/api/auth/login"

# Authenticated current-user request (200). Try without -b cookies.txt for 401.
curl.exe -i -b cookies.txt "$api/api/auth/me"

# Logout (204); clears the cookie. Retest /me with the jar for 401.
curl.exe -i -b cookies.txt -c cookies.txt -H "Origin: $origin" `
  -X POST "$api/api/auth/logout"
curl.exe -i -b cookies.txt "$api/api/auth/me"
```

Do not commit `cookies.txt`; it contains an authentication credential. For
production, use HTTPS and a same-site frontend/API deployment.

📖 How to Use

1. Enter an assignment name and subject.
2. Choose a due date and priority.
3. Add the assignment.
4. View and filter your assignments.
5. Mark tasks as completed when finished.
6. Edit or delete tasks when needed.
7. Review Today's Study Plan and choose **Focus on this task** to associate an
   assignment with the timer.
8. Start, pause, resume, or reset a focus session. Only sessions that reach
   zero are recorded.

💾 Data Storage

StudyTrack uses browser localStorage to save assignments locally. Data is not
automatically synchronized across devices, and clearing browser storage may
remove saved tasks. Completed focus sessions are saved separately under
`studytrack.focusSessions`; they do not replace assignment data. New assignment
completion dates are saved with the assignment as `completedAt`. Older
completed assignments are not given invented dates and are excluded from the
weekly activity chart. Charts use Chart.js 4.5.1 from jsDelivr; if the CDN is
unavailable, assignment management and summary statistics still work and the
charts display an unavailable message.

🔮 Future Enhancements

- Assignment and focus-session APIs with frontend synchronization
- Email verification and password reset
- Cross-device cloud synchronization
- Calendar view and reminders
- Assignment search and sorting
- Export assignments to CSV or PDF
- Dark mode

👨‍💻 Author

Akshay C. Ballary

Student | Interested in Software Development and Artificial Intelligence

GitHub: https://github.com/ballaryakshay661-lang/STUDY-TRACK

[🚀 Open StudyTrack Website](https://ballaryakshay661-lang.github.io/STUDY-TRACK/)

📄 License

Choose and add an appropriate open-source license before claiming that the
project is released under one.

---

⭐ If you find this project useful, consider starring the repository!

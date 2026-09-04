# YenSync - College Department Timetable Management & Scheduling System

YenSync is an automated timetable generation, clash prevention, and schedule management system built for college departments.

## Tech Stack
- **Frontend**: React + Tailwind CSS
- **Backend**: Node.js + Express
- **Database**: PostgreSQL
- **Auth**: JWT-based authentication with bcrypt hashing (Admin & Faculty roles)

---

## Project Structure
```
YenSync/
├── backend/
│   ├── migrations/
│   │   ├── 001_initial_schema.sql  # Exact DB schema tables & constraints
│   │   ├── 002_seed_data.sql        # Initial department, faculty, semesters, timeslots, subjects
│   │   └── migrate.js               # Database migration execution script
│   ├── src/
│   │   ├── config/
│   │   │   └── db.js                # PostgreSQL connection pool
│   │   ├── controllers/             # Auth, CRUD & Timetable controllers
│   │   ├── middleware/              # JWT authentication & role-based access control
│   │   ├── routes/                  # Express API route declarations
│   │   ├── services/
│   │   │   ├── clashDetector.js     # Standalone testable clash detection engine
│   │   │   └── scheduler.js         # Multi-semester backtracking CSP scheduler
│   │   └── server.js                # Express app entry point
│   ├── tests/
│   │   ├── clashDetector.test.js    # Unit tests for conflict detection
│   │   ├── scheduler.test.js        # Multi-semester clash-free schedule solver tests
│   │   └── runAllTests.js           # Test runner
│   ├── .env.example
│   └── package.json
└── frontend/                        # React + Tailwind CSS client
```

---

## Database Schema Overview
1. `department` (id, name)
2. `faculty` (id, faculty_code UNIQUE, name, password_hash, role, department_id FK)
3. `semester` (id, number, department_id FK, class_room, academic_year)
4. `subject` (id, subject_code UNIQUE, name, semester_id FK, faculty_id FK, weekly_hours, is_lab BOOLEAN)
5. `timeslot` (id, day, period_number, start_time, end_time)
6. `timetable_entry` (id, subject_id FK, semester_id FK, timeslot_id FK, academic_year)
7. `academic_calendar` (id, date, type ENUM('holiday','working'), remarks)

---

## Running Database Migrations
1. Configure `.env` in `backend/` with your PostgreSQL credentials.
2. Run migrations:
   ```bash
   npm --prefix backend run migrate
   ```

---

## Running Tests
Run all unit and algorithm tests:
```bash
npm --prefix backend test
```

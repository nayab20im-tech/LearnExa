# LearnExa Full-Stack Project

This is the redesigned LearnExa package with the complete frontend and backend.

## Brand

- **Name:** LearnExa
- **Tagline:** Learn · Explore · Excel
- **Visual direction:** deep navy, cobalt blue, aqua, coral, and warm white

## Important security action

The originally uploaded backend contained live secrets in `.env`, and the MongoDB credential was also duplicated inside a JavaScript diagnostic file. The hardcoded copy was removed and `.env` is excluded from this package.

Rotate these credentials before deployment:

- MongoDB Atlas database-user password
- JWT secret
- Google OAuth client secret
- Gemini API key
- Cloudinary API secret

## 1. Configure the backend

```bash
cd backend
cp .env.example .env
nano .env
npm install
npm run verify:auth
npm run dev
```

Backend address:

```text
http://localhost:5000
```

Health check:

```bash
curl http://localhost:5000/api/health
```

## 2. Start the frontend

Open another terminal:

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

Frontend address:

```text
http://localhost:5173
```

## 3. Final local validation

```bash
cd backend
npm run check

cd ../frontend
npm run lint
npm run build
```

## 4. Test the main flow

1. Open `/register`.
2. Create a Student or Teacher account.
3. Confirm that the dashboard opens.
4. Log out and sign in again.
5. Test quiz creation, publishing, access code, attempt, evaluation, report, notification routing, avatar saving, and leaderboard refresh.

Read `UI_UPGRADE_2026.md` for the complete LearnExa redesign summary.

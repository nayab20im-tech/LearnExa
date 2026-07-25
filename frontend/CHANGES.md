# LearnExa Integration Changes

## Authentication
- Centralized API origin and cookie configuration.
- Registration now creates an authenticated session.
- Login stores the complete current-user state.
- Added useful backend-offline and timeout messages.
- Corrected Google OAuth URL generation.

## Real application data
- Student dashboard uses MongoDB analytics, quizzes, grades, trends, and subject results.
- Teacher dashboard uses real counts, recent submissions, and grade export data.
- Quiz attempt fetches the selected quiz from the API.
- Quiz answers, time used, and integrity warnings are submitted to MongoDB.
- Result pages fetch the saved submission and question-level feedback.
- Removed mock quiz questions and mock result values from the core quiz flow.

## API configuration
- Added `src/api/client.js`.
- Added `.env.example` with `VITE_API_URL`.
- Removed hardcoded API URLs from components and pages.

## Verification
- Current source passes JS/JSX syntax parsing.
- Run `npm run lint` and `npm run build` after `npm install` on the deployment machine.
- See the root `UI_UPGRADE_2026.md` for the latest interface and live-feature changes.

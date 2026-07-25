# LearnExa Vercel deployment notes

This copy is prepared for a GitHub repository and Vercel deployment.

## Projects

Create two Vercel projects from the same GitHub repository:

- Backend root directory: `backend`
- Frontend root directory: `frontend`

## Backend variables

Set these in the backend Vercel project:

- `NODE_ENV=production`
- `MONGODB_URI`
- `CLIENT_URL`
- `JWT_SECRET`
- `JWT_EXPIRES_IN=7d`
- `GOOGLE_CLIENT_ID` (optional)
- `GOOGLE_CLIENT_SECRET` (optional)
- `GOOGLE_CALLBACK_URL` (optional)
- `GEMINI_API_KEY` (optional)
- `GEMINI_MODEL=gemini-2.5-flash` (optional)
- `CLOUDINARY_CLOUD_NAME` (optional)
- `CLOUDINARY_API_KEY` (optional)
- `CLOUDINARY_API_SECRET` (optional)

Do not add `PORT`; Vercel manages it.

## Frontend variable

Set this in the frontend Vercel project:

- `VITE_API_URL=https://YOUR-BACKEND-PROJECT.vercel.app`

After changing environment variables, redeploy the affected project.

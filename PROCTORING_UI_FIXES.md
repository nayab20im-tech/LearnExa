# LearnExa Proctoring and UI Fixes

## Proctoring behavior

1. A hidden quiz tab, minimized browser, or quiz window focus loss is recorded as a focus-loss incident.
2. Copy, cut, and quiz-page context-menu attempts are blocked and recorded.
3. The first integrity incident displays an automatic warning to the student.
4. The second incident hides the quiz and displays a locked assessment screen.
5. The quiz timer continues while access is locked.
6. Only the teacher who owns the quiz, or an administrator, can restore the quiz from Live Monitoring.
7. After restoration, another incident locks the quiz again.
8. Live Monitoring shows focus/minimize incidents, copying actions, violations, lock reason, and recent activity.
9. The teacher's Send Warning and Restore Quiz buttons call real backend routes.
10. Duplicate unfinished monitoring sessions for the same student and quiz are reused and deduplicated.

> Browser note: web browsers do not expose a dependable API that distinguishes a changed tab from a minimized window. LearnExa records both reliably as a hidden/focus-loss event and identifies visible-window blur separately in the activity label.

## Avatar behavior

New users now see a neutral, non-gendered profile symbol. The illustrated avatar appears only after the user opens the avatar studio and saves a design.

## UI improvements

The landing page received richer typography, depth, hover motion, product-preview movement, and improved CTA interactions. Login and registration now use a polished glass card, stronger typography, refined fields, and more responsive spacing.

## Verification completed

- Backend Node syntax checks passed.
- Backend automated tests passed.
- Frontend ESLint passed.
- Frontend production build passed.

## Local testing sequence

1. Start backend and frontend.
2. Log in as teacher in one browser profile.
3. Log in as a student in another browser profile.
4. Start a quiz.
5. First: switch tab, minimize, or copy text. Confirm the automatic warning.
6. Second: repeat an integrity event. Confirm the locked screen.
7. In Teacher > Live Monitoring, click Restore quiz.
8. Confirm the student quiz screen returns automatically.

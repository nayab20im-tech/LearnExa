# LearnExa feature update

## Private quiz access codes

- Every quiz receives a unique 8-character access code automatically.
- Teachers can copy or regenerate codes from the teacher dashboard.
- Students can start a listed quiz only after entering the correct code.
- Students can also use **Join with code** to open a quiz that is not in their list.
- The backend verifies the code again during submission, so bypassing the frontend does not work.
- Existing quizzes receive codes automatically the next time the backend starts.

## Evaluation modes

Teachers choose one option while preparing a quiz:

- **Automatic AI evaluation**: MCQs and short answers are evaluated immediately. The student receives a result, while the teacher can still change AI marks and feedback.
- **Teacher approval required**: AI prepares short-answer suggestions, but the result remains under review until the teacher approves the answers.

## Runtime evaluation monitoring

The Live Monitoring page refreshes every four seconds and shows:

- Active quiz sessions
- Integrity warnings and tab switches
- Recently submitted quizzes
- Automatic AI scores
- Whether teacher review is still required

## Teacher overrides

The Evaluations page has two views:

- Pending review
- Automatic / completed

Teachers can edit the score and feedback in either view. Changes recalculate the final percentage and notify the student.

## PDF reports

- Students can download a detailed PDF from the quiz result page.
- Students can reopen recent results from their dashboard and download the report later.
- Teachers can download an overall PDF performance report from the teacher dashboard.
- Teachers can download a detailed PDF for an individual submission from the Evaluations page.

## Run checks

Backend:

```bash
cd backend
npm install
npm test
npm run dev
```

Frontend:

```bash
cd frontend
npm install
npm run lint
npm run dev
```

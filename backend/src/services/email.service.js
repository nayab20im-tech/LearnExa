const nodemailer = require('nodemailer');

let transporter = null;

const escapeHtml = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

const isEmailConfigured = () =>
  Boolean(
    process.env.EMAIL_USER?.trim() &&
      process.env.EMAIL_APP_PASSWORD?.trim()
  );

const getTransporter = () => {
  if (transporter) return transporter;

  if (!isEmailConfigured()) {
    return null;
  }

  const port = Number(process.env.EMAIL_PORT || 465);
  const secure =
    String(process.env.EMAIL_SECURE || 'true').toLowerCase() ===
    'true';

  transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port,
    secure,
    auth: {
      user: process.env.EMAIL_USER.trim(),
      pass: process.env.EMAIL_APP_PASSWORD.trim().replace(/\s+/g, '')
    },
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 20000
  });

  return transporter;
};

const buildGradeEmailHtml = ({
  studentName,
  quizTitle,
  marksObtained,
  totalMarks,
  percentage,
  status,
  teacherFeedback,
  resultUrl
}) => {
  const safeStudent = escapeHtml(studentName || 'Student');
  const safeQuiz = escapeHtml(quizTitle || 'Assessment');
  const safeMarks = escapeHtml(marksObtained);
  const safeTotal = escapeHtml(totalMarks);
  const safePercentage = escapeHtml(percentage);
  const safeStatus = escapeHtml(status || 'Fully graded');
  const safeFeedback = escapeHtml(
    teacherFeedback || 'No overall teacher feedback was added.'
  );
  const safeUrl = escapeHtml(resultUrl);

  return `
    <!doctype html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>LearnExa Grade Update</title>
      </head>
      <body style="margin:0;background:#f4f6fb;font-family:Arial,Helvetica,sans-serif;color:#172033;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f6fb;padding:28px 12px;">
          <tr>
            <td align="center">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;background:#ffffff;border:1px solid #e1e5ee;border-radius:16px;overflow:hidden;">
                <tr>
                  <td style="background:#0e1a38;padding:28px 32px;border-bottom:5px solid #6d47e5;">
                    <div style="font-size:28px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">LearnExa</div>
                    <div style="margin-top:8px;font-size:14px;color:#d5dced;">Your assessment result is ready</div>
                  </td>
                </tr>
                <tr>
                  <td style="padding:30px 32px;">
                    <p style="margin:0 0 12px;font-size:16px;line-height:1.6;">Hello <strong>${safeStudent}</strong>,</p>
                    <p style="margin:0 0 22px;font-size:15px;line-height:1.7;color:#4d5668;">
                      Your grades for <strong style="color:#172033;">${safeQuiz}</strong> have been published in LearnExa.
                    </p>

                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:separate;border-spacing:10px 0;margin:0 -10px 22px;">
                      <tr>
                        <td width="33.33%" style="background:#f0ebff;border:1px solid #ded3ff;border-radius:12px;padding:18px 14px;">
                          <div style="font-size:11px;font-weight:700;color:#677086;text-transform:uppercase;">Marks</div>
                          <div style="margin-top:8px;font-size:22px;font-weight:800;color:#6138d2;">${safeMarks} / ${safeTotal}</div>
                        </td>
                        <td width="33.33%" style="background:#eaf9f2;border:1px solid #c9efdf;border-radius:12px;padding:18px 14px;">
                          <div style="font-size:11px;font-weight:700;color:#677086;text-transform:uppercase;">Percentage</div>
                          <div style="margin-top:8px;font-size:22px;font-weight:800;color:#05875d;">${safePercentage}%</div>
                        </td>
                        <td width="33.33%" style="background:#edf5ff;border:1px solid #d2e6ff;border-radius:12px;padding:18px 14px;">
                          <div style="font-size:11px;font-weight:700;color:#677086;text-transform:uppercase;">Status</div>
                          <div style="margin-top:8px;font-size:15px;font-weight:800;color:#172033;">${safeStatus}</div>
                        </td>
                      </tr>
                    </table>

                    <div style="background:#f8f9fc;border:1px solid #e3e6ee;border-radius:12px;padding:18px 20px;margin-bottom:24px;">
                      <div style="font-size:12px;font-weight:800;color:#6138d2;text-transform:uppercase;margin-bottom:8px;">Teacher feedback</div>
                      <div style="font-size:14px;line-height:1.7;color:#394256;">${safeFeedback}</div>
                    </div>

                    <div style="text-align:center;margin:26px 0 8px;">
                      <a href="${safeUrl}" style="display:inline-block;background:#6138d2;color:#ffffff;text-decoration:none;font-size:14px;font-weight:700;padding:13px 24px;border-radius:10px;">View complete result</a>
                    </div>
                  </td>
                </tr>
                <tr>
                  <td style="padding:18px 32px;background:#f8f9fc;border-top:1px solid #e3e6ee;font-size:12px;line-height:1.6;color:#737b8d;">
                    This is an automated academic notification from LearnExa. You can also download the detailed PDF report from your result page.
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `;
};

const sendGradeEmail = async ({
  to,
  studentName,
  quizTitle,
  marksObtained,
  totalMarks,
  percentage,
  status,
  teacherFeedback,
  resultUrl
}) => {
  if (!to) {
    return {
      sent: false,
      reason: 'Student email address is missing.'
    };
  }

  const mailTransporter = getTransporter();

  if (!mailTransporter) {
    console.warn(
      'Grade email was skipped because EMAIL_USER or EMAIL_APP_PASSWORD is not configured.'
    );

    return {
      sent: false,
      reason: 'Email service is not configured.'
    };
  }

  const fromName = process.env.EMAIL_FROM_NAME || 'LearnExa';
  const fromAddress = process.env.EMAIL_FROM || process.env.EMAIL_USER;

  const info = await mailTransporter.sendMail({
    from: `"${fromName}" <${fromAddress}>`,
    to,
    subject: `Your LearnExa result: ${quizTitle || 'Assessment'}`,
    text: [
      `Hello ${studentName || 'Student'},`,
      '',
      `Your result for ${quizTitle || 'the assessment'} is ready.`,
      `Marks: ${marksObtained} / ${totalMarks}`,
      `Percentage: ${percentage}%`,
      `Status: ${status || 'Fully graded'}`,
      `Teacher feedback: ${teacherFeedback || 'No overall feedback was added.'}`,
      '',
      `View your result: ${resultUrl}`,
      '',
      'LearnExa'
    ].join('\n'),
    html: buildGradeEmailHtml({
      studentName,
      quizTitle,
      marksObtained,
      totalMarks,
      percentage,
      status,
      teacherFeedback,
      resultUrl
    })
  });

  return {
    sent: true,
    messageId: info.messageId
  };
};

module.exports = {
  isEmailConfigured,
  sendGradeEmail
};

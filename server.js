require('dotenv').config();

const express = require('express');
const nodemailer = require('nodemailer');
const path = require('path');

const app = express();
const PORT = Number(process.env.PORT || 3000);

app.use(express.json());
app.use(express.static(__dirname));

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: Number(process.env.SMTP_PORT || 465),
  secure: String(process.env.SMTP_SECURE || 'true').toLowerCase() === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: (process.env.SMTP_PASS || '').replace(/\s/g, '')
  }
});

// Gmail SMTP connection test
app.get('/api/test-email', async (req, res) => {
  try {
    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
      return res.status(400).json({
        ok: false,
        error: 'SMTP_USER or SMTP_PASS is missing in .env'
      });
    }

    await transporter.verify();

    res.json({
      ok: true,
      message: 'Gmail SMTP connection is working.'
    });
  } catch (error) {
    console.error('SMTP TEST ERROR:', error);
    res.status(500).json({
      ok: false,
      error: error.message
    });
  }
});

// Send an actual absent-student reminder email
app.post('/api/send-absent-reminder', async (req, res) => {
  try {
    const { studentName, studentEmail, roll, branch, date } = req.body;

    if (!studentName || !studentEmail || !date) {
      return res.status(400).json({
        ok: false,
        error: 'studentName, studentEmail and date are required.'
      });
    }

    const fromAddress = process.env.MAIL_FROM || process.env.SMTP_USER;
    const replyTo = process.env.MAIL_REPLY_TO || fromAddress;
    const subject = 'Attendance Reminder | AttendXStudent';
    const safe = (value) => String(value ?? 'N/A')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/\"/g, '&quot;');

    const text = `Dear ${studentName},\n\nThis is a reminder that you were marked absent in AttendXStudent.\n\nAttendance date: ${date}\nRoll number: ${roll || 'N/A'}\nClass / Branch: ${branch || 'N/A'}\n\nIf you believe this is incorrect, please contact your faculty.\n\nRegards,\nAttendXStudent\nSmart Attendance System`;

    const html = `<!doctype html><html><body style=\"margin:0;background:#f5f5f5;font-family:Arial,sans-serif;color:#222;\"><div style=\"max-width:600px;margin:24px auto;background:#fff;border:1px solid #ddd;border-radius:10px;padding:28px;\"><h2 style=\"margin-top:0;\">Attendance Reminder</h2><p>Dear ${safe(studentName)},</p><p>This is a reminder that you were marked <strong>absent</strong> in AttendXStudent.</p><p><strong>Attendance date:</strong> ${safe(date)}<br><strong>Roll number:</strong> ${safe(roll)}<br><strong>Class / Branch:</strong> ${safe(branch)}</p><p>If you believe this is incorrect, please contact your faculty.</p><p>Regards,<br>AttendXStudent<br>Smart Attendance System</p></div></body></html>`;

    const info = await transporter.sendMail({
      from: fromAddress,
      to: studentEmail,
      replyTo,
      subject,
      text,
      html,
      envelope: { from: fromAddress, to: studentEmail },
      headers: { 'X-Mailer': 'AttendXStudent Attendance System' }
    });

    console.log(`Email sent to ${studentEmail}: ${info.messageId}`);

    res.json({
      ok: true,
      message: 'Absent reminder email sent successfully.',
      messageId: info.messageId
    });
  } catch (error) {
    console.error('EMAIL SEND ERROR:', error);
    res.status(500).json({
      ok: false,
      error: error.message
    });
  }
});

// Optional browser test page
app.get('/api', (req, res) => {
  res.json({ ok: true, service: 'AttendXStudent API' });
});

app.listen(PORT, () => {
  console.log(`AttendXStudent running at http://localhost:${PORT}`);
});

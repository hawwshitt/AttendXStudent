AttendXStudent - Automatic Absent Reminder Emails

1. Keep your real .env file in this folder. Do NOT upload/share it.
2. Install dependencies: npm install
3. Start: npm start
4. Open: http://localhost:3000
5. Test SMTP: http://localhost:3000/api/test-email
6. Save attendance. Any student marked Absent with an email address is automatically sent a Gmail reminder through /api/send-absent-reminder.

Gmail SMTP uses the Google 16-digit App Password in SMTP_PASS, not your normal Gmail password.

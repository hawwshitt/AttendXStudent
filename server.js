const express = require("express");
const path = require("path");

const app = express();
app.use(express.json());
app.use(express.static(__dirname));

const port = process.env.PORT || 3000;

// Render Free blocks outbound SMTP connections.
// Use Resend's HTTPS Email API instead of Gmail SMTP.
async function sendEmail({ to, subject, body }) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.MAIL_FROM || "onboarding@resend.dev";

  if (!apiKey) {
    throw new Error("RESEND_API_KEY is not configured on Render");
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject,
      text: body,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.message || data?.error || `Email API error (${response.status})`);
  }

  return data;
}

// Test email route
app.post("/api/test-email", async (req, res) => {
  try {
    const { to } = req.body;
    if (!to) return res.status(400).json({ error: "Recipient email required" });

    const result = await sendEmail({
      to,
      subject: "AttendXStudent Test Email",
      body: "This is a test email from AttendXStudent.",
    });

    res.json({ ok: true, result });
  } catch (error) {
    console.error("Test email failed:", error);
    res.status(500).json({ error: error.message });
  }
});

// Attendance reminder route
app.post("/api/send-reminder", async (req, res) => {
  try {
    const { to, subject, body } = req.body;
    if (!to) return res.status(400).json({ error: "Recipient email required" });

    const result = await sendEmail({
      to,
      subject: subject || "AttendXStudent Attendance Reminder",
      body: body || "You were marked absent for today's class.",
    });

    res.json({ ok: true, result });
  } catch (error) {
    console.error("Reminder email failed:", error);
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/health", (req, res) => {
  res.json({ ok: true, service: "AttendXStudent" });
});

app.listen(port, "0.0.0.0", () => {
  console.log(`AttendXStudent running on port ${port}`);
});

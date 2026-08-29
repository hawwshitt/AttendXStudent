require("dotenv").config();

const express = require("express");
const nodemailer = require("nodemailer");
const path = require("path");

const app = express();

const PORT = Number(process.env.PORT || 3000);

// Middleware
app.use(express.json());
app.use(express.static(__dirname));

// Gmail SMTP transporter
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: Number(process.env.SMTP_PORT || 587),

  secure:
    String(process.env.SMTP_SECURE || "false").toLowerCase() === "true",

  auth: {
    user: process.env.SMTP_USER,
    pass: (process.env.SMTP_PASS || "").replace(/\s/g, ""),
  },
});

// --------------------------------------------------
// TEST EMAIL
// --------------------------------------------------

app.post("/api/test-email", async (req, res) => {
  try {
    const { to } = req.body;

    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
      return res.status(500).json({
        ok: false,
        error: "SMTP_USER or SMTP_PASS is missing",
      });
    }

    if (!to) {
      return res.status(400).json({
        ok: false,
        error: "Recipient email is required",
      });
    }

    await transporter.sendMail({
      from: process.env.MAIL_FROM || process.env.SMTP_USER,
      to: to,
      subject: "AttendXStudent Test Email",
      text: "This is a test email from AttendXStudent.",
    });

    res.json({
      ok: true,
      message: "Test email sent successfully",
    });
  } catch (error) {
    console.error("Test email failed:", error);

    res.status(500).json({
      ok: false,
      error: error.message,
    });
  }
});

// --------------------------------------------------
// SEND ABSENT STUDENT REMINDER
// --------------------------------------------------

app.post("/api/send-absent-reminder", async (req, res) => {
  try {
    const { to, subject, body } = req.body;

    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
      return res.status(500).json({
        ok: false,
        error: "SMTP_USER or SMTP_PASS is missing",
      });
    }

    if (!to) {
      return res.status(400).json({
        ok: false,
        error: "Recipient email is required",
      });
    }

    await transporter.sendMail({
      from: process.env.MAIL_FROM || process.env.SMTP_USER,
      to: to,
      subject:
        subject || "AttendXStudent Attendance Reminder",
      text:
        body ||
        "You were marked Absent for today's class.",
    });

    console.log(`Reminder email sent to ${to}`);

    res.json({
      ok: true,
      message: "Email sent successfully",
    });
  } catch (error) {
    console.error("Reminder email failed:", error);

    res.status(500).json({
      ok: false,
      error: error.message,
    });
  }
});

// --------------------------------------------------
// OLD REMINDER ENDPOINT
// --------------------------------------------------

app.post("/api/send-reminder", async (req, res) => {
  try {
    const { to, subject, body } = req.body;

    if (!to) {
      return res.status(400).json({
        ok: false,
        error: "Recipient email is required",
      });
    }

    await transporter.sendMail({
      from: process.env.MAIL_FROM || process.env.SMTP_USER,
      to: to,
      subject:
        subject || "AttendXStudent Attendance Reminder",
      text:
        body ||
        "You were marked Absent for today's class.",
    });

    res.json({
      ok: true,
      message: "Email sent successfully",
    });
  } catch (error) {
    console.error("Reminder email failed:", error);

    res.status(500).json({
      ok: false,
      error: error.message,
    });
  }
});

// --------------------------------------------------
// HEALTH CHECK
// --------------------------------------------------

app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    message: "AttendXStudent server is running",
  });
});

// --------------------------------------------------
// START SERVER
// --------------------------------------------------

app.listen(PORT, "0.0.0.0", () => {
  console.log(
    `AttendXStudent running at http://localhost:${PORT}`
  );
});

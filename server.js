require("dotenv").config();

const express = require("express");
const nodemailer = require("nodemailer");
const path = require("path");

const app = express();

const PORT = Number(process.env.PORT || 3000);

// ==================================================
// MIDDLEWARE
// ==================================================

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve frontend files
app.use(express.static(__dirname));


// ==================================================
// GMAIL SMTP CONFIGURATION
// ==================================================

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",

  port: Number(process.env.SMTP_PORT || 587),

  secure:
    String(process.env.SMTP_SECURE || "false").toLowerCase() === "true",

  auth: {
    user: process.env.SMTP_USER,

    pass: String(process.env.SMTP_PASS || "").replace(/\s/g, ""),
  },

  connectionTimeout: 20000,
  greetingTimeout: 20000,
  socketTimeout: 30000,
});


// ==================================================
// HELPER FUNCTION
// ==================================================

function getRecipient(body) {
  return (
    body?.to ||
    body?.email ||
    body?.recipient ||
    body?.recipientEmail ||
    body?.studentEmail ||
    body?.student?.email ||
    ""
  ).trim();
}


// ==================================================
// TEST SMTP CONNECTION
// ==================================================

app.get("/api/test-smtp", async (req, res) => {
  try {
    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
      return res.status(500).json({
        ok: false,
        error: "SMTP_USER or SMTP_PASS is missing",
      });
    }

    await transporter.verify();

    console.log("Gmail SMTP connection successful");

    res.json({
      ok: true,
      message: "Gmail SMTP connection is working",
      user: process.env.SMTP_USER,
    });

  } catch (error) {
    console.error("SMTP verification failed:", error);

    res.status(500).json({
      ok: false,
      error: error.message,
      code: error.code || null,
      response: error.response || null,
    });
  }
});


// ==================================================
// TEST EMAIL
// ==================================================

app.post("/api/test-email", async (req, res) => {
  try {
    console.log("TEST EMAIL BODY:", req.body);

    const to = getRecipient(req.body);

    if (!process.env.SMTP_USER) {
      return res.status(500).json({
        ok: false,
        error: "SMTP_USER is missing",
      });
    }

    if (!process.env.SMTP_PASS) {
      return res.status(500).json({
        ok: false,
        error: "SMTP_PASS is missing",
      });
    }

    if (!to) {
      return res.status(400).json({
        ok: false,
        error: "Recipient email is required",
      });
    }

    const info = await transporter.sendMail({
      from: process.env.MAIL_FROM || process.env.SMTP_USER,

      to: to,

      subject: "AttendXStudent Test Email",

      text:
        "This is a test email from AttendXStudent.\n\n" +
        "If you received this email, Gmail SMTP is working correctly.",
    });

    console.log("Test email sent:", info.messageId);

    res.json({
      ok: true,
      message: "Test email sent successfully",
      messageId: info.messageId,
    });

  } catch (error) {
    console.error("Test email failed:", error);

    res.status(500).json({
      ok: false,
      error: error.message,
      code: error.code || null,
      response: error.response || null,
    });
  }
});


// ==================================================
// SEND ABSENT STUDENT REMINDER
// ==================================================

app.post("/api/send-absent-reminder", async (req, res) => {
  try {
    console.log("ABSENT REMINDER BODY:", req.body);

    const to = getRecipient(req.body);

    const subject =
      req.body?.subject ||
      "AttendXStudent Attendance Reminder";

    const body =
      req.body?.body ||
      req.body?.message ||
      "You were marked Absent for today's class.";

    // ----------------------------------------------
    // Check SMTP credentials
    // ----------------------------------------------

    if (!process.env.SMTP_USER) {
      return res.status(500).json({
        ok: false,
        error: "SMTP_USER is missing",
      });
    }

    if (!process.env.SMTP_PASS) {
      return res.status(500).json({
        ok: false,
        error: "SMTP_PASS is missing",
      });
    }

    // ----------------------------------------------
    // Check recipient
    // ----------------------------------------------

    if (!to) {
      return res.status(400).json({
        ok: false,
        error: "Recipient email is required",
        receivedBody: req.body,
      });
    }

    // ----------------------------------------------
    // Send email
    // ----------------------------------------------

    const info = await transporter.sendMail({
      from: process.env.MAIL_FROM || process.env.SMTP_USER,

      to: to,

      subject: subject,

      text: body,
    });

    console.log(
      `Reminder email sent successfully to ${to}`
    );

    console.log("Message ID:", info.messageId);

    res.json({
      ok: true,
      message: "Email sent successfully",
      messageId: info.messageId,
    });

  } catch (error) {
    console.error("Reminder email failed:", error);

    res.status(500).json({
      ok: false,
      error: error.message,
      code: error.code || null,
      response: error.response || null,
    });
  }
});


// ==================================================
// OLD REMINDER ENDPOINT
// ==================================================

app.post("/api/send-reminder", async (req, res) => {
  try {
    console.log("OLD REMINDER BODY:", req.body);

    const to = getRecipient(req.body);

    const subject =
      req.body?.subject ||
      "AttendXStudent Attendance Reminder";

    const body =
      req.body?.body ||
      req.body?.message ||
      "You were marked Absent for today's class.";

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
        receivedBody: req.body,
      });
    }

    const info = await transporter.sendMail({
      from: process.env.MAIL_FROM || process.env.SMTP_USER,

      to: to,

      subject: subject,

      text: body,
    });

    console.log(`Reminder sent to ${to}`);

    res.json({
      ok: true,
      message: "Email sent successfully",
      messageId: info.messageId,
    });

  } catch (error) {
    console.error("Reminder email failed:", error);

    res.status(500).json({
      ok: false,
      error: error.message,
      code: error.code || null,
      response: error.response || null,
    });
  }
});


// ==================================================
// HEALTH CHECK
// ==================================================

app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    message: "AttendXStudent server is running",
  });
});


// ==================================================
// ROOT
// ==================================================

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});


// ==================================================
// START SERVER
// ==================================================

app.listen(PORT, "0.0.0.0", () => {
  console.log(
    `AttendXStudent running on port ${PORT}`
  );

  console.log(
    `SMTP Host: ${process.env.SMTP_HOST || "smtp.gmail.com"}`
  );

  console.log(
    `SMTP Port: ${process.env.SMTP_PORT || "587"}`
  );

  console.log(
    `SMTP User: ${process.env.SMTP_USER || "NOT SET"}`
  );
});

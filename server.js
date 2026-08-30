require("dotenv").config();

const express = require("express");
const path = require("path");

const app = express();

const PORT = Number(process.env.PORT || 3000);

// ==================================================
// MIDDLEWARE
// ==================================================

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Frontend files
app.use(express.static(__dirname));


// ==================================================
// RESEND CONFIGURATION
// ==================================================

const RESEND_API_KEY = process.env.RESEND_API_KEY;

// Resend testing sender
// Later, when you verify your own domain in Resend,
// you can put your own email in MAIL_FROM.
const MAIL_FROM =
  process.env.MAIL_FROM || "onboarding@resend.dev";


// ==================================================
// HELPER - GET RECIPIENT
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
// HELPER - SEND EMAIL USING RESEND
// ==================================================

async function sendEmail({ to, subject, text }) {

  if (!RESEND_API_KEY) {
    throw new Error("RESEND_API_KEY is missing");
  }

  const response = await fetch(
    "https://api.resend.com/emails",
    {
      method: "POST",

      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json"
      },

      body: JSON.stringify({
        from: MAIL_FROM,
        to: [to],
        subject: subject,
        text: text
      })
    }
  );

  const data = await response.json();

  if (!response.ok) {
    const error = new Error(
      data?.message ||
      data?.error ||
      "Resend email failed"
    );

    error.status = response.status;
    error.resendData = data;

    throw error;
  }

  return data;
}


// ==================================================
// RESEND CONNECTION TEST
// ==================================================

app.get("/api/test-smtp", async (req, res) => {

  try {

    if (!RESEND_API_KEY) {
      return res.status(500).json({
        ok: false,
        error: "RESEND_API_KEY is missing in Render Environment"
      });
    }

    res.json({
      ok: true,
      message: "Resend API key is configured successfully",
      provider: "Resend"
    });

  } catch (error) {

    console.error("Resend test failed:", error);

    res.status(500).json({
      ok: false,
      error: error.message
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

    // Check API key
    if (!RESEND_API_KEY) {
      return res.status(500).json({
        ok: false,
        error: "RESEND_API_KEY is missing"
      });
    }

    // Check recipient
    if (!to) {
      return res.status(400).json({
        ok: false,
        error: "Recipient email is required"
      });
    }

    // Send email
    const result = await sendEmail({

      to: to,

      subject: "AttendXStudent Test Email",

      text:
        "This is a test email from AttendXStudent.\n\n" +
        "If you received this email, Resend is working correctly."
    });

    console.log("Test email sent:", result);

    res.json({
      ok: true,
      message: "Test email sent successfully",
      data: result
    });

  } catch (error) {

    console.error("Test email failed:", error);

    res.status(500).json({
      ok: false,
      error: error.message,
      status: error.status || null,
      resendData: error.resendData || null
    });
  }
});


// ==================================================
// SEND ABSENT STUDENT REMINDER
// ==================================================

app.post("/api/send-absent-reminder", async (req, res) => {

  try {

    console.log(
      "ABSENT REMINDER BODY:",
      req.body
    );

    const to = getRecipient(req.body);

    const subject =
      req.body?.subject ||
      "AttendXStudent Attendance Reminder";

    const body =
      req.body?.body ||
      req.body?.message ||
      "You were marked Absent for today's class.";


    // ----------------------------------------------
    // CHECK RESEND API KEY
    // ----------------------------------------------

    if (!RESEND_API_KEY) {

      return res.status(500).json({
        ok: false,
        error: "RESEND_API_KEY is missing"
      });
    }


    // ----------------------------------------------
    // CHECK RECIPIENT
    // ----------------------------------------------

    if (!to) {

      return res.status(400).json({
        ok: false,
        error: "Recipient email is required",
        receivedBody: req.body
      });
    }


    // ----------------------------------------------
    // SEND EMAIL
    // ----------------------------------------------

    const result = await sendEmail({

      to: to,

      subject: subject,

      text: body
    });


    console.log(
      `Reminder email sent successfully to ${to}`
    );

    console.log(
      "Resend response:",
      result
    );


    res.json({

      ok: true,

      message: "Email sent successfully",

      messageId:
        result?.id || null
    });

  } catch (error) {

    console.error(
      "Reminder email failed:",
      error
    );

    res.status(500).json({

      ok: false,

      error: error.message,

      status:
        error.status || null,

      resendData:
        error.resendData || null
    });
  }
});


// ==================================================
// OLD REMINDER ENDPOINT
// ==================================================

app.post("/api/send-reminder", async (req, res) => {

  try {

    console.log(
      "OLD REMINDER BODY:",
      req.body
    );

    const to = getRecipient(req.body);

    const subject =
      req.body?.subject ||
      "AttendXStudent Attendance Reminder";

    const body =
      req.body?.body ||
      req.body?.message ||
      "You were marked Absent for today's class.";


    // ----------------------------------------------
    // CHECK RESEND API KEY
    // ----------------------------------------------

    if (!RESEND_API_KEY) {

      return res.status(500).json({
        ok: false,
        error: "RESEND_API_KEY is missing"
      });
    }


    // ----------------------------------------------
    // CHECK RECIPIENT
    // ----------------------------------------------

    if (!to) {

      return res.status(400).json({
        ok: false,
        error: "Recipient email is required",
        receivedBody: req.body
      });
    }


    // ----------------------------------------------
    // SEND EMAIL
    // ----------------------------------------------

    const result = await sendEmail({

      to: to,

      subject: subject,

      text: body
    });


    console.log(
      `Reminder sent successfully to ${to}`
    );


    res.json({

      ok: true,

      message: "Email sent successfully",

      messageId:
        result?.id || null
    });

  } catch (error) {

    console.error(
      "Reminder email failed:",
      error
    );

    res.status(500).json({

      ok: false,

      error: error.message,

      status:
        error.status || null,

      resendData:
        error.resendData || null
    });
  }
});


// ==================================================
// HEALTH CHECK
// ==================================================

app.get("/api/health", (req, res) => {

  res.json({

    ok: true,

    message:
      "AttendXStudent server is running",

    emailProvider:
      "Resend",

    resendConfigured:
      Boolean(RESEND_API_KEY)
  });

});


// ==================================================
// ROOT
// ==================================================

app.get("/", (req, res) => {

  res.sendFile(
    path.join(__dirname, "index.html")
  );

});


// ==================================================
// START SERVER
// ==================================================

app.listen(
  PORT,
  "0.0.0.0",
  () => {

    console.log(
      `AttendXStudent running on port ${PORT}`
    );

    console.log(
      `Email Provider: Resend`
    );

    console.log(
      `Resend API Key: ${
        RESEND_API_KEY
          ? "CONFIGURED"
          : "NOT SET"
      }`
    );

    console.log(
      `MAIL_FROM: ${MAIL_FROM}`
    );

  }
);

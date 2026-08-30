// ============================================================
// AttendXStudent - Complete Server
// ============================================================

require("dotenv").config();

const express = require("express");
const nodemailer = require("nodemailer");
const path = require("path");
const session = require("express-session");
const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;

const app = express();

// ============================================================
// PORT
// ============================================================

const PORT = Number(process.env.PORT || 3000);

// ============================================================
// ENVIRONMENT
// ============================================================

const IS_PRODUCTION = process.env.NODE_ENV === "production";

// ============================================================
// GOOGLE CALLBACK URL
// ============================================================

const GOOGLE_CALLBACK_URL =
  process.env.GOOGLE_CALLBACK_URL ||
  (IS_PRODUCTION
    ? "https://attendxstudent.onrender.com/auth/google/callback"
    : "http://localhost:3000/auth/google/callback");

// ============================================================
// MIDDLEWARE
// ============================================================

app.use(express.json());

app.use(
  express.urlencoded({
    extended: true,
  })
);

// ============================================================
// RENDER / PROXY SUPPORT
// ============================================================

if (IS_PRODUCTION) {
  app.set("trust proxy", 1);
}

// ============================================================
// STATIC FRONTEND
// ============================================================

app.use(express.static(__dirname));

// ============================================================
// SESSION
// ============================================================

app.use(
  session({
    secret:
      process.env.SESSION_SECRET ||
      "attendxstudent-secret-key-change-this",

    resave: false,

    saveUninitialized: false,

    cookie: {
      secure: IS_PRODUCTION,
      httpOnly: true,
      sameSite: "lax",
      maxAge: 24 * 60 * 60 * 1000,
    },
  })
);

// ============================================================
// PASSPORT
// ============================================================

app.use(passport.initialize());
app.use(passport.session());

// ============================================================
// GOOGLE OAUTH CONFIGURATION
// ============================================================

if (
  process.env.GOOGLE_CLIENT_ID &&
  process.env.GOOGLE_CLIENT_SECRET
) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,

        clientSecret:
          process.env.GOOGLE_CLIENT_SECRET,

        callbackURL:
          GOOGLE_CALLBACK_URL,
      },

      async (
        accessToken,
        refreshToken,
        profile,
        done
      ) => {
        try {
          const user = {
            id: profile.id,

            name:
              profile.displayName || "",

            email:
              profile.emails?.[0]?.value || "",

            photo:
              profile.photos?.[0]?.value || "",
          };

          console.log(
            "Google login:",
            user.email
          );

          return done(null, user);

        } catch (error) {

          console.error(
            "Google OAuth error:",
            error
          );

          return done(error, null);
        }
      }
    )
  );

  console.log(
    "Google OAuth: CONFIGURED"
  );

} else {

  console.log(
    "WARNING: Google OAuth credentials are missing."
  );
}

// ============================================================
// PASSPORT SERIALIZATION
// ============================================================

passport.serializeUser(
  (user, done) => {
    done(null, user);
  }
);

passport.deserializeUser(
  (user, done) => {
    done(null, user);
  }
);

// ============================================================
// GOOGLE LOGIN
// ============================================================

app.get(
  "/auth/google",

  (req, res, next) => {

    if (
      !process.env.GOOGLE_CLIENT_ID ||
      !process.env.GOOGLE_CLIENT_SECRET
    ) {

      return res.status(500).send(`
        <h2>Google Login is not configured</h2>
        <p>
          GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET is missing.
        </p>
      `);
    }

    next();
  },

  passport.authenticate(
    "google",
    {
      scope: [
        "profile",
        "email",
      ],
    }
  )
);

// ============================================================
// GOOGLE CALLBACK
// ============================================================

app.get(
  "/auth/google/callback",

  passport.authenticate(
    "google",
    {
      failureRedirect:
        "/?login=failed",
    }
  ),

  (req, res) => {

    console.log(
      "Google authentication successful:",
      req.user?.email
    );

    res.redirect(
      "/?login=success"
    );
  }
);

// ============================================================
// CURRENT USER
// ============================================================

app.get(
  "/api/me",

  (req, res) => {

    if (!req.isAuthenticated()) {

      return res.json({
        loggedIn: false,
        user: null,
      });
    }

    res.json({
      loggedIn: true,
      user: req.user,
    });
  }
);

// ============================================================
// LOGOUT
// ============================================================

app.get(
  "/auth/logout",

  (req, res) => {

    req.logout((error) => {

      if (error) {

        console.error(
          "Logout error:",
          error
        );

        return res.status(500).json({
          ok: false,
          error: "Logout failed",
        });
      }

      req.session.destroy(
        (sessionError) => {

          if (sessionError) {

            console.error(
              "Session destroy error:",
              sessionError
            );
          }

          res.redirect("/");
        }
      );
    });
  }
);

// ============================================================
// GMAIL SMTP CONFIGURATION
// ============================================================

const SMTP_USER =
  process.env.SMTP_USER ||
  process.env.GMAIL_USER ||
  "";

const SMTP_PASS =
  String(
    process.env.SMTP_PASS ||
    process.env.GMAIL_APP_PASSWORD ||
    ""
  ).replace(/\s/g, "");

const SMTP_HOST =
  process.env.SMTP_HOST ||
  "smtp.gmail.com";

const SMTP_PORT =
  Number(
    process.env.SMTP_PORT || 587
  );

const SMTP_SECURE =
  String(
    process.env.SMTP_SECURE || "false"
  ).toLowerCase() === "true";

// IMPORTANT:
// Always use process.env.MAIL_FROM or the safe fallback.
// Never use MAIL_FROM directly.

const MAIL_FROM =
  process.env.MAIL_FROM ||
  SMTP_USER;

// ============================================================
// NODEMAILER TRANSPORTER
// ============================================================

const transporter =
  nodemailer.createTransport({

    host: SMTP_HOST,

    port: SMTP_PORT,

    secure: SMTP_SECURE,

    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS,
    },

    connectionTimeout: 20000,

    greetingTimeout: 20000,

    socketTimeout: 30000,
  });

// ============================================================
// RECIPIENT HELPER
// ============================================================

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

// ============================================================
// SMTP CONFIG CHECK
// ============================================================

function smtpConfigError() {

  if (!SMTP_USER) {
    return "SMTP_USER / GMAIL_USER is missing";
  }

  if (!SMTP_PASS) {
    return "SMTP_PASS / GMAIL_APP_PASSWORD is missing";
  }

  return null;
}

// ============================================================
// TEST SMTP CONNECTION
// ============================================================

app.get(
  "/api/test-smtp",

  async (req, res) => {

    try {

      const configError =
        smtpConfigError();

      if (configError) {

        return res.status(500).json({
          ok: false,
          error: configError,
        });
      }

      await transporter.verify();

      console.log(
        "Gmail SMTP connection successful"
      );

      return res.json({

        ok: true,

        message:
          "Gmail SMTP connection is working",

        user:
          SMTP_USER,

        host:
          SMTP_HOST,

        port:
          SMTP_PORT,

        secure:
          SMTP_SECURE,
      });

    } catch (error) {

      console.error(
        "SMTP verification failed:",
        error
      );

      return res.status(500).json({

        ok: false,

        error:
          error.message ||
          "SMTP verification failed",

        code:
          error.code || null,

        response:
          error.response || null,
      });
    }
  }
);

// ============================================================
// TEST EMAIL
// ============================================================

app.post(
  "/api/test-email",

  async (req, res) => {

    try {

      console.log(
        "TEST EMAIL BODY:",
        req.body
      );

      const configError =
        smtpConfigError();

      if (configError) {

        return res.status(500).json({
          ok: false,
          error: configError,
        });
      }

      const to =
        getRecipient(req.body);

      if (!to) {

        return res.status(400).json({

          ok: false,

          error:
            "Recipient email is required",
        });
      }

      const info =
        await transporter.sendMail({

          from:
            MAIL_FROM,

          to:
            to,

          subject:
            "AttendXStudent Test Email",

          text:
            "This is a test email from AttendXStudent.\n\n" +
            "If you received this email, Gmail SMTP is working correctly.",
        });

      console.log(
        "Test email sent:",
        info.messageId
      );

      return res.json({

        ok: true,

        message:
          "Test email sent successfully",

        messageId:
          info.messageId,
      });

    } catch (error) {

      console.error(
        "Test email failed:",
        error
      );

      return res.status(500).json({

        ok: false,

        error:
          error.message ||
          "Test email failed",

        code:
          error.code || null,

        response:
          error.response || null,
      });
    }
  }
);

// ============================================================
// SEND ABSENT STUDENT REMINDER
// ============================================================

app.post(
  "/api/send-absent-reminder",

  async (req, res) => {

    try {

      console.log(
        "ABSENT REMINDER BODY:",
        req.body
      );

      // --------------------------------------------------------
      // Check SMTP configuration
      // --------------------------------------------------------

      const configError =
        smtpConfigError();

      if (configError) {

        return res.status(500).json({

          ok: false,

          error:
            configError,
        });
      }

      // --------------------------------------------------------
      // Get recipient
      // --------------------------------------------------------

      const to =
        getRecipient(req.body);

      // --------------------------------------------------------
      // Get subject
      // --------------------------------------------------------

      const subject =
        req.body?.subject ||
        "AttendXStudent Attendance Reminder";

      // --------------------------------------------------------
      // Get email body
      // --------------------------------------------------------

      const body =
        req.body?.body ||
        req.body?.message ||
        "You were marked Absent for today's class.";

      // --------------------------------------------------------
      // Validate recipient
      // --------------------------------------------------------

      if (!to) {

        return res.status(400).json({

          ok: false,

          error:
            "Recipient email is required",

          receivedBody:
            req.body,
        });
      }

      // --------------------------------------------------------
      // SEND EMAIL
      // --------------------------------------------------------

      console.log(
        "Preparing to send absent reminder..."
      );

      console.log(
        "From:",
        MAIL_FROM
      );

      console.log(
        "To:",
        to
      );

      console.log(
        "Subject:",
        subject
      );

      const info =
        await transporter.sendMail({

          // IMPORTANT FIX:
          // This uses the actual variable value.
          from:
            MAIL_FROM,

          to:
            to,

          subject:
            subject,

          text:
            body,
        });

      // --------------------------------------------------------
      // SUCCESS
      // --------------------------------------------------------

      console.log(
        `Reminder email sent successfully to ${to}`
      );

      console.log(
        "Message ID:",
        info.messageId
      );

      return res.json({

        ok: true,

        message:
          "Email sent successfully",

        messageId:
          info.messageId,
      });

    } catch (error) {

      // --------------------------------------------------------
      // ERROR
      // --------------------------------------------------------

      console.error(
        "Reminder email failed:",
        error
      );

      return res.status(500).json({

        ok: false,

        error:
          error.message ||
          "Email sending failed",

        code:
          error.code || null,

        response:
          error.response || null,
      });
    }
  }
);

// ============================================================
// OLD REMINDER ENDPOINT
// ============================================================

app.post(
  "/api/send-reminder",

  async (req, res) => {

    try {

      console.log(
        "OLD REMINDER BODY:",
        req.body
      );

      const configError =
        smtpConfigError();

      if (configError) {

        return res.status(500).json({

          ok: false,

          error:
            configError,
        });
      }

      const to =
        getRecipient(req.body);

      const subject =
        req.body?.subject ||
        "AttendXStudent Attendance Reminder";

      const body =
        req.body?.body ||
        req.body?.message ||
        "You were marked Absent for today's class.";

      if (!to) {

        return res.status(400).json({

          ok: false,

          error:
            "Recipient email is required",

          receivedBody:
            req.body,
        });
      }

      const info =
        await transporter.sendMail({

          from:
            MAIL_FROM,

          to:
            to,

          subject:
            subject,

          text:
            body,
        });

      console.log(
        `Reminder sent to ${to}`
      );

      return res.json({

        ok: true,

        message:
          "Email sent successfully",

        messageId:
          info.messageId,
      });

    } catch (error) {

      console.error(
        "Reminder email failed:",
        error
      );

      return res.status(500).json({

        ok: false,

        error:
          error.message ||
          "Email sending failed",

        code:
          error.code || null,

        response:
          error.response || null,
      });
    }
  }
);

// ============================================================
// HEALTH CHECK
// ============================================================

app.get(
  "/api/health",

  (req, res) => {

    res.json({

      ok: true,

      message:
        "AttendXStudent server is running",
    });
  }
);

// ============================================================
// ROOT PAGE
// ============================================================

app.get(
  "/",

  (req, res) => {

    res.sendFile(
      path.join(
        __dirname,
        "index.html"
      )
    );
  }
);

// ============================================================
// 404 HANDLER
// ============================================================

app.use(
  (req, res) => {

    res.status(404).json({

      ok: false,

      error:
        "Route not found",

      path:
        req.originalUrl,
    });
  }
);

// ============================================================
// ERROR HANDLER
// ============================================================

app.use(
  (error, req, res, next) => {

    console.error(
      "SERVER ERROR:",
      error
    );

    res.status(500).json({

      ok: false,

      error:
        error.message ||
        "Internal server error",
    });
  }
);

// ============================================================
// START SERVER
// ============================================================

app.listen(
  PORT,

  "0.0.0.0",

  async () => {

    console.log(
      "========================================"
    );

    console.log(
      `AttendXStudent running on port ${PORT}`
    );

    console.log(
      `Environment: ${
        IS_PRODUCTION
          ? "production"
          : "development"
      }`
    );

    console.log(
      `SMTP Host: ${SMTP_HOST}`
    );

    console.log(
      `SMTP Port: ${SMTP_PORT}`
    );

    console.log(
      `SMTP User: ${
        SMTP_USER || "NOT SET"
      }`
    );

    console.log(
      `MAIL_FROM: ${
        MAIL_FROM || "NOT SET"
      }`
    );

    console.log(
      `Google OAuth: ${
        process.env.GOOGLE_CLIENT_ID &&
        process.env.GOOGLE_CLIENT_SECRET
          ? "CONFIGURED"
          : "NOT CONFIGURED"
      }`
    );

    console.log(
      `Google Callback: ${GOOGLE_CALLBACK_URL}`
    );

    console.log(
      "========================================"
    );

    // ----------------------------------------------------------
    // Verify SMTP when server starts
    // ----------------------------------------------------------

    if (SMTP_USER && SMTP_PASS) {

      try {

        await transporter.verify();

        console.log(
          "Gmail SMTP verification: SUCCESS"
        );

      } catch (error) {

        console.error(
          "Gmail SMTP verification: FAILED"
        );

        console.error(
          "SMTP Error:",
          error.message
        );

        console.error(
          "SMTP Code:",
          error.code || "N/A"
        );
      }

    } else {

      console.error(
        "Gmail SMTP verification skipped: SMTP credentials missing"
      );
    }
  }
);

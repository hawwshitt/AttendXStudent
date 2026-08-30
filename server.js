// ============================================================
// AttendXStudent - Gmail API Server
// SMTP COMPLETELY REMOVED
// ============================================================

require("dotenv").config();

const express = require("express");
const path = require("path");
const session = require("express-session");
const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;

const app = express();

// ============================================================
// CONFIG
// ============================================================

const PORT = Number(process.env.PORT || 3000);

const IS_PRODUCTION =
  process.env.NODE_ENV === "production";

const GOOGLE_CLIENT_ID =
  process.env.GOOGLE_CLIENT_ID || "";

const GOOGLE_CLIENT_SECRET =
  process.env.GOOGLE_CLIENT_SECRET || "";

const GOOGLE_CALLBACK_URL =
  process.env.GOOGLE_CALLBACK_URL ||
  (IS_PRODUCTION
    ? "https://attendxstudent.onrender.com/auth/google/callback"
    : "http://localhost:3000/auth/google/callback");

const GMAIL_CALLBACK_URL =
  process.env.GMAIL_CALLBACK_URL ||
  (IS_PRODUCTION
    ? "https://attendxstudent.onrender.com/auth/google/gmail/callback"
    : "http://localhost:3000/auth/google/gmail/callback");

const GMAIL_USER =
  process.env.GMAIL_USER ||
  "shantisingh6666@gmail.com";

const GMAIL_REFRESH_TOKEN =
  process.env.GMAIL_REFRESH_TOKEN || "";

// Gmail API scope.
// This allows sending mail.
const GMAIL_SCOPE =
  "https://www.googleapis.com/auth/gmail.send";

// ============================================================
// MIDDLEWARE
// ============================================================

app.use(express.json());

app.use(
  express.urlencoded({
    extended: true,
  })
);

if (IS_PRODUCTION) {
  app.set("trust proxy", 1);
}

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
      maxAge:
        24 * 60 * 60 * 1000,
    },
  })
);

// ============================================================
// PASSPORT
// ============================================================

app.use(passport.initialize());

app.use(passport.session());

// ============================================================
// GOOGLE LOGIN
// ============================================================

if (
  GOOGLE_CLIENT_ID &&
  GOOGLE_CLIENT_SECRET
) {
  passport.use(
    new GoogleStrategy(
      {
        clientID:
          GOOGLE_CLIENT_ID,

        clientSecret:
          GOOGLE_CLIENT_SECRET,

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
              profile.emails?.[0]?.value ||
              "",

            photo:
              profile.photos?.[0]?.value ||
              "",
          };

          console.log(
            "Google login:",
            user.email
          );

          return done(
            null,
            user
          );

        } catch (error) {
          console.error(
            "Google login error:",
            error
          );

          return done(
            error,
            null
          );
        }
      }
    )
  );

  console.log(
    "Google OAuth: CONFIGURED"
  );

} else {

  console.log(
    "WARNING: Google OAuth credentials missing"
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
// NORMAL GOOGLE LOGIN
// ============================================================

app.get(
  "/auth/google",

  (req, res, next) => {

    if (
      !GOOGLE_CLIENT_ID ||
      !GOOGLE_CLIENT_SECRET
    ) {
      return res
        .status(500)
        .send(
          "Google OAuth is not configured."
        );
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
// NORMAL GOOGLE CALLBACK
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
// GMAIL API AUTHORIZATION
// ============================================================
//
// Open this URL ONCE:
// /auth/google/gmail
//
// This asks Google for Gmail send permission.
// After approval, callback gives a refresh token.
// Put that token into Render as:
// GMAIL_REFRESH_TOKEN
//
// ============================================================

app.get(
  "/auth/google/gmail",

  (req, res) => {

    if (
      !GOOGLE_CLIENT_ID ||
      !GOOGLE_CLIENT_SECRET
    ) {
      return res
        .status(500)
        .send(
          "Google OAuth credentials are missing."
        );
    }

    const params =
      new URLSearchParams({

        client_id:
          GOOGLE_CLIENT_ID,

        redirect_uri:
          GMAIL_CALLBACK_URL,

        response_type:
          "code",

        access_type:
          "offline",

        prompt:
          "consent",

        scope:
          GMAIL_SCOPE,
      });

    const url =
      "https://accounts.google.com/o/oauth2/v2/auth?" +
      params.toString();

    res.redirect(url);
  }
);

// ============================================================
// GMAIL OAUTH CALLBACK
// ============================================================

app.get(
  "/auth/google/gmail/callback",

  async (req, res) => {

    try {

      const code =
        req.query.code;

      if (!code) {
        return res
          .status(400)
          .send(
            "Google authorization code missing."
          );
      }

      // --------------------------------------------------------
      // Exchange authorization code for tokens
      // --------------------------------------------------------

      const tokenResponse =
        await fetch(
          "https://oauth2.googleapis.com/token",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/x-www-form-urlencoded",
            },

            body:
              new URLSearchParams({

                code: code,

                client_id:
                  GOOGLE_CLIENT_ID,

                client_secret:
                  GOOGLE_CLIENT_SECRET,

                redirect_uri:
                  GMAIL_CALLBACK_URL,

                grant_type:
                  "authorization_code",
              }).toString(),
          }
        );

      const tokens =
        await tokenResponse.json();

      if (
        !tokenResponse.ok
      ) {

        console.error(
          "Google token error:",
          tokens
        );

        return res
          .status(500)
          .send(`
            <h2>Google Authorization Failed</h2>
            <pre>${escapeHtml(
              JSON.stringify(
                tokens,
                null,
                2
              )
            )}</pre>
          `);
      }

      if (!tokens.refresh_token) {

        return res
          .status(500)
          .send(`
            <h2>Refresh Token Not Received</h2>
            <p>
              Google did not return a refresh token.
              Please revoke the previous permission and
              open /auth/google/gmail again.
            </p>
          `);
      }

      console.log(
        "Gmail OAuth authorization successful."
      );

      // --------------------------------------------------------
      // IMPORTANT
      // --------------------------------------------------------
      //
      // The refresh token must be copied into Render.
      //
      // We intentionally display it once here.
      //
      // Do NOT share it with anyone.
      //
      // --------------------------------------------------------

      res.send(`
        <html>
          <head>
            <title>AttendXStudent Gmail Setup</title>
            <style>
              body {
                font-family: Arial, sans-serif;
                max-width: 800px;
                margin: 50px auto;
                padding: 20px;
              }

              textarea {
                width: 100%;
                height: 120px;
                font-size: 14px;
              }

              .box {
                padding: 20px;
                background: #f5f5f5;
                border-radius: 10px;
              }

              code {
                background: #eee;
                padding: 3px 6px;
              }
            </style>
          </head>

          <body>

            <h1>Gmail Authorization Successful ✅</h1>

            <p>
              Copy the refresh token below.
            </p>

            <div class="box">

              <textarea readonly>${escapeHtml(
                tokens.refresh_token
              )}</textarea>

            </div>

            <h3>Next step</h3>

            <p>
              Render → Environment → Add Variable
            </p>

            <p>
              Key:
            </p>

            <code>
              GMAIL_REFRESH_TOKEN
            </code>

            <p>
              Value:
              paste the refresh token above.
            </p>

            <p>
              After saving the variable,
              redeploy your Render service.
            </p>

            <p>
              <b>
                Do not share this refresh token.
              </b>
            </p>

          </body>
        </html>
      `);

    } catch (error) {

      console.error(
        "Gmail OAuth callback error:",
        error
      );

      res
        .status(500)
        .send(
          "Gmail authorization failed."
        );
    }
  }
);

// ============================================================
// CURRENT USER
// ============================================================

app.get(
  "/api/me",

  (req, res) => {

    if (
      !req.isAuthenticated()
    ) {

      return res.json({
        loggedIn: false,
        user: null,
      });
    }

    res.json({

      loggedIn: true,

      user:
        req.user,
    });
  }
);

// ============================================================
// LOGOUT
// ============================================================

app.get(
  "/auth/logout",

  (req, res) => {

    req.logout(
      (error) => {

        if (error) {

          console.error(
            "Logout error:",
            error
          );

          return res
            .status(500)
            .json({
              ok: false,
              error:
                "Logout failed",
            });
        }

        req.session.destroy(
          () => {
            res.redirect("/");
          }
        );
      }
    );
  }
);

// ============================================================
// HTML ESCAPE
// ============================================================

function escapeHtml(value) {

  return String(value)
    .replace(
      /&/g,
      "&amp;"
    )
    .replace(
      /</g,
      "&lt;"
    )
    .replace(
      />/g,
      "&gt;"
    )
    .replace(
      /"/g,
      "&quot;"
    )
    .replace(
      /'/g,
      "&#039;"
    );
}

// ============================================================
// CREATE MIME EMAIL
// ============================================================

function createMimeMessage({
  from,
  to,
  subject,
  text,
}) {

  const encodedSubject =
    `=?UTF-8?B?${Buffer
      .from(subject, "utf8")
      .toString("base64")}?=`;

  const message = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${encodedSubject}`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: 8bit",
    "",
    text,
  ].join("\r\n");

  return Buffer
    .from(message, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

// ============================================================
// GET GMAIL ACCESS TOKEN
// ============================================================

async function getGmailAccessToken() {

  if (
    !GMAIL_REFRESH_TOKEN
  ) {

    throw new Error(
      "GMAIL_REFRESH_TOKEN is missing in Render Environment Variables."
    );
  }

  const response =
    await fetch(
      "https://oauth2.googleapis.com/token",
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/x-www-form-urlencoded",
        },

        body:
          new URLSearchParams({

            client_id:
              GOOGLE_CLIENT_ID,

            client_secret:
              GOOGLE_CLIENT_SECRET,

            refresh_token:
              GMAIL_REFRESH_TOKEN,

            grant_type:
              "refresh_token",

          }).toString(),
      }
    );

  const data =
    await response.json();

  if (
    !response.ok
  ) {

    console.error(
      "Access token refresh failed:",
      data
    );

    throw new Error(
      data.error_description ||
      data.error ||
      "Unable to get Gmail access token"
    );
  }

  return data.access_token;
}

// ============================================================
// SEND EMAIL USING GMAIL API
// ============================================================

async function sendGmailEmail({
  to,
  subject,
  text,
}) {

  const accessToken =
    await getGmailAccessToken();

  const raw =
    createMimeMessage({

      from:
        GMAIL_USER,

      to:
        to,

      subject:
        subject,

      text:
        text,
    });

  const response =
    await fetch(
      "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
      {

        method: "POST",

        headers: {

          Authorization:
            `Bearer ${accessToken}`,

          "Content-Type":
            "application/json",
        },

        body:
          JSON.stringify({
            raw: raw,
          }),
      }
    );

  const data =
    await response.json();

  if (
    !response.ok
  ) {

    console.error(
      "Gmail API error:",
      data
    );

    throw new Error(
      data.error?.message ||
      "Gmail API failed to send email"
    );
  }

  return data;
}

// ============================================================
// TEST GMAIL API
// ============================================================

app.get(
  "/api/test-gmail",

  async (req, res) => {

    try {

      if (
        !GMAIL_REFRESH_TOKEN
      ) {

        return res.status(500).json({

          ok: false,

          error:
            "GMAIL_REFRESH_TOKEN is missing.",
        });
      }

      const accessToken =
        await getGmailAccessToken();

      return res.json({

        ok: true,

        message:
          "Gmail API authorization is working.",

        accessTokenReceived:
          Boolean(accessToken),

        sender:
          GMAIL_USER,
      });

    } catch (error) {

      console.error(
        "Gmail API test failed:",
        error
      );

      return res.status(500).json({

        ok: false,

        error:
          error.message,
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

      const to =
        getRecipient(req.body);

      if (!to) {

        return res.status(400).json({

          ok: false,

          error:
            "Recipient email is required",
        });
      }

      const result =
        await sendGmailEmail({

          to:
            to,

          subject:
            "AttendXStudent Test Email",

          text:
            "This is a test email from AttendXStudent.\n\n" +
            "If you received this email, Gmail API is working correctly.",
        });

      console.log(
        "Test Gmail email sent:",
        result.id
      );

      return res.json({

        ok: true,

        message:
          "Test email sent successfully",

        messageId:
          result.id,
      });

    } catch (error) {

      console.error(
        "Test Gmail email failed:",
        error
      );

      return res.status(500).json({

        ok: false,

        error:
          error.message,
      });
    }
  }
);

// ============================================================
// ABSENT REMINDER
// ============================================================

app.post(
  "/api/send-absent-reminder",

  async (req, res) => {

    try {

      console.log(
        "ABSENT REMINDER BODY:",
        req.body
      );

      const to =
        getRecipient(req.body);

      if (!to) {

        return res.status(400).json({

          ok: false,

          error:
            "Recipient email is required",
        });
      }

      const subject =
        req.body?.subject ||
        "Attendance Reminder – AttendXStudent";

      const body =
        req.body?.body ||
        req.body?.message ||
        "You were marked Absent for today's class.";

      console.log(
        "Preparing Gmail API email..."
      );

      console.log(
        "From:",
        GMAIL_USER
      );

      console.log(
        "To:",
        to
      );

      console.log(
        "Subject:",
        subject
      );

      const result =
        await sendGmailEmail({

          to:
            to,

          subject:
            subject,

          text:
            body,
        });

      console.log(
        `Reminder email sent successfully to ${to}`
      );

      console.log(
        "Gmail Message ID:",
        result.id
      );

      return res.json({

        ok: true,

        message:
          "Email sent successfully",

        messageId:
          result.id,
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

      const to =
        getRecipient(req.body);

      if (!to) {

        return res.status(400).json({

          ok: false,

          error:
            "Recipient email is required",
        });
      }

      const subject =
        req.body?.subject ||
        "Attendance Reminder – AttendXStudent";

      const body =
        req.body?.body ||
        req.body?.message ||
        "You were marked Absent for today's class.";

      const result =
        await sendGmailEmail({

          to:
            to,

          subject:
            subject,

          text:
            body,
        });

      return res.json({

        ok: true,

        message:
          "Email sent successfully",

        messageId:
          result.id,
      });

    } catch (error) {

      console.error(
        "Old reminder failed:",
        error
      );

      return res.status(500).json({

        ok: false,

        error:
          error.message ||
          "Email sending failed",
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

      emailMethod:
        "Gmail API",

      gmailConfigured:
        Boolean(
          GMAIL_REFRESH_TOKEN
        ),
    });
  }
);

// ============================================================
// ROOT
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
// 404
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
  (
    error,
    req,
    res,
    next
  ) => {

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

  () => {

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
      "Email Method: Gmail API"
    );

    console.log(
      `Gmail User: ${GMAIL_USER}`
    );

    console.log(
      `Gmail Refresh Token: ${
        GMAIL_REFRESH_TOKEN
          ? "CONFIGURED"
          : "NOT CONFIGURED"
      }`
    );

    console.log(
      `Google OAuth: ${
        GOOGLE_CLIENT_ID &&
        GOOGLE_CLIENT_SECRET
          ? "CONFIGURED"
          : "NOT CONFIGURED"
      }`
    );

    console.log(
      `Google Callback: ${GOOGLE_CALLBACK_URL}`
    );

    console.log(
      `Gmail Callback: ${GMAIL_CALLBACK_URL}`
    );

    console.log(
      "========================================"
    );
  }
);

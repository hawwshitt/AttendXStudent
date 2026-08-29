app.post("/api/send-absent-reminder", async (req, res) => {
  try {
    const { to, subject, body } = req.body;

    if (!to) {
      return res.status(400).json({
        ok: false,
        error: "Recipient email is required"
      });
    }

    await transporter.sendMail({
      from: process.env.MAIL_FROM || process.env.SMTP_USER,
      to,
      subject: subject || "AttendXStudent Attendance Reminder",
      text: body || "You were marked Absent for today's class."
    });

    res.json({
      ok: true,
      message: "Email sent successfully"
    });

  } catch (error) {
    console.error("Reminder email failed:", error);

    res.status(500).json({
      ok: false,
      error: error.message
    });
  }
});

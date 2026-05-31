# email_service.py
# Central email service. Import send_email() from here anywhere in the app.
# Uses Gmail SMTP with your app password from .env

import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import config

BRAND = "NUVRA"
APP_URL = "http://localhost:8080"
PRIMARY = "#4F46E5"  # indigo-600


def send_email(to: str, subject: str, html: str):
    """
    Send an HTML email. Fails silently with a log — never crashes the main request.
    Call this after the main DB operation succeeds.
    """
    if not config.EMAIL_ADDRESS or not config.EMAIL_PASSWORD:
        print("Warning: EMAIL_ADDRESS or EMAIL_PASSWORD not set. Skipping email.")
        return

    # Silence emails to fake demo addresses (otherwise SMTP delivers them,
    # the .demo TLD doesn't exist, and Gmail floods the sender with bounces).
    # Override with EMAIL_SEND_TO_DEMO=1 in .env if you need to test against
    # a real address that happens to use a .demo subdomain.
    import os
    allow_demo = os.getenv("EMAIL_SEND_TO_DEMO", "0") == "1"
    fake_tlds = ("@nuvra.demo", ".demo", "@example.com", "@test.com")
    if not allow_demo and any(to.lower().endswith(suffix) for suffix in fake_tlds):
        print(f"Email skipped (demo address) → {to} | {subject}")
        return

    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = f"{BRAND} <{config.EMAIL_ADDRESS}>"
        msg["To"] = to
        msg.attach(MIMEText(html, "html"))

        with smtplib.SMTP_SSL("smtp.gmail.com", 465) as server:
            server.login(config.EMAIL_ADDRESS, config.EMAIL_PASSWORD)
            server.sendmail(config.EMAIL_ADDRESS, to, msg.as_string())

        print(f"Email sent → {to} | {subject}")
    except Exception as e:
        print(f"Email failed → {to} | {subject} | {e}")


def _wrapper(title: str, body_html: str) -> str:
    return f"""
    <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; color: #1a1a1a;">
      <div style="background: {PRIMARY}; padding: 32px 40px; border-radius: 12px 12px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 24px;">{title}</h1>
      </div>
      <div style="background: #f8fafc; padding: 32px 40px; border-radius: 0 0 12px 12px; border: 1px solid #e2e8f0; border-top: none;">
        {body_html}
        <p style="font-size: 13px; color: #94a3b8; margin-top: 32px;">The {BRAND} team</p>
      </div>
    </div>
    """


# ─── Email templates ──────────────────────────────────────────────────────────

def email_welcome(name: str, role: str) -> str:
    role_line = (
        "You can now browse courses and enroll to start learning."
        if role == "student"
        else "You can now create courses, schedule sessions, and upload materials for your students."
    )
    body = f"""
        <p style="font-size: 16px; margin: 0 0 16px;">Hi <strong>{name}</strong>,</p>
        <p style="font-size: 15px; color: #475569; margin: 0 0 16px;">
          Your account is ready. {role_line}
        </p>
        <a href="{APP_URL}/dashboard"
           style="display: inline-block; background: {PRIMARY}; color: white; padding: 12px 24px;
                  border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 15px;">
          Go to Dashboard
        </a>
    """
    return _wrapper(f"Welcome to {BRAND}", body)


def email_enrollment_confirmation(student_name: str, course_title: str, tutor_name: str) -> str:
    body = f"""
        <p style="font-size: 16px; margin: 0 0 16px;">Hi <strong>{student_name}</strong>,</p>
        <p style="font-size: 15px; color: #475569; margin: 0 0 8px;">
          You've successfully enrolled in:
        </p>
        <div style="background: white; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px 20px; margin: 0 0 20px;">
          <p style="font-size: 17px; font-weight: 600; margin: 0 0 4px;">{course_title}</p>
          <p style="font-size: 13px; color: #64748b; margin: 0;">Tutor: {tutor_name}</p>
        </div>
        <p style="font-size: 15px; color: #475569; margin: 0 0 20px;">
          Your tutor will schedule sessions and upload materials shortly.
          You can ask the AI assistant questions about the course at any time.
        </p>
        <a href="{APP_URL}/dashboard"
           style="display: inline-block; background: {PRIMARY}; color: white; padding: 12px 24px;
                  border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 15px;">
          Go to Dashboard
        </a>
    """
    return _wrapper("You're enrolled!", body)


def email_new_session(
    student_name: str,
    course_title: str,
    start_time: str,
    zoom_link: str,
) -> str:
    body = f"""
        <p style="font-size: 16px; margin: 0 0 16px;">Hi <strong>{student_name}</strong>,</p>
        <p style="font-size: 15px; color: #475569; margin: 0 0 16px;">
          Your tutor has scheduled a new session for <strong>{course_title}</strong>.
        </p>
        <div style="background: white; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px 20px; margin: 0 0 24px;">
          <p style="font-size: 13px; color: #64748b; margin: 0 0 4px;">Date &amp; Time</p>
          <p style="font-size: 16px; font-weight: 600; margin: 0 0 16px;">{start_time}</p>
          <p style="font-size: 13px; color: #64748b; margin: 0 0 4px;">Meeting Link</p>
          <a href="{zoom_link}"
             style="font-size: 15px; color: {PRIMARY}; font-weight: 600; word-break: break-all;">
            {zoom_link}
          </a>
        </div>
        <a href="{zoom_link}"
           style="display: inline-block; background: #16a34a; color: white; padding: 12px 24px;
                  border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 15px;">
          Join Session
        </a>
    """
    return _wrapper("New session scheduled", body)


def email_new_assignment(
    student_name: str,
    course_title: str,
    assignment_title: str,
    due_date: str,
    description: str,
) -> str:
    body = f"""
        <p style="font-size: 16px; margin: 0 0 16px;">Hi <strong>{student_name}</strong>,</p>
        <p style="font-size: 15px; color: #475569; margin: 0 0 16px;">
          A new assignment has been posted in <strong>{course_title}</strong>.
        </p>
        <div style="background: white; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px 20px; margin: 0 0 20px;">
          <p style="font-size: 17px; font-weight: 600; margin: 0 0 8px;">{assignment_title}</p>
          <p style="font-size: 14px; color: #475569; margin: 0 0 12px; line-height: 1.5;">{description}</p>
          <p style="font-size: 13px; color: #64748b; margin: 0;">
            <strong>Due:</strong> {due_date}
          </p>
        </div>
        <a href="{APP_URL}/exams"
           style="display: inline-block; background: {PRIMARY}; color: white; padding: 12px 24px;
                  border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 15px;">
          View Assignment
        </a>
    """
    return _wrapper("New assignment posted", body)


def email_grade_received(
    student_name: str,
    course_title: str,
    assignment_title: str,
    grade: int,
    feedback: str,
) -> str:
    grade_color = "#16a34a" if grade >= 70 else "#d97706" if grade >= 50 else "#dc2626"
    feedback_block = (
        f"""<div style="background: white; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px 20px; margin: 0 0 20px;">
              <p style="font-size: 13px; color: #64748b; margin: 0 0 8px;">Tutor feedback</p>
              <p style="font-size: 14px; color: #1a1a1a; margin: 0; line-height: 1.6;">{feedback}</p>
            </div>"""
        if feedback else ""
    )
    body = f"""
        <p style="font-size: 16px; margin: 0 0 16px;">Hi <strong>{student_name}</strong>,</p>
        <p style="font-size: 15px; color: #475569; margin: 0 0 20px;">
          Your work on <strong>{assignment_title}</strong> ({course_title}) has been graded.
        </p>
        <div style="background: white; border: 1px solid #e2e8f0; border-radius: 8px; padding: 24px; text-align: center; margin: 0 0 20px;">
          <p style="font-size: 13px; color: #64748b; margin: 0 0 4px;">Your grade</p>
          <p style="font-size: 48px; font-weight: 700; color: {grade_color}; margin: 0;">{grade}<span style="font-size: 24px; color: #94a3b8;">/100</span></p>
        </div>
        {feedback_block}
        <a href="{APP_URL}/exams"
           style="display: inline-block; background: {PRIMARY}; color: white; padding: 12px 24px;
                  border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 15px;">
          View Details
        </a>
    """
    return _wrapper("Your assignment has been graded", body)

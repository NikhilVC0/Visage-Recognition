"""Email service for sending automated attendance alerts."""

import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import logging
import asyncio
import os

logger = logging.getLogger(__name__)

# SMTP Configuration (fallback to environment variables, ideally configured via .env)
SMTP_SERVER = os.getenv("SMTP_SERVER", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER", "attendance.bot@example.com")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "secret-app-password")

# Only try to send emails if explicitly enabled or if we have non-default credentials
EMAIL_ENABLED = os.getenv("SMTP_USER") is not None

async def send_attendance_email(student_name: str, student_email: str, event_type: str, time_str: str):
    """Asynchronously send an email alerting the student of their attendance."""
    if not EMAIL_ENABLED or not student_email:
        logger.debug(f"Skipping email to {student_email} (Email service disabled or missing address)")
        return
    
    # Run SMTP blocking call in a background thread to prevent blocking the async event loop
    loop = asyncio.get_running_loop()
    await loop.run_in_executor(
        None, 
        _send_email_sync, 
        student_name, 
        student_email, 
        event_type, 
        time_str
    )

def _send_email_sync(student_name: str, student_email: str, event_type: str, time_str: str):
    """Synchronous email sending logic."""
    action_text = "marked present (entry)" if event_type == "entry" else "marked absent (checkout/exit)"
    subject = f"Attendance Alert: You have been {action_text}"
    
    body = f"""
    Hello {student_name},
    
    This is an automated notification from the AI Attendance System.
    
    Your attendance was just recorded.
    Action: {action_text.title()}
    Time: {time_str}
    
    If this was an error, please contact your administrator.
    
    Regards,
    AI Attendance System
    """
    
    msg = MIMEMultipart()
    msg['From'] = SMTP_USER
    msg['To'] = student_email
    msg['Subject'] = subject
    msg.attach(MIMEText(body, 'plain'))
    
    try:
        # Establish a secure session with gmail's outgoing SMTP server using your gmail account
        server = smtplib.SMTP(SMTP_SERVER, SMTP_PORT)
        server.starttls()
        server.login(SMTP_USER, SMTP_PASSWORD)
        server.send_message(msg)
        server.quit()
        logger.info(f"Successfully sent attendance email to {student_email}")
    except Exception as e:
        logger.error(f"Failed to send email to {student_email}: {e}")

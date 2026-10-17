```python
import smtplib
from email.mime.text import MIMEText

def send_sms(phone_number, message):
    # Thông tin SMTP
    smtp_server = "smtp.example.com"
    smtp_port = 587
    smtp_username = "your_username"
    smtp_password = "your_password"

    # Tạo email
    sender_email = "your_email@example.com"
    receiver_email = phone_number
    subject = "SMS from SPSM"
    body = message

    msg = MIMEText(body)
    msg['Subject'] = subject
    msg['From'] = sender_email
    msg['To'] = receiver_email

    # Kết nối SMTP và gửi email
    try:
        server = smtplib.SMTP(smtp_server, smtp_port)
        server.starttls()
        server.login(smtp_username, smtp_password)
        server.sendmail(sender_email, receiver_email, msg.as_string())
        server.quit()
        print("SMS sent successfully!")
    except Exception as e:
        print("Failed to send SMS:", e)

# Example usage
phone_number = "+1234567890"
message = "Hello, this is an SMS from SPSM!"
send_sms(phone_number, message)
```

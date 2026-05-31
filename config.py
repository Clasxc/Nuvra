import os
from dotenv import load_dotenv

load_dotenv()

GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")
SECRET_KEY = os.getenv("SECRET_KEY")
DATABASE_URL = os.getenv("DATABASE_URL")
EMAIL_ADDRESS = os.getenv("EMAIL_ADDRESS")
EMAIL_PASSWORD = os.getenv("EMAIL_PASSWORD")

ALGORITHM = os.getenv("ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "60"))

if not GOOGLE_API_KEY:
    print("Warning: GOOGLE_API_KEY not set.")
if not SECRET_KEY:
    print("Warning: SECRET_KEY not set.")
if not DATABASE_URL:
    print("Warning: DATABASE_URL not set.")
if not EMAIL_ADDRESS or not EMAIL_PASSWORD:
    print("Warning: EMAIL_ADDRESS or EMAIL_PASSWORD not set. Emails will be skipped.")
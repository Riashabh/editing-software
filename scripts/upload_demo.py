import os, boto3
from botocore.config import Config
from dotenv import load_dotenv

load_dotenv()

s3 = boto3.client(
    "s3",
    endpoint_url=os.environ["R2_ENDPOINT_URL"],
    aws_access_key_id=os.environ["R2_ACCESS_KEY_ID"],
    aws_secret_access_key=os.environ["R2_SECRET_ACCESS_KEY"],
    config=Config(signature_version="s3v4"),
    region_name="auto",
)

uploaded_bytes = [0]

def progress(n):
    uploaded_bytes[0] += n
    print(f"\r{uploaded_bytes[0]/1e6:.1f} MB uploaded", end="", flush=True)

s3.upload_file(
    "demo/demo_compressed.mp4",
    os.environ["R2_BUCKET"],
    "demo/demo.mp4",
    ExtraArgs={"ContentType": "video/mp4"},
    Callback=progress,
)
print("\nDone.")

import os
import boto3
from botocore.config import Config

_r2 = None

def _client():
    global _r2
    if _r2 is None:
        _r2 = boto3.client(
            "s3",
            endpoint_url=os.environ["R2_ENDPOINT_URL"],
            aws_access_key_id=os.environ["R2_ACCESS_KEY_ID"],
            aws_secret_access_key=os.environ["R2_SECRET_ACCESS_KEY"],
            config=Config(signature_version="s3v4"),
            region_name="auto",
        )
    return _r2

def upload(local_path: str, key: str) -> str:
    bucket = os.environ["R2_BUCKET"]
    _client().upload_file(local_path, bucket, key, ExtraArgs={"ContentType": "video/mp4"})
    return _client().generate_presigned_url("get_object", Params={"Bucket": bucket, "Key": key}, ExpiresIn=3600)


def enabled() -> bool:
    return bool(os.environ.get("R2_ENDPOINT_URL"))

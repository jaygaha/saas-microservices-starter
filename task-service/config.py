import os
from dataclasses import dataclass

@dataclass
class Config:
    service_name: str
    port: int
    database_url: str
    jwt_secret: str
    
# Helper to load configuration from environment variables
# We are manually loading config, 
def load_config() -> Config:
    def required(key: str) -> str:
        val = os.getenv(key)
        if val is None:
            raise ValueError(f"Missing required environment variable: {key}")
        return val


    return Config(
        service_name=os.getenv("SERVICE_NAME", "task-service"),
        port=int(os.getenv("PORT", "8001")),
        database_url=required("DATABASE_URL"),
        jwt_secret=required("JWT_SECRET"),
    )

config = load_config()

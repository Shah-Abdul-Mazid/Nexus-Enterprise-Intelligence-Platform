import os
from pydantic_settings import BaseSettings
from dotenv import load_dotenv

load_dotenv()

class Settings(BaseSettings):
    PROJECT_NAME: str = "Nexus Intelligence"
    API_V1_STR: str = "/api/v1"
    
    LLM_PROVIDER: str = os.getenv("LLM_PROVIDER", "openai")
    OPENAI_API_KEY: str = os.getenv("OPENAI_API_KEY", "")
    GOOGLE_API_KEY: str = os.getenv("GOOGLE_API_KEY", "")
    GROK_API_KEY: str = os.getenv("GROK_API_KEY", "")
    WEATHER_API_KEY: str = os.getenv("WEATHER_API_KEY", "")
    TAVILY_API_KEY: str = os.getenv("TAVILY_API_KEY", "")
    
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./data/app.db")

    
    PINECONE_API_KEY: str = os.getenv("PINECONE_API_KEY", "")
    PINECONE_INDEX_NAME: str = os.getenv("PINECONE_INDEX_NAME", "enterprise-rag")
    
    UPLOADS_DIR: str = os.getenv("UPLOADS_DIR", "./uploads")

    # Security & Firewall Settings
    RENDER_INTERNAL_SECRET: str = os.getenv("RENDER_INTERNAL_SECRET", "")
    JWT_SECRET_KEY: str = os.getenv("JWT_SECRET_KEY", "mgi_interview_super_secret_key")
    FRONTEND_URL: str = os.getenv("FRONTEND_URL", "http://localhost:3000")
    ALLOWED_ORIGINS: str = os.getenv("ALLOWED_ORIGINS", "")

settings = Settings()

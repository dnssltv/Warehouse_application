from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    POSTGRES_DB: str
    POSTGRES_USER: str
    POSTGRES_PASSWORD: str
    POSTGRES_HOST: str = "db"
    POSTGRES_PORT: int = 5432
    DATABASE_URL: str | None = None

    BACKEND_HOST: str = "0.0.0.0"
    BACKEND_PORT: int = 8000
    CORS_ORIGINS: list[str] = ["http://localhost:5173"]
    # Разрешить запросы с частных IP (LAN): 192.168.x.x, 10.x, 172.16–31.x и localhost с любым портом
    CORS_ALLOW_LAN: bool = True

    SECRET_KEY: str
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440
    ADMIN_EMAIL: str
    ADMIN_PASSWORD: str
    ADMIN_FIRST_NAME: str = "Admin"
    ADMIN_LAST_NAME: str = "User"
    SYNC_ADMIN_ON_STARTUP: bool = False

    @property
    def cors_lan_regex(self) -> str | None:
        if not self.CORS_ALLOW_LAN:
            return None
        return (
            r"https?://(localhost|127\.0\.0\.1)(:[0-9]+)?"
            r"|https?://192\.168\.\d{1,3}\.\d{1,3}(:[0-9]+)?"
            r"|https?://10\.\d{1,3}\.\d{1,3}\.\d{1,3}(:[0-9]+)?"
            r"|https?://172\.(1[6-9]|2[0-9]|3[0-1])\.\d{1,3}\.\d{1,3}(:[0-9]+)?"
        )

    @property
    def database_url(self) -> str:
        if self.DATABASE_URL:
            # Render usually provides postgresql://... URL
            # SQLAlchemy with psycopg2 expects postgresql+psycopg2://...
            if self.DATABASE_URL.startswith("postgresql+psycopg2://"):
                return self.DATABASE_URL
            if self.DATABASE_URL.startswith("postgresql://"):
                return self.DATABASE_URL.replace("postgresql://", "postgresql+psycopg2://", 1)
            if self.DATABASE_URL.startswith("postgres://"):
                return self.DATABASE_URL.replace("postgres://", "postgresql+psycopg2://", 1)
            return self.DATABASE_URL
        return (
            f"postgresql+psycopg2://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}"
            f"@{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
        )


settings = Settings()

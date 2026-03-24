"""Platform configuration — all settings from environment variables."""

import logging
import secrets

from pydantic_settings import BaseSettings
from pydantic import model_validator
from functools import lru_cache

logger = logging.getLogger(__name__)


class Settings(BaseSettings):
    # Platform
    APP_NAME: str = "Murph.AI NexGen Platform"
    APP_VERSION: str = "1.1.0"
    DEBUG: bool = False
    HOST: str = "0.0.0.0"
    PORT: int = 8000

    # Database
    DATABASE_URL: str = "postgresql+asyncpg://nexgen:nexgen@localhost:5432/nexgen_platform"
    DATABASE_POOL_SIZE: int = 20
    DATABASE_MAX_OVERFLOW: int = 10

    # Auth / Keycloak
    KEYCLOAK_URL: str = "https://vm-iam-01.mgmt.local:8443"
    KEYCLOAK_REALM: str = "nexgen"
    KEYCLOAK_CLIENT_ID: str = "nexgen-platform"
    KEYCLOAK_CLIENT_SECRET: str = ""
    JWT_SECRET_KEY: str = ""
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 480  # 8 hours for admin

    # AWS Bedrock (LLM — Bedrock only per Addendum v1.1)
    AWS_REGION: str = "us-east-1"
    AWS_ACCESS_KEY_ID: str = ""
    AWS_SECRET_ACCESS_KEY: str = ""
    BEDROCK_MODEL_ID: str = "anthropic.claude-3-5-sonnet-20241022-v2:0"
    BEDROCK_ONLY: bool = True  # v1.1 — no Ollama until GPU added

    # Ollama (DEFERRED — v1.1)
    OLLAMA_ENDPOINT: str = "http://vm-llm-01.control.local:11434"
    OLLAMA_MODEL: str = "llama3:8b"
    OLLAMA_ENABLED: bool = False  # Deferred until GPU installed

    # Proxmox
    PROXMOX_URL: str = "https://192.168.4.58:8006"
    PROXMOX_TOKEN_ID: str = "platform@pve!platform-token"
    PROXMOX_TOKEN_SECRET: str = ""
    PROXMOX_VERIFY_SSL: bool = False
    PROXMOX_NODE: str = "r7625"
    PROXMOX_STORAGE: str = "nexgen-vms"
    PROXMOX_ISO_STORAGE: str = "local"
    PROXMOX_BRIDGE_PREFIX: str = "vmbr"
    PROXMOX_UBUNTU_ISO: str = "ubuntu-22.04.iso"

    # HashiCorp Vault
    VAULT_URL: str = "https://vm-sec-01.mgmt.local:8200"
    VAULT_TOKEN: str = ""

    # Murph.ai Integration
    MURPH_API_BASE_URL: str = "https://api.murph.ai"
    MURPH_HMAC_SECRET: str = ""
    MURPH_WEBHOOK_SECRET: str = ""
    MURPH_RATE_LIMIT_PER_MIN: int = 100

    # Monitoring
    PROMETHEUS_ENABLED: bool = True
    GRAFANA_URL: str = "http://vm-mon-01.mgmt.local:3000"

    # Security
    CORS_ORIGINS: list[str] = ["https://dashboard.nexgen.local"]
    TLS_MIN_VERSION: str = "1.3"

    # Backup
    BACKUP_SSH_USER: str = "deploy"
    BACKUP_SSH_KEY_PATH: str = "/opt/nexgen/.ssh/id_ed25519"
    BACKUP_DEST_DIR: str = "/var/backups/nexgen"

    model_config = {"env_file": ".env", "case_sensitive": True}

    @model_validator(mode="after")
    def validate_critical_settings(self) -> "Settings":
        if not self.JWT_SECRET_KEY:
            raise ValueError(
                "JWT_SECRET_KEY must be set. Generate one with: openssl rand -hex 32"
            )
        if not self.PROXMOX_TOKEN_SECRET:
            logger.warning(
                "PROXMOX_TOKEN_SECRET is empty — Proxmox API calls will fail. "
                "Set it from the token created during Proxmox post-install."
            )
        if not self.AWS_ACCESS_KEY_ID or not self.AWS_SECRET_ACCESS_KEY:
            logger.warning(
                "AWS credentials not set — Bedrock LLM calls will fail. "
                "Set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY in .env."
            )
        if not self.MURPH_HMAC_SECRET:
            self.MURPH_HMAC_SECRET = secrets.token_hex(32)
            logger.warning(
                "MURPH_HMAC_SECRET was empty — generated a random one for this session. "
                "Set it in .env for persistence across restarts."
            )
        if not self.MURPH_WEBHOOK_SECRET:
            self.MURPH_WEBHOOK_SECRET = secrets.token_hex(32)
            logger.warning(
                "MURPH_WEBHOOK_SECRET was empty — generated a random one for this session."
            )
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()

import os

# ========================================
# STANDALONE DATABASE MODE (Default)
# ========================================
# Notes are now stored directly in the database.
# You don't need an Obsidian vault to use this app.

# The database will be created in the `data` folder unless explicitly overridden.
_DEFAULT_DB_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'data', 'notes.db'))
DB_PATH = os.path.abspath(os.environ.get('MYOB_DATABASE_PATH', _DEFAULT_DB_PATH))
DB_CONNECTION_STRING = f"sqlite:///{DB_PATH}"
DATA_DIR = os.path.abspath(os.environ.get('MYOB_DATA_DIR', os.path.dirname(DB_PATH)))
ATTACHMENTS_PATH = os.path.join(DATA_DIR, 'attachments')

# ========================================
# OBSIDIAN IMPORT (Optional)
# ========================================
# Only needed if you want to import notes from an existing Obsidian vault.
# Set this to None if you don't have an Obsidian vault.
# Example for Windows: "C:/Users/YourName/Documents/ObsidianVault"
# Example for macOS/Linux: "/Users/yourname/Documents/ObsidianVault"

VAULT_PATH = os.environ.get("MYOB_VAULT_PATH")

# Validate vault path only if it's set and being used for import
def validate_vault_path():
    """Check if vault path exists. Only call this when importing from Obsidian."""
    if VAULT_PATH and not os.path.isdir(VAULT_PATH):
        raise Exception(
            f"Vault path not found or is not a directory: '{VAULT_PATH}'.\n"
            f"Either update VAULT_PATH in backend/config.py or set it to None."
        )
    return VAULT_PATH

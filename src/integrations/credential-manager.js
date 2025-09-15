import crypto from 'crypto';
import { promises as fs } from 'fs';
import path from 'path';

/**
 * Manages encrypted credential storage for platform integrations
 */
export class CredentialManager {
  constructor(options = {}) {
    this.credentials_path = options.credentials_path || '.devflow/credentials';
    this.use_keychain = options.use_keychain || false;
    this.service_name = options.service_name || 'devflow';
    this.auto_refresh = false;
    this.refresh_handlers = new Map();
    this.default_accounts = new Map();

    // Validate and set encryption key
    if (options.encryption_key) {
      if (options.encryption_key.length !== 64) {
        throw new Error('Encryption key must be 64 hex characters');
      }
      this.encryption_key = Buffer.from(options.encryption_key, 'hex');
    } else {
      // Generate a key if not provided (should be persisted in production)
      this.encryption_key = crypto.randomBytes(32);
    }
  }

  /**
   * Save encrypted credentials for a platform
   */
  async save_credentials(platform, credentials) {
    const encrypted = this.encrypt(JSON.stringify(credentials));
    const file_path = this.get_credential_path(platform);

    await fs.mkdir(path.dirname(file_path), { recursive: true });
    await fs.writeFile(file_path, encrypted, 'utf8');

    return true;
  }

  /**
   * Get and decrypt credentials for a platform
   */
  async get_credentials(platform) {
    try {
      const file_path = this.get_credential_path(platform);
      const encrypted = await fs.readFile(file_path, 'utf8');
      const decrypted = this.decrypt(encrypted);
      const credentials = JSON.parse(decrypted);

      // Auto-refresh if enabled and token is expired
      if (this.auto_refresh && this.is_token_expired(credentials)) {
        return await this.refresh_token(platform);
      }

      return credentials;
    } catch (error) {
      if (error.code === 'ENOENT') {
        return null;
      }
      throw error;
    }
  }

  /**
   * Delete credentials for a platform
   */
  async delete_credentials(platform) {
    const file_path = this.get_credential_path(platform);
    await fs.unlink(file_path);
  }

  /**
   * List all stored credential platforms
   */
  async list_credentials() {
    try {
      const files = await fs.readdir(this.credentials_path);
      return files
        .filter((f) => f.endsWith('.enc'))
        .map((f) => f.replace('.enc', '').replace('_', ':'));
    } catch (error) {
      if (error.code === 'ENOENT') {
        return [];
      }
      throw error;
    }
  }

  /**
   * Validate credentials (check expiration)
   */
  async validate_credentials(platform) {
    const credentials = await this.get_credentials(platform);
    if (!credentials) {
      return false;
    }

    if (!credentials.expires_at) {
      return true; // No expiration
    }

    return !this.is_token_expired(credentials);
  }

  /**
   * Check if token is expired
   */
  is_token_expired(credentials) {
    if (!credentials.expires_at) {
      return false;
    }
    return Date.now() >= credentials.expires_at;
  }

  /**
   * Encrypt data using AES-256-GCM
   */
  encrypt(plaintext) {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-gcm', this.encryption_key, iv);

    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const auth_tag = cipher.getAuthTag();

    return `${iv.toString('hex')}:${auth_tag.toString('hex')}:${encrypted}`;
  }

  /**
   * Decrypt data
   */
  decrypt(encrypted_data) {
    const parts = encrypted_data.split(':');
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted data format');
    }

    const [iv_hex, auth_tag_hex, encrypted] = parts;
    const iv = Buffer.from(iv_hex, 'hex');
    const auth_tag = Buffer.from(auth_tag_hex, 'hex');

    const decipher = crypto.createDecipheriv('aes-256-gcm', this.encryption_key, iv);
    decipher.setAuthTag(auth_tag);

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }

  /**
   * Set a refresh handler for a platform
   */
  set_refresh_handler(platform, handler) {
    this.refresh_handlers.set(platform, handler);
  }

  /**
   * Enable or disable auto-refresh
   */
  enable_auto_refresh(enabled) {
    this.auto_refresh = enabled;
  }

  /**
   * Refresh an OAuth token
   */
  async refresh_token(platform) {
    const credentials = await this.get_credentials(platform);
    if (!credentials || !credentials.refresh_token) {
      throw new Error('No refresh token available');
    }

    const refresh_handler = this.refresh_handlers.get(platform);
    if (!refresh_handler) {
      throw new Error(`No refresh handler configured for ${platform}`);
    }

    try {
      const new_token_data = await refresh_handler(credentials.refresh_token);

      const updated_credentials = {
        ...credentials,
        token: new_token_data.access_token,
        refresh_token: new_token_data.refresh_token || credentials.refresh_token,
        expires_at: new_token_data.expires_in
          ? Date.now() + new_token_data.expires_in * 1000
          : undefined,
      };

      await this.save_credentials(platform, updated_credentials);
      return updated_credentials;
    } catch (error) {
      throw new Error(`Failed to refresh token: ${error.message}`);
    }
  }

  /**
   * Get credential file path
   */
  get_credential_path(platform) {
    const safe_platform = platform.replace(':', '_');
    return path.join(this.credentials_path, `${safe_platform}.enc`);
  }

  /**
   * Check if using OS keychain
   */
  is_using_keychain() {
    return this.use_keychain;
  }

  /**
   * List accounts for a platform
   */
  async list_accounts(platform) {
    const all_credentials = await this.list_credentials();
    return all_credentials
      .filter((cred) => cred.startsWith(`${platform}:`))
      .map((cred) => cred.split(':')[1]);
  }

  /**
   * Set default account for a platform
   */
  set_default_account(platform, account) {
    this.default_accounts.set(platform, account);
  }

  /**
   * Get default account for a platform
   */
  get_default_account(platform) {
    return this.default_accounts.get(platform);
  }

  /**
   * Export credentials for backup
   */
  async export_credentials(password) {
    const all_platforms = await this.list_credentials();
    const credentials = {};

    for (const platform of all_platforms) {
      credentials[platform] = await this.get_credentials(platform);
    }

    const backup_data = JSON.stringify(credentials);
    const encrypted = this.encrypt_with_password(backup_data, password);

    return {
      version: '1.0.0',
      encrypted_data: encrypted,
      timestamp: Date.now(),
    };
  }

  /**
   * Import credentials from backup
   */
  async import_credentials(backup, password) {
    if (backup.version !== '1.0.0') {
      throw new Error('Unsupported backup version');
    }

    const decrypted = this.decrypt_with_password(backup.encrypted_data, password);
    const credentials = JSON.parse(decrypted);

    for (const [platform, creds] of Object.entries(credentials)) {
      await this.save_credentials(platform, creds);
    }

    return Object.keys(credentials);
  }

  /**
   * Encrypt with password (for backups)
   */
  encrypt_with_password(data, password) {
    const salt = crypto.randomBytes(32);
    const key = crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha256');
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const auth_tag = cipher.getAuthTag();

    return Buffer.from(
      JSON.stringify({
        salt: salt.toString('hex'),
        iv: iv.toString('hex'),
        auth_tag: auth_tag.toString('hex'),
        encrypted,
      })
    ).toString('base64');
  }

  /**
   * Decrypt with password (for backups)
   */
  decrypt_with_password(encrypted_data, password) {
    const data = JSON.parse(Buffer.from(encrypted_data, 'base64').toString());
    const salt = Buffer.from(data.salt, 'hex');
    const key = crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha256');
    const iv = Buffer.from(data.iv, 'hex');
    const auth_tag = Buffer.from(data.auth_tag, 'hex');

    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(auth_tag);

    let decrypted = decipher.update(data.encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }

  /**
   * Decrypt backup (helper method for testing)
   */
  decrypt_backup(encrypted_data, password) {
    return this.decrypt_with_password(encrypted_data, password);
  }

  /**
   * Migrate credentials between storage backends
   */
  async migrate_credentials(old_manager) {
    const platforms = await old_manager.list_credentials();
    const migrated = [];

    for (const platform of platforms) {
      const credentials = await old_manager.get_credentials(platform);
      if (credentials) {
        await this.save_credentials(platform, credentials);
        migrated.push(platform);
      }
    }

    return migrated;
  }
}

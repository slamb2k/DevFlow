import { jest } from '@jest/globals';
import { CredentialManager } from '../../src/integrations/credential-manager.js';
import * as fs from 'fs';
import path from 'path';
import crypto from 'crypto';

// Mock fs module
const mockFs = {
  readFile: jest.fn(),
  writeFile: jest.fn(),
  mkdir: jest.fn(),
  access: jest.fn(),
  unlink: jest.fn(),
  readdir: jest.fn(),
};

jest.mock('fs', () => ({
  promises: mockFs,
}));

describe('CredentialManager', () => {
  let credential_manager;
  let mock_encryption_key;

  beforeEach(() => {
    mock_encryption_key = crypto.randomBytes(32).toString('hex');
    credential_manager = new CredentialManager({
      credentials_path: '.devflow/credentials',
      encryption_key: mock_encryption_key,
    });
    jest.clearAllMocks();
  });

  describe('Credential Storage', () => {
    it('should save encrypted credentials', async () => {
      const credentials = {
        platform: 'github',
        token: 'ghp_test_token_12345',
        refresh_token: 'ghp_refresh_token',
        expires_at: Date.now() + 3600000,
      };

      await credential_manager.save_credentials('github', credentials);

      expect(mockFs.mkdir).toHaveBeenCalledWith(expect.stringContaining('.devflow/credentials'), {
        recursive: true,
      });
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('github.enc'),
        expect.any(String),
        'utf8'
      );
    });

    it('should retrieve and decrypt credentials', async () => {
      const original_credentials = {
        platform: 'gitlab',
        token: 'glpat-test-token',
        expires_at: Date.now() + 7200000,
      };

      const encrypted_data = credential_manager.encrypt(JSON.stringify(original_credentials));
      mockFs.readFile.mockResolvedValue(encrypted_data);

      const retrieved = await credential_manager.get_credentials('gitlab');
      expect(retrieved).toEqual(original_credentials);
    });

    it('should handle missing credentials gracefully', async () => {
      mockFs.readFile.mockRejectedValue(new Error('ENOENT'));

      const result = await credential_manager.get_credentials('non-existent');
      expect(result).toBeNull();
    });

    it('should delete credentials', async () => {
      await credential_manager.delete_credentials('github');

      expect(mockFs.unlink).toHaveBeenCalledWith(expect.stringContaining('github.enc'));
    });

    it('should list all stored credentials', async () => {
      mockFs.readFile.mockImplementation((path) => {
        if (path.includes('github')) {
          return Promise.resolve(
            credential_manager.encrypt(JSON.stringify({ platform: 'github', token: 'token1' }))
          );
        }
        if (path.includes('gitlab')) {
          return Promise.resolve(
            credential_manager.encrypt(JSON.stringify({ platform: 'gitlab', token: 'token2' }))
          );
        }
        return Promise.reject(new Error('Not found'));
      });

      const platforms = await credential_manager.list_credentials();
      expect(platforms).toContain('github');
      expect(platforms).toContain('gitlab');
    });
  });

  describe('Encryption', () => {
    it('should encrypt data using AES-256-GCM', () => {
      const plaintext = 'sensitive-data';
      const encrypted = credential_manager.encrypt(plaintext);

      expect(encrypted).not.toBe(plaintext);
      expect(encrypted).toContain(':'); // Should contain IV:authTag:encrypted
    });

    it('should decrypt data correctly', () => {
      const plaintext = 'test-credential-data';
      const encrypted = credential_manager.encrypt(plaintext);
      const decrypted = credential_manager.decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it('should generate unique IVs for each encryption', () => {
      const plaintext = 'same-data';
      const encrypted1 = credential_manager.encrypt(plaintext);
      const encrypted2 = credential_manager.encrypt(plaintext);

      expect(encrypted1).not.toBe(encrypted2);
    });

    it('should fail decryption with wrong key', () => {
      const plaintext = 'secure-data';
      const encrypted = credential_manager.encrypt(plaintext);

      const wrong_manager = new CredentialManager({
        credentials_path: '.devflow/credentials',
        encryption_key: crypto.randomBytes(32).toString('hex'),
      });

      expect(() => wrong_manager.decrypt(encrypted)).toThrow();
    });

    it('should validate encryption key strength', () => {
      expect(() => {
        new CredentialManager({
          credentials_path: '.devflow/credentials',
          encryption_key: 'weak-key',
        });
      }).toThrow('Encryption key must be 64 hex characters');
    });
  });

  describe('Token Validation', () => {
    it('should validate token expiration', async () => {
      const expired_token = {
        platform: 'jira',
        token: 'expired-token',
        expires_at: Date.now() - 3600000, // Expired 1 hour ago
      };

      mockFs.readFile.mockResolvedValue(credential_manager.encrypt(JSON.stringify(expired_token)));

      const is_valid = await credential_manager.validate_credentials('jira');
      expect(is_valid).toBe(false);
    });

    it('should validate non-expired tokens', async () => {
      const valid_token = {
        platform: 'slack',
        token: 'valid-token',
        expires_at: Date.now() + 3600000, // Expires in 1 hour
      };

      mockFs.readFile.mockResolvedValue(credential_manager.encrypt(JSON.stringify(valid_token)));

      const is_valid = await credential_manager.validate_credentials('slack');
      expect(is_valid).toBe(true);
    });

    it('should handle tokens without expiration', async () => {
      const permanent_token = {
        platform: 'github',
        token: 'personal-access-token',
        // No expires_at field
      };

      mockFs.readFile.mockResolvedValue(
        credential_manager.encrypt(JSON.stringify(permanent_token))
      );

      const is_valid = await credential_manager.validate_credentials('github');
      expect(is_valid).toBe(true);
    });
  });

  describe('OAuth Token Management', () => {
    it('should refresh OAuth tokens', async () => {
      const oauth_credentials = {
        platform: 'github',
        token: 'access-token',
        refresh_token: 'refresh-token',
        expires_at: Date.now() - 1000, // Just expired
      };

      mockFs.readFile.mockResolvedValue(
        credential_manager.encrypt(JSON.stringify(oauth_credentials))
      );

      const mock_refresh_handler = jest.fn().mockResolvedValue({
        access_token: 'new-access-token',
        refresh_token: 'new-refresh-token',
        expires_in: 3600,
      });

      credential_manager.set_refresh_handler('github', mock_refresh_handler);

      const refreshed = await credential_manager.refresh_token('github');

      expect(mock_refresh_handler).toHaveBeenCalledWith('refresh-token');
      expect(refreshed.token).toBe('new-access-token');
      expect(mockFs.writeFile).toHaveBeenCalled();
    });

    it('should auto-refresh expired tokens on retrieval', async () => {
      const expired_oauth = {
        platform: 'gitlab',
        token: 'old-token',
        refresh_token: 'refresh-token',
        expires_at: Date.now() - 1000,
      };

      mockFs.readFile.mockResolvedValue(credential_manager.encrypt(JSON.stringify(expired_oauth)));

      const mock_refresh_handler = jest.fn().mockResolvedValue({
        access_token: 'fresh-token',
        expires_in: 7200,
      });

      credential_manager.set_refresh_handler('gitlab', mock_refresh_handler);
      credential_manager.enable_auto_refresh(true);

      const credentials = await credential_manager.get_credentials('gitlab');

      expect(mock_refresh_handler).toHaveBeenCalled();
      expect(credentials.token).toBe('fresh-token');
    });

    it('should handle refresh failures', async () => {
      const expired_oauth = {
        platform: 'jira',
        token: 'expired-token',
        refresh_token: 'bad-refresh-token',
        expires_at: Date.now() - 1000,
      };

      mockFs.readFile.mockResolvedValue(credential_manager.encrypt(JSON.stringify(expired_oauth)));

      const mock_refresh_handler = jest.fn().mockRejectedValue(new Error('Invalid refresh token'));

      credential_manager.set_refresh_handler('jira', mock_refresh_handler);

      await expect(credential_manager.refresh_token('jira')).rejects.toThrow(
        'Failed to refresh token'
      );
    });
  });

  describe('Secure Storage', () => {
    it('should use OS keychain when available', async () => {
      const keytar_manager = new CredentialManager({
        use_keychain: true,
        service_name: 'devflow',
      });

      const credentials = {
        platform: 'github',
        token: 'secure-token',
      };

      await keytar_manager.save_credentials('github', credentials);

      // Verify keychain methods would be called (mocked in actual implementation)
      expect(keytar_manager.is_using_keychain()).toBe(true);
    });

    it('should fallback to encrypted file storage', async () => {
      const file_manager = new CredentialManager({
        use_keychain: false,
        credentials_path: '.devflow/credentials',
        encryption_key: mock_encryption_key,
      });

      const credentials = {
        platform: 'gitlab',
        token: 'file-token',
      };

      await file_manager.save_credentials('gitlab', credentials);

      expect(mockFs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('.devflow/credentials'),
        expect.any(String),
        'utf8'
      );
    });

    it('should migrate credentials between storage backends', async () => {
      const old_manager = new CredentialManager({
        use_keychain: false,
        credentials_path: '.devflow/credentials',
        encryption_key: mock_encryption_key,
      });

      const new_manager = new CredentialManager({
        use_keychain: true,
        service_name: 'devflow',
      });

      const credentials = {
        platform: 'slack',
        token: 'migrate-token',
      };

      await old_manager.save_credentials('slack', credentials);

      const migrated = await new_manager.migrate_credentials(old_manager);
      expect(migrated).toContain('slack');
    });
  });

  describe('Multi-Account Support', () => {
    it('should support multiple accounts per platform', async () => {
      const account1 = {
        platform: 'github',
        account: 'user1',
        token: 'token1',
      };

      const account2 = {
        platform: 'github',
        account: 'user2',
        token: 'token2',
      };

      await credential_manager.save_credentials('github:user1', account1);
      await credential_manager.save_credentials('github:user2', account2);

      const retrieved1 = await credential_manager.get_credentials('github:user1');
      const retrieved2 = await credential_manager.get_credentials('github:user2');

      expect(retrieved1.token).toBe('token1');
      expect(retrieved2.token).toBe('token2');
    });

    it('should list accounts by platform', async () => {
      mockFs.readFile.mockImplementation((path) => {
        const accounts = {
          'github:personal': { account: 'personal', token: 'token1' },
          'github:work': { account: 'work', token: 'token2' },
          'gitlab:main': { account: 'main', token: 'token3' },
        };

        for (const [key, value] of Object.entries(accounts)) {
          if (path.includes(key.replace(':', '_'))) {
            return Promise.resolve(credential_manager.encrypt(JSON.stringify(value)));
          }
        }
        return Promise.reject(new Error('Not found'));
      });

      const github_accounts = await credential_manager.list_accounts('github');
      expect(github_accounts).toContain('personal');
      expect(github_accounts).toContain('work');
      expect(github_accounts).not.toContain('main');
    });

    it('should set default account per platform', async () => {
      await credential_manager.set_default_account('github', 'work');
      const default_account = credential_manager.get_default_account('github');
      expect(default_account).toBe('work');
    });
  });

  describe('Credential Backup and Recovery', () => {
    it('should export credentials for backup', async () => {
      const credentials = {
        github: { token: 'github-token' },
        gitlab: { token: 'gitlab-token' },
      };

      for (const [platform, cred] of Object.entries(credentials)) {
        await credential_manager.save_credentials(platform, cred);
      }

      const backup = await credential_manager.export_credentials('password123');

      expect(backup).toBeDefined();
      expect(backup.version).toBe('1.0.0');
      expect(backup.encrypted_data).toBeDefined();
      expect(backup.timestamp).toBeDefined();
    });

    it('should import credentials from backup', async () => {
      const backup = {
        version: '1.0.0',
        encrypted_data: 'encrypted-backup-data',
        timestamp: Date.now(),
      };

      const mock_decrypt = jest.spyOn(credential_manager, 'decrypt_backup').mockReturnValue({
        github: { token: 'restored-github-token' },
        gitlab: { token: 'restored-gitlab-token' },
      });

      await credential_manager.import_credentials(backup, 'password123');

      expect(mock_decrypt).toHaveBeenCalledWith(backup.encrypted_data, 'password123');
      expect(mockFs.writeFile).toHaveBeenCalled();
    });

    it('should validate backup integrity', async () => {
      const invalid_backup = {
        version: '0.0.0', // Wrong version
        encrypted_data: 'data',
      };

      await expect(
        credential_manager.import_credentials(invalid_backup, 'password')
      ).rejects.toThrow('Unsupported backup version');
    });
  });
});

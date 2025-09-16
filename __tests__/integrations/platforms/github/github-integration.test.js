import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { GitHubIntegration } from '../../../../src/integrations/platforms/github/GitHubIntegration.js';
import { IntegrationManager } from '../../../../src/integrations/integration-manager.js';
import { CredentialManager } from '../../../../src/integrations/credential-manager.js';
import { EventBus } from '../../../../src/integrations/event-bus.js';
import { Octokit } from '@octokit/rest';
import { createOAuthAppAuth } from '@octokit/auth-oauth-app';
import { createAppAuth } from '@octokit/auth-app';
import crypto from 'crypto';

jest.mock('@octokit/rest');
jest.mock('@octokit/auth-oauth-app');
jest.mock('@octokit/auth-app');
jest.mock('../../../../src/integrations/credential-manager.js');
jest.mock('../../../../src/integrations/event-bus.js');

describe('GitHubIntegration', () => {
  let githubIntegration;
  let mockCredentialManager;
  let mockEventBus;
  let mockOctokit;

  beforeEach(() => {
    jest.clearAllMocks();

    mockCredentialManager = {
      getCredential: jest.fn(),
      storeCredential: jest.fn(),
      deleteCredential: jest.fn()
    };

    mockEventBus = {
      emit: jest.fn(),
      on: jest.fn(),
      off: jest.fn()
    };

    mockOctokit = {
      rest: {
        repos: {
          listForAuthenticatedUser: jest.fn(),
          create: jest.fn(),
          get: jest.fn(),
          delete: jest.fn(),
          listBranches: jest.fn(),
          getBranch: jest.fn()
        },
        issues: {
          create: jest.fn(),
          update: jest.fn(),
          get: jest.fn(),
          listForRepo: jest.fn(),
          createComment: jest.fn(),
          listComments: jest.fn()
        },
        pulls: {
          create: jest.fn(),
          update: jest.fn(),
          get: jest.fn(),
          list: jest.fn(),
          merge: jest.fn(),
          listReviews: jest.fn(),
          createReview: jest.fn()
        },
        actions: {
          createWorkflowDispatch: jest.fn(),
          listWorkflowRuns: jest.fn(),
          getWorkflowRun: jest.fn(),
          listRepoWorkflows: jest.fn()
        },
        users: {
          getAuthenticated: jest.fn()
        },
        apps: {
          getAuthenticated: jest.fn()
        }
      },
      paginate: jest.fn(),
      auth: jest.fn()
    };

    Octokit.mockImplementation(() => mockOctokit);
    CredentialManager.getInstance = jest.fn().mockReturnValue(mockCredentialManager);
    EventBus.getInstance = jest.fn().mockReturnValue(mockEventBus);

    githubIntegration = new GitHubIntegration();
  });

  describe('Authentication', () => {
    describe('OAuth 2.0 Flow', () => {
      it('should initiate OAuth flow with correct parameters', async () => {
        const config = {
          clientId: 'test-client-id',
          clientSecret: 'test-client-secret',
          redirectUri: 'http://localhost:3000/callback'
        };

        const authUrl = await githubIntegration.initiateOAuthFlow(config);

        expect(authUrl).toContain('https://github.com/login/oauth/authorize');
        expect(authUrl).toContain('client_id=test-client-id');
        expect(authUrl).toContain('redirect_uri=');
        expect(authUrl).toContain('scope=');
      });

      it('should handle OAuth callback and exchange code for token', async () => {
        const code = 'test-auth-code';
        const config = {
          clientId: 'test-client-id',
          clientSecret: 'test-client-secret'
        };

        const mockAuthResponse = {
          authentication: {
            token: 'gho_testtoken123',
            tokenType: 'oauth',
            scope: 'repo,user'
          }
        };

        createOAuthAppAuth.mockReturnValue(() => mockAuthResponse);

        const result = await githubIntegration.handleOAuthCallback(code, config);

        expect(result.token).toBe('gho_testtoken123');
        expect(mockCredentialManager.storeCredential).toHaveBeenCalledWith(
          'github',
          expect.objectContaining({
            token: 'gho_testtoken123',
            type: 'oauth'
          })
        );
      });

      it('should handle OAuth errors gracefully', async () => {
        const code = 'invalid-code';
        const config = {
          clientId: 'test-client-id',
          clientSecret: 'test-client-secret'
        };

        createOAuthAppAuth.mockImplementation(() => {
          throw new Error('Invalid authorization code');
        });

        await expect(githubIntegration.handleOAuthCallback(code, config))
          .rejects.toThrow('Invalid authorization code');
      });
    });

    describe('Personal Access Token', () => {
      it('should authenticate with personal access token', async () => {
        const token = 'ghp_testtoken456';

        await githubIntegration.authenticateWithToken(token);

        expect(Octokit).toHaveBeenCalledWith({
          auth: token
        });
        expect(mockCredentialManager.storeCredential).toHaveBeenCalledWith(
          'github',
          expect.objectContaining({
            token,
            type: 'personal_access_token'
          })
        );
      });

      it('should validate token has required scopes', async () => {
        const token = 'ghp_testtoken789';

        mockOctokit.rest.users.getAuthenticated.mockResolvedValue({
          data: { login: 'testuser' },
          headers: {
            'x-oauth-scopes': 'repo, user, workflow'
          }
        });

        const isValid = await githubIntegration.validateTokenScopes(token, ['repo', 'user']);

        expect(isValid).toBe(true);
      });

      it('should reject token with insufficient scopes', async () => {
        const token = 'ghp_limited';

        mockOctokit.rest.users.getAuthenticated.mockResolvedValue({
          data: { login: 'testuser' },
          headers: {
            'x-oauth-scopes': 'public_repo'
          }
        });

        const isValid = await githubIntegration.validateTokenScopes(token, ['repo', 'user']);

        expect(isValid).toBe(false);
      });
    });

    describe('GitHub App Authentication', () => {
      it('should authenticate as GitHub App', async () => {
        const appConfig = {
          appId: 12345,
          privateKey: '-----BEGIN RSA PRIVATE KEY-----\ntest-key\n-----END RSA PRIVATE KEY-----',
          installationId: 67890
        };

        const mockAppAuth = jest.fn().mockResolvedValue({
          token: 'ghs_apptoken123',
          type: 'installation'
        });

        createAppAuth.mockReturnValue(mockAppAuth);

        await githubIntegration.authenticateAsApp(appConfig);

        expect(createAppAuth).toHaveBeenCalledWith({
          appId: appConfig.appId,
          privateKey: appConfig.privateKey,
          installationId: appConfig.installationId
        });

        expect(Octokit).toHaveBeenCalledWith({
          authStrategy: expect.any(Function)
        });
      });

      it('should list app installations', async () => {
        const mockInstallations = [
          { id: 1, account: { login: 'org1' } },
          { id: 2, account: { login: 'org2' } }
        ];

        mockOctokit.rest.apps.getAuthenticated.mockResolvedValue({
          data: { id: 12345, name: 'TestApp' }
        });

        mockOctokit.paginate.mockResolvedValue(mockInstallations);

        const installations = await githubIntegration.listAppInstallations();

        expect(installations).toEqual(mockInstallations);
      });
    });

    describe('Enterprise Server Support', () => {
      it('should connect to GitHub Enterprise Server', async () => {
        const config = {
          baseUrl: 'https://github.enterprise.com/api/v3',
          token: 'ghes_token123'
        };

        await githubIntegration.connectToEnterprise(config);

        expect(Octokit).toHaveBeenCalledWith({
          baseUrl: config.baseUrl,
          auth: config.token
        });
      });

      it('should validate enterprise server connection', async () => {
        mockOctokit.rest.users.getAuthenticated.mockResolvedValue({
          data: { login: 'enterprise-user' }
        });

        const isValid = await githubIntegration.validateConnection();

        expect(isValid).toBe(true);
      });
    });
  });

  describe('Repository Management', () => {
    beforeEach(async () => {
      await githubIntegration.authenticateWithToken('ghp_test');
    });

    describe('Repository Operations', () => {
      it('should list repositories for authenticated user', async () => {
        const mockRepos = [
          { id: 1, name: 'repo1', full_name: 'user/repo1' },
          { id: 2, name: 'repo2', full_name: 'user/repo2' }
        ];

        mockOctokit.paginate.mockResolvedValue(mockRepos);

        const repos = await githubIntegration.listRepositories();

        expect(mockOctokit.paginate).toHaveBeenCalledWith(
          mockOctokit.rest.repos.listForAuthenticatedUser,
          expect.any(Object)
        );
        expect(repos).toEqual(mockRepos);
      });

      it('should create a new repository', async () => {
        const repoConfig = {
          name: 'new-repo',
          description: 'Test repository',
          private: true,
          auto_init: true
        };

        mockOctokit.rest.repos.create.mockResolvedValue({
          data: {
            id: 123,
            name: 'new-repo',
            full_name: 'user/new-repo',
            clone_url: 'https://github.com/user/new-repo.git'
          }
        });

        const repo = await githubIntegration.createRepository(repoConfig);

        expect(mockOctokit.rest.repos.create).toHaveBeenCalledWith(repoConfig);
        expect(repo.name).toBe('new-repo');
        expect(mockEventBus.emit).toHaveBeenCalledWith('github:repository:created', expect.any(Object));
      });

      it('should clone a repository', async () => {
        const cloneUrl = 'https://github.com/user/repo.git';
        const localPath = '/tmp/repo';

        const result = await githubIntegration.cloneRepository(cloneUrl, localPath);

        expect(result.localPath).toBe(localPath);
        expect(result.cloneUrl).toBe(cloneUrl);
      });

      it('should delete a repository', async () => {
        mockOctokit.rest.repos.delete.mockResolvedValue({ status: 204 });

        await githubIntegration.deleteRepository('user', 'repo-to-delete');

        expect(mockOctokit.rest.repos.delete).toHaveBeenCalledWith({
          owner: 'user',
          repo: 'repo-to-delete'
        });
        expect(mockEventBus.emit).toHaveBeenCalledWith('github:repository:deleted', expect.any(Object));
      });

      it('should get repository details', async () => {
        const mockRepo = {
          id: 1,
          name: 'test-repo',
          full_name: 'user/test-repo',
          default_branch: 'main'
        };

        mockOctokit.rest.repos.get.mockResolvedValue({ data: mockRepo });

        const repo = await githubIntegration.getRepository('user', 'test-repo');

        expect(repo).toEqual(mockRepo);
      });

      it('should list repository branches', async () => {
        const mockBranches = [
          { name: 'main', protected: true },
          { name: 'develop', protected: false }
        ];

        mockOctokit.paginate.mockResolvedValue(mockBranches);

        const branches = await githubIntegration.listBranches('user', 'repo');

        expect(branches).toEqual(mockBranches);
      });
    });
  });

  describe('Pull Request and Issue Management', () => {
    beforeEach(async () => {
      await githubIntegration.authenticateWithToken('ghp_test');
    });

    describe('Issue Operations', () => {
      it('should create an issue', async () => {
        const issueData = {
          title: 'Bug: Test issue',
          body: 'This is a test issue',
          labels: ['bug', 'high-priority'],
          assignees: ['user1']
        };

        mockOctokit.rest.issues.create.mockResolvedValue({
          data: {
            id: 1,
            number: 42,
            title: issueData.title,
            state: 'open'
          }
        });

        const issue = await githubIntegration.createIssue('user', 'repo', issueData);

        expect(mockOctokit.rest.issues.create).toHaveBeenCalledWith({
          owner: 'user',
          repo: 'repo',
          ...issueData
        });
        expect(issue.number).toBe(42);
        expect(mockEventBus.emit).toHaveBeenCalledWith('github:issue:created', expect.any(Object));
      });

      it('should update an issue', async () => {
        const updateData = {
          state: 'closed',
          labels: ['resolved']
        };

        mockOctokit.rest.issues.update.mockResolvedValue({
          data: {
            number: 42,
            state: 'closed'
          }
        });

        const issue = await githubIntegration.updateIssue('user', 'repo', 42, updateData);

        expect(mockOctokit.rest.issues.update).toHaveBeenCalledWith({
          owner: 'user',
          repo: 'repo',
          issue_number: 42,
          ...updateData
        });
        expect(mockEventBus.emit).toHaveBeenCalledWith('github:issue:updated', expect.any(Object));
      });

      it('should list issues with filters', async () => {
        const filters = {
          state: 'open',
          labels: 'bug',
          assignee: 'user1'
        };

        const mockIssues = [
          { number: 1, title: 'Issue 1' },
          { number: 2, title: 'Issue 2' }
        ];

        mockOctokit.paginate.mockResolvedValue(mockIssues);

        const issues = await githubIntegration.listIssues('user', 'repo', filters);

        expect(mockOctokit.paginate).toHaveBeenCalledWith(
          mockOctokit.rest.issues.listForRepo,
          {
            owner: 'user',
            repo: 'repo',
            ...filters
          }
        );
        expect(issues).toEqual(mockIssues);
      });

      it('should add a comment to an issue', async () => {
        const comment = 'This is a test comment';

        mockOctokit.rest.issues.createComment.mockResolvedValue({
          data: {
            id: 123,
            body: comment
          }
        });

        const result = await githubIntegration.addIssueComment('user', 'repo', 42, comment);

        expect(mockOctokit.rest.issues.createComment).toHaveBeenCalledWith({
          owner: 'user',
          repo: 'repo',
          issue_number: 42,
          body: comment
        });
        expect(result.body).toBe(comment);
      });
    });

    describe('Pull Request Operations', () => {
      it('should create a pull request', async () => {
        const prData = {
          title: 'Feature: Add new feature',
          body: 'This PR adds a new feature',
          head: 'feature-branch',
          base: 'main',
          draft: false
        };

        mockOctokit.rest.pulls.create.mockResolvedValue({
          data: {
            id: 1,
            number: 100,
            title: prData.title,
            state: 'open'
          }
        });

        const pr = await githubIntegration.createPullRequest('user', 'repo', prData);

        expect(mockOctokit.rest.pulls.create).toHaveBeenCalledWith({
          owner: 'user',
          repo: 'repo',
          ...prData
        });
        expect(pr.number).toBe(100);
        expect(mockEventBus.emit).toHaveBeenCalledWith('github:pr:created', expect.any(Object));
      });

      it('should update a pull request', async () => {
        const updateData = {
          title: 'Updated title',
          body: 'Updated body',
          state: 'closed'
        };

        mockOctokit.rest.pulls.update.mockResolvedValue({
          data: {
            number: 100,
            ...updateData
          }
        });

        const pr = await githubIntegration.updatePullRequest('user', 'repo', 100, updateData);

        expect(mockOctokit.rest.pulls.update).toHaveBeenCalledWith({
          owner: 'user',
          repo: 'repo',
          pull_number: 100,
          ...updateData
        });
        expect(mockEventBus.emit).toHaveBeenCalledWith('github:pr:updated', expect.any(Object));
      });

      it('should merge a pull request', async () => {
        const mergeOptions = {
          merge_method: 'squash',
          commit_title: 'Merge PR #100',
          commit_message: 'Squashed commit'
        };

        mockOctokit.rest.pulls.merge.mockResolvedValue({
          data: {
            sha: 'abc123',
            merged: true
          }
        });

        const result = await githubIntegration.mergePullRequest('user', 'repo', 100, mergeOptions);

        expect(mockOctokit.rest.pulls.merge).toHaveBeenCalledWith({
          owner: 'user',
          repo: 'repo',
          pull_number: 100,
          ...mergeOptions
        });
        expect(result.merged).toBe(true);
        expect(mockEventBus.emit).toHaveBeenCalledWith('github:pr:merged', expect.any(Object));
      });

      it('should list pull requests with filters', async () => {
        const filters = {
          state: 'open',
          base: 'main',
          sort: 'created'
        };

        const mockPRs = [
          { number: 1, title: 'PR 1' },
          { number: 2, title: 'PR 2' }
        ];

        mockOctokit.paginate.mockResolvedValue(mockPRs);

        const prs = await githubIntegration.listPullRequests('user', 'repo', filters);

        expect(mockOctokit.paginate).toHaveBeenCalledWith(
          mockOctokit.rest.pulls.list,
          {
            owner: 'user',
            repo: 'repo',
            ...filters
          }
        );
        expect(prs).toEqual(mockPRs);
      });

      it('should create a pull request review', async () => {
        const reviewData = {
          body: 'LGTM',
          event: 'APPROVE',
          comments: [
            {
              path: 'src/index.js',
              line: 10,
              body: 'Nice work!'
            }
          ]
        };

        mockOctokit.rest.pulls.createReview.mockResolvedValue({
          data: {
            id: 456,
            state: 'APPROVED'
          }
        });

        const review = await githubIntegration.createPullRequestReview('user', 'repo', 100, reviewData);

        expect(mockOctokit.rest.pulls.createReview).toHaveBeenCalledWith({
          owner: 'user',
          repo: 'repo',
          pull_number: 100,
          ...reviewData
        });
        expect(review.state).toBe('APPROVED');
      });
    });
  });

  describe('GitHub Actions Integration', () => {
    beforeEach(async () => {
      await githubIntegration.authenticateWithToken('ghp_test');
    });

    it('should trigger a workflow dispatch', async () => {
      const dispatchData = {
        workflow_id: 'ci.yml',
        ref: 'main',
        inputs: {
          environment: 'production',
          version: '1.0.0'
        }
      };

      mockOctokit.rest.actions.createWorkflowDispatch.mockResolvedValue({
        status: 204
      });

      await githubIntegration.triggerWorkflow('user', 'repo', dispatchData);

      expect(mockOctokit.rest.actions.createWorkflowDispatch).toHaveBeenCalledWith({
        owner: 'user',
        repo: 'repo',
        ...dispatchData
      });
      expect(mockEventBus.emit).toHaveBeenCalledWith('github:workflow:triggered', expect.any(Object));
    });

    it('should list workflow runs', async () => {
      const mockRuns = [
        { id: 1, status: 'completed', conclusion: 'success' },
        { id: 2, status: 'in_progress', conclusion: null }
      ];

      mockOctokit.paginate.mockResolvedValue(mockRuns);

      const runs = await githubIntegration.listWorkflowRuns('user', 'repo', 'ci.yml');

      expect(mockOctokit.paginate).toHaveBeenCalledWith(
        mockOctokit.rest.actions.listWorkflowRuns,
        {
          owner: 'user',
          repo: 'repo',
          workflow_id: 'ci.yml'
        }
      );
      expect(runs).toEqual(mockRuns);
    });

    it('should get workflow run details', async () => {
      const mockRun = {
        id: 12345,
        status: 'completed',
        conclusion: 'success',
        created_at: '2024-01-01T00:00:00Z'
      };

      mockOctokit.rest.actions.getWorkflowRun.mockResolvedValue({
        data: mockRun
      });

      const run = await githubIntegration.getWorkflowRun('user', 'repo', 12345);

      expect(mockOctokit.rest.actions.getWorkflowRun).toHaveBeenCalledWith({
        owner: 'user',
        repo: 'repo',
        run_id: 12345
      });
      expect(run).toEqual(mockRun);
    });

    it('should list available workflows', async () => {
      const mockWorkflows = [
        { id: 1, name: 'CI', path: '.github/workflows/ci.yml' },
        { id: 2, name: 'Deploy', path: '.github/workflows/deploy.yml' }
      ];

      mockOctokit.paginate.mockResolvedValue(mockWorkflows);

      const workflows = await githubIntegration.listWorkflows('user', 'repo');

      expect(mockOctokit.paginate).toHaveBeenCalledWith(
        mockOctokit.rest.actions.listRepoWorkflows,
        {
          owner: 'user',
          repo: 'repo'
        }
      );
      expect(workflows).toEqual(mockWorkflows);
    });

    it('should handle workflow dispatch with invalid inputs', async () => {
      const dispatchData = {
        workflow_id: 'invalid.yml',
        ref: 'main',
        inputs: {}
      };

      mockOctokit.rest.actions.createWorkflowDispatch.mockRejectedValue(
        new Error('Workflow not found')
      );

      await expect(githubIntegration.triggerWorkflow('user', 'repo', dispatchData))
        .rejects.toThrow('Workflow not found');
    });
  });

  describe('Webhook Handling', () => {
    it('should register webhook handlers', () => {
      const handler = jest.fn();

      githubIntegration.registerWebhookHandler('push', handler);

      expect(githubIntegration.webhookHandlers.get('push')).toBe(handler);
    });

    it('should process push webhook', async () => {
      const pushHandler = jest.fn();
      githubIntegration.registerWebhookHandler('push', pushHandler);

      const payload = {
        ref: 'refs/heads/main',
        repository: { full_name: 'user/repo' },
        commits: [{ id: 'abc123', message: 'Test commit' }]
      };

      await githubIntegration.handleWebhook('push', payload);

      expect(pushHandler).toHaveBeenCalledWith(payload);
      expect(mockEventBus.emit).toHaveBeenCalledWith('github:webhook:push', payload);
    });

    it('should process pull request webhook', async () => {
      const prHandler = jest.fn();
      githubIntegration.registerWebhookHandler('pull_request', prHandler);

      const payload = {
        action: 'opened',
        pull_request: {
          number: 42,
          title: 'New feature',
          user: { login: 'contributor' }
        }
      };

      await githubIntegration.handleWebhook('pull_request', payload);

      expect(prHandler).toHaveBeenCalledWith(payload);
      expect(mockEventBus.emit).toHaveBeenCalledWith('github:webhook:pull_request', payload);
    });

    it('should process issue webhook', async () => {
      const issueHandler = jest.fn();
      githubIntegration.registerWebhookHandler('issues', issueHandler);

      const payload = {
        action: 'opened',
        issue: {
          number: 10,
          title: 'Bug report',
          user: { login: 'reporter' }
        }
      };

      await githubIntegration.handleWebhook('issues', payload);

      expect(issueHandler).toHaveBeenCalledWith(payload);
      expect(mockEventBus.emit).toHaveBeenCalledWith('github:webhook:issues', payload);
    });

    it('should validate webhook signature', () => {
      const secret = 'webhook-secret';
      const payload = JSON.stringify({ test: 'data' });
      const signature = 'sha256=' + crypto.createHmac('sha256', secret).update(payload).digest('hex');

      const isValid = githubIntegration.validateWebhookSignature(payload, signature, secret);

      expect(isValid).toBe(true);
    });

    it('should reject invalid webhook signature', () => {
      const secret = 'webhook-secret';
      const payload = JSON.stringify({ test: 'data' });
      const signature = 'sha256=invalid';

      const isValid = githubIntegration.validateWebhookSignature(payload, signature, secret);

      expect(isValid).toBe(false);
    });

    it('should handle workflow run webhook', async () => {
      const workflowHandler = jest.fn();
      githubIntegration.registerWebhookHandler('workflow_run', workflowHandler);

      const payload = {
        action: 'completed',
        workflow_run: {
          id: 12345,
          status: 'completed',
          conclusion: 'success'
        }
      };

      await githubIntegration.handleWebhook('workflow_run', payload);

      expect(workflowHandler).toHaveBeenCalledWith(payload);
      expect(mockEventBus.emit).toHaveBeenCalledWith('github:webhook:workflow_run', payload);
    });

    it('should handle release webhook', async () => {
      const releaseHandler = jest.fn();
      githubIntegration.registerWebhookHandler('release', releaseHandler);

      const payload = {
        action: 'published',
        release: {
          tag_name: 'v1.0.0',
          name: 'Release 1.0.0'
        }
      };

      await githubIntegration.handleWebhook('release', payload);

      expect(releaseHandler).toHaveBeenCalledWith(payload);
      expect(mockEventBus.emit).toHaveBeenCalledWith('github:webhook:release', payload);
    });
  });

  describe('Error Handling and Retry Logic', () => {
    beforeEach(async () => {
      await githubIntegration.authenticateWithToken('ghp_test');
    });

    it('should retry on rate limit errors', async () => {
      const rateLimitError = new Error('API rate limit exceeded');
      rateLimitError.status = 403;
      rateLimitError.response = {
        headers: {
          'x-ratelimit-remaining': '0',
          'x-ratelimit-reset': String(Math.floor(Date.now() / 1000) + 60)
        }
      };

      mockOctokit.rest.repos.get
        .mockRejectedValueOnce(rateLimitError)
        .mockResolvedValueOnce({ data: { name: 'test-repo' } });

      const repo = await githubIntegration.getRepository('user', 'repo');

      expect(repo.name).toBe('test-repo');
      expect(mockOctokit.rest.repos.get).toHaveBeenCalledTimes(2);
    });

    it('should handle authentication errors', async () => {
      const authError = new Error('Bad credentials');
      authError.status = 401;

      mockOctokit.rest.users.getAuthenticated.mockRejectedValue(authError);

      await expect(githubIntegration.validateConnection())
        .rejects.toThrow('Bad credentials');

      expect(mockEventBus.emit).toHaveBeenCalledWith('github:error:authentication', expect.any(Object));
    });

    it('should handle network errors with retry', async () => {
      const networkError = new Error('Network error');
      networkError.code = 'ECONNRESET';

      mockOctokit.rest.repos.listForAuthenticatedUser
        .mockRejectedValueOnce(networkError)
        .mockRejectedValueOnce(networkError)
        .mockResolvedValueOnce({ data: [{ name: 'repo1' }] });

      mockOctokit.paginate
        .mockRejectedValueOnce(networkError)
        .mockRejectedValueOnce(networkError)
        .mockResolvedValueOnce([{ name: 'repo1' }]);

      const repos = await githubIntegration.listRepositories();

      expect(repos).toHaveLength(1);
      expect(mockOctokit.paginate).toHaveBeenCalledTimes(3);
    });

    it('should handle repository not found errors', async () => {
      const notFoundError = new Error('Not Found');
      notFoundError.status = 404;

      mockOctokit.rest.repos.get.mockRejectedValue(notFoundError);

      await expect(githubIntegration.getRepository('user', 'nonexistent'))
        .rejects.toThrow('Not Found');
    });

    it('should handle permission errors', async () => {
      const permissionError = new Error('Insufficient permissions');
      permissionError.status = 403;
      permissionError.message = 'Resource not accessible by integration';

      mockOctokit.rest.repos.delete.mockRejectedValue(permissionError);

      await expect(githubIntegration.deleteRepository('user', 'protected-repo'))
        .rejects.toThrow('Insufficient permissions');

      expect(mockEventBus.emit).toHaveBeenCalledWith('github:error:permission', expect.any(Object));
    });
  });

  describe('Integration with IntegrationManager', () => {
    it('should register with IntegrationManager', () => {
      const manager = new IntegrationManager();
      const spy = jest.spyOn(manager, 'registerIntegration');

      githubIntegration.register(manager);

      expect(spy).toHaveBeenCalledWith('github', githubIntegration);
    });

    it('should provide correct metadata', () => {
      const metadata = githubIntegration.getMetadata();

      expect(metadata).toEqual({
        name: 'GitHub',
        version: '1.0.0',
        platform: 'github',
        supportedAuthMethods: ['oauth', 'personal_access_token', 'github_app'],
        capabilities: [
          'repository_management',
          'issue_tracking',
          'pull_requests',
          'actions_workflow',
          'webhooks'
        ]
      });
    });

    it('should handle lifecycle events', async () => {
      await githubIntegration.onInit();
      expect(mockEventBus.emit).toHaveBeenCalledWith('github:initialized', expect.any(Object));

      await githubIntegration.onStart();
      expect(mockEventBus.emit).toHaveBeenCalledWith('github:started', expect.any(Object));

      await githubIntegration.onStop();
      expect(mockEventBus.emit).toHaveBeenCalledWith('github:stopped', expect.any(Object));

      await githubIntegration.onDestroy();
      expect(mockEventBus.emit).toHaveBeenCalledWith('github:destroyed', expect.any(Object));
    });
  });

  describe('Cross-Platform Event Mapping', () => {
    beforeEach(async () => {
      await githubIntegration.authenticateWithToken('ghp_test');
    });

    it('should map GitHub issue to standard format', () => {
      const githubIssue = {
        number: 42,
        title: 'Bug: Test issue',
        body: 'Description',
        state: 'open',
        labels: [{ name: 'bug' }, { name: 'high-priority' }],
        assignees: [{ login: 'user1' }],
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-02T00:00:00Z'
      };

      const standardIssue = githubIntegration.mapToStandardIssue(githubIssue);

      expect(standardIssue).toEqual({
        id: 'github-42',
        title: 'Bug: Test issue',
        description: 'Description',
        status: 'open',
        labels: ['bug', 'high-priority'],
        assignees: ['user1'],
        platform: 'github',
        platformId: 42,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-02T00:00:00Z'
      });
    });

    it('should map standard issue to GitHub format', () => {
      const standardIssue = {
        title: 'New feature',
        description: 'Feature description',
        labels: ['enhancement'],
        assignees: ['developer1']
      };

      const githubIssue = githubIntegration.mapFromStandardIssue(standardIssue);

      expect(githubIssue).toEqual({
        title: 'New feature',
        body: 'Feature description',
        labels: ['enhancement'],
        assignees: ['developer1']
      });
    });

    it('should emit cross-platform events', async () => {
      const issueData = {
        title: 'Cross-platform issue',
        body: 'Test',
        labels: ['bug']
      };

      mockOctokit.rest.issues.create.mockResolvedValue({
        data: {
          number: 100,
          ...issueData,
          state: 'open'
        }
      });

      await githubIntegration.createIssue('user', 'repo', issueData);

      expect(mockEventBus.emit).toHaveBeenCalledWith(
        'integration:issue:created',
        expect.objectContaining({
          platform: 'github',
          data: expect.any(Object)
        })
      );
    });
  });
});
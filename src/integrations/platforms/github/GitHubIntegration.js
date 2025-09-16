import { Octokit } from '@octokit/rest';
import { createOAuthAppAuth } from '@octokit/auth-oauth-app';
import { createAppAuth } from '@octokit/auth-app';
import crypto from 'crypto';
import { BaseIntegration } from '../../base-integration.js';
import { CredentialManager } from '../../credential-manager.js';
import { EventBus } from '../../event-bus.js';
import { RateLimiter } from '../../rate-limiter.js';

class GitHubIntegration extends BaseIntegration {
  constructor() {
    super('github');
    this.octokit = null;
    this.credentialManager = CredentialManager.getInstance();
    this.eventBus = EventBus.getInstance();
    this.rateLimiter = new RateLimiter();
    this.webhookHandlers = new Map();
  }

  // OAuth 2.0 Authentication
  async initiateOAuthFlow(config) {
    const { clientId, clientSecret, redirectUri, scopes = ['repo', 'user', 'workflow'] } = config;

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      scope: scopes.join(' '),
      state: crypto.randomBytes(16).toString('hex')
    });

    return `https://github.com/login/oauth/authorize?${params.toString()}`;
  }

  async handleOAuthCallback(code, config) {
    const { clientId, clientSecret } = config;

    try {
      const auth = createOAuthAppAuth({
        clientId,
        clientSecret
      });

      const { authentication } = await auth({
        type: 'oauth-user',
        code
      });

      const credential = {
        token: authentication.token,
        type: 'oauth',
        scope: authentication.scope,
        createdAt: new Date().toISOString()
      };

      await this.credentialManager.storeCredential('github', credential);

      this.octokit = new Octokit({
        auth: authentication.token
      });

      return credential;
    } catch (error) {
      throw error;
    }
  }

  // Personal Access Token Authentication
  async authenticateWithToken(token) {
    this.octokit = new Octokit({
      auth: token
    });

    const credential = {
      token,
      type: 'personal_access_token',
      createdAt: new Date().toISOString()
    };

    await this.credentialManager.storeCredential('github', credential);

    return credential;
  }

  async validateTokenScopes(token, requiredScopes) {
    const tempOctokit = new Octokit({ auth: token });

    try {
      const { headers } = await tempOctokit.rest.users.getAuthenticated();
      const grantedScopes = headers['x-oauth-scopes'] ? headers['x-oauth-scopes'].split(', ') : [];

      return requiredScopes.every(scope => grantedScopes.includes(scope));
    } catch (error) {
      return false;
    }
  }

  // GitHub App Authentication
  async authenticateAsApp(appConfig) {
    const { appId, privateKey, installationId } = appConfig;

    const auth = createAppAuth({
      appId,
      privateKey,
      installationId
    });

    this.octokit = new Octokit({
      authStrategy: createAppAuth,
      auth: {
        appId,
        privateKey,
        installationId
      }
    });

    const credential = {
      type: 'github_app',
      appId,
      installationId,
      createdAt: new Date().toISOString()
    };

    await this.credentialManager.storeCredential('github', credential);

    return credential;
  }

  async listAppInstallations() {
    if (!this.octokit) {
      throw new Error('Not authenticated');
    }

    try {
      const installations = await this.octokit.paginate(
        this.octokit.rest.apps.listInstallations
      );
      return installations;
    } catch (error) {
      throw error;
    }
  }

  // Enterprise Server Support
  async connectToEnterprise(config) {
    const { baseUrl, token } = config;

    this.octokit = new Octokit({
      baseUrl,
      auth: token
    });

    const credential = {
      token,
      type: 'enterprise',
      baseUrl,
      createdAt: new Date().toISOString()
    };

    await this.credentialManager.storeCredential('github', credential);

    return credential;
  }

  async validateConnection() {
    if (!this.octokit) {
      throw new Error('Not authenticated');
    }

    try {
      const { data } = await this.octokit.rest.users.getAuthenticated();
      return true;
    } catch (error) {
      if (error.status === 401) {
        this.eventBus.emit('github:error:authentication', { error });
      }
      throw error;
    }
  }

  // Repository Management
  async listRepositories(options = {}) {
    return this.withRetry(async () => {
      const repos = await this.octokit.paginate(
        this.octokit.rest.repos.listForAuthenticatedUser,
        {
          per_page: 100,
          ...options
        }
      );
      return repos;
    });
  }

  async createRepository(config) {
    const { data } = await this.octokit.rest.repos.create(config);

    this.eventBus.emit('github:repository:created', { repository: data });

    return data;
  }

  async cloneRepository(cloneUrl, localPath) {
    // This would typically use git commands via child_process
    // For now, return a placeholder
    return {
      cloneUrl,
      localPath,
      status: 'cloned'
    };
  }

  async deleteRepository(owner, repo) {
    try {
      await this.octokit.rest.repos.delete({ owner, repo });

      this.eventBus.emit('github:repository:deleted', { owner, repo });
    } catch (error) {
      if (error.status === 403) {
        this.eventBus.emit('github:error:permission', { error, owner, repo });
      }
      throw error;
    }
  }

  async getRepository(owner, repo) {
    const { data } = await this.octokit.rest.repos.get({ owner, repo });
    return data;
  }

  async listBranches(owner, repo) {
    const branches = await this.octokit.paginate(
      this.octokit.rest.repos.listBranches,
      { owner, repo }
    );
    return branches;
  }

  // Issue Management
  async createIssue(owner, repo, issueData) {
    const { data } = await this.octokit.rest.issues.create({
      owner,
      repo,
      ...issueData
    });

    this.eventBus.emit('github:issue:created', { issue: data });
    this.eventBus.emit('integration:issue:created', {
      platform: 'github',
      data: this.mapToStandardIssue(data)
    });

    return data;
  }

  async updateIssue(owner, repo, issueNumber, updateData) {
    const { data } = await this.octokit.rest.issues.update({
      owner,
      repo,
      issue_number: issueNumber,
      ...updateData
    });

    this.eventBus.emit('github:issue:updated', { issue: data });

    return data;
  }

  async listIssues(owner, repo, filters = {}) {
    const issues = await this.octokit.paginate(
      this.octokit.rest.issues.listForRepo,
      {
        owner,
        repo,
        ...filters
      }
    );
    return issues;
  }

  async addIssueComment(owner, repo, issueNumber, comment) {
    const { data } = await this.octokit.rest.issues.createComment({
      owner,
      repo,
      issue_number: issueNumber,
      body: comment
    });
    return data;
  }

  // Pull Request Management
  async createPullRequest(owner, repo, prData) {
    const { data } = await this.octokit.rest.pulls.create({
      owner,
      repo,
      ...prData
    });

    this.eventBus.emit('github:pr:created', { pullRequest: data });

    return data;
  }

  async updatePullRequest(owner, repo, pullNumber, updateData) {
    const { data } = await this.octokit.rest.pulls.update({
      owner,
      repo,
      pull_number: pullNumber,
      ...updateData
    });

    this.eventBus.emit('github:pr:updated', { pullRequest: data });

    return data;
  }

  async mergePullRequest(owner, repo, pullNumber, mergeOptions = {}) {
    const { data } = await this.octokit.rest.pulls.merge({
      owner,
      repo,
      pull_number: pullNumber,
      ...mergeOptions
    });

    this.eventBus.emit('github:pr:merged', { pullRequest: data });

    return data;
  }

  async listPullRequests(owner, repo, filters = {}) {
    const prs = await this.octokit.paginate(
      this.octokit.rest.pulls.list,
      {
        owner,
        repo,
        ...filters
      }
    );
    return prs;
  }

  async createPullRequestReview(owner, repo, pullNumber, reviewData) {
    const { data } = await this.octokit.rest.pulls.createReview({
      owner,
      repo,
      pull_number: pullNumber,
      ...reviewData
    });
    return data;
  }

  // GitHub Actions
  async triggerWorkflow(owner, repo, dispatchData) {
    await this.octokit.rest.actions.createWorkflowDispatch({
      owner,
      repo,
      ...dispatchData
    });

    this.eventBus.emit('github:workflow:triggered', {
      owner,
      repo,
      workflow: dispatchData.workflow_id
    });
  }

  async listWorkflowRuns(owner, repo, workflowId) {
    const runs = await this.octokit.paginate(
      this.octokit.rest.actions.listWorkflowRuns,
      {
        owner,
        repo,
        workflow_id: workflowId
      }
    );
    return runs;
  }

  async getWorkflowRun(owner, repo, runId) {
    const { data } = await this.octokit.rest.actions.getWorkflowRun({
      owner,
      repo,
      run_id: runId
    });
    return data;
  }

  async listWorkflows(owner, repo) {
    const workflows = await this.octokit.paginate(
      this.octokit.rest.actions.listRepoWorkflows,
      {
        owner,
        repo
      }
    );
    return workflows;
  }

  // Webhook Handling
  registerWebhookHandler(event, handler) {
    this.webhookHandlers.set(event, handler);
  }

  async handleWebhook(event, payload) {
    const handler = this.webhookHandlers.get(event);
    if (handler) {
      await handler(payload);
    }

    this.eventBus.emit(`github:webhook:${event}`, payload);
  }

  validateWebhookSignature(payload, signature, secret) {
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(payload);
    const expectedSignature = 'sha256=' + hmac.digest('hex');

    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  }

  // Data Mapping
  mapToStandardIssue(githubIssue) {
    return {
      id: `github-${githubIssue.number}`,
      title: githubIssue.title,
      description: githubIssue.body,
      status: githubIssue.state,
      labels: githubIssue.labels ? githubIssue.labels.map(l => l.name) : [],
      assignees: githubIssue.assignees ? githubIssue.assignees.map(a => a.login) : [],
      platform: 'github',
      platformId: githubIssue.number,
      createdAt: githubIssue.created_at,
      updatedAt: githubIssue.updated_at
    };
  }

  mapFromStandardIssue(standardIssue) {
    return {
      title: standardIssue.title,
      body: standardIssue.description,
      labels: standardIssue.labels || [],
      assignees: standardIssue.assignees || []
    };
  }

  // Integration Metadata
  getMetadata() {
    return {
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
    };
  }

  // Lifecycle Methods
  async onInit() {
    await super.onInit();
    this.eventBus.emit('github:initialized', { metadata: this.getMetadata() });
  }

  async onStart() {
    await super.onStart();
    this.eventBus.emit('github:started', {});
  }

  async onStop() {
    await super.onStop();
    this.eventBus.emit('github:stopped', {});
  }

  async onDestroy() {
    await super.onDestroy();
    this.eventBus.emit('github:destroyed', {});
  }

  // Retry Logic
  async withRetry(fn, maxRetries = 3) {
    let lastError;

    for (let i = 0; i < maxRetries; i++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;

        if (error.status === 403 && error.response?.headers['x-ratelimit-remaining'] === '0') {
          const resetTime = parseInt(error.response.headers['x-ratelimit-reset'], 10);
          const waitTime = Math.max(0, resetTime * 1000 - Date.now());

          if (i < maxRetries - 1) {
            await new Promise(resolve => setTimeout(resolve, Math.min(waitTime, 60000)));
            continue;
          }
        }

        if (error.code === 'ECONNRESET' && i < maxRetries - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, i)));
          continue;
        }

        throw error;
      }
    }

    throw lastError;
  }

  // IntegrationManager Registration
  register(manager) {
    manager.registerIntegration('github', this);
  }
}

export { GitHubIntegration };
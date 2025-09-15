# API Specification

This is the API specification for the spec detailed in @.agent-os/specs/2025-09-15-platform-integrations/spec.md

## Integration Management Endpoints

### POST /api/integrations/connect
**Purpose:** Initiate connection to a platform
**Parameters:**
- `platform` (string): github|gitlab|jira|slack
- `config` (object): Platform-specific configuration
**Response:**
```json
{
  "status": "pending|connected|failed",
  "authUrl": "https://...", // For OAuth flows
  "integrationId": "uuid"
}
```
**Errors:** 400 (invalid platform), 401 (auth failed), 500 (connection error)

### GET /api/integrations
**Purpose:** List all configured integrations
**Parameters:** None
**Response:**
```json
{
  "integrations": [
    {
      "id": "uuid",
      "platform": "github",
      "status": "connected",
      "account": "username/org",
      "connectedAt": "2025-09-15T10:00:00Z"
    }
  ]
}
```
**Errors:** 401 (unauthorized)

### DELETE /api/integrations/:id
**Purpose:** Disconnect an integration
**Parameters:**
- `id` (string): Integration ID
**Response:**
```json
{
  "status": "disconnected",
  "message": "Integration removed successfully"
}
```
**Errors:** 404 (integration not found), 500 (removal failed)

## Webhook Endpoints

### POST /webhooks/github
**Purpose:** Receive GitHub webhook events
**Parameters:** GitHub webhook payload
**Response:** 200 OK
**Errors:** 401 (invalid signature), 400 (malformed payload)

### POST /webhooks/gitlab
**Purpose:** Receive GitLab webhook events
**Parameters:** GitLab webhook payload
**Response:** 200 OK
**Errors:** 401 (invalid token), 400 (malformed payload)

### POST /webhooks/jira
**Purpose:** Receive Jira webhook events
**Parameters:** Jira webhook payload
**Response:** 200 OK
**Errors:** 401 (invalid signature), 400 (malformed payload)

### POST /webhooks/slack
**Purpose:** Receive Slack events and interactions
**Parameters:** Slack event/interaction payload
**Response:** 200 OK or challenge response
**Errors:** 401 (invalid signature), 400 (malformed payload)

## Platform Action Endpoints

### POST /api/github/pr
**Purpose:** Create a pull request on GitHub
**Parameters:**
- `repo` (string): owner/repo
- `title` (string): PR title
- `body` (string): PR description
- `head` (string): Source branch
- `base` (string): Target branch
**Response:**
```json
{
  "prNumber": 123,
  "url": "https://github.com/owner/repo/pull/123",
  "status": "open"
}
```
**Errors:** 404 (repo not found), 422 (validation failed)

### POST /api/jira/issue
**Purpose:** Create or update a Jira issue
**Parameters:**
- `action` (string): create|update
- `issueKey` (string): For updates
- `fields` (object): Jira field values
**Response:**
```json
{
  "issueKey": "PROJ-123",
  "url": "https://company.atlassian.net/browse/PROJ-123",
  "status": "created|updated"
}
```
**Errors:** 400 (invalid fields), 404 (issue not found)

### POST /api/slack/message
**Purpose:** Send a message to Slack
**Parameters:**
- `channel` (string): Channel ID or name
- `text` (string): Message text
- `attachments` (array): Optional rich attachments
- `threadTs` (string): Optional thread timestamp
**Response:**
```json
{
  "ts": "1234567890.123456",
  "channel": "C1234567890",
  "message": "sent"
}
```
**Errors:** 404 (channel not found), 400 (invalid message)

## Event Subscription Endpoints

### POST /api/subscriptions
**Purpose:** Subscribe to platform events
**Parameters:**
- `platform` (string): Platform name
- `events` (array): Event types to subscribe to
- `filter` (object): Optional event filters
**Response:**
```json
{
  "subscriptionId": "uuid",
  "platform": "github",
  "events": ["pull_request", "issues"],
  "status": "active"
}
```
**Errors:** 400 (invalid events), 409 (duplicate subscription)

### DELETE /api/subscriptions/:id
**Purpose:** Unsubscribe from platform events
**Parameters:**
- `id` (string): Subscription ID
**Response:**
```json
{
  "status": "unsubscribed",
  "message": "Subscription removed"
}
```
**Errors:** 404 (subscription not found)
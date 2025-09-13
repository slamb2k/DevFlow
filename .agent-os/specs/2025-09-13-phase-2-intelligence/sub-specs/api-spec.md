# API Specification

This is the API specification for the spec detailed in @.agent-os/specs/2025-09-13-phase-2-intelligence/spec.md

## Agent Communication API

### Agent Registry API

#### GET /agents
**Purpose:** List all available sub-agents and their capabilities
**Parameters:** None
**Response:**
```json
{
  "agents": [
    {
      "id": "analyzer",
      "name": "Analyzer Agent",
      "capabilities": ["ast-parsing", "complexity-analysis", "pattern-detection"],
      "status": "ready"
    }
  ]
}
```
**Errors:** 500 - Registry initialization failure

#### POST /agents/:id/invoke
**Purpose:** Invoke a specific agent with a task
**Parameters:**
```json
{
  "task": "analyze",
  "context": {
    "projectRoot": "/path/to/project",
    "options": {}
  }
}
```
**Response:**
```json
{
  "result": {},
  "metrics": {
    "executionTime": 1234,
    "memoryUsed": 5678
  }
}
```
**Errors:** 404 - Agent not found, 400 - Invalid task, 500 - Agent execution failure

### Style System API

#### GET /styles
**Purpose:** List available output styles
**Parameters:** None
**Response:**
```json
{
  "styles": ["guide", "expert", "coach", "reporter"],
  "current": "guide"
}
```
**Errors:** 500 - Style registry error

#### PUT /styles/current
**Purpose:** Change the current output style
**Parameters:**
```json
{
  "style": "expert"
}
```
**Response:**
```json
{
  "previous": "guide",
  "current": "expert"
}
```
**Errors:** 400 - Invalid style name

### Analysis API

#### POST /analyze/security
**Purpose:** Run security analysis on project
**Parameters:**
```json
{
  "projectRoot": "/path/to/project",
  "depth": "full",
  "include": ["dependencies", "code", "configs"]
}
```
**Response:**
```json
{
  "vulnerabilities": [],
  "riskScore": 7.5,
  "recommendations": []
}
```
**Errors:** 400 - Invalid project path, 500 - Analysis failure

#### POST /analyze/performance
**Purpose:** Analyze performance characteristics
**Parameters:**
```json
{
  "projectRoot": "/path/to/project",
  "targets": ["build", "runtime", "test"]
}
```
**Response:**
```json
{
  "metrics": {},
  "bottlenecks": [],
  "optimizations": []
}
```
**Errors:** 400 - Invalid targets, 500 - Profiling error

### Recommendations API

#### GET /recommendations
**Purpose:** Get smart recommendations for current project
**Parameters:**
```json
{
  "categories": ["workflow", "security", "performance"],
  "limit": 10
}
```
**Response:**
```json
{
  "recommendations": [
    {
      "id": "rec-001",
      "category": "workflow",
      "title": "Enable pre-commit hooks",
      "impact": "high",
      "confidence": 0.85,
      "implementation": {}
    }
  ]
}
```
**Errors:** 500 - Recommendation engine error

#### POST /recommendations/:id/feedback
**Purpose:** Provide feedback on a recommendation
**Parameters:**
```json
{
  "action": "accepted",
  "reason": "Improved workflow efficiency"
}
```
**Response:**
```json
{
  "recorded": true,
  "learningUpdated": true
}
```
**Errors:** 404 - Recommendation not found

### Template API

#### GET /templates
**Purpose:** List available templates
**Parameters:**
```json
{
  "type": "custom",
  "category": "ci-cd"
}
```
**Response:**
```json
{
  "templates": [
    {
      "id": "github-actions-node",
      "name": "GitHub Actions for Node.js",
      "category": "ci-cd",
      "variables": []
    }
  ]
}
```
**Errors:** 500 - Template registry error

#### POST /templates/render
**Purpose:** Render a template with variables
**Parameters:**
```json
{
  "templateId": "github-actions-node",
  "variables": {
    "nodeVersion": "20",
    "testCommand": "npm test"
  }
}
```
**Response:**
```json
{
  "rendered": "...",
  "validation": {
    "valid": true,
    "errors": []
  }
}
```
**Errors:** 404 - Template not found, 400 - Invalid variables
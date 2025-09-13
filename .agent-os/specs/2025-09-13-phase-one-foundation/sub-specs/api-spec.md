# API Specification

This is the API specification for the spec detailed in @.agent-os/specs/2025-09-13-phase-one-foundation/spec.md

> Created: 2025-09-13
> Version: 1.0.0

## Endpoints

### Slash Command Endpoints

#### `/devflow-init`
**Purpose**: Initialize new project with DevFlow best practices

**Syntax**:
```
/devflow-init [project-type] [options]
```

**Parameters**:
- `project-type` (optional): `react` | `nodejs` | `python` | `auto`
  - Default: `auto` (detect from current directory or prompt user)
- `--template=<name>`: Specific template variant
- `--name=<project-name>`: Override default project name
- `--typescript`: Force TypeScript usage (for applicable templates)
- `--git`: Initialize git repository (default: true)
- `--install`: Run package installation immediately (default: true)
- `--overwrite`: Allow overwriting existing files

**Response Format**:
```json
{
  "status": "success" | "error" | "warning",
  "project": {
    "name": "string",
    "type": "react" | "nodejs" | "python",
    "template": "string",
    "location": "absolute-path",
    "files_created": ["relative-path"],
    "next_steps": ["string"]
  },
  "timing": {
    "duration_ms": "number",
    "operations": {
      "template_generation": "number",
      "file_creation": "number",
      "dependency_installation": "number"
    }
  }
}
```

**Examples**:
```bash
/devflow-init
/devflow-init react --template=typescript --name=my-app
/devflow-init nodejs --template=microservice --no-install
/devflow-init python --template=fastapi --git=false
```

#### `/devflow-analyze`
**Purpose**: Comprehensive project analysis and recommendations

**Syntax**:
```
/devflow-analyze [options]
```

**Parameters**:
- `--deep`: Enable comprehensive analysis (slower but more detailed)
- `--focus=<area>`: Focus analysis on specific area
  - Values: `dependencies` | `security` | `performance` | `architecture` | `quality`
- `--format=<type>`: Output format
  - Values: `interactive` | `json` | `markdown` | `summary`
- `--cache`: Use cached analysis if available and recent
- `--export=<path>`: Export results to file

**Response Format**:
```json
{
  "status": "success" | "error" | "partial",
  "analysis": {
    "project_info": {
      "name": "string",
      "type": "string",
      "framework": ["string"],
      "package_manager": "npm" | "yarn" | "pip" | "poetry",
      "build_tool": "string"
    },
    "dependencies": {
      "total_count": "number",
      "outdated": [{
        "name": "string",
        "current": "string",
        "latest": "string",
        "severity": "low" | "medium" | "high"
      }],
      "vulnerabilities": [{
        "package": "string",
        "severity": "low" | "medium" | "high" | "critical",
        "cve": "string",
        "fix_available": "boolean"
      }]
    },
    "architecture": {
      "score": "number", // 0-100
      "patterns": ["string"],
      "concerns": ["string"],
      "recommendations": ["string"]
    },
    "performance": {
      "bundle_size": "string",
      "bottlenecks": ["string"],
      "optimizations": ["string"]
    },
    "quality": {
      "test_coverage": "number",
      "linting_issues": "number",
      "code_smells": ["string"]
    }
  },
  "recommendations": [{
    "category": "string",
    "priority": "low" | "medium" | "high" | "critical",
    "title": "string",
    "description": "string",
    "action_items": ["string"],
    "estimated_effort": "string"
  }],
  "timing": {
    "duration_ms": "number"
  }
}
```

#### `/devflow-roadmap`
**Purpose**: Generate development roadmap based on project analysis

**Syntax**:
```
/devflow-roadmap [options]
```

**Parameters**:
- `--timeline=<duration>`: Roadmap timeframe
  - Values: `1month` | `3months` | `6months` | `1year`
- `--focus=<area>`: Prioritize specific improvement areas
- `--team-size=<number>`: Team size for effort estimation
- `--format=<type>`: Output format
  - Values: `interactive` | `markdown` | `gantt` | `json`

**Response Format**:
```json
{
  "status": "success" | "error",
  "roadmap": {
    "timeline": "string",
    "phases": [{
      "name": "string",
      "duration": "string",
      "goals": ["string"],
      "deliverables": ["string"],
      "effort_estimate": "string",
      "prerequisites": ["string"],
      "risks": ["string"]
    }],
    "milestones": [{
      "name": "string",
      "date": "ISO-8601",
      "success_criteria": ["string"]
    }],
    "resource_requirements": {
      "developers": "number",
      "devops_engineers": "number",
      "estimated_hours": "number"
    }
  }
}
```

#### `/devflow-optimize`
**Purpose**: Apply optimization recommendations to project

**Syntax**:
```
/devflow-optimize [options]
```

**Parameters**:
- `--focus=<area>`: Optimization focus area
  - Values: `dependencies` | `performance` | `security` | `quality` | `all`
- `--apply`: Apply optimizations automatically (default: preview mode)
- `--backup`: Create backup before applying changes
- `--interactive`: Prompt for each optimization

**Response Format**:
```json
{
  "status": "success" | "error" | "partial",
  "optimizations": [{
    "category": "string",
    "description": "string",
    "impact": "low" | "medium" | "high",
    "applied": "boolean",
    "files_modified": ["string"],
    "rollback_info": "string"
  }],
  "summary": {
    "total_optimizations": "number",
    "applied": "number",
    "skipped": "number",
    "failed": "number",
    "estimated_improvement": "string"
  }
}
```

## Controllers

### Command Controller Architecture

#### BaseCommand Controller
**Responsibilities**:
- Argument parsing and validation
- Error handling and user feedback
- Progress reporting
- Output formatting

**Interface**:
```typescript
abstract class BaseCommand {
  abstract name: string;
  abstract description: string;
  abstract examples: string[];
  
  abstract execute(args: string[], options: CommandOptions): Promise<CommandResult>;
  
  protected validateArgs(args: string[]): ValidationResult;
  protected formatOutput(result: any, format: OutputFormat): string;
  protected reportProgress(message: string, percentage?: number): void;
}
```

#### InitCommand Controller
**File**: `src/commands/init.ts`

**Methods**:
```typescript
class InitCommand extends BaseCommand {
  async execute(args: string[], options: CommandOptions): Promise<CommandResult>;
  private detectProjectType(targetDir: string): ProjectType;
  private selectTemplate(projectType: ProjectType, options: any): Template;
  private generateProject(template: Template, config: ProjectConfig): Promise<void>;
  private installDependencies(projectPath: string, packageManager: string): Promise<void>;
  private initializeGit(projectPath: string): Promise<void>;
}
```

**Dependencies**:
- TemplateEngine: Template processing and file generation
- ProjectDetector: Automatic project type detection
- PackageManagerUtils: Dependency installation
- GitUtils: Repository initialization

#### AnalyzeCommand Controller
**File**: `src/commands/analyze.ts`

**Methods**:
```typescript
class AnalyzeCommand extends BaseCommand {
  async execute(args: string[], options: CommandOptions): Promise<CommandResult>;
  private runAnalysis(projectPath: string, config: AnalysisConfig): Promise<AnalysisResult>;
  private analyzeProject(projectPath: string): Promise<ProjectInfo>;
  private analyzeDependencies(projectPath: string): Promise<DependencyAnalysis>;
  private analyzeArchitecture(projectPath: string): Promise<ArchitectureAssessment>;
  private analyzePerformance(projectPath: string): Promise<PerformanceInsights>;
  private generateRecommendations(analysis: AnalysisResult): Recommendation[];
}
```

**Dependencies**:
- ProjectAnalyzer: Core analysis engine
- DependencyScanner: Package vulnerability scanning
- ArchitectureEvaluator: Code structure assessment
- PerformanceProfiler: Performance analysis
- RecommendationEngine: Suggestion generation

#### RoadmapCommand Controller
**File**: `src/commands/roadmap.ts`

**Methods**:
```typescript
class RoadmapCommand extends BaseCommand {
  async execute(args: string[], options: CommandOptions): Promise<CommandResult>;
  private generateRoadmap(analysis: AnalysisResult, config: RoadmapConfig): Roadmap;
  private createPhases(recommendations: Recommendation[], timeline: string): Phase[];
  private estimateEffort(phase: Phase, teamSize: number): EffortEstimate;
  private identifyMilestones(phases: Phase[]): Milestone[];
  private calculateResourceRequirements(phases: Phase[]): ResourceRequirements;
}
```

#### OptimizeCommand Controller
**File**: `src/commands/optimize.ts`

**Methods**:
```typescript
class OptimizeCommand extends BaseCommand {
  async execute(args: string[], options: CommandOptions): Promise<CommandResult>;
  private identifyOptimizations(analysis: AnalysisResult): Optimization[];
  private applyOptimization(optimization: Optimization, projectPath: string): Promise<OptimizationResult>;
  private createBackup(projectPath: string): Promise<string>;
  private rollbackOptimization(rollbackInfo: string): Promise<void>;
  private validateOptimizations(projectPath: string): Promise<ValidationResult>;
}
```

### Integration Controllers

#### SlashCommandAdapter
**File**: `src/integration/claude-code-adapter.ts`

**Responsibilities**:
- Register slash commands with Claude Code
- Handle command routing and execution
- Format output for Claude Code chat interface
- Manage command lifecycle and cleanup

**Methods**:
```typescript
class SlashCommandAdapter {
  registerCommands(): void;
  handleCommand(command: string, args: string[]): Promise<void>;
  formatChatOutput(result: CommandResult): string;
  reportProgress(message: string): void;
}
```

#### OutputController
**File**: `src/output/output-controller.ts`

**Responsibilities**:
- Rich text formatting with colors and emojis
- ASCII art generation
- Progress bars and status indicators
- Multi-format output (terminal, markdown, JSON)

**Methods**:
```typescript
class OutputController {
  formatAnalysisResult(analysis: AnalysisResult, format: OutputFormat): string;
  generateProjectDiagram(projectInfo: ProjectInfo): string;
  createProgressBar(current: number, total: number): string;
  formatRecommendations(recommendations: Recommendation[]): string;
  exportToMarkdown(result: any): string;
  exportToJson(result: any): string;
}
```

### Data Access Controllers

#### ProjectMemory Controller
**File**: `src/memory/project-memory.ts`

**Responsibilities**:
- Persist project state and preferences
- Manage analysis history and caching
- Handle team collaboration data
- Provide data migration and cleanup

**Methods**:
```typescript
class ProjectMemory {
  saveAnalysis(projectPath: string, analysis: AnalysisResult): Promise<void>;
  loadAnalysis(projectPath: string): Promise<AnalysisResult | null>;
  savePreferences(preferences: UserPreferences): Promise<void>;
  loadPreferences(): Promise<UserPreferences>;
  clearCache(projectPath?: string): Promise<void>;
  exportData(projectPath: string): Promise<any>;
}
```

#### ValidationController
**File**: `src/validation/validation-controller.ts`

**Responsibilities**:
- Input validation for all commands
- Configuration validation
- Project state validation
- Template compatibility checking

**Methods**:
```typescript
class ValidationController {
  validateCommandArgs(command: string, args: string[]): ValidationResult;
  validateProjectStructure(projectPath: string): ValidationResult;
  validateTemplateCompatibility(template: Template, projectType: ProjectType): boolean;
  validateConfiguration(config: any, schema: JSONSchema): ValidationResult;
}
```
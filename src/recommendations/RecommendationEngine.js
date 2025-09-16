import PatternRecognizer from './PatternRecognizer.js';
import ScoringAlgorithm from './ScoringAlgorithm.js';
import FeedbackManager from './FeedbackManager.js';
import { promises as fs } from 'fs';
import path from 'path';

class RecommendationEngine {
  constructor(projectPath) {
    this.projectPath = projectPath;
    this.patternRecognizer = new PatternRecognizer(projectPath);
    this.scoringAlgorithm = new ScoringAlgorithm();
    this.feedbackManager = new FeedbackManager(projectPath);

    this.patterns = null;
    this.categoryWeights = {
      security: 1.5,
      performance: 1.2,
      workflow: 1.0,
      codeQuality: 1.1,
      dependencies: 0.9,
    };
  }

  async initialize() {
    await this.loadPatterns();
    await this.feedbackManager.initialize();
    await this.updateRecommendationWeights();
  }

  async loadPatterns() {
    try {
      const patternsPath = path.join(this.projectPath, '.devflow/intelligence/patterns.json');
      const data = await fs.readFile(patternsPath, 'utf8');
      this.patterns = JSON.parse(data);
    } catch (error) {
      // No existing patterns
      this.patterns = null;
    }
  }

  async recognizePatterns(commits) {
    const patterns = this.patternRecognizer.analyzeCommits(commits);

    // Look for security-focused patterns
    const securityCommits = commits.filter(
      (c) =>
        c.message.toLowerCase().includes('security') ||
        c.message.toLowerCase().includes('vulnerability') ||
        c.message.toLowerCase().includes('cve')
    );

    if (securityCommits.length > 0) {
      const securityFiles = new Set();
      securityCommits.forEach((c) => c.files.forEach((f) => securityFiles.add(f)));

      patterns.push({
        type: 'security_focus',
        frequency: securityCommits.length,
        files: Array.from(securityFiles),
        confidence: 0.8,
      });
    }

    // Add filePatterns for compatibility
    if (!patterns.filePatterns && patterns.frequentlyChangedFiles) {
      patterns.filePatterns = patterns.frequentlyChangedFiles;
    }

    return patterns;
  }

  async analyzeWorkflow(workflow) {
    const patterns = [];

    // Check for long-lived branches
    if (workflow.branches && workflow.branches.length > 0) {
      const featureBranches = workflow.branches.filter((b) => b.includes('feature/'));

      if (featureBranches.length > 3) {
        patterns.push({
          type: 'feature_branch_workflow',
          recommendation: 'Consider using shorter-lived branches',
          confidence: 0.7,
        });
      }
    }

    // Check PR frequency
    if (workflow.prFrequency === 'daily' || workflow.prFrequency === 'multiple-daily') {
      patterns.push({
        type: 'high_pr_frequency',
        recommendation: 'Great PR frequency! Keep up the good practice',
        confidence: 0.9,
      });
    } else if (workflow.prFrequency === 'sporadic') {
      patterns.push({
        type: 'low_pr_frequency',
        recommendation: 'Consider more frequent, smaller PRs for easier reviews',
        confidence: 0.6,
      });
    }

    return { patterns };
  }

  async generateRecommendations(analysis) {
    const recommendations = [];

    // Security recommendations
    if (analysis.security && analysis.security.vulnerabilities) {
      const highSeverity = analysis.security.vulnerabilities.filter((v) => v.severity === 'HIGH');

      if (highSeverity.length > 0) {
        recommendations.push({
          id: `sec-${Date.now()}`,
          category: 'security',
          priority: 'high',
          title: 'Address High-Severity Security Vulnerabilities',
          description: `Found ${highSeverity.length} high-severity vulnerabilities that should be addressed immediately`,
          action: 'Run security scanner and fix identified issues',
          confidence: 0.95,
          impact: 'high',
          effort: 'medium',
          dataPoints: highSeverity.length,
        });
      }
    }

    // Performance recommendations
    if (analysis.performance) {
      if (analysis.performance.bundleSize && parseFloat(analysis.performance.bundleSize) > 5) {
        recommendations.push({
          id: `perf-${Date.now()}`,
          category: 'performance',
          priority: 'medium',
          title: 'Optimize Bundle Size',
          description: 'Bundle size exceeds recommended threshold',
          suggestion: 'Consider code splitting and lazy loading to reduce bundle size',
          action: 'Implement dynamic imports for non-critical modules',
          confidence: 0.8,
          impact: 'high',
          effort: 'medium',
          dataPoints: 1,
        });
      }

      if (analysis.performance.buildTime && analysis.performance.buildTime > 60000) {
        recommendations.push({
          id: `perf-build-${Date.now()}`,
          category: 'performance',
          priority: 'low',
          title: 'Improve Build Performance',
          description: 'Build time exceeds 1 minute',
          suggestion: 'Consider build caching and parallelization',
          action: 'Review webpack configuration and enable caching',
          confidence: 0.7,
          impact: 'medium',
          effort: 'low',
          dataPoints: 1,
        });
      }
    }

    // Code quality recommendations
    if (analysis.codeQuality) {
      if (analysis.codeQuality.coverage && analysis.codeQuality.coverage < 60) {
        recommendations.push({
          id: `quality-coverage-${Date.now()}`,
          category: 'codeQuality',
          priority: 'medium',
          title: 'Increase Test Coverage',
          description: `Test coverage is at ${analysis.codeQuality.coverage}%, below recommended 60%`,
          suggestion: 'Add unit tests for critical business logic',
          action: 'Focus on testing high-complexity functions first',
          confidence: 0.85,
          impact: 'medium',
          effort: 'high',
          dataPoints: 1,
        });
      }

      if (analysis.codeQuality.complexity && analysis.codeQuality.complexity > 10) {
        recommendations.push({
          id: `quality-complexity-${Date.now()}`,
          category: 'codeQuality',
          priority: 'low',
          title: 'Reduce Code Complexity',
          description: 'Several functions have high cyclomatic complexity',
          suggestion: 'Refactor complex functions into smaller, focused functions',
          action: 'Break down functions with complexity > 10',
          confidence: 0.75,
          impact: 'medium',
          effort: 'medium',
          dataPoints: 1,
        });
      }
    }

    // Apply scoring and confidence
    for (const rec of recommendations) {
      rec.confidence = this.calculateConfidence(rec);
      rec.score = this.scoringAlgorithm.calculatePriority(rec);
    }

    return this.prioritizeRecommendations(recommendations);
  }

  async generateSecurityRecommendations() {
    return [
      {
        id: `security-dep-${Date.now()}`,
        type: 'dependency_update',
        category: 'security',
        priority: 'high',
        title: 'Update Dependencies',
        description: 'Security vulnerabilities detected in dependencies',
        confidence: 0.9,
        impact: 'high',
        effort: 'low',
      },
    ];
  }

  async generatePerformanceRecommendations() {
    return [
      {
        id: `perf-build-${Date.now()}`,
        type: 'build_optimization',
        category: 'performance',
        priority: 'medium',
        title: 'Optimize Build Process',
        description: 'Build times can be improved',
        confidence: 0.7,
        impact: 'medium',
        effort: 'medium',
      },
    ];
  }

  async generateWorkflowRecommendations() {
    return [
      {
        id: `workflow-ci-${Date.now()}`,
        type: 'ci_improvement',
        category: 'workflow',
        priority: 'low',
        title: 'Improve CI Pipeline',
        description: 'CI pipeline can be optimized',
        confidence: 0.6,
        impact: 'low',
        effort: 'low',
      },
    ];
  }

  async improveRecommendations(feedback) {
    // Process feedback to improve future recommendations
    const improvements = {
      applied: feedback.filter((f) => f.accepted).length,
      rejected: feedback.filter((f) => !f.accepted).length,
      adjustments: [],
    };

    // Adjust weights based on feedback
    for (const item of feedback) {
      if (item.accepted) {
        // Increase weight for accepted recommendation types
        improvements.adjustments.push({
          type: item.type,
          adjustment: 0.1,
        });
      }
    }

    return improvements;
  }

  async optimizeWorkflow(patterns) {
    const recommendations = [];

    if (patterns.frequentConflicts) {
      recommendations.push({
        id: `workflow-conflicts-${Date.now()}`,
        category: 'workflow',
        priority: 'high',
        title: 'Reduce Merge Conflicts',
        description: 'Frequent merge conflicts detected',
        action: 'Consider smaller, more frequent merges',
        suggestion: 'Break large features into smaller PRs',
        confidence: 0.8,
        impact: 'high',
        effort: 'low',
      });
    }

    if (patterns.longRunningBranches && patterns.longRunningBranches.length > 0) {
      recommendations.push({
        id: `workflow-branches-${Date.now()}`,
        category: 'workflow',
        priority: 'medium',
        title: 'Close Long-Running Branches',
        description: `Found ${patterns.longRunningBranches.length} branches open for >30 days`,
        action: `Review and merge or close: ${patterns.longRunningBranches.join(', ')}`,
        suggestion: 'Implement branch protection rules with auto-delete',
        confidence: 0.9,
        impact: 'medium',
        effort: 'low',
      });
    }

    return recommendations;
  }

  calculateConfidence(recommendation) {
    let confidence = 0.5; // Base confidence

    // Increase confidence based on data points
    if (recommendation.dataPoints) {
      confidence += Math.min(0.3, recommendation.dataPoints * 0.03);
    }

    // Increase confidence based on historical accuracy
    if (recommendation.historicalAccuracy) {
      confidence *= recommendation.historicalAccuracy;
    }

    // Apply category weight
    const categoryWeight = this.categoryWeights[recommendation.category] || 1.0;
    confidence *= categoryWeight;

    // Normalize to 0-1 range
    return Math.min(1.0, Math.max(0, confidence));
  }

  prioritizeRecommendations(recommendations) {
    return recommendations.sort((a, b) => {
      // First sort by priority
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];

      if (priorityDiff !== 0) {
        return priorityDiff;
      }

      // Then by score
      return (b.score || 0) - (a.score || 0);
    });
  }

  async acceptRecommendation(recommendationIdOrObj) {
    // Handle both ID and object
    let recommendation;
    if (typeof recommendationIdOrObj === 'string') {
      recommendation = { id: recommendationIdOrObj };
    } else {
      recommendation = recommendationIdOrObj;
    }

    await this.feedbackManager.recordAccepted(recommendation);
    await this.feedbackManager.recordFeedback({
      recommendationId: recommendation.id,
      category: recommendation.category,
      accepted: true,
      timestamp: new Date(),
    });

    // Update weights based on acceptance
    await this.updateRecommendationWeights();
    return true;
  }

  async rejectRecommendation(recommendationIdOrObj, reason) {
    // Handle both ID and object
    let recommendation;
    if (typeof recommendationIdOrObj === 'string') {
      recommendation = { id: recommendationIdOrObj };
    } else {
      recommendation = recommendationIdOrObj;
    }

    await this.feedbackManager.recordRejected(recommendation, reason);
    await this.feedbackManager.recordFeedback({
      recommendationId: recommendation.id,
      category: recommendation.category,
      accepted: false,
      reason,
      timestamp: new Date(),
    });

    // Update weights based on rejection
    await this.updateRecommendationWeights();
    return true;
  }

  async updateRecommendationWeights() {
    const stats = await this.feedbackManager.getCategoryStats();

    for (const [category, data] of Object.entries(stats)) {
      if (data.total > 5) {
        // Only update if we have enough data
        const acceptanceRate = data.acceptanceRate || 0.5;

        // Adjust weight based on acceptance rate
        // Higher acceptance = higher weight
        this.categoryWeights[category] = 0.5 + acceptanceRate;
      }
    }
  }

  async savePatterns(patterns) {
    const dir = path.join(this.projectPath, '.devflow/intelligence');
    await fs.mkdir(dir, { recursive: true });

    const patternsPath = path.join(dir, 'patterns.json');
    await fs.writeFile(patternsPath, JSON.stringify(patterns, null, 2));
  }

  async saveFeedback(feedback) {
    const dir = path.join(this.projectPath, '.devflow/intelligence');
    await fs.mkdir(dir, { recursive: true });

    const feedbackPath = path.join(dir, 'feedback.json');
    await fs.writeFile(feedbackPath, JSON.stringify(feedback, null, 2));
  }

  async analyzeProject() {
    // Comprehensive project analysis
    const patterns = await this.patternRecognizer.analyzeProjectHistory();
    await this.savePatterns(patterns);

    const recommendations = [];

    // Generate recommendations based on patterns
    if (patterns.commits) {
      // Security-focused development
      if (patterns.commits.commitTopics && patterns.commits.commitTopics.security > 5) {
        recommendations.push({
          id: `pattern-security-${Date.now()}`,
          category: 'security',
          priority: 'medium',
          title: 'Security-Focused Development Detected',
          description: 'Your team frequently works on security issues',
          suggestion: 'Consider implementing automated security scanning in CI/CD',
          action: 'Add security scanning tools to your pipeline',
          confidence: 0.8,
          impact: 'high',
          effort: 'medium',
        });
      }

      // Frequent file changes
      if (patterns.commits.frequentlyChangedFiles) {
        const hotspots = Object.entries(patterns.commits.frequentlyChangedFiles)
          .filter(([, count]) => count > 10)
          .map(([file]) => file);

        if (hotspots.length > 0) {
          recommendations.push({
            id: `pattern-hotspots-${Date.now()}`,
            category: 'codeQuality',
            priority: 'medium',
            title: 'Code Hotspots Detected',
            description: `Files frequently changed: ${hotspots.slice(0, 3).join(', ')}`,
            suggestion: 'Consider refactoring frequently modified files',
            action: 'Review architecture to reduce coupling',
            confidence: 0.75,
            impact: 'medium',
            effort: 'high',
          });
        }
      }
    }

    // Workflow recommendations
    if (patterns.workflow) {
      if (patterns.workflow.branchingStrategy === 'trunk-based') {
        recommendations.push({
          id: `pattern-trunk-${Date.now()}`,
          category: 'workflow',
          priority: 'low',
          title: 'Trunk-Based Development',
          description: 'You are using trunk-based development',
          suggestion: 'Great choice for continuous deployment',
          action: 'Ensure feature flags are properly managed',
          confidence: 0.9,
          impact: 'low',
          effort: 'low',
        });
      }

      if (!patterns.workflow.cicdPipeline) {
        recommendations.push({
          id: `pattern-cicd-${Date.now()}`,
          category: 'workflow',
          priority: 'high',
          title: 'Set Up CI/CD Pipeline',
          description: 'No CI/CD configuration detected',
          suggestion: 'Automate testing and deployment',
          action: 'Set up GitHub Actions or similar CI/CD tool',
          confidence: 0.95,
          impact: 'high',
          effort: 'medium',
        });
      }
    }

    // Structure recommendations
    if (patterns.structure) {
      if (!patterns.structure.hasTests) {
        recommendations.push({
          id: `pattern-tests-${Date.now()}`,
          category: 'codeQuality',
          priority: 'high',
          title: 'Add Test Suite',
          description: 'No test directory or files detected',
          suggestion: 'Implement unit and integration tests',
          action: 'Set up Jest or similar testing framework',
          confidence: 0.95,
          impact: 'high',
          effort: 'high',
        });
      }
    }

    return {
      patterns,
      recommendations: this.prioritizeRecommendations(recommendations),
    };
  }
}

export default RecommendationEngine;

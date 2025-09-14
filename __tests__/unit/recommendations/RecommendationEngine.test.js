import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import RecommendationEngine from '../../../src/recommendations/RecommendationEngine.js';
import PatternRecognizer from '../../../src/recommendations/PatternRecognizer.js';
import ScoringAlgorithm from '../../../src/recommendations/ScoringAlgorithm.js';
import FeedbackManager from '../../../src/recommendations/FeedbackManager.js';
import { promises as fs } from 'fs';
import path from 'path';

jest.mock('fs', () => ({
  promises: {
    readFile: jest.fn(),
    writeFile: jest.fn(),
    readdir: jest.fn(),
    mkdir: jest.fn(),
    access: jest.fn()
  }
}));

describe('RecommendationEngine', () => {
  let engine;
  let mockProjectPath;

  beforeEach(() => {
    mockProjectPath = '/test/project';
    engine = new RecommendationEngine(mockProjectPath);
    jest.clearAllMocks();
  });

  describe('Initialization', () => {
    it('should initialize with correct project path', () => {
      expect(engine.projectPath).toBe(mockProjectPath);
    });

    it('should initialize all recommendation components', () => {
      expect(engine.patternRecognizer).toBeInstanceOf(PatternRecognizer);
      expect(engine.scoringAlgorithm).toBeInstanceOf(ScoringAlgorithm);
      expect(engine.feedbackManager).toBeInstanceOf(FeedbackManager);
    });

    it('should load existing patterns from storage', async () => {
      const mockPatterns = { patterns: ['pattern1', 'pattern2'] };
      fs.readFile.mockResolvedValue(JSON.stringify(mockPatterns));

      await engine.loadPatterns();
      expect(fs.readFile).toHaveBeenCalledWith(
        path.join(mockProjectPath, '.devflow/intelligence/patterns.json'),
        'utf8'
      );
      expect(engine.patterns).toEqual(mockPatterns);
    });
  });

  describe('Pattern Recognition', () => {
    it('should recognize patterns from commit history', async () => {
      const mockCommits = [
        { message: 'fix: security vulnerability', files: ['auth.js'] },
        { message: 'fix: another security issue', files: ['auth.js'] }
      ];

      const patterns = await engine.recognizePatterns(mockCommits);
      expect(patterns).toContainEqual(
        expect.objectContaining({
          type: 'security_focus',
          frequency: 2,
          files: ['auth.js']
        })
      );
    });

    it('should identify workflow patterns', async () => {
      const mockWorkflow = {
        branches: ['feature/auth', 'feature/api', 'feature/ui'],
        prFrequency: 'daily'
      };

      const patterns = await engine.analyzeWorkflow(mockWorkflow);
      expect(patterns).toContainEqual(
        expect.objectContaining({
          type: 'feature_branch_workflow',
          recommendation: 'Consider using shorter-lived branches'
        })
      );
    });
  });

  describe('Recommendation Generation', () => {
    it('should generate security recommendations', async () => {
      const mockAnalysis = {
        security: { vulnerabilities: [{ severity: 'HIGH' }] }
      };

      const recommendations = await engine.generateRecommendations(mockAnalysis);
      expect(recommendations).toContainEqual(
        expect.objectContaining({
          category: 'security',
          priority: 'high',
          confidence: expect.any(Number)
        })
      );
    });

    it('should generate performance recommendations', async () => {
      const mockAnalysis = {
        performance: { bundleSize: '10MB', buildTime: 60000 }
      };

      const recommendations = await engine.generateRecommendations(mockAnalysis);
      expect(recommendations).toContainEqual(
        expect.objectContaining({
          category: 'performance',
          suggestion: expect.stringContaining('bundle size')
        })
      );
    });

    it('should generate workflow optimization recommendations', async () => {
      const mockPatterns = {
        frequentConflicts: true,
        longRunningBranches: ['feature/old-branch']
      };

      const recommendations = await engine.optimizeWorkflow(mockPatterns);
      expect(recommendations).toContainEqual(
        expect.objectContaining({
          category: 'workflow',
          action: expect.stringContaining('merge')
        })
      );
    });
  });

  describe('Scoring and Confidence', () => {
    it('should calculate confidence scores for recommendations', () => {
      const recommendation = {
        category: 'security',
        dataPoints: 10,
        historicalAccuracy: 0.8
      };

      const score = engine.calculateConfidence(recommendation);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(1);
    });

    it('should prioritize recommendations by score', () => {
      const recommendations = [
        { id: 1, score: 0.5 },
        { id: 2, score: 0.9 },
        { id: 3, score: 0.7 }
      ];

      const prioritized = engine.prioritizeRecommendations(recommendations);
      expect(prioritized[0].score).toBe(0.9);
      expect(prioritized[2].score).toBe(0.5);
    });
  });

  describe('Feedback Loop', () => {
    it('should track accepted recommendations', async () => {
      const recommendation = { id: 'rec1', category: 'security' };

      await engine.acceptRecommendation(recommendation);

      expect(engine.feedbackManager.recordFeedback).toHaveBeenCalledWith({
        recommendationId: 'rec1',
        accepted: true,
        timestamp: expect.any(Date)
      });
    });

    it('should track rejected recommendations', async () => {
      const recommendation = { id: 'rec2', category: 'performance' };
      const reason = 'Not applicable to this project';

      await engine.rejectRecommendation(recommendation, reason);

      expect(engine.feedbackManager.recordFeedback).toHaveBeenCalledWith({
        recommendationId: 'rec2',
        accepted: false,
        reason,
        timestamp: expect.any(Date)
      });
    });

    it('should improve recommendations based on feedback', async () => {
      const mockFeedback = {
        'security': { accepted: 8, rejected: 2 },
        'performance': { accepted: 3, rejected: 7 }
      };

      engine.feedbackManager.getFeedbackStats = jest.fn().mockResolvedValue(mockFeedback);

      await engine.updateRecommendationWeights();

      expect(engine.categoryWeights.security).toBeGreaterThan(
        engine.categoryWeights.performance
      );
    });
  });

  describe('Persistence', () => {
    it('should save patterns to storage', async () => {
      const patterns = { patterns: ['pattern1', 'pattern2'] };

      await engine.savePatterns(patterns);

      expect(fs.mkdir).toHaveBeenCalledWith(
        path.join(mockProjectPath, '.devflow/intelligence'),
        { recursive: true }
      );
      expect(fs.writeFile).toHaveBeenCalledWith(
        path.join(mockProjectPath, '.devflow/intelligence/patterns.json'),
        JSON.stringify(patterns, null, 2)
      );
    });

    it('should save feedback history', async () => {
      const feedback = { recommendations: [] };

      await engine.saveFeedback(feedback);

      expect(fs.writeFile).toHaveBeenCalledWith(
        path.join(mockProjectPath, '.devflow/intelligence/feedback.json'),
        JSON.stringify(feedback, null, 2)
      );
    });
  });
});

describe('PatternRecognizer', () => {
  let recognizer;

  beforeEach(() => {
    recognizer = new PatternRecognizer();
  });

  describe('Commit Pattern Recognition', () => {
    it('should identify frequent file changes', () => {
      const commits = [
        { files: ['auth.js', 'user.js'] },
        { files: ['auth.js', 'api.js'] },
        { files: ['auth.js', 'db.js'] }
      ];

      const patterns = recognizer.analyzeCommits(commits);
      expect(patterns.frequentlyChangedFiles).toContain('auth.js');
    });

    it('should detect commit message patterns', () => {
      const commits = [
        { message: 'fix: security issue' },
        { message: 'fix: another security bug' },
        { message: 'feat: new feature' }
      ];

      const patterns = recognizer.analyzeCommitMessages(commits);
      expect(patterns.commonTypes).toHaveProperty('fix', 2);
      expect(patterns.commonTopics).toContain('security');
    });
  });

  describe('File Structure Patterns', () => {
    it('should analyze project structure', () => {
      const fileTree = {
        'src': ['index.js', 'app.js'],
        'src/components': ['Button.js', 'Form.js'],
        'tests': ['app.test.js']
      };

      const patterns = recognizer.analyzeStructure(fileTree);
      expect(patterns.hasTests).toBe(true);
      expect(patterns.componentStructure).toBe('hierarchical');
    });
  });
});

describe('ScoringAlgorithm', () => {
  let algorithm;

  beforeEach(() => {
    algorithm = new ScoringAlgorithm();
  });

  describe('Confidence Calculation', () => {
    it('should calculate base confidence from data points', () => {
      const score = algorithm.calculateBaseConfidence(10, 100);
      expect(score).toBeCloseTo(0.1, 2);
    });

    it('should apply historical accuracy weight', () => {
      const baseScore = 0.7;
      const historicalAccuracy = 0.9;

      const weighted = algorithm.applyHistoricalWeight(baseScore, historicalAccuracy);
      expect(weighted).toBeGreaterThan(baseScore);
    });

    it('should apply recency boost', () => {
      const score = 0.5;
      const daysOld = 1;

      const boosted = algorithm.applyRecencyBoost(score, daysOld);
      expect(boosted).toBeGreaterThan(score);
    });
  });

  describe('Priority Scoring', () => {
    it('should calculate priority based on impact and confidence', () => {
      const recommendation = {
        impact: 'high',
        confidence: 0.8,
        category: 'security'
      };

      const priority = algorithm.calculatePriority(recommendation);
      expect(priority).toBeGreaterThan(0.5);
    });

    it('should boost security recommendations', () => {
      const securityRec = { category: 'security', impact: 'medium', confidence: 0.6 };
      const performanceRec = { category: 'performance', impact: 'medium', confidence: 0.6 };

      const securityPriority = algorithm.calculatePriority(securityRec);
      const performancePriority = algorithm.calculatePriority(performanceRec);

      expect(securityPriority).toBeGreaterThan(performancePriority);
    });
  });
});

describe('FeedbackManager', () => {
  let manager;
  let mockProjectPath;

  beforeEach(() => {
    mockProjectPath = '/test/project';
    manager = new FeedbackManager(mockProjectPath);
  });

  describe('Feedback Recording', () => {
    it('should record accepted recommendations', async () => {
      const feedback = {
        recommendationId: 'rec1',
        accepted: true,
        timestamp: new Date()
      };

      await manager.recordFeedback(feedback);

      const history = await manager.getFeedbackHistory();
      expect(history).toContainEqual(feedback);
    });

    it('should record rejected recommendations with reasons', async () => {
      const feedback = {
        recommendationId: 'rec2',
        accepted: false,
        reason: 'Not applicable',
        timestamp: new Date()
      };

      await manager.recordFeedback(feedback);

      const history = await manager.getFeedbackHistory();
      expect(history).toContainEqual(feedback);
    });
  });

  describe('Feedback Statistics', () => {
    it('should calculate acceptance rate by category', async () => {
      const mockHistory = [
        { category: 'security', accepted: true },
        { category: 'security', accepted: true },
        { category: 'security', accepted: false },
        { category: 'performance', accepted: false }
      ];

      manager.getFeedbackHistory = jest.fn().mockResolvedValue(mockHistory);

      const stats = await manager.getCategoryStats();

      expect(stats.security.acceptanceRate).toBeCloseTo(0.67, 2);
      expect(stats.performance.acceptanceRate).toBe(0);
    });

    it('should identify most successful recommendation types', async () => {
      const mockHistory = [
        { type: 'dependency_update', accepted: true },
        { type: 'dependency_update', accepted: true },
        { type: 'code_splitting', accepted: false }
      ];

      manager.getFeedbackHistory = jest.fn().mockResolvedValue(mockHistory);

      const successful = await manager.getMostSuccessfulTypes();

      expect(successful[0]).toEqual({
        type: 'dependency_update',
        acceptanceRate: 1.0
      });
    });
  });

  describe('Learning Improvements', () => {
    it('should adjust weights based on feedback', async () => {
      const initialWeights = { security: 1.0, performance: 1.0 };
      const feedback = {
        security: { accepted: 8, rejected: 2 },
        performance: { accepted: 2, rejected: 8 }
      };

      const adjusted = await manager.adjustWeights(initialWeights, feedback);

      expect(adjusted.security).toBeGreaterThan(initialWeights.security);
      expect(adjusted.performance).toBeLessThan(initialWeights.performance);
    });
  });
});
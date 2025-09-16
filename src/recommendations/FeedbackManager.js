import { promises as fs } from 'fs';
import path from 'path';

class FeedbackManager {
  constructor(projectPath) {
    this.projectPath = projectPath;
    this.feedbackPath = path.join(projectPath, '.devflow/intelligence/feedback.json');
    this.feedbackHistory = [];
    this.categoryStats = {};
  }

  async initialize() {
    await this.loadFeedback();
    await this.calculateStats();
  }

  async loadFeedback() {
    try {
      const data = await fs.readFile(this.feedbackPath, 'utf8');
      this.feedbackHistory = JSON.parse(data);
    } catch (error) {
      // No existing feedback file
      this.feedbackHistory = [];
    }
  }

  async saveFeedback() {
    const dir = path.dirname(this.feedbackPath);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(this.feedbackPath, JSON.stringify(this.feedbackHistory, null, 2));
  }

  async recordFeedback(feedback) {
    const entry = {
      ...feedback,
      timestamp: feedback.timestamp || new Date(),
      id: this.generateFeedbackId(),
    };

    this.feedbackHistory.push(entry);
    await this.saveFeedback();
    await this.calculateStats();

    return entry;
  }

  async recordAccepted(recommendation) {
    return this.recordFeedback({
      recommendationId: recommendation.id,
      category: recommendation.category,
      type: recommendation.type,
      accepted: true,
      timestamp: new Date(),
    });
  }

  async recordRejected(recommendation, reason) {
    return this.recordFeedback({
      recommendationId: recommendation.id,
      category: recommendation.category,
      type: recommendation.type,
      accepted: false,
      reason,
      timestamp: new Date(),
    });
  }

  generateFeedbackId() {
    return `fb-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  getFeedbackHistory() {
    return this.feedbackHistory;
  }

  async getFeedbackHistoryAsync() {
    return this.feedbackHistory;
  }

  async getCategoryStats() {
    await this.calculateStats();
    return this.categoryStats;
  }

  async calculateStats() {
    this.categoryStats = {};

    for (const feedback of this.feedbackHistory) {
      const category = feedback.category;
      if (!category) {
        continue;
      }

      if (!this.categoryStats[category]) {
        this.categoryStats[category] = {
          total: 0,
          accepted: 0,
          rejected: 0,
          acceptanceRate: 0,
          reasons: [],
          avgConfidence: 0,
          avgImpact: { high: 0, medium: 0, low: 0 },
        };
      }

      const stats = this.categoryStats[category];
      stats.total++;

      if (feedback.accepted) {
        stats.accepted++;
      } else {
        stats.rejected++;
        if (feedback.reason) {
          stats.reasons.push(feedback.reason);
        }
      }

      // Calculate acceptance rate
      stats.acceptanceRate = stats.total > 0 ? stats.accepted / stats.total : 0;

      // Track confidence if available
      if (feedback.confidence) {
        stats.avgConfidence =
          (stats.avgConfidence * (stats.total - 1) + feedback.confidence) / stats.total;
      }

      // Track impact distribution
      if (feedback.impact) {
        stats.avgImpact[feedback.impact]++;
      }
    }

    return this.categoryStats;
  }

  async getMostSuccessfulTypes() {
    const typeStats = {};

    for (const feedback of this.feedbackHistory) {
      const type = feedback.type || feedback.recommendationType;
      if (!type) {
        continue;
      }

      if (!typeStats[type]) {
        typeStats[type] = {
          total: 0,
          accepted: 0,
          acceptanceRate: 0,
        };
      }

      typeStats[type].total++;
      if (feedback.accepted) {
        typeStats[type].accepted++;
      }
      typeStats[type].acceptanceRate = typeStats[type].accepted / typeStats[type].total;
    }

    // Sort by acceptance rate
    const sorted = Object.entries(typeStats)
      .map(([type, stats]) => ({ type, ...stats }))
      .sort((a, b) => b.acceptanceRate - a.acceptanceRate);

    return sorted;
  }

  async getRecentFeedback(days = 7) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);

    return this.feedbackHistory.filter((feedback) => {
      const feedbackDate = new Date(feedback.timestamp);
      return feedbackDate >= cutoff;
    });
  }

  async getAcceptanceRateOverTime(bucketSizeDays = 7) {
    if (this.feedbackHistory.length === 0) {
      return [];
    }

    // Sort feedback by timestamp
    const sorted = [...this.feedbackHistory].sort(
      (a, b) => new Date(a.timestamp) - new Date(b.timestamp)
    );

    const buckets = [];
    let currentBucket = {
      start: new Date(sorted[0].timestamp),
      end: null,
      total: 0,
      accepted: 0,
      rate: 0,
    };

    for (const feedback of sorted) {
      const feedbackDate = new Date(feedback.timestamp);
      const daysSinceStart = (feedbackDate - currentBucket.start) / (1000 * 60 * 60 * 24);

      if (daysSinceStart > bucketSizeDays) {
        // Finish current bucket
        currentBucket.end = feedbackDate;
        currentBucket.rate =
          currentBucket.total > 0 ? currentBucket.accepted / currentBucket.total : 0;
        buckets.push(currentBucket);

        // Start new bucket
        currentBucket = {
          start: feedbackDate,
          end: null,
          total: 0,
          accepted: 0,
          rate: 0,
        };
      }

      currentBucket.total++;
      if (feedback.accepted) {
        currentBucket.accepted++;
      }
    }

    // Add final bucket
    if (currentBucket.total > 0) {
      currentBucket.end = new Date();
      currentBucket.rate = currentBucket.accepted / currentBucket.total;
      buckets.push(currentBucket);
    }

    return buckets;
  }

  async getRejectionReasons() {
    const reasons = {};

    for (const feedback of this.feedbackHistory) {
      if (!feedback.accepted && feedback.reason) {
        // Simple categorization of rejection reasons
        const category = this.categorizeReason(feedback.reason);
        reasons[category] = (reasons[category] || 0) + 1;
      }
    }

    return Object.entries(reasons)
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count);
  }

  categorizeReason(reason) {
    const lowerReason = reason.toLowerCase();

    if (lowerReason.includes('not applicable') || lowerReason.includes('not relevant')) {
      return 'Not Applicable';
    }
    if (lowerReason.includes('already') || lowerReason.includes('existing')) {
      return 'Already Implemented';
    }
    if (lowerReason.includes('too complex') || lowerReason.includes('too difficult')) {
      return 'Too Complex';
    }
    if (lowerReason.includes('low priority') || lowerReason.includes('not important')) {
      return 'Low Priority';
    }
    if (lowerReason.includes('incorrect') || lowerReason.includes('wrong')) {
      return 'Incorrect Analysis';
    }

    return 'Other';
  }

  async adjustWeights(initialWeights, feedbackStats) {
    const adjusted = { ...initialWeights };

    for (const [category, stats] of Object.entries(feedbackStats)) {
      if (!stats || typeof stats !== 'object') {
        continue;
      }

      const acceptanceRate = stats.accepted / (stats.accepted + stats.rejected);

      // Adjust weight based on acceptance rate
      // High acceptance rate = increase weight
      // Low acceptance rate = decrease weight
      const adjustment = (acceptanceRate - 0.5) * 0.4; // ±0.2 max adjustment
      adjusted[category] = (adjusted[category] || 1.0) + adjustment;

      // Ensure weights stay within reasonable bounds
      adjusted[category] = Math.max(0.5, Math.min(1.5, adjusted[category]));
    }

    return adjusted;
  }

  async getRecommendationEffectiveness(recommendationId) {
    const feedback = this.feedbackHistory.find((f) => f.recommendationId === recommendationId);

    if (!feedback) {
      return null;
    }

    // Calculate effectiveness based on multiple factors
    let effectiveness = 0;

    if (feedback.accepted) {
      effectiveness += 0.5;

      // Check if recommendation was actually implemented
      if (feedback.implemented) {
        effectiveness += 0.3;
      }

      // Check if it had positive impact
      if (feedback.impactRealized) {
        effectiveness += 0.2;
      }
    }

    return {
      recommendationId,
      effectiveness,
      accepted: feedback.accepted,
      implemented: feedback.implemented || false,
      impactRealized: feedback.impactRealized || false,
      feedback: feedback.additionalFeedback || null,
    };
  }

  async exportFeedback(format = 'json') {
    const data = {
      history: this.feedbackHistory,
      stats: await this.getCategoryStats(),
      successfulTypes: await this.getMostSuccessfulTypes(),
      rejectionReasons: await this.getRejectionReasons(),
      exportDate: new Date(),
    };

    switch (format) {
      case 'json':
        return JSON.stringify(data, null, 2);

      case 'csv':
        return this.exportToCSV(data);

      case 'summary':
        return this.exportSummary(data);

      default:
        return data;
    }
  }

  exportToCSV(data) {
    const headers = ['Date', 'Category', 'Type', 'Accepted', 'Reason', 'Confidence'];
    const rows = [headers.join(',')];

    for (const feedback of data.history) {
      const row = [
        new Date(feedback.timestamp).toISOString(),
        feedback.category || '',
        feedback.type || '',
        feedback.accepted ? 'Yes' : 'No',
        feedback.reason || '',
        feedback.confidence || '',
      ];
      rows.push(row.map((cell) => `"${cell}"`).join(','));
    }

    return rows.join('\n');
  }

  exportSummary(data) {
    let summary = '# Feedback Summary\n\n';
    summary += `Export Date: ${data.exportDate}\n\n`;

    summary += '## Overall Statistics\n';
    summary += `Total Feedback: ${data.history.length}\n\n`;

    summary += '## Category Performance\n';
    for (const [category, stats] of Object.entries(data.stats)) {
      summary += `### ${category}\n`;
      summary += `- Acceptance Rate: ${(stats.acceptanceRate * 100).toFixed(1)}%\n`;
      summary += `- Total: ${stats.total} (Accepted: ${stats.accepted}, Rejected: ${stats.rejected})\n\n`;
    }

    summary += '## Top Successful Recommendation Types\n';
    for (const type of data.successfulTypes.slice(0, 5)) {
      summary += `- ${type.type}: ${(type.acceptanceRate * 100).toFixed(1)}% acceptance\n`;
    }

    summary += '\n## Common Rejection Reasons\n';
    for (const reason of data.rejectionReasons.slice(0, 5)) {
      summary += `- ${reason.reason}: ${reason.count} times\n`;
    }

    return summary;
  }
}

export default FeedbackManager;

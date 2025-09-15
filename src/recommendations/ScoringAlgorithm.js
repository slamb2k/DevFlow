class ScoringAlgorithm {
  constructor() {
    this.impactWeights = {
      high: 1.0,
      medium: 0.6,
      low: 0.3,
    };

    this.effortWeights = {
      low: 1.0,
      medium: 0.6,
      high: 0.3,
    };

    this.categoryBoosts = {
      security: 1.5,
      performance: 1.2,
      workflow: 1.0,
      codeQuality: 1.1,
      dependencies: 0.9,
    };
  }

  calculatePriority(recommendation) {
    let score = 0;

    // Base score from impact
    const impactScore = this.impactWeights[recommendation.impact] || 0.5;

    // Effort modifier (lower effort = higher priority)
    const effortScore = this.effortWeights[recommendation.effort] || 0.5;

    // Confidence modifier
    const confidence = recommendation.confidence || 0.5;

    // Calculate base score
    score = impactScore * 0.4 + effortScore * 0.3 + confidence * 0.3;

    // Apply category boost
    const categoryBoost = this.categoryBoosts[recommendation.category] || 1.0;
    score *= categoryBoost;

    // Apply urgency factor for security issues
    if (recommendation.category === 'security' && recommendation.priority === 'high') {
      score *= 1.5;
    }

    // Normalize to 0-1 range
    return Math.min(1.0, Math.max(0, score));
  }

  calculateBaseConfidence(dataPoints, totalPossible) {
    if (totalPossible === 0) {
      return 0.5;
    }
    return Math.min(1.0, dataPoints / totalPossible);
  }

  applyHistoricalWeight(baseScore, historicalAccuracy) {
    // Historical accuracy influences confidence
    // If past recommendations were accurate, boost confidence
    const weight = 0.3; // How much historical accuracy influences the score
    return baseScore * (1 - weight) + baseScore * historicalAccuracy * weight;
  }

  applyRecencyBoost(score, daysOld) {
    // More recent data gets a confidence boost
    const recencyFactor = Math.max(0, 1 - daysOld / 30); // Decay over 30 days
    const boost = recencyFactor * 0.2; // Max 20% boost for very recent data
    return Math.min(1.0, score + boost);
  }

  calculateComplexityPenalty(complexity) {
    // Higher complexity reduces confidence
    if (complexity < 5) {
      return 0;
    }
    if (complexity < 10) {
      return 0.05;
    }
    if (complexity < 20) {
      return 0.1;
    }
    return 0.2;
  }

  calculateCoverageBoost(coverage) {
    // Higher test coverage increases confidence
    if (coverage > 80) {
      return 0.15;
    }
    if (coverage > 60) {
      return 0.1;
    }
    if (coverage > 40) {
      return 0.05;
    }
    return 0;
  }

  scorePattern(pattern) {
    let score = 0.5; // Base score

    // Frequency-based scoring
    if (pattern.frequency) {
      if (pattern.frequency > 10) {
        score += 0.2;
      } else if (pattern.frequency > 5) {
        score += 0.1;
      } else if (pattern.frequency > 2) {
        score += 0.05;
      }
    }

    // Confidence from pattern
    if (pattern.confidence) {
      score = score * 0.7 + pattern.confidence * 0.3;
    }

    // Impact of pattern
    if (pattern.impact) {
      const impactBoost = this.impactWeights[pattern.impact] || 0.5;
      score = score * 0.8 + impactBoost * 0.2;
    }

    return Math.min(1.0, Math.max(0, score));
  }

  rankRecommendations(recommendations) {
    // Calculate scores for all recommendations
    const scored = recommendations.map((rec) => ({
      ...rec,
      score: this.calculatePriority(rec),
    }));

    // Sort by score (highest first)
    scored.sort((a, b) => b.score - a.score);

    // Group by category for balanced recommendations
    const byCategory = {};
    for (const rec of scored) {
      if (!byCategory[rec.category]) {
        byCategory[rec.category] = [];
      }
      byCategory[rec.category].push(rec);
    }

    // Interleave categories to ensure variety
    const ranked = [];
    let hasMore = true;
    let index = 0;

    while (hasMore) {
      hasMore = false;
      for (const category of Object.keys(byCategory)) {
        if (byCategory[category].length > index) {
          ranked.push(byCategory[category][index]);
          hasMore = true;
        }
      }
      index++;
    }

    return ranked;
  }

  calculateTrend(historicalScores) {
    if (!historicalScores || historicalScores.length < 2) {
      return 0; // No trend
    }

    // Calculate simple linear trend
    const n = historicalScores.length;
    let sumX = 0,
      sumY = 0,
      sumXY = 0,
      sumX2 = 0;

    for (let i = 0; i < n; i++) {
      sumX += i;
      sumY += historicalScores[i];
      sumXY += i * historicalScores[i];
      sumX2 += i * i;
    }

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);

    // Normalize slope to -1 to 1 range
    return Math.max(-1, Math.min(1, slope));
  }

  adjustForContext(score, context) {
    let adjusted = score;

    // Project size adjustment
    if (context.projectSize === 'large') {
      // Large projects need more confident recommendations
      adjusted *= 0.9;
    } else if (context.projectSize === 'small') {
      // Small projects can be more experimental
      adjusted *= 1.1;
    }

    // Team size adjustment
    if (context.teamSize > 10) {
      // Larger teams need more conservative recommendations
      adjusted *= 0.95;
    }

    // Development phase adjustment
    if (context.phase === 'production') {
      // Production systems need very confident recommendations
      adjusted *= 0.85;
    } else if (context.phase === 'development') {
      // Development can be more experimental
      adjusted *= 1.15;
    }

    return Math.min(1.0, Math.max(0, adjusted));
  }

  compareRecommendations(rec1, rec2) {
    const score1 = this.calculatePriority(rec1);
    const score2 = this.calculatePriority(rec2);

    if (Math.abs(score1 - score2) < 0.05) {
      // If scores are very close, use secondary criteria

      // Prefer security over other categories
      if (rec1.category === 'security' && rec2.category !== 'security') {
        return -1;
      }
      if (rec2.category === 'security' && rec1.category !== 'security') {
        return 1;
      }

      // Prefer lower effort for similar impact
      const effort1 = this.effortWeights[rec1.effort] || 0.5;
      const effort2 = this.effortWeights[rec2.effort] || 0.5;
      if (effort1 !== effort2) {
        return effort2 - effort1;
      }

      // Prefer higher confidence
      return (rec2.confidence || 0) - (rec1.confidence || 0);
    }

    return score2 - score1;
  }

  calculateROI(recommendation) {
    // Return on Investment calculation
    const impact = this.impactWeights[recommendation.impact] || 0.5;
    const effort = this.effortWeights[recommendation.effort] || 0.5;
    const confidence = recommendation.confidence || 0.5;

    // ROI = (Impact * Confidence) / (1 - Effort)
    // Higher impact and confidence with lower effort = higher ROI
    const roi = (impact * confidence) / (1.1 - effort); // 1.1 to avoid division by zero

    return Math.min(1.0, Math.max(0, roi));
  }
}

export default ScoringAlgorithm;

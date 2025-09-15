import { execSync } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import { performance } from 'perf_hooks';

class PerformanceProfiler {
  constructor(projectPath) {
    this.projectPath = projectPath;
  }

  async profile() {
    const results = {
      bundle: await this.analyzeBundleSize(),
      buildPerformance: await this.measureBuildPerformance(),
      runtime: await this.collectRuntimeMetrics(),
      timestamp: new Date().toISOString(),
    };

    results.summary = this.generateSummary(results);
    results.recommendations = this.generateRecommendations(results);

    return results;
  }

  async analyzeBundleSize() {
    try {
      const webpackConfigPath = path.join(this.projectPath, 'webpack.config.js');
      await fs.access(webpackConfigPath);

      const statsPath = path.join(this.projectPath, 'webpack-stats.json');

      try {
        const command = `npx webpack --profile --json > ${statsPath}`;
        execSync(command, { cwd: this.projectPath, encoding: 'utf8' });

        const statsData = await fs.readFile(statsPath, 'utf8');
        const stats = JSON.parse(statsData);

        const assets = stats.assets.map((asset) => ({
          name: asset.name,
          size: asset.size,
          chunks: asset.chunks,
          sizeInMB: (asset.size / 1048576).toFixed(2),
        }));

        const totalSize = assets.reduce((sum, asset) => sum + asset.size, 0);

        const result = {
          totalSize,
          totalSizeInMB: (totalSize / 1048576).toFixed(2),
          assets: assets.sort((a, b) => b.size - a.size),
          largestAssets: assets.slice(0, 5),
        };

        await fs.unlink(statsPath).catch(() => {});

        return result;
      } catch (error) {
        return { error: error.message, skipped: false };
      }
    } catch (error) {
      return { skipped: true, reason: 'No webpack.config.js found' };
    }
  }

  async measureBuildPerformance() {
    const results = {
      buildTime: await this.measureBuildTime(),
      memory: await this.profileBuildMemory(),
    };

    return results;
  }

  async measureBuildTime() {
    try {
      const packageJsonPath = path.join(this.projectPath, 'package.json');
      const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf8'));

      if (!packageJson.scripts?.build) {
        return { skipped: true, reason: 'No build script found' };
      }

      const startTime = performance.now();

      try {
        execSync('npm run build', {
          cwd: this.projectPath,
          encoding: 'utf8',
          stdio: 'pipe',
        });
      } catch (error) {
        // Build might fail but we still want to measure time
      }

      const endTime = performance.now();
      const buildTime = endTime - startTime;

      return {
        buildTime: Math.round(buildTime),
        buildTimeSeconds: (buildTime / 1000).toFixed(2),
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return { error: error.message, skipped: false };
    }
  }

  async profileBuildMemory() {
    try {
      const packageJsonPath = path.join(this.projectPath, 'package.json');
      const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf8'));

      if (!packageJson.scripts?.build) {
        return { skipped: true, reason: 'No build script found' };
      }

      const memoryUsage = [];
      const interval = 100; // Sample every 100ms
      let monitoring = true;

      const monitor = setInterval(() => {
        if (monitoring) {
          const usage = process.memoryUsage();
          memoryUsage.push({
            rss: usage.rss,
            heapUsed: usage.heapUsed,
            heapTotal: usage.heapTotal,
            external: usage.external,
          });
        }
      }, interval);

      try {
        execSync('npm run build', {
          cwd: this.projectPath,
          encoding: 'utf8',
          stdio: 'pipe',
        });
      } catch (error) {
        // Build might fail but we still want memory data
      }

      monitoring = false;
      clearInterval(monitor);

      if (memoryUsage.length === 0) {
        return { error: 'No memory data collected' };
      }

      const peakMemory = Math.max(...memoryUsage.map((m) => m.rss));
      const averageMemory = memoryUsage.reduce((sum, m) => sum + m.rss, 0) / memoryUsage.length;
      const peakHeap = Math.max(...memoryUsage.map((m) => m.heapUsed));

      return {
        peakMemory,
        peakMemoryMB: (peakMemory / 1048576).toFixed(2),
        averageMemory: Math.round(averageMemory),
        averageMemoryMB: (averageMemory / 1048576).toFixed(2),
        peakHeap,
        peakHeapMB: (peakHeap / 1048576).toFixed(2),
        samples: memoryUsage.length,
      };
    } catch (error) {
      return { error: error.message, skipped: false };
    }
  }

  async collectRuntimeMetrics() {
    try {
      const metricsPath = path.join(this.projectPath, '.devflow', 'metrics.json');

      try {
        const metricsData = await fs.readFile(metricsPath, 'utf8');
        const metrics = JSON.parse(metricsData);

        return {
          responseTime: metrics.responseTime || null,
          throughput: metrics.throughput || null,
          errorRate: metrics.errorRate || null,
          uptime: metrics.uptime || null,
          requestsPerSecond: metrics.requestsPerSecond || null,
        };
      } catch (error) {
        return {
          message: 'No runtime metrics available',
          hint: 'Runtime metrics will be collected when the application is running',
        };
      }
    } catch (error) {
      return { error: error.message };
    }
  }

  generateSummary(results) {
    const summary = {
      bundleSize: null,
      buildTime: null,
      memoryUsage: null,
      issues: [],
    };

    if (results.bundle && !results.bundle.skipped && !results.bundle.error) {
      summary.bundleSize = {
        total: `${results.bundle.totalSizeInMB} MB`,
        largestAsset: results.bundle.largestAssets?.[0]?.name,
      };

      if (parseFloat(results.bundle.totalSizeInMB) > 10) {
        summary.issues.push('Bundle size exceeds 10MB');
      }
    }

    if (results.buildPerformance?.buildTime && !results.buildPerformance.buildTime.skipped) {
      summary.buildTime = `${results.buildPerformance.buildTime.buildTimeSeconds} seconds`;

      if (results.buildPerformance.buildTime.buildTime > 60000) {
        summary.issues.push('Build time exceeds 1 minute');
      }
    }

    if (results.buildPerformance?.memory && !results.buildPerformance.memory.skipped) {
      summary.memoryUsage = {
        peak: `${results.buildPerformance.memory.peakMemoryMB} MB`,
        average: `${results.buildPerformance.memory.averageMemoryMB} MB`,
      };

      if (parseFloat(results.buildPerformance.memory.peakMemoryMB) > 1024) {
        summary.issues.push('Peak memory usage exceeds 1GB');
      }
    }

    return summary;
  }

  generateRecommendations(results) {
    const recommendations = [];

    if (results.bundle && !results.bundle.skipped && !results.bundle.error) {
      const totalSizeMB = parseFloat(results.bundle.totalSizeInMB);

      if (totalSizeMB > 5) {
        recommendations.push('Consider code splitting to reduce initial bundle size');
      }

      if (totalSizeMB > 10) {
        recommendations.push(
          'Bundle size is very large - implement lazy loading for non-critical modules'
        );
      }

      const largeAssets = results.bundle.assets.filter((a) => parseFloat(a.sizeInMB) > 1);
      if (largeAssets.length > 0) {
        recommendations.push(`Large assets detected: ${largeAssets.map((a) => a.name).join(', ')}`);
        recommendations.push('Consider optimizing images and using compression');
      }

      if (results.bundle.assets.some((a) => a.name.includes('vendor'))) {
        const vendorAsset = results.bundle.assets.find((a) => a.name.includes('vendor'));
        if (parseFloat(vendorAsset.sizeInMB) > 2) {
          recommendations.push('Vendor bundle is large - review and remove unused dependencies');
        }
      }
    }

    if (results.buildPerformance?.buildTime && !results.buildPerformance.buildTime.skipped) {
      const buildTimeMs = results.buildPerformance.buildTime.buildTime;

      if (buildTimeMs > 30000) {
        recommendations.push('Build time is slow - consider using build caching');
      }

      if (buildTimeMs > 60000) {
        recommendations.push(
          'Build time exceeds 1 minute - review webpack configuration and plugins'
        );
      }
    }

    if (results.buildPerformance?.memory && !results.buildPerformance.memory.skipped) {
      const peakMemoryMB = parseFloat(results.buildPerformance.memory.peakMemoryMB);

      if (peakMemoryMB > 512) {
        recommendations.push(
          'High memory usage during build - consider increasing Node.js memory limit'
        );
      }

      if (peakMemoryMB > 1024) {
        recommendations.push(
          'Very high memory usage - review build process and consider splitting builds'
        );
      }
    }

    if (results.runtime && results.runtime.responseTime) {
      if (results.runtime.responseTime > 1000) {
        recommendations.push(
          'High response time detected - optimize database queries and API calls'
        );
      }

      if (results.runtime.errorRate && results.runtime.errorRate > 0.01) {
        recommendations.push('Error rate above 1% - investigate and fix application errors');
      }
    }

    return recommendations;
  }
}

export { PerformanceProfiler };

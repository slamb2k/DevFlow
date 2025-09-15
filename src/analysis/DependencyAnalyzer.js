const { execSync } = require('child_process');
const fs = require('fs').promises;
const path = require('path');

class DependencyAnalyzer {
  constructor(projectPath) {
    this.projectPath = projectPath;
  }

  async analyze() {
    const results = {
      outdated: await this.checkOutdated(),
      licenses: await this.checkLicenses(),
      tree: await this.generateDependencyTree(),
      circular: await this.detectCircularDependencies(),
      timestamp: new Date().toISOString(),
    };

    results.summary = this.generateSummary(results);
    results.recommendations = this.generateRecommendations(results);

    return results;
  }

  async checkOutdated() {
    const results = {};

    try {
      await fs.access(path.join(this.projectPath, 'package.json'));
      results.npm = await this.checkNpmOutdated();
    } catch {
      results.npm = { skipped: true, reason: 'No package.json found' };
    }

    try {
      await fs.access(path.join(this.projectPath, 'requirements.txt'));
      results.python = await this.checkPythonOutdated();
    } catch {
      results.python = { skipped: true, reason: 'No requirements.txt found' };
    }

    return results;
  }

  async checkNpmOutdated() {
    try {
      const command = 'npm outdated --json';
      let output;

      try {
        output = execSync(command, { cwd: this.projectPath, encoding: 'utf8' });
      } catch (error) {
        if (error.stdout) {
          output = error.stdout;
        } else {
          throw error;
        }
      }

      if (!output || output.trim() === '') {
        return { upToDate: true, packages: {} };
      }

      const outdated = JSON.parse(output);
      const packages = {};

      for (const [name, info] of Object.entries(outdated)) {
        packages[name] = {
          current: info.current,
          wanted: info.wanted,
          latest: info.latest,
          type: info.type,
          homepage: info.homepage,
        };
      }

      return packages;
    } catch (error) {
      return { error: error.message };
    }
  }

  async checkPythonOutdated() {
    try {
      const command = 'pip list --outdated --format json';
      const output = execSync(command, { cwd: this.projectPath, encoding: 'utf8' });

      if (!output || output.trim() === '') {
        return { upToDate: true, packages: {} };
      }

      const outdated = JSON.parse(output);
      const packages = {};

      for (const pkg of outdated) {
        packages[pkg.name] = {
          current: pkg.version,
          latest: pkg.latest_version,
          type: pkg.latest_filetype,
        };
      }

      return packages;
    } catch (error) {
      if (error.message.includes('pip: command not found')) {
        return { skipped: true, reason: 'pip not installed' };
      }
      return { error: error.message };
    }
  }

  async checkLicenses(targetLicense = null) {
    const results = {
      compatible: [],
      incompatible: [],
      unlicensed: [],
      summary: {},
    };

    try {
      await fs.access(path.join(this.projectPath, 'package.json'));
      const npmLicenses = await this.checkNpmLicenses();

      if (!npmLicenses.error) {
        for (const pkg of npmLicenses) {
          if (!pkg.license) {
            results.unlicensed.push(pkg.name);
          } else if (targetLicense && !this.isLicenseCompatible(pkg.license, targetLicense)) {
            results.incompatible.push(pkg.name);
          } else {
            results.compatible.push(pkg.name);
          }

          const licenseKey = pkg.license || 'UNLICENSED';
          results.summary[licenseKey] = (results.summary[licenseKey] || 0) + 1;
        }
      }
    } catch {
      results.npm = { skipped: true, reason: 'No package.json found' };
    }

    return results;
  }

  async checkNpmLicenses() {
    try {
      const command = 'npm ls --json --depth=0';
      const output = execSync(command, { cwd: this.projectPath, encoding: 'utf8' });
      const tree = JSON.parse(output);

      const licenses = [];

      if (tree.dependencies) {
        for (const [name, info] of Object.entries(tree.dependencies)) {
          const packageJsonPath = path.join(this.projectPath, 'node_modules', name, 'package.json');

          try {
            const packageData = await fs.readFile(packageJsonPath, 'utf8');
            const packageJson = JSON.parse(packageData);

            licenses.push({
              name,
              version: info.version,
              license: packageJson.license || packageJson.licenses,
            });
          } catch {
            licenses.push({
              name,
              version: info.version,
              license: null,
            });
          }
        }
      }

      return licenses;
    } catch (error) {
      return { error: error.message };
    }
  }

  isLicenseCompatible(license, targetLicense) {
    const compatibilityMatrix = {
      MIT: ['MIT', 'BSD', 'Apache-2.0', 'ISC'],
      'Apache-2.0': ['Apache-2.0', 'MIT', 'BSD', 'ISC'],
      'GPL-3.0': ['GPL-3.0', 'GPL-2.0'],
      BSD: ['BSD', 'MIT', 'Apache-2.0', 'ISC'],
      ISC: ['ISC', 'MIT', 'BSD', 'Apache-2.0'],
    };

    const normalizedLicense = this.normalizeLicense(license);
    const normalizedTarget = this.normalizeLicense(targetLicense);

    if (compatibilityMatrix[normalizedTarget]) {
      return compatibilityMatrix[normalizedTarget].includes(normalizedLicense);
    }

    return normalizedLicense === normalizedTarget;
  }

  normalizeLicense(license) {
    if (typeof license !== 'string') {
      return 'UNKNOWN';
    }

    const normalized = license.toUpperCase().replace(/[^A-Z0-9]/g, '');

    const mapping = {
      MIT: 'MIT',
      APACHE20: 'Apache-2.0',
      APACHE2: 'Apache-2.0',
      GPL3: 'GPL-3.0',
      GPL30: 'GPL-3.0',
      BSD: 'BSD',
      BSD3: 'BSD',
      ISC: 'ISC',
    };

    return mapping[normalized] || license;
  }

  async generateDependencyTree() {
    try {
      await fs.access(path.join(this.projectPath, 'package.json'));

      const command = 'npm ls --json';
      let output;

      try {
        output = execSync(command, { cwd: this.projectPath, encoding: 'utf8' });
      } catch (error) {
        if (error.stdout) {
          output = error.stdout;
        } else {
          throw error;
        }
      }

      const tree = JSON.parse(output);

      const analysis = {
        tree: this.simplifyTree(tree),
        depth: this.calculateTreeDepth(tree),
        totalPackages: this.countPackages(tree),
        directDependencies: Object.keys(tree.dependencies || {}).length,
        problems: tree.problems || [],
      };

      return analysis;
    } catch (error) {
      return { error: error.message };
    }
  }

  simplifyTree(tree, maxDepth = 3, currentDepth = 0) {
    if (currentDepth >= maxDepth || !tree.dependencies) {
      return null;
    }

    const simplified = {};

    for (const [name, info] of Object.entries(tree.dependencies)) {
      simplified[name] = {
        version: info.version,
        resolved: info.resolved,
        dependencies: this.simplifyTree(info, maxDepth, currentDepth + 1),
      };
    }

    return simplified;
  }

  calculateTreeDepth(tree, currentDepth = 0) {
    if (!tree.dependencies || Object.keys(tree.dependencies).length === 0) {
      return currentDepth;
    }

    let maxDepth = currentDepth;

    for (const dep of Object.values(tree.dependencies)) {
      const depth = this.calculateTreeDepth(dep, currentDepth + 1);
      maxDepth = Math.max(maxDepth, depth);
    }

    return maxDepth;
  }

  countPackages(tree, visited = new Set()) {
    let count = 0;

    if (tree.dependencies) {
      for (const [name, dep] of Object.entries(tree.dependencies)) {
        const key = `${name}@${dep.version}`;

        if (!visited.has(key)) {
          visited.add(key);
          count++;
          count += this.countPackages(dep, visited);
        }
      }
    }

    return count;
  }

  async detectCircularDependencies() {
    try {
      await fs.access(path.join(this.projectPath, 'package.json'));

      const command = 'npm ls --json';
      let output;

      try {
        output = execSync(command, { cwd: this.projectPath, encoding: 'utf8' });
      } catch (error) {
        if (error.stdout) {
          output = error.stdout;
        } else {
          throw error;
        }
      }

      const tree = JSON.parse(output);
      const circular = {};
      const visited = new Set();
      const path = [];

      this.findCircular(tree, visited, path, circular);

      return circular;
    } catch (error) {
      return { error: error.message };
    }
  }

  findCircular(node, visited, path, circular, name = 'root') {
    if (!node || !node.dependencies) {
      return;
    }

    path.push(name);
    visited.add(name);

    for (const [depName, dep] of Object.entries(node.dependencies)) {
      if (path.includes(depName)) {
        const cycleStart = path.indexOf(depName);
        const cycle = path.slice(cycleStart);
        cycle.push(depName);

        if (!circular[depName]) {
          circular[depName] = [];
        }
        circular[depName].push(cycle.join(' -> '));
      } else if (!visited.has(depName)) {
        this.findCircular(dep, visited, [...path], circular, depName);
      }
    }
  }

  generateSummary(results) {
    const summary = {
      outdatedCount: 0,
      licenseIssues: 0,
      circularDependencies: 0,
      totalDependencies: 0,
      health: 'Unknown',
    };

    if (results.outdated) {
      if (results.outdated.npm && !results.outdated.npm.skipped && !results.outdated.npm.upToDate) {
        summary.outdatedCount += Object.keys(results.outdated.npm).length;
      }

      if (
        results.outdated.python &&
        !results.outdated.python.skipped &&
        !results.outdated.python.upToDate
      ) {
        summary.outdatedCount += Object.keys(results.outdated.python).length;
      }
    }

    if (results.licenses) {
      summary.licenseIssues =
        results.licenses.incompatible.length + results.licenses.unlicensed.length;
    }

    if (results.circular && !results.circular.error) {
      summary.circularDependencies = Object.keys(results.circular).length;
    }

    if (results.tree && !results.tree.error) {
      summary.totalDependencies = results.tree.totalPackages;
      summary.dependencyDepth = results.tree.depth;
    }

    const score =
      100 -
      summary.outdatedCount * 2 -
      summary.licenseIssues * 5 -
      summary.circularDependencies * 10;

    if (score >= 90) {
      summary.health = 'Excellent';
    } else if (score >= 70) {
      summary.health = 'Good';
    } else if (score >= 50) {
      summary.health = 'Fair';
    } else {
      summary.health = 'Poor';
    }

    return summary;
  }

  generateRecommendations(results) {
    const recommendations = [];

    if (results.outdated) {
      if (results.outdated.npm && !results.outdated.npm.skipped && !results.outdated.npm.upToDate) {
        const majorUpdates = [];

        for (const [name, info] of Object.entries(results.outdated.npm)) {
          if (info.current && info.latest) {
            const currentMajor = info.current.split('.')[0];
            const latestMajor = info.latest.split('.')[0];

            if (currentMajor !== latestMajor) {
              majorUpdates.push(`${name} (${info.current} -> ${info.latest})`);
            }
          }
        }

        if (majorUpdates.length > 0) {
          recommendations.push(
            `Major version updates available: ${majorUpdates.slice(0, 3).join(', ')}`
          );
        }

        if (Object.keys(results.outdated.npm).length > 10) {
          recommendations.push('Many outdated packages - consider regular dependency updates');
        }
      }
    }

    if (results.licenses) {
      if (results.licenses.unlicensed.length > 0) {
        recommendations.push(
          `Review unlicensed packages: ${results.licenses.unlicensed.slice(0, 3).join(', ')}`
        );
      }

      if (results.licenses.incompatible.length > 0) {
        recommendations.push(
          `License compatibility issues: ${results.licenses.incompatible.slice(0, 3).join(', ')}`
        );
      }
    }

    if (results.tree && !results.tree.error) {
      if (results.tree.depth > 10) {
        recommendations.push('Deep dependency tree - consider flattening dependencies');
      }

      if (results.tree.totalPackages > 1000) {
        recommendations.push('Large number of dependencies - review and remove unused packages');
      }

      if (results.tree.problems && results.tree.problems.length > 0) {
        recommendations.push(
          `Dependency problems detected: ${results.tree.problems.length} issues`
        );
      }
    }

    if (results.circular && !results.circular.error) {
      const circularCount = Object.keys(results.circular).length;

      if (circularCount > 0) {
        recommendations.push(`Fix ${circularCount} circular dependencies`);

        const examples = Object.keys(results.circular).slice(0, 2);
        if (examples.length > 0) {
          recommendations.push(`Circular dependencies in: ${examples.join(', ')}`);
        }
      }
    }

    if (recommendations.length === 0) {
      recommendations.push('Dependencies are well-maintained');
    }

    return recommendations;
  }
}

module.exports = DependencyAnalyzer;

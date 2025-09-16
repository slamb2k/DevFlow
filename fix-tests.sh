#!/bin/bash

echo "Fixing remaining test issues..."

# Fix all CommonJS requires to ES6 imports in src/
echo "Converting remaining CommonJS to ES6..."
find src/ -name "*.js" -type f -exec sed -i \
  -e "s/const \(.*\) = require('\(.*\)');/import \1 from '\2';/g" \
  -e "s/const { \(.*\) } = require('\(.*\)');/import { \1 } from '\2';/g" \
  -e "s/module.exports = \(.*\);/export default \1;/g" \
  -e "s/exports\.\([a-zA-Z_][a-zA-Z0-9_]*\) = \(.*\);/export const \1 = \2;/g" \
  {} \;

# Fix specific fs.promises imports
find src/ -name "*.js" -type f -exec sed -i \
  "s/const fs = require('fs').promises;/import { promises as fs } from 'fs';/g" \
  {} \;

# Fix @babel/traverse import
find src/ -name "*.js" -type f -exec sed -i \
  "s/const traverse = require('@babel\/traverse').default;/import traverse from '@babel\/traverse';/g" \
  {} \;

# Ensure all relative imports have .js extension
echo "Adding .js extensions to relative imports..."
find src/ -name "*.js" -type f -exec sed -i \
  -E "s/from '(\.\/.+)'/from '\1.js'/g" \
  {} \;

# Remove duplicate .js.js extensions if any
find src/ -name "*.js" -type f -exec sed -i \
  "s/\.js\.js'/.js'/g" \
  {} \;

echo "Test fixes applied!"
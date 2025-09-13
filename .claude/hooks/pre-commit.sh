#!/bin/bash
# This hook blocks Claude from committing without explicit user approval

echo "⚠️  Claude is attempting to commit changes."
echo "Please review the changes and explicitly ask Claude to commit if you approve."
echo ""
echo "To commit, say: 'Yes, please commit these changes'"
echo "To skip, say: 'No, don't commit yet'"
echo ""
echo "Blocking commit for now..."
exit 1  # Block the commit

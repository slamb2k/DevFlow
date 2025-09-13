#!/bin/bash
# This hook blocks Claude from pushing without explicit user approval

echo "⚠️  Claude is attempting to push changes."
echo ""
echo "IMPORTANT: Check if a script (like /ship) is already running!"
echo "- If you see a Han-Solo banner, a script is handling this"
echo "- If /ship or ship-core.sh is running, it will push automatically"
echo ""
echo "Please review and explicitly approve if manual push is needed:"
echo "To push, say: 'Yes, push these changes'"
echo "To skip, say: 'No, let the script handle it'"
echo ""
echo "Blocking push for now..."
exit 1  # Block the push

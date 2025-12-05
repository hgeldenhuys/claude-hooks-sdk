#!/bin/bash
#
# Install claude-hooks-sdk skills from marketplace
#
# Usage:
#   ./scripts/install-skills.sh
#
# Prerequisites:
#   1. Add marketplace: claude plugin marketplace add hgeldenhuys/claude-hooks-sdk
#   2. Run this script to symlink skills
#
# This creates symlinks from the marketplace clone to ~/.claude/skills/
# so skills auto-update when you run: claude plugin marketplace update

set -e

MARKETPLACE_DIR="$HOME/.claude/plugins/marketplaces/claude-hooks-sdk"
SKILLS_DIR="$HOME/.claude/skills"

# Check if marketplace is installed
if [ ! -d "$MARKETPLACE_DIR" ]; then
  echo "Error: claude-hooks-sdk marketplace not found."
  echo ""
  echo "First, add the marketplace:"
  echo "  claude plugin marketplace add hgeldenhuys/claude-hooks-sdk"
  echo ""
  exit 1
fi

# Check if skills exist in marketplace
if [ ! -d "$MARKETPLACE_DIR/.claude/skills" ]; then
  echo "Error: Skills not found in marketplace. Try updating:"
  echo "  claude plugin marketplace update claude-hooks-sdk"
  exit 1
fi

echo "Installing skills from claude-hooks-sdk marketplace..."
echo ""

# Install claude-code-hooks skill
mkdir -p "$SKILLS_DIR/claude-code-hooks"
ln -sf "$MARKETPLACE_DIR/.claude/skills/claude-code-hooks.md" "$SKILLS_DIR/claude-code-hooks/skill.md"
echo "  ✓ claude-code-hooks"

# Install claude-hooks-sdk skill
mkdir -p "$SKILLS_DIR/claude-hooks-sdk"
ln -sf "$MARKETPLACE_DIR/.claude/skills/claude-hooks-sdk.md" "$SKILLS_DIR/claude-hooks-sdk/skill.md"
echo "  ✓ claude-hooks-sdk"

echo ""
echo "Done! Skills installed to $SKILLS_DIR"
echo ""
echo "Skills are symlinked to the marketplace clone, so they'll auto-update when you run:"
echo "  claude plugin marketplace update claude-hooks-sdk"
echo ""
echo "Available skills:"
echo "  - claude-code-hooks: Generic guide for implementing Claude Code hooks"
echo "  - claude-hooks-sdk: Expert guide for using the SDK with transforms and utilities"

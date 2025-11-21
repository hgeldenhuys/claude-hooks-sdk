# Publishing Guide

## Dual Distribution Strategy

The `claude-hooks-sdk` is distributed via **two channels**:

1. **npm** - For developers building custom hooks
2. **Claude Code Plugin Marketplace** - For ready-to-use example hooks

## 1. Publishing to npm

### Prerequisites

```bash
# Login to npm (first time only)
npm login

# Verify you're logged in
npm whoami
```

### Publish Steps

```bash
# 1. Ensure everything is built
bun run build
bun run typecheck

# 2. Test the package
npm pack --dry-run

# 3. Publish to npm
npm publish

# 4. Verify
npm view claude-hooks-sdk
```

### Update npm Package

```bash
# 1. Update version in package.json
#    - Patch: 0.4.1 -> 0.4.2
#    - Minor: 0.4.1 -> 0.5.0
#    - Major: 0.4.1 -> 1.0.0

# 2. Update CHANGELOG.md

# 3. Commit and tag
git add package.json CHANGELOG.md
git commit -m "chore: bump version to 0.4.2"
git tag v0.4.2

# 4. Publish
npm publish

# 5. Push with tags
git push && git push --tags
```

## 2. Publishing to Claude Code Plugin Marketplace

The plugin marketplace is **automatically available** via GitHub! No separate publishing step needed.

### How Users Install

Users add your marketplace and install examples:

```bash
# Add the marketplace
/plugin marketplace add hgeldenhuys/agios/packages/claude-hooks-sdk

# List available plugins
/plugin list

# Install example hooks
/plugin install claude-hooks-sdk-examples
```

### Update Plugin Marketplace

To update the marketplace:

1. **Update version** in `.claude-plugin/plugin.json`
2. **Update version** in `.claude-plugin/marketplace.json`
3. **Commit and push** to GitHub
4. Users get updates automatically when they sync

```bash
git add .claude-plugin/
git commit -m "chore: update plugin to v0.4.2"
git push
```

## What Gets Published Where

### npm Package Includes:
- ✅ `dist/` - Compiled TypeScript
- ✅ `src/` - Source code
- ✅ `docs/` - Full documentation
- ✅ `sample-extension/` - Example code
- ✅ `.claude-plugin/` - Plugin manifest
- ✅ README, CHANGELOG, LICENSE

### GitHub Plugin Marketplace Includes:
- ✅ `.claude-plugin/plugin.json` - Plugin manifest
- ✅ `.claude-plugin/hooks.json` - Hook definitions
- ✅ `.claude-plugin/marketplace.json` - Marketplace catalog
- ✅ `sample-extension/` - Ready-to-use hooks

## Version Sync Checklist

When releasing a new version, update these files:

- [ ] `package.json` - version field
- [ ] `CHANGELOG.md` - Add release notes
- [ ] `.claude-plugin/plugin.json` - version field
- [ ] `.claude-plugin/marketplace.json` - plugins[0].version field
- [ ] Commit with version tag: `git tag v0.4.2`

## Distribution Differences

| Aspect | npm | Plugin Marketplace |
|--------|-----|-------------------|
| **Audience** | Developers | End users |
| **What** | SDK library | Ready-to-use hooks |
| **Install** | `npm install` | `/plugin install` |
| **Update** | `npm update` | `/plugin update` |
| **Use Case** | Build custom hooks | Use example hooks |

## Testing Before Publishing

### Test npm Package

```bash
# Create tarball
npm pack

# Install locally in test project
cd /tmp/test-project
npm install /path/to/claude-hooks-sdk-0.4.1.tgz

# Test import
cat > test.ts << 'EOF'
import { HookManager, success } from 'claude-hooks-sdk';
console.log('Import works!');
EOF
bun test.ts
```

### Test Plugin Installation

```bash
# In Claude Code, test marketplace
/plugin marketplace add hgeldenhuys/agios/packages/claude-hooks-sdk

# Verify plugin shows up
/plugin list

# Test installation
/plugin install claude-hooks-sdk-examples

# Check hook is available
ls -la .claude/hooks/
```

## Rollback

### Unpublish from npm (within 72 hours)

```bash
npm unpublish claude-hooks-sdk@0.4.1
```

### Fix Plugin Marketplace

Simply revert the commit and push:

```bash
git revert HEAD
git push
```

## Support

If users encounter issues:

- **npm issues**: https://github.com/hgeldenhuys/agios/issues
- **Plugin issues**: https://github.com/hgeldenhuys/agios/issues
- **Documentation**: https://github.com/hgeldenhuys/agios/tree/main/packages/claude-hooks-sdk

## Next Steps After Publishing

1. ✅ Publish to npm
2. ✅ Push to GitHub (plugin marketplace auto-available)
3. ✅ Create GitHub release with changelog
4. ✅ Tweet/share announcement
5. ✅ Update any dependent projects

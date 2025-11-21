# Documentation

## Quick Links

- **[Quick Reference](./QUICK-REFERENCE.md)** - Cheat sheet and common patterns
- **[Main README](../README.md)** - Getting started and API overview
- **[CHANGELOG](../CHANGELOG.md)** - Version history and changes
- **[CONTRIBUTING](../CONTRIBUTING.md)** - Development guide

## Feature Guides

Step-by-step guides for SDK features:

- [Edit Tracking](./guides/EDIT-TRACKING.md) - Track files modified by Claude
- [Non-Blocking Hooks](./guides/NON-BLOCKING-HOOKS.md) - Error handling that doesn't block Claude Code
- [Failure Queue](./guides/FAILURE-QUEUE.md) - Sequential event processing with retry
- [Repo Instance ID](./guides/REPO-INSTANCE-ID.md) - Track different checkouts of the same repo

## Reference Documentation

Technical details and advanced topics:

- [Schema Discoveries](./reference/SCHEMA_DISCOVERIES.md) - Undocumented Claude Code schema fields
- [Publication Checklist](./reference/PUBLICATION-CHECKLIST.md) - Pre-publication verification

## Release Notes

Version-specific documentation:

- [v0.4.1 Summary](./releases/v0.4.1-SUMMARY.md) - Latest release overview
- [v0.4.1 Bug Fixes](./releases/BUG-FIXES-v0.4.1.md) - Detailed bug fix documentation
- [v0.4.1 Verification](./releases/VERIFICATION.md) - Testing and verification results

## Scripts

Development and testing tools:

- [Scripts README](../scripts/README.md) - Schema analysis and testing tools
- [Trigger All Events](../scripts/trigger-all-events.md) - Event testing guide

## Examples

Working code examples:

- [Sample Extension](../sample-extension/) - Complete hook implementations
- [Event Logger v2](../sample-extension/event-logger-v2.ts) - Production-ready example

## Documentation Structure

```
docs/
├── README.md              ← You are here
├── guides/               ← Feature guides
│   ├── EDIT-TRACKING.md
│   ├── NON-BLOCKING-HOOKS.md
│   ├── FAILURE-QUEUE.md
│   └── REPO-INSTANCE-ID.md
├── reference/            ← Technical reference
│   ├── SCHEMA_DISCOVERIES.md
│   └── PUBLICATION-CHECKLIST.md
└── releases/             ← Version history
    ├── v0.4.1-SUMMARY.md
    ├── BUG-FIXES-v0.4.1.md
    └── VERIFICATION.md
```

## Finding What You Need

### "I want to..."

- **Get started** → [Main README](../README.md)
- **Track edited files** → [Edit Tracking Guide](./guides/EDIT-TRACKING.md)
- **Handle errors gracefully** → [Non-Blocking Hooks](./guides/NON-BLOCKING-HOOKS.md)
- **Implement retry logic** → [Failure Queue Guide](./guides/FAILURE-QUEUE.md)
- **Track different repo checkouts** → [Repo Instance ID](./guides/REPO-INSTANCE-ID.md)
- **See what's new** → [CHANGELOG](../CHANGELOG.md)
- **Understand schema issues** → [Schema Discoveries](./reference/SCHEMA_DISCOVERIES.md)
- **Publish the package** → [Publication Checklist](./reference/PUBLICATION-CHECKLIST.md)

### "I need examples of..."

- **Complete hook implementation** → [Event Logger v2](../sample-extension/event-logger-v2.ts)
- **All hook events** → [Sample Extension](../sample-extension/)
- **Testing hooks** → [Test Edit Tracking](../sample-extension/test-edit-tracking.ts)

### "I'm debugging..."

- **Schema mismatches** → [Schema Discoveries](./reference/SCHEMA_DISCOVERIES.md)
- **Hook failures** → [Non-Blocking Hooks](./guides/NON-BLOCKING-HOOKS.md)
- **Type errors** → [Main README](../README.md) TypeScript section

## Contributing

See [CONTRIBUTING.md](../CONTRIBUTING.md) for development setup and guidelines.

# Contributing to claude-hooks-sdk

Thank you for your interest in contributing! We welcome contributions from the community.

## Development Setup

1. Clone the repository
2. Install dependencies: `bun install`
3. Build: `bun run build`
4. Run tests: `bun test`

## Project Structure

```
claude-hooks-sdk/
├── src/
│   ├── index.ts        # Main exports
│   ├── manager.ts      # HookManager class
│   ├── types.ts        # Type definitions
│   ├── utils.ts        # Helper functions
│   └── transcript.ts   # Transcript utilities
├── examples/           # Example hooks
└── dist/              # Build output (generated)
```

## Making Changes

1. **Create a branch**: `git checkout -b feature/your-feature-name`
2. **Make changes**: Edit files in `src/`
3. **Build**: Run `bun run build` to ensure it compiles
4. **Test**: Add tests if applicable
5. **Commit**: Use clear, descriptive commit messages
6. **Push**: `git push origin feature/your-feature-name`
7. **PR**: Open a pull request with description of changes

## Coding Standards

- **TypeScript**: All code must be TypeScript
- **Types**: Export all public types
- **Documentation**: Add TSDoc comments for public APIs
- **Examples**: Add examples for new features

## Adding New Hook Events

If Claude Code adds new hook events:

1. Add event name to `HookEventName` in `types.ts`
2. Add input/output interfaces
3. Add handler method to `HookManager`
4. Update README with event documentation
5. Add example in `examples/`

## Testing

Currently manual testing via examples. Automated tests coming soon!

```bash
# Test basic hook
echo '{"hook_event_name":"SessionStart",...}' | bun examples/basic-hook.ts

# Test security validation
echo '{"hook_event_name":"PreToolUse",...}' | bun examples/security-validation.ts
```

## Release Process

1. Update version in `package.json`
2. Update CHANGELOG.md (coming soon)
3. Build: `bun run build`
4. Publish: `npm publish`

## Questions?

Open an issue or discussion on GitHub.

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

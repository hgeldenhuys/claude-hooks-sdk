# Claude Developers Discord Post

**🎣 Built a comprehensive TypeScript SDK for Claude Code Hooks**

I've been building with Claude Code for the past few weeks and wanted better observability and automation, so I created **claude-hooks-sdk** - a type-safe SDK for extending Claude Code with custom hooks.

**What it does:**
- Intercepts all 10 Claude Code hook events (SessionStart, ToolUse, Stop, etc.)
- Tracks conversation turns with automatic line numbers for fast transcript lookups
- Records full transaction context (user prompts → tool calls → file changes → todos → responses)
- Includes production-ready examples: custom backend integration, transaction logger with TUI viewer, and more

**How Claude Code helped:**
Claude Code built ~90% of this. I used it to:
- Design the TypeScript architecture and type system
- Implement transform utilities for conversation logging, file tracking, and todo monitoring
- Create comprehensive examples with beautiful terminal viewers
- Write all documentation and test suites
- Debug issues through iterative development

**Key Features:**
- 📊 Transaction Logger - "flight recorder" for conversations (tracks everything from prompt to response)
- 🔌 Custom Backend Example - posts events to HTTP server with real-time HTML dashboard
- ⚡ Line Numbers - blazing fast transcript lookups (0.002s vs 2.5s for UUID search)
- 🎨 Beautiful TUI viewers with color-coding
- 📦 Examples for every use case

**Free & Open Source:**
- npm: `claude-hooks-sdk` (v0.8.0)
- GitHub: https://github.com/hgeldenhuys/claude-hooks-sdk
- MIT License

The transaction logger example is particularly cool - it captures user prompts, all tool calls, file changes, todos, and the assistant response into a single JSON entry, then displays it in a beautiful terminal viewer with watch mode.

Would love feedback from anyone building with Claude Code! What hooks would be most useful for your workflow?

---

**Character count:** ~1,750 (well within Discord's 2,000 limit)

**Rules compliance:**
- ✅ Built with Claude Code
- ✅ Clear description + how Claude helped
- ✅ Free to try (npm install)
- ✅ Minimal promotional language
- ✅ No security disclaimer needed (library, not hosted service)
- ✅ No affiliate links
- ✅ No job seeking
- ✅ No personal info beyond GitHub username

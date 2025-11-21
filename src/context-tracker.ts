/**
 * Context Tracker
 * Tracks transaction IDs, prompt IDs, and session metadata across hook events
 */

import { execSync } from 'child_process';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import type { AnyHookInput } from './types';

/**
 * Enhanced event context with correlation IDs
 */
export interface EventContext {
  transactionId: string;        // Generated on SessionStart, persists until SessionEnd
  promptId?: string;            // Last prompt ID from UserPromptSubmit
  conversationId?: string;      // Conversation/session identifier
  parentSessionId?: string;     // Parent session ID (for subagent events)
  agentId?: string;             // Subagent ID (for subagent events)
  project_dir?: string;         // Claude Code project directory (CLAUDE_PROJECT_DIR)
  git?: GitMetadata;            // Git repository metadata
  editedFiles?: string[];       // Files edited between UserPromptSubmit and Stop (if trackEdits enabled)
}

/**
 * Git repository metadata
 */
export interface GitMetadata {
  user?: string;                // Git user name
  email?: string;               // Git user email
  repo?: string;                // Repository URL
  branch?: string;              // Current branch
  commit?: string;              // Current commit hash
  dirty?: boolean;              // Has uncommitted changes
  repoInstanceId?: string;      // Unique ID for this checkout/clone (persisted)
}

/**
 * Context Tracker Class
 * Manages transaction IDs and context across hook events
 */
export class ContextTracker {
  private contextFilePath: string;
  private context: EventContext | null = null;

  constructor(clientId: string, logDir?: string) {
    const baseDir = process.env.CLAUDE_PROJECT_DIR || process.cwd();
    const dir = logDir || join(baseDir, '.claude', 'hooks', clientId);
    this.contextFilePath = join(dir, 'context.json');
    this.loadContext();
  }

  /**
   * Load context from file
   */
  private loadContext(): void {
    if (existsSync(this.contextFilePath)) {
      try {
        const content = readFileSync(this.contextFilePath, 'utf-8');
        this.context = JSON.parse(content);
      } catch (error) {
        // Invalid context file, start fresh
        this.context = null;
      }
    }
  }

  /**
   * Save context to file
   */
  private saveContext(): void {
    if (this.context) {
      try {
        writeFileSync(this.contextFilePath, JSON.stringify(this.context, null, 2));
      } catch (error) {
        // Silently fail - context tracking shouldn't break hooks
      }
    }
  }

  /**
   * Generate a new transaction ID
   */
  private generateTransactionId(): string {
    return `tx_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
  }

  /**
   * Generate a unique repo instance ID
   * This ID persists for the lifetime of this checkout/clone
   */
  private generateRepoInstanceId(): string {
    return `repo_${Date.now()}_${Math.random().toString(36).slice(2, 15)}`;
  }

  /**
   * Get git metadata for the current directory
   */
  private getGitMetadata(cwd: string): GitMetadata | undefined {
    try {
      // Check if we're in a git repository (works in subdirectories too)
      const execGit = (cmd: string): string => {
        try {
          return execSync(`git ${cmd}`, { cwd, encoding: 'utf-8' }).trim();
        } catch {
          return '';
        }
      };

      // Test if git is available
      const isGitRepo = execGit('rev-parse --git-dir');
      if (!isGitRepo) {
        return undefined;
      }

      // Get or generate repoInstanceId (persisted in context)
      let repoInstanceId = this.context?.git?.repoInstanceId;
      if (!repoInstanceId) {
        repoInstanceId = this.generateRepoInstanceId();
      }

      return {
        user: execGit('config user.name') || undefined,
        email: execGit('config user.email') || undefined,
        repo: execGit('config --get remote.origin.url') || undefined,
        branch: execGit('rev-parse --abbrev-ref HEAD') || undefined,
        commit: execGit('rev-parse HEAD') || undefined,
        dirty: execGit('status --porcelain').length > 0,
        repoInstanceId,
      };
    } catch {
      return undefined;
    }
  }

  /**
   * Handle SessionStart event
   * Generates new transaction ID and collects git metadata
   */
  onSessionStart(input: AnyHookInput): EventContext {
    const transactionId = this.generateTransactionId();
    const project_dir = process.env.CLAUDE_PROJECT_DIR;

    // Try to get git metadata from CLAUDE_PROJECT_DIR first, fallback to cwd
    const gitDir = project_dir || input.cwd;
    const git = this.getGitMetadata(gitDir);

    this.context = {
      transactionId,
      conversationId: input.session_id,
      project_dir,
      git,
    };

    this.saveContext();
    return this.context;
  }

  /**
   * Handle SessionEnd event
   * Clears context
   */
  onSessionEnd(): void {
    this.context = null;
    try {
      if (existsSync(this.contextFilePath)) {
        writeFileSync(this.contextFilePath, '');
      }
    } catch {
      // Silently fail
    }
  }

  /**
   * Handle UserPromptSubmit event
   * Captures prompt ID (if available in event payload)
   * Falls back to generating a prompt ID from timestamp
   */
  onUserPromptSubmit(input: any): void {
    if (this.context) {
      // Use prompt_id if available, otherwise generate one
      this.context.promptId = input.prompt_id || `prompt_${Date.now()}`;
      this.saveContext();
    }
  }

  /**
   * Get current context with enrichment
   */
  getContext(input: AnyHookInput): EventContext {
    // Handle lifecycle events
    if (input.hook_event_name === 'SessionStart') {
      return this.onSessionStart(input);
    }

    if (input.hook_event_name === 'SessionEnd') {
      this.onSessionEnd();
    }

    if (input.hook_event_name === 'UserPromptSubmit') {
      this.onUserPromptSubmit(input);
    }

    // Handle SubagentStop - add parent session ID and agent ID
    if (input.hook_event_name === 'SubagentStop') {
      const project_dir = process.env.CLAUDE_PROJECT_DIR;
      const gitDir = project_dir || input.cwd;

      const baseContext = this.context || {
        transactionId: this.generateTransactionId(),
        conversationId: input.session_id,
        project_dir,
        git: this.getGitMetadata(gitDir),  // Use CLAUDE_PROJECT_DIR for git
      };

      return {
        ...baseContext,
        parentSessionId: input.session_id,  // Parent session ID
        agentId: (input as any).agent_id,    // Subagent ID
      };
    }

    // Handle Stop - add edited files if tracked
    if (input.hook_event_name === 'Stop') {
      const project_dir = process.env.CLAUDE_PROJECT_DIR;
      const gitDir = project_dir || input.cwd;

      const baseContext = this.context || {
        transactionId: this.generateTransactionId(),
        conversationId: input.session_id,
        project_dir,
        git: this.getGitMetadata(gitDir),  // Use CLAUDE_PROJECT_DIR for git
      };

      const editedFiles = (input as any)._editedFiles;
      if (editedFiles && editedFiles.length > 0) {
        return {
          ...baseContext,
          editedFiles,  // Add tracked edited files
        };
      }

      return baseContext;
    }

    // Return existing context or create minimal one
    if (!this.context) {
      // No session started yet, create minimal context
      const project_dir = process.env.CLAUDE_PROJECT_DIR;
      return {
        transactionId: this.generateTransactionId(),
        conversationId: input.session_id,
        project_dir,
      };
    }

    return { ...this.context };
  }

  /**
   * Enrich event with context
   * Returns a new object with context added
   */
  enrichEvent<T extends AnyHookInput>(event: T): T & { context: EventContext } {
    const context = this.getContext(event);
    return {
      ...event,
      context,
    };
  }
}

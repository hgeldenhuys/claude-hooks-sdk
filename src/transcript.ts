/**
 * Transcript Types and Utilities
 * Provides zero-dependency utilities for parsing Claude Code transcripts
 */

/**
 * Represents a single line from the Claude Code transcript
 */
export interface TranscriptLine {
  lineNumber: number;
  content: any;
  raw: string;
}

/**
 * Conversation line structure from transcript
 */
export interface ConversationLine {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: string;
  [key: string]: any;
}

/**
 * Get the last line from a transcript file content
 */
export function getLastTranscriptLine(content: string): ConversationLine | null {
  try {
    const lines = content.trim().split('\n');
    if (lines.length === 0) {
      return null;
    }

    const lastLine = lines[lines.length - 1];
    return JSON.parse(lastLine);
  } catch (error) {
    return null;
  }
}

/**
 * Parse transcript content into structured lines
 */
export function parseTranscript(content: string): TranscriptLine[] {
  const lines = content.trim().split('\n');
  return lines.map((raw, index) => {
    try {
      return {
        lineNumber: index + 1,
        content: JSON.parse(raw),
        raw,
      };
    } catch (error) {
      return {
        lineNumber: index + 1,
        content: null,
        raw,
      };
    }
  });
}

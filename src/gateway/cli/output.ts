/**
 * CLI output formatting utilities
 */

export interface OutputOptions {
  format: 'json' | 'text';
  quiet: boolean;
}

export function formatOutput(data: unknown, options: OutputOptions): string {
  if (options.format === 'json') {
    return JSON.stringify(data, null, 2);
  }
  return formatText(data);
}

function formatText(data: unknown): string {
  if (data === null || data === undefined) return '';
  if (typeof data === 'string') return data;
  if (typeof data !== 'object') return String(data);

  const obj = data as Record<string, unknown>;
  const lines: string[] = [];

  for (const [key, value] of Object.entries(obj)) {
    if (Array.isArray(value)) {
      lines.push(`${key}:`);
      for (const item of value) {
        if (typeof item === 'object' && item !== null) {
          lines.push(`  - ${JSON.stringify(item)}`);
        } else {
          lines.push(`  - ${item}`);
        }
      }
    } else if (typeof value === 'object' && value !== null) {
      lines.push(`${key}:`);
      lines.push(`  ${JSON.stringify(value)}`);
    } else {
      lines.push(`${key}: ${value}`);
    }
  }

  return lines.join('\n');
}

export function formatDiffText(diff: { additions: number; deletions: number; hunks?: Array<{ content: string }> }): string {
  const lines: string[] = [];
  lines.push(`--- a`);
  lines.push(`+++ b`);
  if (diff.hunks) {
    for (const hunk of diff.hunks) {
      lines.push(hunk.content);
    }
  }
  lines.push(`${diff.additions} additions, ${diff.deletions} deletions`);
  return lines.join('\n');
}

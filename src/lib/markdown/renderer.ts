/**
 * Markdown utility for EODH
 * 
 * Converts Markdown text to HTML for rendering with react-native-render-html.
 * Provides proper styling for headings, paragraphs, lists, blockquotes,
 * tables, code blocks, and other Markdown elements.
 */

/**
 * Convert Markdown text to HTML
 * Uses a simple parser for common Markdown syntax
 */
export function markdownToHtml(markdown: string): string {
  let html = markdown;

  // Escape HTML special characters first (but preserve Markdown syntax)
  html = html.replace(/&/g, '&amp;');
  html = html.replace(/</g, '&lt;');
  html = html.replace(/>/g, '&gt;');

  // Code blocks (```)
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
    const language = lang || 'code';
    return `<pre class="code-block"><code class="language-${language}">${code.trim()}</code></pre>`;
  });

  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>');

  // Headings
  html = html.replace(/^######\s+(.+)$/gm, '<h6>$1</h6>');
  html = html.replace(/^#####\s+(.+)$/gm, '<h5>$1</h5>');
  html = html.replace(/^####\s+(.+)$/gm, '<h4>$1</h4>');
  html = html.replace(/^###\s+(.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^##\s+(.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^#\s+(.+)$/gm, '<h1>$1</h1>');

  // Horizontal rules
  html = html.replace(/^(---|\*\*\*|___)$/gm, '<hr />');

  // Blockquotes
  html = html.replace(/^>\s+(.+)$/gm, '<blockquote>$1</blockquote>');

  // Images
  html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img alt="$1" src="$2" />');

  // Links
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

  // Bold and Italic
  html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
  html = html.replace(/__(.+?)__/g, '<strong><em>$1</em></strong>');
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/__(.+?)__/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
  html = html.replace(/_(.+?)_/g, '<em>$1</em>');

  // Strikethrough
  html = html.replace(/~~(.+?)~~/g, '<del>$1</del>');

  // Unordered lists
  html = html.replace(/^(\s*)[-*+]\s+(.+)$/gm, (_, indent, content) => {
    const level = indent.length / 2;
    return `<li data-level="${level}">${content}</li>`;
  });

  // Wrap consecutive <li> elements in <ul>
  html = html.replace(/((?:<li[^>]*>.*<\/li>\n?)+)/g, '<ul>$1</ul>');

  // Ordered lists
  html = html.replace(/^(\s*)\d+\.\s+(.+)$/gm, (_, indent, content) => {
    const level = indent.length / 2;
    return `<oli data-level="${level}">${content}</oli>`;
  });

  // Wrap consecutive <oli> elements in <ol>
  html = html.replace(/((?:<oli[^>]*>.*<\/oli>\n?)+)/g, (match) => {
    return match.replace(/<oli/g, '<li').replace(/<\/oli/g, '</li').replace(/((?:<li[^>]*>.*<\/li>\n?)+)/, '<ol>$1</ol>');
  });

  // Tables
  html = html.replace(/^(\|.+\|)\n(\|[-| :]+\|)\n((?:\|.+\|\n?)*)/gm, (_, header, separator, body) => {
    const headerCells = header.split('|').filter(c => c.trim()).map(c => `<th>${c.trim()}</th>`).join('');
    const rows = body.trim().split('\n').map(row => {
      const cells = row.split('|').filter(c => c.trim()).map(c => `<td>${c.trim()}</td>`).join('');
      return `<tr>${cells}</tr>`;
    }).join('');
    
    return `<table><thead><tr>${headerCells}</tr></thead><tbody>${rows}</tbody></table>`;
  });

  // Paragraphs - wrap remaining text blocks
  html = html.split('\n\n').map(block => {
    const trimmed = block.trim();
    if (!trimmed) return '';
    if (/^<(h[1-6]|ul|ol|li|blockquote|pre|table|hr|img|div)/.test(trimmed)) {
      return trimmed;
    }
    // Convert line breaks within paragraph
    const withBreaks = trimmed.replace(/\n/g, '<br />');
    return `<p>${withBreaks}</p>`;
  }).join('\n');

  return html;
}

/**
 * Extract plain text from Markdown
 * Removes all Markdown syntax for TTS and search
 */
export function markdownToPlainText(markdown: string): string {
  let text = markdown;

  // Remove code blocks
  text = text.replace(/```[\s\S]*?```/g, '');

  // Remove images but keep alt text
  text = text.replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1');

  // Remove links but keep text
  text = text.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');

  // Remove headings markers
  text = text.replace(/^#+\s+/gm, '');

  // Remove bold/italic markers
  text = text.replace(/[*_~]/g, '');

  // Remove blockquote markers
  text = text.replace(/^>\s*/gm, '');

  // Remove list markers
  text = text.replace(/^(\s*)[-*+]\s+/gm, '$1');
  text = text.replace(/^(\s*)\d+\.\s+/gm, '$1');

  // Remove horizontal rules
  text = text.replace(/^(---|\*\*\*|___)$/gm, '');

  // Remove HTML tags
  text = text.replace(/<[^>]+>/g, '');

  // Clean up whitespace
  text = text.replace(/\n{3,}/g, '\n\n');

  return text.trim();
}

/**
 * Extract chapters from Markdown based on headings
 */
export interface MarkdownChapter {
  id: string;
  title: string;
  level: number;
  content: string;
  startOffset: number;
  endOffset: number;
}

export function extractChapters(markdown: string): MarkdownChapter[] {
  const chapters: MarkdownChapter[] = [];
  const headingRegex = /^(#{1,3})\s+(.+)$/gm;
  
  const headings: { level: number; title: string; index: number }[] = [];
  
  let match;
  while ((match = headingRegex.exec(markdown)) !== null) {
    headings.push({
      level: match[1].length,
      title: match[2].trim(),
      index: match.index,
    });
  }

  if (headings.length === 0) {
    // Single chapter
    return [{
      id: 'chapter-0',
      title: 'Full Text',
      level: 0,
      content: markdown,
      startOffset: 0,
      endOffset: markdown.length,
    }];
  }

  headings.forEach((heading, index) => {
    const nextHeadingIndex = headings[index + 1]?.index ?? markdown.length;
    const content = markdown.slice(heading.index, nextHeadingIndex);
    
    chapters.push({
      id: `chapter-${index}`,
      title: heading.title,
      level: heading.level,
      content: content.trim(),
      startOffset: heading.index,
      endOffset: nextHeadingIndex,
    });
  });

  return chapters;
}

/**
 * Get HTML styles for react-native-render-html
 */
export const markdownHtmlStyles = {
  document: {
    fontSize: 16,
    color: '#1a1a1a',
    lineHeight: 1.6,
  },
  h1: {
    fontSize: 28,
    fontWeight: 'bold' as const,
    marginTop: 24,
    marginBottom: 12,
    color: '#080B2E',
  },
  h2: {
    fontSize: 24,
    fontWeight: 'bold' as const,
    marginTop: 20,
    marginBottom: 10,
    color: '#080B2E',
  },
  h3: {
    fontSize: 20,
    fontWeight: '600' as const,
    marginTop: 16,
    marginBottom: 8,
    color: '#080B2E',
  },
  h4: {
    fontSize: 18,
    fontWeight: '600' as const,
    marginTop: 14,
    marginBottom: 8,
    color: '#080B2E',
  },
  h5: {
    fontSize: 16,
    fontWeight: '600' as const,
    marginTop: 12,
    marginBottom: 6,
    color: '#080B2E',
  },
  h6: {
    fontSize: 14,
    fontWeight: '600' as const,
    marginTop: 10,
    marginBottom: 6,
    color: '#080B2E',
  },
  p: {
    fontSize: 16,
    lineHeight: 1.6,
    marginBottom: 12,
  },
  strong: {
    fontWeight: 'bold' as const,
  },
  em: {
    fontStyle: 'italic' as const,
  },
  a: {
    color: '#5415E8',
    textDecorationLine: 'underline' as const,
  },
  ul: {
    marginTop: 8,
    marginBottom: 12,
    marginLeft: 20,
  },
  ol: {
    marginTop: 8,
    marginBottom: 12,
    marginLeft: 20,
  },
  li: {
    fontSize: 16,
    lineHeight: 1.4,
    marginBottom: 4,
  },
  blockquote: {
    borderLeftWidth: 4,
    borderLeftColor: '#5415E8',
    paddingLeft: 16,
    marginVertical: 12,
    marginLeft: 0,
    marginRight: 0,
    fontStyle: 'italic' as const,
    color: '#555',
  },
  pre: {
    backgroundColor: '#f4f4f4',
    borderRadius: 8,
    padding: 12,
    marginVertical: 12,
    fontFamily: 'monospace' as const,
    fontSize: 13,
  },
  code: {
    fontFamily: 'monospace' as const,
    fontSize: 14,
    color: '#e83e8c',
  },
  table: {
    width: '100%',
    marginVertical: 12,
    borderCollapse: 'collapse' as const,
  },
  th: {
    fontWeight: 'bold' as const,
    borderBottomWidth: 2,
    borderBottomColor: '#ddd',
    padding: 8,
    textAlign: 'left' as const,
  },
  td: {
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    padding: 8,
  },
  img: {
    maxWidth: '100%',
    borderRadius: 8,
    marginVertical: 12,
  },
  hr: {
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
    marginVertical: 20,
  },
};

/**
 * Get dark theme HTML styles
 */
export const markdownHtmlStylesDark = {
  ...markdownHtmlStyles,
  document: {
    ...markdownHtmlStyles.document,
    color: '#e0e0e0',
  },
  h1: { ...markdownHtmlStyles.h1, color: '#FFFFFF' },
  h2: { ...markdownHtmlStyles.h2, color: '#FFFFFF' },
  h3: { ...markdownHtmlStyles.h3, color: '#FFFFFF' },
  h4: { ...markdownHtmlStyles.h4, color: '#FFFFFF' },
  h5: { ...markdownHtmlStyles.h5, color: '#FFFFFF' },
  h6: { ...markdownHtmlStyles.h6, color: '#FFFFFF' },
  a: { ...markdownHtmlStyles.a, color: '#812BFF' },
  blockquote: { ...markdownHtmlStyles.blockquote, borderLeftColor: '#812BFF', color: '#aaa' },
  pre: { ...markdownHtmlStyles.pre, backgroundColor: '#2a2a2a' },
  code: { ...markdownHtmlStyles.code, color: '#ff6b9d' },
  th: { ...markdownHtmlStyles.th, borderBottomColor: '#444' },
  td: { ...markdownHtmlStyles.td, borderBottomColor: '#333' },
  hr: { ...markdownHtmlStyles.hr, borderBottomColor: '#444' },
};

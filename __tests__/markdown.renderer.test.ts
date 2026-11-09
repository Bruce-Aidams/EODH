import {
  markdownToHtml,
  markdownToPlainText,
  extractChapters,
  MarkdownChapter,
} from '@/lib/markdown/renderer';

describe('Markdown Renderer', () => {
  describe('markdownToHtml', () => {
    it('converts headings to HTML', () => {
      const md = '# Heading 1\n\n## Heading 2\n\n### Heading 3';
      const html = markdownToHtml(md);
      expect(html).toContain('<h1>Heading 1</h1>');
      expect(html).toContain('<h2>Heading 2</h2>');
      expect(html).toContain('<h3>Heading 3</h3>');
    });

    it('converts bold text', () => {
      const md = 'This is **bold** text.';
      const html = markdownToHtml(md);
      expect(html).toContain('<strong>bold</strong>');
    });

    it('converts italic text', () => {
      const md = 'This is *italic* text.';
      const html = markdownToHtml(md);
      expect(html).toContain('<em>italic</em>');
    });

    it('converts bold and italic text', () => {
      const md = 'This is ***bold and italic*** text.';
      const html = markdownToHtml(md);
      expect(html).toContain('<strong><em>bold and italic</em></strong>');
    });

    it('converts links', () => {
      const md = '[Click here](https://example.com)';
      const html = markdownToHtml(md);
      expect(html).toContain('<a href="https://example.com">Click here</a>');
    });

    it('converts images', () => {
      const md = '![Alt text](https://example.com/image.png)';
      const html = markdownToHtml(md);
      expect(html).toContain('<img alt="Alt text" src="https://example.com/image.png" />');
    });

    it('converts unordered lists', () => {
      const md = '- Item 1\n- Item 2\n- Item 3';
      const html = markdownToHtml(md);
      expect(html).toContain('<ul>');
      expect(html).toContain('<li');
      expect(html).toContain('Item 1');
      expect(html).toContain('Item 2');
      expect(html).toContain('Item 3');
    });

    it('converts blockquotes', () => {
      const md = '> This is a quote';
      const html = markdownToHtml(md);
      expect(html).toContain('<blockquote>This is a quote</blockquote>');
    });

    it('converts blockquotes with paragraph break', () => {
      const md = 'Text before.\n\n> This is a quote\n\nText after.';
      const html = markdownToHtml(md);
      expect(html).toContain('<blockquote>This is a quote</blockquote>');
    });

    it('converts code blocks', () => {
      const md = '```javascript\nconst x = 1;\n```';
      const html = markdownToHtml(md);
      expect(html).toContain('<pre class="code-block">');
      expect(html).toContain('const x = 1;');
    });

    it('converts inline code', () => {
      const md = 'Use `code` here.';
      const html = markdownToHtml(md);
      expect(html).toContain('<code class="inline-code">code</code>');
    });

    it('converts horizontal rules', () => {
      const md = '---';
      const html = markdownToHtml(md);
      expect(html).toContain('<hr />');
    });

    it('converts strikethrough', () => {
      const md = '~~deleted~~';
      const html = markdownToHtml(md);
      expect(html).toContain('<del>deleted</del>');
    });

    it('wraps paragraphs', () => {
      const md = 'This is a paragraph.\n\nThis is another paragraph.';
      const html = markdownToHtml(md);
      expect(html).toContain('<p>');
      expect(html).toContain('This is a paragraph.');
      expect(html).toContain('This is another paragraph.');
    });

    it('escapes HTML special characters', () => {
      const md = 'Use <div> & "quotes"';
      const html = markdownToHtml(md);
      expect(html).toContain('&lt;div&gt;');
      expect(html).toContain('&amp;');
    });

    it('converts tables', () => {
      const md = '| Header 1 | Header 2 |\n|----------|----------|\n| Cell 1 | Cell 2 |';
      const html = markdownToHtml(md);
      expect(html).toContain('<table>');
      expect(html).toContain('<th>Header 1</th>');
      expect(html).toContain('<td>Cell 1</td>');
    });
  });

  describe('markdownToPlainText', () => {
    it('removes heading markers', () => {
      const md = '# Heading\n\n## Subheading';
      const text = markdownToPlainText(md);
      expect(text).not.toContain('#');
      expect(text).toContain('Heading');
      expect(text).toContain('Subheading');
    });

    it('removes bold and italic markers', () => {
      const md = '**bold** and *italic*';
      const text = markdownToPlainText(md);
      expect(text).toBe('bold and italic');
    });

    it('removes link syntax but keeps text', () => {
      const md = '[Link text](https://example.com)';
      const text = markdownToPlainText(md);
      expect(text).toBe('Link text');
    });

    it('removes image syntax but keeps alt text', () => {
      const md = '![Alt text](https://example.com/image.png)';
      const text = markdownToPlainText(md);
      expect(text).toBe('Alt text');
    });

    it('removes code blocks', () => {
      const md = 'Text before\n\n```\ncode block\n```\n\nText after';
      const text = markdownToPlainText(md);
      expect(text).not.toContain('code block');
      expect(text).toContain('Text before');
      expect(text).toContain('Text after');
    });

    it('removes list markers', () => {
      const md = '- Item 1\n- Item 2';
      const text = markdownToPlainText(md);
      expect(text).not.toContain('-');
      expect(text).toContain('Item 1');
      expect(text).toContain('Item 2');
    });

    it('removes blockquote markers', () => {
      const md = '> Quote text';
      const text = markdownToPlainText(md);
      expect(text).not.toContain('>');
      expect(text).toContain('Quote text');
    });

    it('removes horizontal rules', () => {
      const md = 'Text\n\n---\n\nMore text';
      const text = markdownToPlainText(md);
      expect(text).not.toContain('---');
    });

    it('cleans up whitespace', () => {
      const md = 'Paragraph 1\n\n\n\n\nParagraph 2';
      const text = markdownToPlainText(md);
      expect(text).toBe('Paragraph 1\n\nParagraph 2');
    });
  });

  describe('extractChapters', () => {
    it('extracts chapters from headings', () => {
      const md = '# Chapter 1\n\nContent of chapter 1.\n\n# Chapter 2\n\nContent of chapter 2.';
      const chapters = extractChapters(md);

      expect(chapters).toHaveLength(2);
      expect(chapters[0].title).toBe('Chapter 1');
      expect(chapters[0].level).toBe(1);
      expect(chapters[0].content).toContain('Content of chapter 1');
      expect(chapters[1].title).toBe('Chapter 2');
      expect(chapters[1].content).toContain('Content of chapter 2');
    });

    it('handles different heading levels', () => {
      const md = '## Section 1\n\nContent 1.\n\n### Subsection 1.1\n\nContent 1.1.';
      const chapters = extractChapters(md);

      expect(chapters).toHaveLength(2);
      expect(chapters[0].level).toBe(2);
      expect(chapters[1].level).toBe(3);
    });

    it('returns single chapter when no headings', () => {
      const md = 'This is plain text without headings.';
      const chapters = extractChapters(md);

      expect(chapters).toHaveLength(1);
      expect(chapters[0].title).toBe('Full Text');
      expect(chapters[0].level).toBe(0);
      expect(chapters[0].content).toBe(md);
    });

    it('assigns correct IDs to chapters', () => {
      const md = '# Chapter 1\n\nContent 1.\n\n# Chapter 2\n\nContent 2.';
      const chapters = extractChapters(md);

      expect(chapters[0].id).toBe('chapter-0');
      expect(chapters[1].id).toBe('chapter-1');
    });

    it('tracks start and end offsets', () => {
      const md = '# Chapter 1\n\nContent 1.';
      const chapters = extractChapters(md);

      expect(chapters[0].startOffset).toBe(0);
      expect(chapters[0].endOffset).toBe(md.length);
    });

    it('handles H3 headings', () => {
      const md = '### Section A\n\nContent A.\n\n### Section B\n\nContent B.';
      const chapters = extractChapters(md);

      expect(chapters).toHaveLength(2);
      expect(chapters[0].title).toBe('Section A');
      expect(chapters[1].title).toBe('Section B');
    });

    it('ignores H4+ headings', () => {
      const md = '#### Small heading\n\nContent.';
      const chapters = extractChapters(md);

      // H4 is ignored, so it returns a single "Full Text" chapter
      expect(chapters).toHaveLength(1);
      expect(chapters[0].title).toBe('Full Text');
    });
  });
});

import React from 'react';

function parseContent(text) {
  if (!text) return [];
  const lines = text.split('\n');
  const blocks = [];
  let inCodeBlock = false;
  let codeLines = [];
  let codeLang = '';

  for (const line of lines) {
    if (line.startsWith('```')) {
      if (inCodeBlock) {
        blocks.push({ type: 'code', lang: codeLang, content: codeLines.join('\n') });
        codeLines = [];
        codeLang = '';
        inCodeBlock = false;
      } else {
        inCodeBlock = true;
        codeLang = line.slice(3).trim();
      }
    } else if (inCodeBlock) {
      codeLines.push(line);
    } else if (line.startsWith('### ')) {
      blocks.push({ type: 'h3', content: line.slice(4) });
    } else if (line.startsWith('## ')) {
      blocks.push({ type: 'h2', content: line.slice(3) });
    } else if (line.startsWith('# ')) {
      blocks.push({ type: 'h1', content: line.slice(2) });
    } else if (line.startsWith('- ') || line.startsWith('* ')) {
      const last = blocks[blocks.length - 1];
      if (last && last.type === 'list') {
        last.items.push(line.slice(2));
      } else {
        blocks.push({ type: 'list', items: [line.slice(2)] });
      }
    } else if (/^\d+\.\s/.test(line)) {
      const last = blocks[blocks.length - 1];
      const text = line.replace(/^\d+\.\s/, '');
      if (last && last.type === 'olist') {
        last.items.push(text);
      } else {
        blocks.push({ type: 'olist', items: [text] });
      }
    } else if (line.startsWith('>')) {
      blocks.push({ type: 'quote', content: line.slice(1).trim() });
    } else if (line.trim() === '') {
      blocks.push({ type: 'spacer' });
    } else {
      blocks.push({ type: 'text', content: line });
    }
  }

  if (inCodeBlock && codeLines.length > 0) {
    blocks.push({ type: 'code', lang: codeLang, content: codeLines.join('\n') });
  }

  return blocks;
}

function renderInline(text) {
  if (!text) return text;
  let result = text;
  const parts = [];
  const regex = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*)/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(result)) !== null) {
    if (match.index > lastIndex) {
      parts.push(<span key={lastIndex}>{result.slice(lastIndex, match.index)}</span>);
    }
    const m = match[0];
    if (m.startsWith('`')) {
      parts.push(<code key={match.index} className="inline-code">{m.slice(1, -1)}</code>);
    } else if (m.startsWith('**')) {
      parts.push(<strong key={match.index}>{m.slice(2, -2)}</strong>);
    } else if (m.startsWith('*')) {
      parts.push(<em key={match.index}>{m.slice(1, -1)}</em>);
    }
    lastIndex = match.index + m.length;
  }

  if (lastIndex < result.length) {
    parts.push(<span key={lastIndex}>{result.slice(lastIndex)}</span>);
  }

  return parts.length > 0 ? parts : text;
}

export default function AIOutput({ content, isLoading }) {
  if (isLoading) {
    return (
      <div className="ai-output ai-loading">
        <div className="ai-loading-dots">
          <span className="dot"></span>
          <span className="dot"></span>
          <span className="dot"></span>
        </div>
        <p className="ai-loading-text">Generating response...</p>
      </div>
    );
  }

  if (!content) return null;

  if (typeof content === 'object') {
    return (
      <div className="ai-output">
        <div className="ai-response-card">
          {Object.entries(content).map(([key, value]) => (
            <div key={key} className="ai-field">
              <label className="ai-field-label">
                {key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase())}
              </label>
              <div className="ai-field-value">
                {typeof value === 'object' ? (
                  <pre className="ai-code-block">{JSON.stringify(value, null, 2)}</pre>
                ) : (
                  <p>{String(value)}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const blocks = parseContent(String(content));

  return (
    <div className="ai-output">
      <div className="ai-response-card">
        {blocks.map((block, i) => {
          switch (block.type) {
            case 'h1':
              return <h1 key={i} className="ai-h1">{renderInline(block.content)}</h1>;
            case 'h2':
              return <h2 key={i} className="ai-h2">{renderInline(block.content)}</h2>;
            case 'h3':
              return <h3 key={i} className="ai-h3">{renderInline(block.content)}</h3>;
            case 'code':
              return (
                <div key={i} className="ai-code-wrapper">
                  {block.lang && <span className="ai-code-lang">{block.lang}</span>}
                  <pre className="ai-code-block"><code>{block.content}</code></pre>
                </div>
              );
            case 'list':
              return (
                <ul key={i} className="ai-list">
                  {block.items.map((item, j) => (
                    <li key={j}>{renderInline(item)}</li>
                  ))}
                </ul>
              );
            case 'olist':
              return (
                <ol key={i} className="ai-list ai-olist">
                  {block.items.map((item, j) => (
                    <li key={j}>{renderInline(item)}</li>
                  ))}
                </ol>
              );
            case 'quote':
              return <blockquote key={i} className="ai-quote">{renderInline(block.content)}</blockquote>;
            case 'spacer':
              return <div key={i} className="ai-spacer" />;
            case 'text':
            default:
              return <p key={i} className="ai-text">{renderInline(block.content)}</p>;
          }
        })}
      </div>
    </div>
  );
}

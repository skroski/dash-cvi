import React, { ReactNode } from 'react';

interface FormattedMessageProps {
  content: string;
  className?: string;
  isDashboardSent?: boolean;
}

/**
 * Converte marcadores inline do WhatsApp (*negrito*, _itálico_, ~tachado~, `código`, links)
 * em elementos React formatados.
 */
function parseInlineWhatsApp(text: string, isDashboardSent?: boolean): ReactNode[] {
  if (!text) return [];

  // Regex para links (http/https/www)
  const urlRegex = /(https?:\/\/[^\s<]+|www\.[^\s<]+)/gi;
  const parts: ReactNode[] = [];
  let lastIndex = 0;
  let urlMatch: RegExpExecArray | null;

  // Processa formatadores inline em trechos de texto
  const processTextFormatting = (str: string, keyPrefix: string): ReactNode[] => {
    if (!str) return [];

    // Regex para sintaxe inline WhatsApp: `código`, *negrito*, _itálico_, ~tachado~
    const inlineRegex = /(`([^`\n]+)`)|\*([^\*\n]+)\*|_([^_\n]+)_|~([^~\n]+)~/g;
    const tokens: ReactNode[] = [];
    let currentIdx = 0;
    let match: RegExpExecArray | null;

    while ((match = inlineRegex.exec(str)) !== null) {
      if (match.index > currentIdx) {
        tokens.push(str.slice(currentIdx, match.index));
      }

      const key = `${keyPrefix}-${match.index}`;

      if (match[1]) {
        // `código inline`
        tokens.push(
          <code
            key={key}
            className={`rounded px-1.5 py-0.5 font-mono text-[0.85em] ${
              isDashboardSent
                ? 'bg-primary-foreground/20 text-primary-foreground font-semibold'
                : 'bg-muted text-foreground font-medium'
            }`}
          >
            {match[2]}
          </code>
        );
      } else if (match[3]) {
        // *negrito*
        tokens.push(
          <strong key={key} className="font-semibold">
            {processTextFormatting(match[3], `${key}-b`)}
          </strong>
        );
      } else if (match[4]) {
        // _itálico_
        tokens.push(
          <em key={key} className="italic">
            {processTextFormatting(match[4], `${key}-i`)}
          </em>
        );
      } else if (match[5]) {
        // ~tachado~
        tokens.push(
          <del key={key} className="line-through opacity-80">
            {processTextFormatting(match[5], `${key}-s`)}
          </del>
        );
      }

      currentIdx = inlineRegex.lastIndex;
    }

    if (currentIdx < str.length) {
      tokens.push(str.slice(currentIdx));
    }

    return tokens;
  };

  while ((urlMatch = urlRegex.exec(text)) !== null) {
    if (urlMatch.index > lastIndex) {
      parts.push(...processTextFormatting(text.slice(lastIndex, urlMatch.index), `txt-${lastIndex}`));
    }

    const url = urlMatch[0];
    const href = url.startsWith('www.') ? `https://${url}` : url;

    parts.push(
      <a
        key={`url-${urlMatch.index}`}
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={`break-all underline transition-opacity hover:opacity-80 ${
          isDashboardSent
            ? 'font-medium text-primary-foreground underline decoration-primary-foreground/60'
            : 'font-medium text-blue-600 dark:text-blue-400'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {url}
      </a>
    );

    lastIndex = urlRegex.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push(...processTextFormatting(text.slice(lastIndex), `txt-${lastIndex}`));
  }

  return parts;
}

/**
 * Processa linhas e blocos (blocos de código ``` ```, citação >, listas *, -, 1.)
 */
function parseBlockWhatsApp(text: string, isDashboardSent?: boolean): ReactNode {
  if (!text) return null;

  const codeBlockRegex = /```([\s\S]*?)```/g;
  const blocks: ReactNode[] = [];
  let lastIdx = 0;
  let codeMatch: RegExpExecArray | null;

  while ((codeMatch = codeBlockRegex.exec(text)) !== null) {
    if (codeMatch.index > lastIdx) {
      const textChunk = text.slice(lastIdx, codeMatch.index);
      blocks.push(
        <span key={`chunk-${lastIdx}`} className="contents">
          {parseLines(textChunk, `chunk-${lastIdx}`, isDashboardSent)}
        </span>
      );
    }

    const codeContent = codeMatch[1].trim();
    blocks.push(
      <pre
        key={`codeblock-${codeMatch.index}`}
        className={`my-1.5 overflow-x-auto rounded-md p-2.5 font-mono text-xs leading-relaxed ${
          isDashboardSent
            ? 'bg-black/20 text-primary-foreground'
            : 'bg-muted/80 text-foreground border border-border/50'
        }`}
      >
        <code>{codeContent}</code>
      </pre>
    );

    lastIdx = codeBlockRegex.lastIndex;
  }

  if (lastIdx < text.length) {
    blocks.push(
      <span key={`chunk-tail-${lastIdx}`} className="contents">
        {parseLines(text.slice(lastIdx), `chunk-${lastIdx}`, isDashboardSent)}
      </span>
    );
  }

  return <>{blocks}</>;
}

function parseLines(textChunk: string, keyPrefix: string, isDashboardSent?: boolean): ReactNode {
  const lines = textChunk.split('\n');
  const elements: ReactNode[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const key = `${keyPrefix}-line-${i}`;

    // Item de lista com marcador: "* texto", "- texto", "+ texto"
    const bulletMatch = line.match(/^[\*\-\+]\s+(.+)$/);
    if (bulletMatch) {
      elements.push(
        <div key={key} className="my-0.5 flex items-start gap-2 pl-1">
          <span className="select-none text-xs leading-relaxed opacity-70">•</span>
          <span className="flex-1">
            {parseInlineWhatsApp(bulletMatch[1], isDashboardSent)}
          </span>
        </div>
      );
      continue;
    }

    // Item de lista numerada: "1. texto"
    const numberMatch = line.match(/^(\d+)\.\s+(.+)$/);
    if (numberMatch) {
      elements.push(
        <div key={key} className="my-0.5 flex items-start gap-1.5 pl-1">
          <span className="select-none text-xs font-semibold tabular-nums leading-relaxed opacity-80">
            {numberMatch[1]}.
          </span>
          <span className="flex-1">
            {parseInlineWhatsApp(numberMatch[2], isDashboardSent)}
          </span>
        </div>
      );
      continue;
    }

    // Citação: "> texto"
    const quoteMatch = line.match(/^>\s*(.+)$/);
    if (quoteMatch) {
      elements.push(
        <blockquote
          key={key}
          className={`my-1 border-l-3 pl-2.5 py-0.5 italic text-sm ${
            isDashboardSent
              ? 'border-primary-foreground/60 text-primary-foreground/90'
              : 'border-primary/60 text-muted-foreground'
          }`}
        >
          {parseInlineWhatsApp(quoteMatch[1], isDashboardSent)}
        </blockquote>
      );
      continue;
    }

    // Linha normal
    elements.push(
      <span key={key} className="contents">
        {parseInlineWhatsApp(line, isDashboardSent)}
        {i < lines.length - 1 && <br />}
      </span>
    );
  }

  return <>{elements}</>;
}

/**
 * Converte elementos DOM do parser HTML em nós React estilizados de forma segura.
 */
function parseDomNode(node: Node, index: number, isDashboardSent?: boolean): ReactNode {
  if (node.nodeType === Node.TEXT_NODE) {
    const text = node.textContent || '';
    return parseBlockWhatsApp(text, isDashboardSent);
  }

  if (node.nodeType === Node.ELEMENT_NODE) {
    const el = node as HTMLElement;
    const tagName = el.tagName.toLowerCase();
    const key = `dom-${tagName}-${index}`;

    // Ignora scripts e elementos de risco de segurança
    if (['script', 'style', 'iframe', 'object', 'embed'].includes(tagName)) {
      return null;
    }

    const children = Array.from(el.childNodes).map((child, idx) =>
      parseDomNode(child, idx, isDashboardSent)
    );

    switch (tagName) {
      case 'br':
        return <br key={key} />;

      case 'p':
      case 'div':
        return (
          <div key={key} className="my-1 first:mt-0 last:mb-0">
            {children}
          </div>
        );

      case 'b':
      case 'strong':
        return (
          <strong key={key} className="font-semibold">
            {children}
          </strong>
        );

      case 'i':
      case 'em':
        return (
          <em key={key} className="italic">
            {children}
          </em>
        );

      case 's':
      case 'strike':
      case 'del':
        return (
          <del key={key} className="line-through opacity-80">
            {children}
          </del>
        );

      case 'code':
        return (
          <code
            key={key}
            className={`rounded px-1.5 py-0.5 font-mono text-[0.85em] ${
              isDashboardSent
                ? 'bg-primary-foreground/20 text-primary-foreground font-semibold'
                : 'bg-muted text-foreground font-medium'
            }`}
          >
            {children}
          </code>
        );

      case 'pre':
        return (
          <pre
            key={key}
            className={`my-1.5 overflow-x-auto rounded-md p-2.5 font-mono text-xs leading-relaxed ${
              isDashboardSent
                ? 'bg-black/20 text-primary-foreground'
                : 'bg-muted/80 text-foreground border border-border/50'
            }`}
          >
            <code>{children}</code>
          </pre>
        );

      case 'a': {
        const href = el.getAttribute('href') || '#';
        const targetHref = href.startsWith('www.') ? `https://${href}` : href;
        return (
          <a
            key={key}
            href={targetHref}
            target="_blank"
            rel="noopener noreferrer"
            className={`break-all underline transition-opacity hover:opacity-80 ${
              isDashboardSent
                ? 'font-medium text-primary-foreground underline decoration-primary-foreground/60'
                : 'font-medium text-blue-600 dark:text-blue-400'
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            {children.length > 0 ? children : href}
          </a>
        );
      }

      case 'ul':
        return (
          <ul key={key} className="my-1.5 list-disc pl-5 space-y-0.5">
            {children}
          </ul>
        );

      case 'ol':
        return (
          <ol key={key} className="my-1.5 list-decimal pl-5 space-y-0.5">
            {children}
          </ol>
        );

      case 'li':
        return (
          <li key={key} className="leading-relaxed">
            {children}
          </li>
        );

      case 'blockquote':
        return (
          <blockquote
            key={key}
            className={`my-1 border-l-3 pl-2.5 py-0.5 italic text-sm ${
              isDashboardSent
                ? 'border-primary-foreground/60 text-primary-foreground/90'
                : 'border-primary/60 text-muted-foreground'
            }`}
          >
            {children}
          </blockquote>
        );

      case 'h1':
      case 'h2':
      case 'h3':
      case 'h4':
      case 'h5':
      case 'h6':
        return (
          <div key={key} className="font-bold my-1 text-base leading-tight">
            {children}
          </div>
        );

      default:
        return <React.Fragment key={key}>{children}</React.Fragment>;
    }
  }

  return null;
}

export const FormattedMessage: React.FC<FormattedMessageProps> = ({
  content,
  className = '',
  isDashboardSent = false,
}) => {
  if (!content) return null;

  // Verifica se o texto contém tags HTML (<p>, <b>, <br>, <div>, <a>, etc.)
  const hasHtml = /<\/?[a-z][\s\S]*>/i.test(content);

  let renderedContent: ReactNode;

  if (hasHtml && typeof DOMParser !== 'undefined') {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(`<body>${content}</body>`, 'text/html');
      const nodes = Array.from(doc.body.childNodes);
      renderedContent = nodes.map((node, i) => parseDomNode(node, i, isDashboardSent));
    } catch {
      renderedContent = parseBlockWhatsApp(content, isDashboardSent);
    }
  } else {
    renderedContent = parseBlockWhatsApp(content, isDashboardSent);
  }

  return (
    <div className={`break-words text-left text-sm leading-relaxed ${className}`}>
      {renderedContent}
    </div>
  );
};

export default FormattedMessage;

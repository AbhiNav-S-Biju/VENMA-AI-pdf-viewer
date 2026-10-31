import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

type MarkdownContentProps = {
  content: string;
  className?: string;
};

const SAFE_URL_PATTERN = /^(?:https?:|mailto:)/i;

const components: Components = {
  a: ({ href, children, ...props }) => {
    if (!href || !SAFE_URL_PATTERN.test(href)) {
      return <span>{children}</span>;
    }

    return (
      <a
        {...props}
        href={href}
        target="_blank"
        rel="noreferrer noopener"
      >
        {children}
      </a>
    );
  },
  h1: ({ children }) => <h3>{children}</h3>,
  h2: ({ children }) => <h4>{children}</h4>,
  h3: ({ children }) => <h5>{children}</h5>,
  pre: ({ children }) => <pre className="markdown-content__code-block">{children}</pre>
};

export function MarkdownContent({ content, className }: MarkdownContentProps) {
  return (
    <div className={className ? `markdown-content ${className}` : "markdown-content"}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={components}
        urlTransform={(url) => (SAFE_URL_PATTERN.test(url) ? url : "")}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

import { forwardRef, isValidElement, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import { MermaidBlock } from "./MermaidBlock";
import { ExcalidrawEmbed } from "./ExcalidrawEmbed";
import { JsonCodeBlock } from "./JsonCodeBlock";
import type { ExcalidrawScene } from "../types";

type MarkdownPreviewProps = {
  markdown: string;
  currentFile: string | null;
  themeMode: "system" | "light" | "dark";
  onOpenExcalidraw: (path: string, scene: ExcalidrawScene | null) => void;
  onOpenWikiLink?: (name: string) => void;
};

function getCodeLanguage(className: string | undefined) {
  return /language-([\w-]+)/.exec(className ?? "")?.[1]?.toLowerCase() ?? null;
}

function getPreCodeLanguage(children: ReactNode) {
  if (!isValidElement<{ className?: string }>(children)) {
    return null;
  }

  return getCodeLanguage(children.props.className);
}

export const MarkdownPreview = forwardRef<HTMLDivElement, MarkdownPreviewProps>(function MarkdownPreview(
  { markdown, currentFile, themeMode, onOpenExcalidraw, onOpenWikiLink },
  ref,
) {
  const renderedMarkdown = markdown.replace(/\[\[([^\]]+)\]\]/g, (_match, rawName: string) => {
    const name = rawName.trim();
    return name ? `[[${name}]](hotaru-wiki://${encodeURIComponent(name)})` : _match;
  });

  return (
    <div className="preview-body" ref={ref}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw]}
        components={{
          a({ href, children, ...props }) {
            if (href?.startsWith("hotaru-wiki://")) {
              const name = decodeURIComponent(href.replace("hotaru-wiki://", ""));
              return (
                <button type="button" className="wiki-link" onClick={() => onOpenWikiLink?.(name)}>
                  {children}
                </button>
              );
            }

            return <a href={href} {...props}>{children}</a>;
          },
          pre({ children, ...props }) {
            const language = getPreCodeLanguage(children);
            if (language === "mermaid" || language === "json") {
              return <>{children}</>;
            }

            return <pre {...props}>{children}</pre>;
          },
          code({ className, children, ...props }) {
            const language = getCodeLanguage(className);
            const code = String(children).replace(/\n$/, "");

            if (language === "mermaid") {
              return <MermaidBlock source={code} themeMode={themeMode} />;
            }

            if (language === "json") {
              return <JsonCodeBlock source={code} />;
            }

            return (
              <code className={className} {...props}>
                {children}
              </code>
            );
          },
          img({ alt, src }) {
            if (typeof src === "string" && src.toLowerCase().endsWith(".excalidraw")) {
              return (
                <ExcalidrawEmbed
                  alt={alt ?? ""}
                  src={src}
                  currentFile={currentFile}
                  onOpen={onOpenExcalidraw}
                />
              );
            }

            return <img alt={alt ?? ""} src={src ?? ""} />;
          },
        }}
      >
        {renderedMarkdown}
      </ReactMarkdown>
    </div>
  );
});

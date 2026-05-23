import { forwardRef, isValidElement, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { MermaidBlock } from "./MermaidBlock";
import { ExcalidrawEmbed } from "./ExcalidrawEmbed";
import { JsonCodeBlock } from "./JsonCodeBlock";
import type { ExcalidrawScene } from "../types";

type MarkdownPreviewProps = {
  markdown: string;
  currentFile: string | null;
  themeMode: "system" | "light" | "dark";
  onOpenExcalidraw: (path: string, scene: ExcalidrawScene | null) => void;
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
  { markdown, currentFile, themeMode, onOpenExcalidraw },
  ref,
) {
  return (
    <div className="preview-body" ref={ref}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
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
        {markdown}
      </ReactMarkdown>
    </div>
  );
});

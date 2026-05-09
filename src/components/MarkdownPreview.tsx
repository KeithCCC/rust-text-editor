import { forwardRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { MermaidBlock } from "./MermaidBlock";
import { ExcalidrawEmbed } from "./ExcalidrawEmbed";
import { JsonCodeBlock } from "./JsonCodeBlock";
import type { ExcalidrawScene } from "../types";

type MarkdownPreviewProps = {
  markdown: string;
  currentFile: string | null;
  onOpenExcalidraw: (path: string, scene: ExcalidrawScene | null) => void;
};

export const MarkdownPreview = forwardRef<HTMLDivElement, MarkdownPreviewProps>(function MarkdownPreview(
  { markdown, currentFile, onOpenExcalidraw },
  ref,
) {
  return (
    <div className="preview-body" ref={ref}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code({ className, children, ...props }) {
            const match = /language-(\w+)/.exec(className ?? "");
            const code = String(children).replace(/\n$/, "");

            if (match?.[1] === "mermaid") {
              return <MermaidBlock source={code} />;
            }

            if (match?.[1] === "json") {
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

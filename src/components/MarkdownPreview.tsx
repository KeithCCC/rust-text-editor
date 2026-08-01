import { createElement, forwardRef, isValidElement, memo, type ComponentPropsWithoutRef, type ReactNode } from "react";
import ReactMarkdown, { type ExtraProps } from "react-markdown";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import { MermaidBlock } from "./MermaidBlock";
import { ExcalidrawEmbed } from "./ExcalidrawEmbed";
import { JsonCodeBlock } from "./JsonCodeBlock";
import { getRelativeMarkdownPath } from "../markdownLinks";
import { parseMarkdownOutline } from "../markdownOutline";
import type { ExcalidrawScene } from "../types";

type MarkdownPreviewProps = {
  markdown: string;
  currentFile: string | null;
  themeMode: "system" | "light" | "dark";
  onOpenExcalidraw: (path: string, scene: ExcalidrawScene | null) => void;
  onOpenRelativeMarkdownLink: (path: string) => void;
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

type PreviewHeadingProps = ComponentPropsWithoutRef<"h1"> & ExtraProps;

function createPreviewHeading(
  tag: "h1" | "h2" | "h3" | "h4" | "h5" | "h6",
  outlineIdsByOffset: ReadonlyMap<number, string>,
) {
  return function PreviewHeading({ node, children, ...props }: PreviewHeadingProps) {
    const offset = node?.position?.start.offset;
    const outlineId = typeof offset === "number" ? outlineIdsByOffset.get(offset) : undefined;
    return createElement(tag, { ...props, id: outlineId ?? props.id }, children);
  };
}

const MarkdownPreviewComponent = forwardRef<HTMLDivElement, MarkdownPreviewProps>(function MarkdownPreview(
  { markdown, currentFile, themeMode, onOpenExcalidraw, onOpenRelativeMarkdownLink },
  ref,
) {
  const outlineIdsByOffset = new Map(
    parseMarkdownOutline(markdown).map((heading) => [heading.offset, heading.id]),
  );

  return (
    <div className="preview-body" ref={ref}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkBreaks]}
        rehypePlugins={[rehypeRaw]}
        components={{
          h1: createPreviewHeading("h1", outlineIdsByOffset),
          h2: createPreviewHeading("h2", outlineIdsByOffset),
          h3: createPreviewHeading("h3", outlineIdsByOffset),
          h4: createPreviewHeading("h4", outlineIdsByOffset),
          h5: createPreviewHeading("h5", outlineIdsByOffset),
          h6: createPreviewHeading("h6", outlineIdsByOffset),
          a({ href, children, ...props }) {
            const relativeMarkdownPath = href ? getRelativeMarkdownPath(href) : null;
            if (relativeMarkdownPath) {
              return (
                <a
                  href={href}
                  {...props}
                  onClick={(event) => {
                    event.preventDefault();
                    onOpenRelativeMarkdownLink(relativeMarkdownPath);
                  }}
                >
                  {children}
                </a>
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
        {markdown}
      </ReactMarkdown>
    </div>
  );
});

export const MarkdownPreview = memo(MarkdownPreviewComponent);

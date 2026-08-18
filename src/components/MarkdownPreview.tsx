import {
  createElement,
  forwardRef,
  isValidElement,
  memo,
  useImperativeHandle,
  useMemo,
  useRef,
  type ComponentPropsWithoutRef,
  type ReactNode,
} from "react";
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
  onOpenExternalLink: (url: string) => void;
  onOpenRelativeMarkdownLink: (path: string) => void;
};

export type MarkdownPreviewHandle = {
  getScrollElement: () => HTMLDivElement | null;
  scrollToSourceOffset: (offset: number) => void;
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
  headingElementsByOffset: Map<number, HTMLHeadingElement>,
) {
  return function PreviewHeading({ node, children, ...props }: PreviewHeadingProps) {
    const offset = node?.position?.start.offset;
    const outlineId = typeof offset === "number" ? outlineIdsByOffset.get(offset) : undefined;
    const ref = outlineId === undefined || typeof offset !== "number"
      ? undefined
      : (element: HTMLHeadingElement | null) => {
        if (element) headingElementsByOffset.set(offset, element);
        else headingElementsByOffset.delete(offset);
      };
    return createElement(tag, { ...props, id: outlineId ?? props.id, ref }, children);
  };
}

const MarkdownPreviewComponent = forwardRef<MarkdownPreviewHandle, MarkdownPreviewProps>(function MarkdownPreview(
  { markdown, currentFile, themeMode, onOpenExcalidraw, onOpenExternalLink, onOpenRelativeMarkdownLink },
  ref,
) {
  const rootRef = useRef<HTMLDivElement>(null);
  const headingElementsByOffset = useRef(new Map<number, HTMLHeadingElement>());
  const outlineIdsByOffset = useMemo(() => new Map(
    parseMarkdownOutline(markdown).map((heading) => [heading.offset, heading.id]),
  ), [markdown]);
  const headingComponents = useMemo(() => ({
    h1: createPreviewHeading("h1", outlineIdsByOffset, headingElementsByOffset.current),
    h2: createPreviewHeading("h2", outlineIdsByOffset, headingElementsByOffset.current),
    h3: createPreviewHeading("h3", outlineIdsByOffset, headingElementsByOffset.current),
    h4: createPreviewHeading("h4", outlineIdsByOffset, headingElementsByOffset.current),
    h5: createPreviewHeading("h5", outlineIdsByOffset, headingElementsByOffset.current),
    h6: createPreviewHeading("h6", outlineIdsByOffset, headingElementsByOffset.current),
  }), [outlineIdsByOffset]);

  useImperativeHandle(ref, () => ({
    getScrollElement: () => rootRef.current,
    scrollToSourceOffset(offset) {
      const heading = headingElementsByOffset.current.get(offset);
      if (!heading || !rootRef.current?.contains(heading)) return;
      heading.scrollIntoView({ block: "start", behavior: "smooth" });
    },
  }), []);

  return (
    <div className="preview-body" ref={rootRef}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkBreaks]}
        rehypePlugins={[rehypeRaw]}
        components={{
          ...headingComponents,
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

            if (href && /^https?:\/\//i.test(href)) {
              return (
                <a
                  href={href}
                  {...props}
                  onClick={(event) => {
                    event.preventDefault();
                    onOpenExternalLink(href);
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

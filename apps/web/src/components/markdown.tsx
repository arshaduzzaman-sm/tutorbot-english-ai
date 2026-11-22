import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/** Renders lesson Markdown safely (raw HTML is not allowed). */
export function Markdown({ children }: { children: string }) {
  return (
    <div className="space-y-3 text-base leading-7 text-foreground [&_li]:ml-5 [&_li]:list-disc [&_strong]:text-primary [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:border-border [&_td]:px-3 [&_td]:py-1 [&_th]:border [&_th]:border-border [&_th]:bg-muted [&_th]:px-3 [&_th]:py-1 [&_th]:text-left">
      <ReactMarkdown remarkPlugins={[remarkGfm]} skipHtml>
        {children}
      </ReactMarkdown>
    </div>
  );
}

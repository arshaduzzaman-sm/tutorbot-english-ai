import { Markdown } from "@/components/markdown";
import { ChartImage, type ChartSpec } from "@/components/practice/chart-image";

export type TaskContent = {
  text?: string;
  passage?: string;
  prompt?: string;
  situation?: string;
  speakers?: string[];
  image?: ChartSpec;
};

/** What a speaking or writing task shows on screen (spoken prompts are played by AudioPlayer). */
export function PromptView({ content, showSituation = true }: { content: TaskContent; showSituation?: boolean }) {
  return (
    <div className="space-y-3">
      {content.text && <p className="rounded-xl bg-muted p-4 text-lg leading-relaxed" data-testid="read-text">{content.text}</p>}
      {content.passage && <div className="rounded-xl bg-muted p-4"><Markdown>{content.passage}</Markdown></div>}
      {content.prompt && <p className="rounded-xl bg-muted p-4 font-medium" data-testid="essay-prompt">{content.prompt}</p>}
      {content.situation && showSituation && <p className="rounded-xl bg-muted p-4">{content.situation}</p>}
      {content.speakers && <p className="text-sm text-muted-foreground">{content.speakers.join(" · ")}</p>}
      {content.image && <ChartImage chart={content.image} />}
    </div>
  );
}

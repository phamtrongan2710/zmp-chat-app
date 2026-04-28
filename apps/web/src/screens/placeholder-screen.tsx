import { Sparkles } from "lucide-react";

type Props = {
  title: string;
  subtitle?: string;
};

export function PlaceholderScreen({ title, subtitle }: Props) {
  return (
    <section className="screen">
      <header className="screen-header">
        <div className="screen-title">{title}</div>
      </header>
      <div className="empty-state">
        <Sparkles size={48} strokeWidth={1.5} className="empty-state-icon" />
        <div className="empty-state-title">{title}</div>
        <div className="empty-state-subtitle">{subtitle ?? "Coming soon."}</div>
      </div>
    </section>
  );
}

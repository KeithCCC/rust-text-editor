import type { FormattingAnnouncement } from "../formattingGuidance";

type FormattingFeedbackProps = {
  announcement: FormattingAnnouncement;
};

export function FormattingFeedback({ announcement }: FormattingFeedbackProps) {
  return (
    <span className="formatting-feedback" aria-live="polite" aria-atomic="true">
      {announcement.message && (
        <span key={announcement.id} data-formatting-announcement={announcement.id}>
          {announcement.message}
        </span>
      )}
    </span>
  );
}

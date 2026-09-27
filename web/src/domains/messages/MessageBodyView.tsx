import { isHtmlMessage, splitMessageLinks } from "@/domains/messages/messageBody";

interface MessageBodyViewProps {
  body: string;
  metadata: Readonly<Record<string, unknown>> | null | undefined;
  className?: string;
}

/**
 * A message's text: staff HTML as stored, or plain text with http(s) links.
 *
 * Staff HTML is sanitised by the API before it is saved. This view does not
 * sanitise again — `web/` has no HTML sanitiser dependency.
 */
export function MessageBodyView({ body, metadata, className = "" }: MessageBodyViewProps) {
  if (isHtmlMessage(metadata)) {
    return <div className={`message-prose break-words ${className}`.trim()} dangerouslySetInnerHTML={{ __html: body }} />;
  }

  const segments = splitMessageLinks(body);
  return (
    <p className={className}>
      {segments.map((segment, index) =>
        segment.kind === "url" ? (
          <a
            key={`url-${index}`}
            href={segment.value}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-primary underline underline-offset-2 hover:text-primary/80"
          >
            {segment.value}
          </a>
        ) : (
          <span key={`text-${index}`}>{segment.value}</span>
        ),
      )}
    </p>
  );
}

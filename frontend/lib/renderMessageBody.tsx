import type { ReactNode } from "react";
import { LinkifyMessageBody } from "@/lib/linkifyMessageBody";

type MessageMetadata = Record<string, unknown> | null | undefined;

export function isHtmlMessage(metadata: MessageMetadata): boolean {
  return metadata?.format === "html";
}

type MessageBodyProps = {
  body: string;
  metadata?: MessageMetadata;
  className?: string;
  linkClassName?: string;
};

/** Renders chat/support message body as sanitized HTML or plain text with linkify. */
export function MessageBody({ body, metadata, className = "", linkClassName }: MessageBodyProps) {
  if (isHtmlMessage(metadata)) {
    const html = body || "";
    return (
      <div
        className={`message-prose break-words ${className}`.trim()}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  }

  return (
    <LinkifyMessageBody body={body} className={className} linkClassName={linkClassName} />
  );
}

export function messageBodyNodes(
  body: string,
  metadata: MessageMetadata,
  className?: string,
): ReactNode {
  return <MessageBody body={body} metadata={metadata} className={className} />;
}

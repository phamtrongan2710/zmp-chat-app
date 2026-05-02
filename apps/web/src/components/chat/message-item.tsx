import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Message, User } from "../../store/chat-store";
import { Avatar } from "./avatar";

type MessageItemProps = {
  message: Message;
  isSelf: boolean;
  isSelected: boolean;
  peer?: User;
  onSelect: (messageId: string) => void;
};

function formatMessageTime(createdAt: string) {
  return new Date(createdAt).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function MessageItem({ message, isSelf, isSelected, peer, onSelect }: MessageItemProps) {
  const handleSelect = () => onSelect(message.id);

  return (
    <div data-message-id={message.id} className={`message-row ${isSelf ? "self" : ""} ${isSelected ? "selected" : ""}`}>
      {!isSelf ? (
        <Avatar url={peer?.avatarUrl ?? null} label={peer?.avatarLabel ?? "?"} className="message-avatar" />
      ) : null}
      <div
        className="message-bubble interactive"
        onClick={(event) => {
          event.stopPropagation();
          handleSelect();
        }}
      >
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {message.content}
        </ReactMarkdown>
        <div className="message-meta">
          {formatMessageTime(message.createdAt)}
          {isSelf && isSelected ? ` | ${message.status}` : ""}
        </div>
      </div>
    </div>
  );
}

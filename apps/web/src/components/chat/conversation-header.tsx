import { ChevronLeft } from "lucide-react";
import type { Chat, User } from "../../store/chat-store";
import { Avatar } from "./avatar";

type ConversationHeaderProps = {
  title: string;
  onBack: () => void;
  peer?: User;
  status?: string;
};

export function ConversationHeader({ title, onBack, peer, status }: ConversationHeaderProps) {
  return (
    <header className="conversation-header-bar">
      <button type="button" className="icon-button" aria-label="Back" onClick={onBack}>
        <ChevronLeft size={24} strokeWidth={2.5} />
      </button>
      {peer ? (
        <div className="conversation-header-peer">
          <div className="conversation-header-avatar">
            <Avatar url={peer.avatarUrl ?? null} label={peer.avatarLabel ?? "?"} className="header-avatar" />
            {peer.online ? <span className="presence-dot online" aria-label="online" /> : null}
          </div>
          <div className="conversation-header-text">
            <div className="conversation-header-name">{peer.name}</div>
            <div className="conversation-header-status">{status}</div>
          </div>
        </div>
      ) : (
        <div className="conversation-header-title">{title}</div>
      )}
    </header>
  );
}

export function getConversationPeer(chat: Chat, selfUserId: string | null) {
  return chat.participants.find((participant) => participant.id !== selfUserId);
}

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useChatStore } from "../../store/chat-store";
import { Avatar } from "./avatar";
import { MessageItem } from "./message-item";

export function ConversationView() {
  const selfUserId = useChatStore((state) => state.selfUserId);
  const activeChatId = useChatStore((state) => state.activeChatId);
  const typingByChat = useChatStore((state) => state.typingByChat);
  const chat = useChatStore((state) => state.chats.find((item) => item.id === activeChatId));
  const isLoadingOlder = useChatStore(
    (state) => (activeChatId ? state.isLoadingOlderByChat[activeChatId] ?? false : false),
  );
  const loadOlderMessages = useChatStore((state) => state.loadOlderMessages);

  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
  const messagesRef = useRef<HTMLElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const oldestMessageIdRef = useRef<string | null>(null);
  const newestMessageIdRef = useRef<string | null>(null);
  const peerIsTypingRef = useRef<boolean>(false);
  const scrollAnchorRef = useRef<{ messageId: string; offsetFromTop: number } | null>(null);

  const scrollMessagesToBottom = () => {
    const container = messagesRef.current;
    if (!container) return;
    container.scrollTop = container.scrollHeight;
  };

  const oldestMessageId = chat?.messages[0]?.id ?? null;
  const newestMessageId = chat?.messages[chat.messages.length - 1]?.id ?? null;
  const messageCount = chat?.messages.length ?? 0;
  const chatHasMore = chat?.hasMore ?? false;

  const peerForTyping = chat?.participants.find((participant) => participant.id !== selfUserId);
  const peerIsTyping = peerForTyping
    ? (typingByChat[activeChatId] ?? []).includes(peerForTyping.id)
    : false;

  // Capture scroll anchor *before* the DOM updates with prepended older messages.
  if (
    oldestMessageIdRef.current &&
    oldestMessageId &&
    oldestMessageIdRef.current !== oldestMessageId &&
    messagesRef.current
  ) {
    const container = messagesRef.current;
    const anchorEl = container.querySelector<HTMLElement>(
      `[data-message-id="${oldestMessageIdRef.current}"]`,
    );
    if (anchorEl) {
      scrollAnchorRef.current = {
        messageId: oldestMessageIdRef.current,
        offsetFromTop: anchorEl.offsetTop - container.scrollTop,
      };
    }
  }

  useLayoutEffect(() => {
    const container = messagesRef.current;
    if (!container) {
      oldestMessageIdRef.current = oldestMessageId;
      newestMessageIdRef.current = newestMessageId;
      peerIsTypingRef.current = peerIsTyping;
      return;
    }

    const anchor = scrollAnchorRef.current;
    if (anchor) {
      const anchorEl = container.querySelector<HTMLElement>(`[data-message-id="${anchor.messageId}"]`);
      if (anchorEl) {
        container.scrollTop = anchorEl.offsetTop - anchor.offsetFromTop;
      }
      scrollAnchorRef.current = null;
    } else {
      const newestChanged = newestMessageIdRef.current !== newestMessageId;
      const typingChanged = peerIsTypingRef.current !== peerIsTyping;
      if (newestChanged || typingChanged) {
        scrollMessagesToBottom();
      }
    }

    oldestMessageIdRef.current = oldestMessageId;
    newestMessageIdRef.current = newestMessageId;
    peerIsTypingRef.current = peerIsTyping;
  }, [oldestMessageId, newestMessageId, peerIsTyping]);

  // Reset anchor and snap to bottom when switching chats.
  useLayoutEffect(() => {
    scrollAnchorRef.current = null;
    setSelectedMessageId(null);
    scrollMessagesToBottom();
  }, [activeChatId]);

  // Scroll to bottom when the virtual keyboard resizes the visual viewport.
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const scrollToBottom = () => scrollMessagesToBottom();
    vv.addEventListener("resize", scrollToBottom);
    return () => vv.removeEventListener("resize", scrollToBottom);
  }, []);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    const container = messagesRef.current;
    if (!sentinel || !container || !activeChatId || !chatHasMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          void loadOlderMessages(activeChatId);
        }
      },
      { root: container, rootMargin: "200px 0px 0px 0px" },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [activeChatId, chatHasMore, loadOlderMessages, messageCount]);

  if (!chat) {
    return null;
  }

  const peer = chat.participants.find((participant) => participant.id !== selfUserId);

  return (
    <>
      <section className="messages" ref={messagesRef} onClick={() => setSelectedMessageId(null)}>
        {chat.hasMore ? <div ref={sentinelRef} className="messages-sentinel" aria-hidden="true" /> : null}
        {isLoadingOlder ? <div className="messages-loading muted">Loading older messages...</div> : null}
        {chat.messages.map((message) => (
          <MessageItem
            key={message.id}
            message={message}
            isSelf={message.senderId === selfUserId}
            isSelected={selectedMessageId === message.id}
            peer={peer}
            onSelect={(messageId) =>
              setSelectedMessageId((currentMessageId) =>
                currentMessageId === messageId ? null : messageId,
              )
            }
          />
        ))}
        {peerIsTyping ? (
          <div className="message-row">
            <Avatar url={peer?.avatarUrl ?? null} label={peer?.avatarLabel ?? "?"} className="message-avatar" />
            <div className="message-bubble typing-bubble" aria-label={`${peer?.name ?? "Peer"} is typing`}>
              <div className="typing-placeholder" aria-hidden="true">
                <span className="typing-dot" />
                <span className="typing-dot" />
                <span className="typing-dot" />
              </div>
            </div>
          </div>
        ) : null}
        <div ref={bottomRef} aria-hidden="true" />
      </section>
    </>
  );
}

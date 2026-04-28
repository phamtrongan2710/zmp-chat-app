import { FormEvent, useEffect, useState } from "react";
import { useChatStore } from "../../store/chat-store";

export function Composer() {
  const [content, setContent] = useState("");
  const sendMessage = useChatStore((state) => state.sendMessage);
  const sendTyping = useChatStore((state) => state.sendTyping);

  useEffect(() => {
    return () => {
      sendTyping(false);
    };
  }, [sendTyping]);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const draft = content;
    setContent("");
    sendTyping(false);
    await sendMessage(draft);
  };

  return (
    <form className="composer" onSubmit={onSubmit}>
      <input
        className="composer-input"
        placeholder="Write a message"
        value={content}
        onChange={(event) => {
          const nextValue = event.target.value;
          setContent(nextValue);
          sendTyping(nextValue.trim().length > 0);
        }}
      />
      <button className="primary-button" type="submit">
        Send
      </button>
    </form>
  );
}

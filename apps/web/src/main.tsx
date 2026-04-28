import React from "react";
import ReactDOM from "react-dom/client";
import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import { App } from "./App";
import { ChatListScreen } from "./screens/chat-list-screen";
import { ConversationScreen } from "./screens/conversation-screen";
import { MobileLayout } from "./screens/mobile-layout";
import { PlaceholderScreen } from "./screens/placeholder-screen";
import { ProfileScreen } from "./screens/profile-screen";
import { NewChatScreen } from "./screens/new-chat-screen";
// @ts-ignore
import "./styles.css";

ReactDOM.createRoot(document.getElementById("app")!).render(
  <React.StrictMode>
    <HashRouter>
      <App>
        <Routes>
          <Route element={<MobileLayout />}>
            <Route index element={<ChatListScreen />} />
            <Route path="stats" element={<PlaceholderScreen title="Statistics" subtitle="Coming soon." />} />
            <Route path="discover" element={<PlaceholderScreen title="Discover" subtitle="Coming soon." />} />
            <Route path="tasks" element={<PlaceholderScreen title="Tasks" subtitle="Coming soon." />} />
            <Route path="profile" element={<ProfileScreen />} />
          </Route>
          <Route path="chats/:chatId" element={<ConversationScreen />} />
          <Route path="new-chat" element={<NewChatScreen />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </App>
    </HashRouter>
  </React.StrictMode>,
);

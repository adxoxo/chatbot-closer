import { useCallback, useRef, useState } from "react";
import { sendChat } from "../lib/api";
import type { ChatResponse, LeadState, Message, Signals } from "../lib/types";

export interface StateEvent {
  state: LeadState;
  at: string;
}

export interface ChatState {
  messages: Message[];
  sending: boolean;
  conversationId: string | null;
  state: LeadState;
  score: number;
  signals: Signals | null;
  calendlyUrl: string | null;
  captureEmail: boolean;
  history: StateEvent[];
  error: string | null;
}

const EMPTY_SIGNALS = null;

export function useChat(tenantId: string, isTest = false) {
  const [state, setState] = useState<ChatState>({
    messages: [],
    sending: false,
    conversationId: null,
    state: "GREETING",
    score: 0,
    signals: EMPTY_SIGNALS,
    calendlyUrl: null,
    captureEmail: false,
    history: [{ state: "GREETING", at: nowTime() }],
    error: null,
  });
  const convRef = useRef<string | null>(null);

  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || state.sending) return;

      const userMsg: Message = {
        id: `local-${Date.now()}`,
        conversation_id: convRef.current || "",
        role: "user",
        content: trimmed,
        created_at: new Date().toISOString(),
      };
      setState((s) => ({
        ...s,
        messages: [...s.messages, userMsg],
        sending: true,
        error: null,
      }));

      try {
        const res: ChatResponse = await sendChat({
          tenant_id: tenantId,
          conversation_id: convRef.current,
          message: trimmed,
          is_test: isTest,
        });
        convRef.current = res.conversation_id;
        const botMsg: Message = {
          id: `bot-${Date.now()}`,
          conversation_id: res.conversation_id,
          role: "assistant",
          content: res.reply,
          created_at: new Date().toISOString(),
        };
        setState((s) => {
          const transitioned = s.state !== res.state;
          return {
            ...s,
            messages: [...s.messages, botMsg],
            sending: false,
            conversationId: res.conversation_id,
            state: res.state,
            score: res.score,
            signals: res.signals,
            calendlyUrl: res.calendly_url,
            captureEmail: res.capture_email,
            history: transitioned
              ? [...s.history, { state: res.state, at: nowTime() }]
              : s.history,
          };
        });
      } catch (e: any) {
        setState((s) => ({
          ...s,
          sending: false,
          error:
            e?.response?.data?.detail ||
            "Couldn't reach the assistant. Is the backend running?",
        }));
      }
    },
    [tenantId, isTest, state.sending]
  );

  const reset = useCallback(() => {
    convRef.current = null;
    setState({
      messages: [],
      sending: false,
      conversationId: null,
      state: "GREETING",
      score: 0,
      signals: EMPTY_SIGNALS,
      calendlyUrl: null,
      captureEmail: false,
      history: [{ state: "GREETING", at: nowTime() }],
      error: null,
    });
  }, []);

  return { state, send, reset };
}

export function nowTime(): string {
  return new Date().toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

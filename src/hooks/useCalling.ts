import { useCallingContext } from "../contexts/CallingContext";
import type { CallType, Profile } from "../types/database";

export function useCalling(conversationId?: string) {
  const context = useCallingContext();

  const startCall = async (type: CallType = "voice", targetUser?: Profile) => {
    if (!conversationId) return;
    await context.startCall(conversationId, type, targetUser);
  };

  return {
    ...context,
    startCall,
  };
}

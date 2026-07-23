import { useAuth } from "../contexts/AuthContext";
import { Clock, LogOut } from "lucide-react";

export function AwaitingApprovalPage() {
  const { signOut } = useAuth();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#12181A] text-white p-4">
      <div className="w-full max-w-md bg-[#1B2326] rounded-2xl shadow-xl p-8 border border-[#2A3438] text-center">
        <div className="mx-auto w-16 h-16 bg-[#1E88C7]/20 rounded-full flex items-center justify-center mb-6">
          <Clock className="w-8 h-8 text-[#1E88C7]" />
        </div>
        
        <h1 className="text-2xl font-bold mb-4 tracking-tight">Awaiting Approval</h1>
        <p className="text-zinc-400 mb-8 leading-relaxed">
          Your account has been created successfully, but it requires administrator approval before you can access Varta. 
          You will receive an email once your account is activated.
        </p>

        <button
          onClick={signOut}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-zinc-800 py-3 font-semibold text-white hover:bg-zinc-700 transition-colors"
        >
          <LogOut size={18} />
          Sign Out
        </button>
      </div>
    </div>
  );
}

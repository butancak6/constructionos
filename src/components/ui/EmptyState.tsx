import { Users } from "lucide-react";

export default function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
        <Users className="text-slate-300" size={32} />
      </div>
      <p className="text-slate-500 font-medium">{message}</p>
    </div>
  );
}

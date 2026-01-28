
import { useState, useEffect } from "react";
import { Save } from "lucide-react";

export default function Settings() {
    const [webhookUrl, setWebhookUrl] = useState("");
    const [msg, setMsg] = useState("");

    useEffect(() => {
        const saved = localStorage.getItem("webhook_url");
        if (saved) setWebhookUrl(saved);
    }, []);

    const saveSettings = () => {
        localStorage.setItem("webhook_url", webhookUrl);
        setMsg("Saved!");
        setTimeout(() => setMsg(""), 2000);
    };

    return (
        <div className="space-y-6">
            <h2 className="text-xl font-bold text-slate-900 mb-4">Settings</h2>

            {/* Integrations Section */}
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
                <h3 className="text-md font-bold text-slate-900 mb-3">Integrations</h3>

                <div className="mb-4">
                    <label className="text-xs font-bold text-slate-500 uppercase block mb-2">Smart Sync Webhook URL</label>
                    <input
                        type="url"
                        value={webhookUrl}
                        onChange={(e) => setWebhookUrl(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm text-slate-900 font-medium outline-none focus:border-primary/50 transition-colors"
                        placeholder="e.g., https://hooks.zapier.com/..."
                    />
                    <p className="text-[10px] text-slate-400 mt-2 leading-relaxed">
                        Paste a webhook URL here. We will send a JSON copy of every invoice to this address automatically.
                    </p>
                </div>

                <button
                    onClick={saveSettings}
                    className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-xl text-xs font-bold shadow-lg shadow-blue-500/30 hover:bg-blue-600 transition-colors"
                >
                    <Save size={16} />
                    <span>Save Integration</span>
                </button>

                {msg && <span className="ml-3 text-xs font-bold text-emerald-600 animate-in fade-in">{msg}</span>}
            </div>

            <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 opacity-60">
                <h3 className="text-md font-bold text-slate-900 mb-2">Account</h3>
                <p className="text-xs text-slate-400">Signed in as Jason Park</p>
            </div>
        </div>
    );
}

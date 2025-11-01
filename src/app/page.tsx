"use client";
import { useEffect, useState } from "react";
import QRScanner from "../components/QRScanner";
import { verifyBatch, verifyByHash, getSigner, getNetwork } from "@/utils/contract";

type BatchPayload = {
  batchNumber: string;
  manufacturer: string;
  productionDate: number; // unix timestamp (seconds)
};

export default function Home() {
  const [mode, setMode] = useState<"scan" | "manual">("scan");
  const [form, setForm] = useState<BatchPayload>({
    batchNumber: "",
    manufacturer: "",
    productionDate: 0,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);
  const [connected, setConnected] = useState(false);
  const [network, setNetwork] = useState<{ name?: string; chainId?: number } | null>(null);

  useEffect(() => {
    // Try pre-detect network if wallet is injected
    (async () => {
      try {
        const net = await getNetwork();
        setNetwork({ name: net.name, chainId: Number(net.chainId) });
      } catch {
        // ignore when wallet not available
      }
    })();
  }, []);

  const handleScan = async (text: string) => {
    try {
      const trimmed = text.trim();
      if (/^0x[a-fA-F0-9]{64}$/.test(trimmed)) {
        await doVerifyByHash(trimmed);
        return;
      }
      const parsed: BatchPayload = JSON.parse(text);
      await doVerify(parsed);
    } catch (e: any) {
      setError("Invalid QR payload. Expected batch hash or JSON with batchNumber, manufacturer, productionDate.");
    }
  };

  const doVerify = async (payload: BatchPayload) => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const data = await verifyBatch(
        payload.batchNumber,
        payload.manufacturer,
        payload.productionDate
      );
      setResult(data);
    } catch (e: any) {
      setError(e?.message ?? "Verification failed");
    } finally {
      setLoading(false);
    }
  };

  const doVerifyByHash = async (batchIdHash: string) => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const data = await verifyByHash(batchIdHash);
      setResult(data);
    } catch (e: any) {
      setError(e?.message ?? "Verification failed");
    } finally {
      setLoading(false);
    }
  };

  const connectWallet = async () => {
    try {
      setError(null);
      await getSigner();
      setConnected(true);
      const net = await getNetwork();
      setNetwork({ name: net.name, chainId: Number(net.chainId) });
    } catch (e: any) {
      setError(e?.message ?? "Wallet connection failed");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#f6f7fb] via-white to-[#eef6ff] dark:from-[#0b0b0e] dark:via-[#0f1115] dark:to-[#0b0b0e]">
      <main className="mx-auto max-w-5xl px-6 py-12">
        {/* Hero header */}
        <div className="relative overflow-hidden rounded-3xl border border-zinc-200/60 bg-white/80 shadow-xl backdrop-blur dark:border-zinc-800/60 dark:bg-zinc-900/60 animate-fade-in">
          <div className="pointer-events-none absolute -top-24 -left-24 h-64 w-64 rounded-full bg-gradient-to-br from-indigo-200/40 to-cyan-200/40 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-20 -right-20 h-52 w-52 rounded-full bg-gradient-to-br from-cyan-200/40 to-indigo-200/40 blur-2xl" />
          <div className="px-6 py-10 sm:px-10 sm:py-12">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-cyan-500 text-white shadow-sm animate-float">
                🔐
              </div>
              <h1 className="text-3xl sm:text-4xl font-semibold bg-gradient-to-r from-indigo-600 to-cyan-600 bg-clip-text text-transparent">
                Medicine Authenticity Verification
              </h1>
            </div>
            <p className="mt-2 text-zinc-600 dark:text-zinc-400">
              Verify medicines by scanning QR code or entering batch details.
            </p>

            <div className="mt-3 flex items-center gap-3">
              <button
                className="rounded-lg bg-black px-3 py-1.5 text-white disabled:opacity-60"
                onClick={connectWallet}
                disabled={connected}
              >
                {connected ? "Wallet Connected" : "Connect Wallet"}
              </button>
              {network && (
                <span className="text-xs text-zinc-600 dark:text-zinc-400">
                  Network: {network.name} (chainId {network.chainId})
                </span>
              )}
            </div>

            <div className="mt-6 inline-flex rounded-full border border-zinc-200 bg-zinc-100 p-1 text-sm shadow-sm dark:border-zinc-800 dark:bg-zinc-800">
              <button
                className={`rounded-full px-4 py-2 transition-all ${mode === "scan" ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-white" : "text-zinc-600 dark:text-zinc-300 hover:text-zinc-800 dark:hover:text-zinc-200"}`}
                onClick={() => setMode("scan")}
              >
                Scan QR
              </button>
              <button
                className={`rounded-full px-4 py-2 transition-all ${mode === "manual" ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-white" : "text-zinc-600 dark:text-zinc-300 hover:text-zinc-800 dark:hover:text-zinc-200"}`}
                onClick={() => setMode("manual")}
              >
                Manual Entry
              </button>
            </div>

            {mode === "scan" ? (
              <div className="mt-6 animate-slide-up">
                <div className="rounded-xl border border-zinc-200 bg-white p-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-800/60">
                  <QRScanner onResult={handleScan} onRequestManual={() => setMode("manual")} />
                </div>
              </div>
            ) : (
              <div className="mt-6 grid gap-4 sm:grid-cols-2 animate-slide-up">
                <input
                  className="rounded-lg border border-zinc-300 bg-white/90 p-2 text-zinc-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 hover:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:focus:border-indigo-400"
                  placeholder="Batch Number"
                  value={form.batchNumber}
                  onChange={(e) => setForm({ ...form, batchNumber: e.target.value })}
                />
                <input
                  className="rounded-lg border border-zinc-300 bg-white/90 p-2 text-zinc-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 hover:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:focus:border-indigo-400"
                  placeholder="Manufacturer"
                  value={form.manufacturer}
                  onChange={(e) => setForm({ ...form, manufacturer: e.target.value })}
                />
                <input
                  className="rounded-lg border border-zinc-300 bg-white/90 p-2 text-zinc-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 hover:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:focus:border-indigo-400"
                  placeholder="Production Date (unix seconds)"
                  type="number"
                  value={form.productionDate || ""}
                  onChange={(e) => setForm({ ...form, productionDate: Number(e.target.value) })}
                />
                <button
                  className="group rounded-lg bg-gradient-to-r from-indigo-600 to-cyan-600 px-4 py-2 text-white transition hover:from-indigo-500 hover:to-cyan-500 active:scale-[0.99] disabled:opacity-60 shadow-sm"
                  onClick={() => doVerify(form)}
                  disabled={!connected}
                >
                  <span className="inline-flex items-center gap-2">
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-white/80 group-hover:animate-pulse-glow" />
                    Verify
                  </span>
                </button>
              </div>
            )}

        {loading && (
          <div className="mt-4 flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
            <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-zinc-300 border-t-transparent dark:border-zinc-600"></span>
            Verifying...
          </div>
        )}
        {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

        {result && (
          <div className="mt-6 rounded-2xl border border-zinc-200 bg-white/80 p-4 shadow-md dark:border-zinc-800 dark:bg-zinc-900/60 animate-fade-in">
            <p className={`text-lg font-medium ${(result.details?.isRegistered && result.matches && result.isAuthentic) ? "text-green-600" : "text-yellow-600"}`}>
              {(result.details?.isRegistered && result.matches && result.isAuthentic)
                ? "✅ Original Medicine"
                : "⚠️ Counterfeit/Unverified Medicine"}
            </p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <p><span className="font-medium">Manufacturer:</span> {result.details.manufacturer}</p>
              <p><span className="font-medium">Product Name:</span> {result.details.productName}</p>
              <p><span className="font-medium">Batch Number:</span> {result.details.batchNumber}</p>
              <p><span className="font-medium">Production Date:</span> {String(result.details.productionDate)}</p>
              <p><span className="font-medium">Expiry Date:</span> {String(result.details.expiryDate)}</p>
              <p><span className="font-medium">Verification Count:</span> {String(result.details.verificationCount)}</p>
              <p><span className="font-medium">Registered:</span> {String(result.details.isRegistered)}</p>
              <p><span className="font-medium">Data Match:</span> {result.matches ? "Yes" : "No"}</p>
              <p><span className="font-medium">Expired:</span> {result.expired ? "Yes" : "No"}</p>
            </div>
            {Array.isArray(result.checkpoints) && result.checkpoints.length > 0 && (
              <div className="mt-4">
                <p className="font-medium">Distribution Path (Supply Chain Checkpoints):</p>
                <ul className="list-disc pl-6">
                  {result.checkpoints.map((c: string, i: number) => (
                    <li key={i}>{c}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
          </div>
        </div>
      </main>
      <style jsx>{`
        @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(6px) } to { opacity: 1; transform: translateY(0) } }
        @keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }
        @keyframes float { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-2px) } }
        @keyframes pulseGlow { 0%,100% { opacity: 0.6; transform: scale(1) } 50% { opacity: 1; transform: scale(1.3) } }
        .animate-fade-in { animation: fadeIn 500ms ease-out both }
        .animate-slide-up { animation: slideUp 400ms ease-out both }
        .animate-spin { animation: spin 800ms linear infinite }
        .animate-float { animation: float 4s ease-in-out infinite }
        .group:hover .group-hover\:animate-pulse-glow { animation: pulseGlow 900ms ease-in-out infinite }
      `}</style>
    </div>
  );
}

"use client";
import { useEffect, useMemo, useState } from "react";
import { registerBatch, getSigner, authorizeManufacturer, getBatchIdHashFromFields, getAddress, isAuthorizedManufacturer, getDetailsByHash, getDetailsFromFields } from "@/utils/contract";
import QRCode from "qrcode";

export default function AdminPage() {
  const [connected, setConnected] = useState(false);
  const [address, setAddress] = useState<string | null>(null);
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [authAddress, setAuthAddress] = useState<string>("");
  const [checkpoint, setCheckpoint] = useState<string>("");
  const [form, setForm] = useState({
    manufacturer: "",
    productName: "",
    productionDate: 0,
    expiryDate: 0,
    batchNumber: "",
  });

  const payload = useMemo(
    () => ({
      batchNumber: form.batchNumber,
      manufacturer: form.manufacturer,
      productionDate: form.productionDate,
    }),
    [form]
  );

  const connect = async () => {
    try {
      setError(null);
      await getSigner();
      setConnected(true);
      const addr = await getAddress();
      setAddress(addr);
      try {
        const ok = await isAuthorizedManufacturer(addr);
        setAuthorized(Boolean(ok));
      } catch (e: any) {
        setAuthorized(false);
        setError(e?.message ?? "Authorization check failed");
      }
    } catch (e: any) {
      setError(e?.message ?? "Wallet connection failed");
    }
  };

  const generateQr = async () => {
    try {
      setError(null);
      // Compute the batchIdHash as stored on-chain
      const hash = await getBatchIdHashFromFields(
        form.batchNumber,
        form.manufacturer,
        form.productionDate
      );
      const url = await QRCode.toDataURL(String(hash));
      setQrDataUrl(url);
    } catch (e: any) {
      setError(e?.message ?? "QR generation failed");
    }
  };

  const register = async () => {
    setLoading(true);
    setError(null);
    try {
      await registerBatch(form);
      await generateQr();
    } catch (e: any) {
      setError(e?.message ?? "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  const authorize = async () => {
    setLoading(true);
    setError(null);
    try {
      await authorizeManufacturer(authAddress);
    } catch (e: any) {
      setError(e?.message ?? "Authorization failed");
    } finally {
      setLoading(false);
    }
  };

  // Supply chain checkpoints now live off-chain; update IPFS/backend record instead.

  useEffect(() => {
    // Pre-generate QR if fields are filled
    if (form.batchNumber && form.manufacturer && form.productionDate) {
      generateQr();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.batchNumber, form.manufacturer, form.productionDate]);

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black">
      <main className="mx-auto max-w-3xl px-6 py-10">
        <h1 className="text-3xl font-semibold text-black dark:text-zinc-50">Manufacturer Dashboard</h1>
        <p className="mt-2 text-zinc-600 dark:text-zinc-400">
          Connect wallet, authorize manufacturer, register batches, add supply checkpoints, and generate QR.
        </p>

        {(!process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || process.env.NEXT_PUBLIC_CONTRACT_ADDRESS === "0x0000000000000000000000000000000000000000") && (
          <div className="mt-4 rounded border border-amber-300 bg-amber-50 p-3 text-amber-900">
            No on-chain contract configured. Update `NEXT_PUBLIC_CONTRACT_ADDRESS` in `.env.local` with your deployed address,
            then restart the dev server.
          </div>
        )}

        <div className="mt-4">
          <button
            className="rounded bg-black px-4 py-2 text-white"
            onClick={connect}
            disabled={connected}
          >
            {connected ? "Wallet Connected" : "Connect Wallet"}
          </button>
        </div>

        {connected && (
          <div className="mt-3 text-sm text-zinc-700 dark:text-zinc-300">
            <p><span className="font-medium">Address:</span> {address}</p>
            <p><span className="font-medium">Authorization:</span> {authorized ? "Authorized manufacturer" : "Not authorized"}</p>
          </div>
        )}

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <input
            className="rounded border p-2"
            placeholder="Manufacturer"
            value={form.manufacturer}
            onChange={(e) => setForm({ ...form, manufacturer: e.target.value })}
          />
          <input
            className="rounded border p-2"
            placeholder="Product Name"
            value={form.productName}
            onChange={(e) => setForm({ ...form, productName: e.target.value })}
          />
          <input
            className="rounded border p-2"
            placeholder="Batch Number"
            value={form.batchNumber}
            onChange={(e) => setForm({ ...form, batchNumber: e.target.value })}
          />
          <input
            className="rounded border p-2"
            placeholder="Production Date (unix seconds)"
            type="number"
            value={form.productionDate || ""}
            onChange={(e) => setForm({ ...form, productionDate: Number(e.target.value) })}
          />
          <input
            className="rounded border p-2"
            placeholder="Expiry Date (unix seconds)"
            type="number"
            value={form.expiryDate || ""}
            onChange={(e) => setForm({ ...form, expiryDate: Number(e.target.value) })}
          />
        </div>

        <div className="mt-4 flex gap-3">
          <button className="rounded bg-black px-4 py-2 text-white disabled:opacity-60" onClick={register} disabled={!connected || !authorized}>
            {loading ? "Registering..." : "Register Batch"}
          </button>
          <button className="rounded bg-zinc-200 px-4 py-2" onClick={generateQr}>
            Generate QR
          </button>
        </div>

        {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

        <div className="mt-8">
          <h2 className="text-xl font-semibold">Authorization</h2>
          <div className="mt-3 flex gap-3">
            <input
              className="rounded border p-2 flex-1"
              placeholder="Manufacturer address (0x...)"
              value={authAddress}
              onChange={(e) => setAuthAddress(e.target.value)}
            />
            <button
              className="rounded bg-black px-4 py-2 text-white disabled:opacity-60"
              onClick={authorize}
              disabled={!connected || !authAddress}
            >
              Authorize
            </button>
          </div>
        </div>

        <div className="mt-8">
          <h2 className="text-xl font-semibold">Supply Chain Checkpoint</h2>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">Checkpoints are stored off-chain in this model. Update your IPFS/backend record to append distribution path entries.</p>
        </div>

        {qrDataUrl && (
          <div className="mt-6">
            <p className="font-medium">QR Code (contains batchIdHash):</p>
            <img src={qrDataUrl} alt="Batch QR" className="mt-2 h-48 w-48 rounded border" />
            <a
              href={qrDataUrl}
              download={`batch-${form.batchNumber}-hash.png`}
              className="mt-3 inline-block rounded bg-black px-4 py-2 text-white"
            >
              Download QR
            </a>
          </div>
        )}

        <div className="mt-10">
          <h2 className="text-xl font-semibold">Verification Logs</h2>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">Fetch verification count and batch details without incrementing logs.</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <input
              className="rounded border p-2"
              placeholder="Batch Hash (0x...)"
              onBlur={async (e) => {
                const v = e.target.value.trim();
                if (!v) return;
                try {
                  setError(null);
                  const { details, checkpoints } = await getDetailsByHash(v);
                  setQrDataUrl(null);
                  setError(`Batch ${details.batchNumber}: verified ${String(details.verificationCount)} times. Registered: ${String(details.isRegistered)}. Checkpoints: ${checkpoints.length}`);
                } catch (err: any) {
                  setError(err?.message ?? "Failed to fetch details by hash");
                }
              }}
            />
            <button
              className="rounded bg-zinc-200 px-4 py-2"
              onClick={async () => {
                if (!form.batchNumber || !form.manufacturer || !form.productionDate) return;
                try {
                  setError(null);
                  const { details, checkpoints } = await getDetailsFromFields(form.batchNumber, form.manufacturer, form.productionDate);
                  setQrDataUrl(null);
                  setError(`Batch ${details.batchNumber}: verified ${String(details.verificationCount)} times. Registered: ${String(details.isRegistered)}. Checkpoints: ${checkpoints.length}`);
                } catch (err: any) {
                  setError(err?.message ?? "Failed to fetch details from fields");
                }
              }}
            >
              Fetch Logs by Fields
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
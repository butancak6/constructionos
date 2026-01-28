import { useState, useRef, useCallback } from 'react';

export function useWavRecorder() {
    // We use State for UI feedback
    const [isRecording, setIsRecording] = useState(false);
    const [isBusy, setIsBusy] = useState(false);

    // We use a Ref for a "busy lock" so you can't double-click (Logic Lock)
    const isBusyRef = useRef(false);

    // Refs are "Instant" - they don't wait for React re-renders.
    // This is crucial for handling WebKit audio hardware.
    const audioContext = useRef<AudioContext | null>(null);
    const processor = useRef<ScriptProcessorNode | null>(null);
    const source = useRef<MediaStreamAudioSourceNode | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const audioChunks = useRef<Float32Array[]>([]);

    const startRecording = useCallback(async () => {
        if (isBusyRef.current || isRecording) return;

        console.log("🎤 Starting Recorder Sequence...");
        isBusyRef.current = true;
        setIsBusy(true);

        // Safety Valve: Auto-reset if it hangs
        const safetyTimer = setTimeout(() => {
            if (isBusyRef.current) {
                console.warn("⚠️ Recorder Safety Valve Triggered (5s timeout)");
                isBusyRef.current = false;
                setIsBusy(false);
            }
        }, 5000);

        try {
            // 1. Aggressive Cleanup of previous session
            if (audioContext.current) {
                await audioContext.current.close();
                audioContext.current = null;
            }
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(t => t.stop());
                streamRef.current = null;
            }

            // 2. Get Mic Permission
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            streamRef.current = stream;

            // 3. Create FRESH Context & FORCE RESUME (Fixes macOS "Suspended" bug)
            const ctx = new window.AudioContext({ sampleRate: 16000 });
            // This await is vital. It ensures the hardware is ready.
            await ctx.resume();
            audioContext.current = ctx;

            // 4. Setup Processor Graph
            audioChunks.current = []; // Wipe old data
            source.current = ctx.createMediaStreamSource(stream);

            // Buffer size 4096 = ~0.25s of audio per tick at 16kHz
            const node = ctx.createScriptProcessor(4096, 1, 1);
            processor.current = node;

            node.onaudioprocess = (e) => {
                // This runs constantly while recording
                const input = e.inputBuffer.getChannelData(0);
                // IMPORTANT: Clone the data, don't just store the reference
                audioChunks.current.push(new Float32Array(input));

                // VISUAL DEBUG: Log occasionally so we know it's alive
                if (audioChunks.current.length % 50 === 0) {
                    console.log(`🔴 Recording Active... Chunks captured: ${audioChunks.current.length}`);
                }
            };

            // 5. THE MAGIC TRICK (Connect to destination to force engine on)
            // WebKit often won't fire 'onaudioprocess' unless output goes to speakers.
            const gain = ctx.createGain();
            gain.gain.value = 0; // Mute it so we don't hear feedback loop
            source.current.connect(node);
            node.connect(gain);
            gain.connect(ctx.destination);

            // 6. Update UI State only after EVERYTHING is successful
            setIsRecording(true);
            console.log("✅ Audio Engine successfully started and running.");
            clearTimeout(safetyTimer); // Clear safety timer on success

        } catch (e) {
            console.error("CRITICAL Mic Failure:", e);
            alert("Could not start microphone. Please check system permissions.");
            // Ensure UI doesn't get stuck in "recording" state if it failed
            setIsRecording(false);
        } finally {
            isBusyRef.current = false;
            setIsBusy(false);
        }
    }, [isRecording]);

    const stopRecording = useCallback(async (): Promise<Blob> => {
        console.log("🛑 Stop sequence initiated...");
        if (isBusyRef.current) throw new Error("Recorder is busy starting or stopping");

        // This is the error you were seeing. We add a check here.
        if (!audioContext.current || audioContext.current.state === 'closed') {
            console.error("Stop called but audio engine is dead.");
            setIsRecording(false);
            throw new Error("Not recording (Audio engine was not active)");
        }

        isBusyRef.current = true;
        setIsBusy(true);

        try {
            // 1. Wait a tiny bit to capture the very last audio buffer chunk
            await new Promise(r => setTimeout(r, 150));

            // 2. Update UI immediately
            setIsRecording(false);

            // 3. Tear down the audio graph completely
            if (processor.current) {
                processor.current.disconnect();
                processor.current.onaudioprocess = null;
            }
            if (source.current) source.current.disconnect();
            // Physically turn off the microphone light
            if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
            // Close the hardware connection
            if (audioContext.current) await audioContext.current.close();

            // 4. Verify Data exists
            const chunkCount = audioChunks.current.length;
            console.log(`📊 Recorder finished. Total Chunks captured: ${chunkCount}`);

            if (chunkCount === 0) {
                // This is what happens if the browser suspended the audio silently
                throw new Error("No audio data captured (Microphone was silent or blocked by OS)");
            }

            // 5. Flatten and Encode
            const totalLength = audioChunks.current.reduce((acc, c) => acc + c.length, 0);
            const result = new Float32Array(totalLength);
            let offset = 0;
            for (const chunk of audioChunks.current) {
                result.set(chunk, offset);
                offset += chunk.length;
            }

            // Use the helper function below
            return encodeWAV(result, 16000);
        } finally {
            isBusyRef.current = false;
            setIsBusy(false);
        }
    }, []);

    return { isRecording, startRecording, stopRecording, isBusy };
}

// --- Helper Function: Manual WAV Header Encoder ---
// This ensures the file is exactly the format Whisper expects (16kHz, Mono, 16-bit PCM)
function encodeWAV(samples: Float32Array, sampleRate: number): Blob {
    const buffer = new ArrayBuffer(44 + samples.length * 2);
    const view = new DataView(buffer);

    // RIFF chunk descriptor
    writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + samples.length * 2, true);
    writeString(view, 8, 'WAVE');
    // fmt sub-chunk
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true); // Subchunk1Size (16 for PCM)
    view.setUint16(20, 1, true); // AudioFormat (1 for PCM)
    view.setUint16(22, 1, true); // NumChannels (1 for Mono)
    view.setUint32(24, sampleRate, true); // SampleRate
    view.setUint32(28, sampleRate * 2, true); // ByteRate
    view.setUint16(32, 2, true); // BlockAlign
    view.setUint16(34, 16, true); // BitsPerSample (16 bits)
    // data sub-chunk
    writeString(view, 36, 'data');
    view.setUint32(40, samples.length * 2, true); // Subchunk2Size

    // Write raw PCM samples
    floatTo16BitPCM(view, 44, samples);

    return new Blob([view], { type: 'audio/wav' });
}

// Convert Float32 (-1.0 to 1.0) to Int16 (-32768 to 32767)
function floatTo16BitPCM(output: DataView, offset: number, input: Float32Array) {
    for (let i = 0; i < input.length; i++, offset += 2) {
        // Clamp values to avoid horrific static noise if volume is too high
        const s = Math.max(-1, Math.min(1, input[i]));
        // Convert and write directly to binary buffer
        output.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
    }
}

// Helper to write ASCII strings into binary buffer
function writeString(view: DataView, offset: number, string: string) {
    for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
    }
}
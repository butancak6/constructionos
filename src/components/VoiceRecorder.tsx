import { useState, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";

export default function VoiceRecorder() {
    const [isRecording, setIsRecording] = useState(false);
    const [captures, setCaptures] = useState<string[]>([]);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mediaRecorder = new MediaRecorder(stream);
            mediaRecorderRef.current = mediaRecorder;
            audioChunksRef.current = [];

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    audioChunksRef.current.push(event.data);
                }
            };

            mediaRecorder.onstop = async () => {
                const audioBlob = new Blob(audioChunksRef.current, { type: "audio/wav" });
                const arrayBuffer = await audioBlob.arrayBuffer();
                const uint8Array = new Uint8Array(arrayBuffer);
                const data = Array.from(uint8Array);

                try {
                    // invoke expects camelCase key 'audioData' for rust snake_case 'audio_data'
                    const path = await invoke<string>("save_audio_blob", { audioData: data });
                    setCaptures((prev) => [path, ...prev]);
                } catch (error) {
                    console.error("Failed to save audio:", error);
                    alert("Failed to save audio: " + error);
                }
            };

            mediaRecorder.start();
            setIsRecording(true);
        } catch (error) {
            console.error("Error accessing microphone:", error);
            alert("Error accessing microphone: " + error);
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
            // Stop all tracks to release the microphone
            mediaRecorderRef.current.stream.getTracks().forEach((track) => track.stop());
        }
    };

    const toggleRecording = () => {
        if (isRecording) {
            stopRecording();
        } else {
            startRecording();
        }
    };

    return (
        <div className="flex flex-col items-center justify-center p-8">
            <h2 className="text-2xl font-bold mb-8 text-white">Voice Recorder</h2>
            <button
                onClick={toggleRecording}
                className={`
          w-32 h-32 rounded-full flex items-center justify-center
          transition-all duration-300 ease-in-out
          focus:outline-none
          ${isRecording
                        ? "bg-red-600 animate-pulse shadow-[0_0_50px_rgba(220,38,38,0.7)] scale-110"
                        : "bg-red-600 hover:bg-red-700 shadow-xl hover:scale-105 active:scale-95"
                    }
        `}
            >
                {isRecording ? (
                    <div className="w-12 h-12 bg-white rounded-md" /> /* Stop Square */
                ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                    </svg> /* Mic Icon */
                )}
            </button>

            <p className="mt-8 text-gray-400 text-lg">
                {isRecording ? "Listening..." : "Tap to Speak"}
            </p>

            <div className="mt-12 w-full max-w-md">
                <h3 className="text-xl font-semibold mb-4 text-gray-200">Recent Captures</h3>
                <div className="bg-gray-800 rounded-lg p-4 min-h-[100px]">
                    {captures.length === 0 ? (
                        <p className="text-gray-500 text-center">No recordings yet</p>
                    ) : (
                        <ul className="space-y-2">
                            {captures.map((path, index) => (
                                <li key={index} className="text-sm text-gray-300 break-all bg-gray-700 p-2 rounded">
                                    {path}
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>
        </div>
    );
}

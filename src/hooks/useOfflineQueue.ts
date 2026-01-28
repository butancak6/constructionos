import { useState, useEffect } from 'react';

export interface PendingInvoice {
    id: string; // Unique ID for queue management
    audioBlob: Blob;
    timestamp: number;
    status: 'pending' | 'uploading' | 'failed';
    retryCount?: number;
}

// Serializable version for LocalStorage
interface StoredPendingInvoice {
    id: string;
    base64Audio: string;
    mimeType: string;
    timestamp: number;
    status: 'pending' | 'uploading' | 'failed';
    retryCount?: number;
}

const STORAGE_KEY = 'offline_invoice_queue';

export function useOfflineQueue() {
    const [queue, setQueue] = useState<PendingInvoice[]>([]);

    // Load from LocalStorage on mount
    useEffect(() => {
        loadQueue();
    }, []);

    // Save to LocalStorage whenever queue changes
    useEffect(() => {
        saveQueueToStorage(queue);
    }, [queue]);

    const loadQueue = async () => {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored) {
                const parsed: StoredPendingInvoice[] = JSON.parse(stored);
                const rehydrated = await Promise.all(parsed.map(async (item) => ({
                    id: item.id,
                    audioBlob: await base64ToBlob(item.base64Audio, item.mimeType),
                    timestamp: item.timestamp,
                    status: item.status,
                    retryCount: item.retryCount || 0
                })));
                setQueue(rehydrated);
            }
        } catch (error) {
            console.error("Failed to load offline queue:", error);
        }
    };

    const saveQueueToStorage = async (currentQueue: PendingInvoice[]) => {
        try {
            const serializable = await Promise.all(currentQueue.map(async (item) => ({
                id: item.id,
                base64Audio: await blobToBase64(item.audioBlob),
                mimeType: item.audioBlob.type,
                timestamp: item.timestamp,
                status: item.status,
                retryCount: item.retryCount || 0
            })));
            localStorage.setItem(STORAGE_KEY, JSON.stringify(serializable));
        } catch (error) {
            console.error("Failed to save offline queue:", error);
        }
    };

    const addToQueue = (audioBlob: Blob) => {
        const newItem: PendingInvoice = {
            id: `queue_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            audioBlob,
            timestamp: Date.now(),
            status: 'pending',
            retryCount: 0
        };
        setQueue(prev => [...prev, newItem]);
    };

    const removeFromQueue = (id: string) => {
        setQueue(prev => prev.filter(item => item.id !== id));
    };

    const updateStatus = (id: string, status: 'pending' | 'uploading' | 'failed') => {
        setQueue(prev => prev.map(item =>
            item.id === id ? { ...item, status } : item
        ));
    };

    return {
        queue,
        addToQueue,
        removeFromQueue,
        updateStatus
    };
}

// --- HELPERS ---

function blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            const result = reader.result as string;
            // Remove data URL prefix (e.g., "data:audio/webm;base64,")
            const base64 = result.split(',')[1];
            resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}

async function base64ToBlob(base64: string, mimeType: string): Promise<Blob> {
    const res = await fetch(`data:${mimeType};base64,${base64}`);
    return res.blob();
}

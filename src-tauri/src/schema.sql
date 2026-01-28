CREATE TABLE IF NOT EXISTS clients (
    id TEXT PRIMARY KEY,
    name TEXT,
    phone TEXT
);

CREATE TABLE IF NOT EXISTS invoices (
    id TEXT PRIMARY KEY,
    client_id TEXT,
    amount_cents INTEGER,
    status TEXT,
    FOREIGN KEY(client_id) REFERENCES clients(id)
);

CREATE TABLE IF NOT EXISTS notes (
    id TEXT PRIMARY KEY,
    audio_path TEXT,
    transcription TEXT
);

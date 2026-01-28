use base64::{engine::general_purpose, Engine as _};
use chrono::{Local, Utc};
use opener;
use rusqlite::Connection;
use serde_json::{json, Value};
use std::fs;
use std::sync::Mutex;
use tauri::State;

use std::io::Cursor;
use tauri::AppHandle;
use whisper_rs::{FullParams, SamplingStrategy, WhisperContext};

mod model_manager;

// REMOVED HARDCODED KEY
use dotenv::dotenv;
use std::env;

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug)]
struct Invoice {
    id: String,
    client: String,
    amount: f64,
    status: String,
    description: String,
    client_phone: Option<String>,
    client_company: Option<String>,
    pdf_path: Option<String>,
}

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug)]
struct Task {
    id: String,
    description: String,
    status: String,
    created_at: String,
    due_date: Option<String>,
}

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug)]
struct Contact {
    id: String,
    name: String,
    phone: String,
    company: Option<String>,
    created_at: String,
}

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug)]
struct Expense {
    id: String,
    merchant: String,
    amount: f64,
    category: String,
    date: String,
    image_path: Option<String>,
    status: String,
}

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug)]
struct FinancialSummary {
    revenue: f64,
    expenses: f64,
    profit: f64,
}

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug)]
struct ActivityItem {
    id: String,
    intent: String,
    description: String,
    amount: f64,
    date: String,
    timestamp: i64,
    file_path: Option<String>,
}

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug)]
struct ContactSuggestion {
    id: String,
    name: String,
    phone: String,
    company: Option<String>,
}

struct AppState {
    db_path: Mutex<String>,
}

// --- SYNCHRONOUS ENGINE (ureq) ---
fn ask_gemini(system_prompt: &str, mime_type: &str, data: &str) -> Result<Value, String> {
    println!("--- STARTING ANALYSIS ({}) ---", mime_type);

    let prompt = json!({
        "contents": [{
            "parts": [
                { "text": system_prompt },
                { "inline_data": { "mime_type": mime_type, "data": data } }
            ]
        }]
    });

    println!("DEBUG: Sending to Google...");

    // Use the provided API key
    let api_key =
        env::var("VITE_GROQ_API_KEY").map_err(|_| "API Key not found in env".to_string())?;
    let url = format!("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={}", api_key);

    let response = match ureq::post(&url).send_json(prompt) {
        Ok(res) => res,
        Err(ureq::Error::Status(code, response)) => {
            let body = response
                .into_string()
                .unwrap_or_else(|_| "No error body".to_string());
            let err = format!("API Error {}: {}", code, body);
            println!("ERROR: {}", err);
            return Err(err);
        }
        Err(e) => {
            let err = format!("Network Error: {}", e);
            println!("ERROR: {}", err);
            return Err(err);
        }
    };

    println!("DEBUG: Google Responded!");

    let response_body: Value = response.into_json().map_err(|e| {
        let err = format!("JSON Error: {}", e);
        println!("ERROR: {}", err);
        err
    })?;

    let raw_text = response_body["candidates"][0]["content"]["parts"][0]["text"]
        .as_str()
        .ok_or_else(|| {
            let err = "AI returned no text".to_string();
            println!("ERROR: {}", err);
            err
        })?;

    let clean_json = raw_text
        .replace("```json", "")
        .replace("```", "")
        .trim()
        .to_string();
    let parsed: Value = serde_json::from_str(&clean_json).map_err(|_| {
        let err = "AI returned bad JSON".to_string();
        println!("ERROR: {}", err);
        err
    })?;

    println!("SUCCESS: Parsed JSON content: {:?}", parsed);

    Ok(parsed)
}

// --- COMMANDS ---

#[tauri::command]
fn open_system_link(url: String) -> Result<String, String> {
    println!("DEBUG: Opening system link: {}", url);
    match opener::open(&url) {
        Ok(_) => Ok("Opened".to_string()),
        Err(e) => Err(format!("Failed to open link: {}", e)),
    }
}

#[tauri::command]
fn open_invoice_pdf(id: String) -> Result<String, String> {
    let home = dirs::home_dir().ok_or("No Home directory found")?;
    // Reconstruct path: ~/.construction-os/invoices/{id}.pdf
    let path = home
        .join(".construction-os")
        .join("invoices")
        .join(format!("{}.pdf", id));

    println!("DEBUG: Attempting to open PDF at: {:?}", path);

    if !path.exists() {
        return Err("PDF not found. Please regenerate it.".to_string());
    }

    match opener::open(&path) {
        Ok(_) => Ok("Opened PDF".to_string()),
        Err(e) => Err(format!("Failed to open PDF: {}", e)),
    }
}

#[tauri::command]
fn analyze_audio(path: String, state: State<'_, AppState>) -> Result<Value, String> {
    let audio_path = std::path::PathBuf::from(&path);
    let audio_data = fs::read(&audio_path).map_err(|e| e.to_string())?;
    let base64_audio = general_purpose::STANDARD.encode(audio_data);

    let current_date = Local::now().format("%Y-%m-%d").to_string();
    let system_prompt = format!(
        "Today is [{}]. Listen to audio. Classify INTENT as 'INVOICE', 'TASK', or 'CONTACT'. 
        1. INVOICE: {{ \"intent\": \"INVOICE\", \"client\": \"Name\", \"amount\": 100, \"description\": \"Short summary of work\" }}
        2. TASK: {{ \"intent\": \"TASK\", \"description\": \"Action item\", \"due_date\": \"YYYY-MM-DD\" (Calculate based on 'today', or null if none) }}
        3. CONTACT: {{ \"intent\": \"CONTACT\", \"name\": \"Name\", \"phone\": \"Phone#\", \"company\": \"Company or null\" }}
        Return ONLY valid JSON.", 
        current_date
    );

    let ai_result = ask_gemini(&system_prompt, "audio/webm", &base64_audio)?;
    let intent = ai_result["intent"].as_str().unwrap_or("UNKNOWN");

    if intent == "INVOICE" {
        let new_id = format!(
            "INV-{}",
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_secs()
        );
        let client = ai_result["client"].as_str().unwrap_or("Unknown");
        let amount = ai_result["amount"].as_f64().unwrap_or(0.0);
        let description = ai_result["description"]
            .as_str()
            .unwrap_or("General Services");
        let status = "DRAFT";

        // Suggestion Logic
        let mut suggested_contacts = Vec::new();
        let mut all_contacts = Vec::new();
        if let Ok(path_guard) = state.db_path.lock() {
            if let Ok(conn) = Connection::open(path_guard.as_str()) {
                let search_pattern = format!("%{}%", client);
                let mut stmt = conn.prepare("SELECT id, name, phone, company FROM contacts WHERE lower(name) LIKE lower(?1) LIMIT 5").unwrap();
                let rows = stmt.query_map([&search_pattern], |row| {
                    Ok(ContactSuggestion {
                        id: row.get(0)?,
                        name: row.get(1)?,
                        phone: row.get(2)?,
                        company: row.get(3).ok(),
                    })
                });
                if let Ok(mapped) = rows {
                    for r in mapped {
                        if let Ok(c) = r {
                            suggested_contacts.push(c);
                        }
                    }
                }

                let mut stmt_all = conn
                    .prepare("SELECT id, name, phone, company FROM contacts ORDER BY name ASC")
                    .unwrap();
                let rows_all = stmt_all.query_map([], |row| {
                    Ok(ContactSuggestion {
                        id: row.get(0)?,
                        name: row.get(1)?,
                        phone: row.get(2)?,
                        company: row.get(3).ok(),
                    })
                });
                if let Ok(mapped_all) = rows_all {
                    for r in mapped_all {
                        if let Ok(c) = r {
                            all_contacts.push(c);
                        }
                    }
                }
            }
        }

        return Ok(json!({
            "intent": "INVOICE", "id": new_id, "client": client, "amount": amount, "description": description, "status": status,
            "client_phone": null, "client_company": null, "suggested_contacts": suggested_contacts, "all_contacts": all_contacts
        }));
    } else if intent == "TASK" {
        let new_id = format!(
            "TSK-{}",
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_secs()
        );
        let description = ai_result["description"]
            .as_str()
            .unwrap_or("No description");
        let status = "DRAFT";
        let created_at = Local::now().to_rfc3339();
        let due_date = ai_result["due_date"].as_str().map(|s| s.to_string());

        return Ok(
            json!({ "intent": "TASK", "id": new_id, "description": description, "status": status, "created_at": created_at, "due_date": due_date }),
        );
    } else if intent == "CONTACT" {
        let new_id = format!(
            "CON-{}",
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_secs()
        );
        let name = ai_result["name"].as_str().unwrap_or("Unknown");
        let phone = ai_result["phone"].as_str().unwrap_or("");
        let company = ai_result["company"].as_str().map(|s| s.to_string());
        let created_at = Local::now().to_rfc3339();

        return Ok(
            json!({ "intent": "CONTACT", "id": new_id, "name": name, "phone": phone, "company": company, "created_at": created_at }),
        );
    }
    Ok(ai_result)
}

#[tauri::command]
fn analyze_image(image_data: String) -> Result<Value, String> {
    let clean_base64 = if let Some(index) = image_data.find(',') {
        &image_data[index + 1..]
    } else {
        &image_data
    };
    let current_date = Local::now().format("%Y-%m-%d").to_string();
    let system_prompt = format!(
        "Today is [{}]. Analyze this image. Is it a RECEIPT? 
        If YES, return JSON: {{ \"intent\": \"EXPENSE\", \"merchant\": \"Name\", \"amount\": 0.00, \"date\": \"YYYY-MM-DD\", \"category\": \"Category (Materials, Fuel, Tools, Other)\" }} 
        If NO, return JSON: {{ \"error\": \"Not a receipt\" }}",
        current_date
    );
    let ai_result = ask_gemini(&system_prompt, "image/jpeg", clean_base64)?;
    if let Some(err) = ai_result.get("error") {
        return Err(err.as_str().unwrap_or("Unknown AI error").to_string());
    }

    let intent = ai_result["intent"].as_str().unwrap_or("UNKNOWN");
    if intent == "EXPENSE" {
        let new_id = format!(
            "EXP-{}",
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_secs()
        );
        let merchant = ai_result["merchant"].as_str().unwrap_or("Unknown");
        let amount = ai_result["amount"].as_f64().unwrap_or(0.0);
        let category = ai_result["category"].as_str().unwrap_or("Other");
        let date = ai_result["date"].as_str().unwrap_or(&current_date);
        let status = "DRAFT";
        return Ok(
            json!({ "intent": "EXPENSE", "id": new_id, "merchant": merchant, "amount": amount, "category": category, "date": date, "status": status }),
        );
    }
    Ok(ai_result)
}

#[tauri::command]
fn confirm_invoice(invoice: Invoice, state: State<'_, AppState>) -> Result<String, String> {
    println!(
        "DEBUG: Attempting to confirm invoice for client: {}",
        invoice.client
    );
    let path_guard = state.db_path.lock().unwrap();
    let conn = Connection::open(path_guard.as_str()).map_err(|e| e.to_string())?;
    let status = if invoice.status == "DRAFT" {
        "GENERATED"
    } else {
        &invoice.status
    };

    // Smart Link
    let mut phone = invoice.client_phone.clone();
    let mut company = invoice.client_company.clone();

    if phone.is_none() || company.is_none() {
        let search_name = format!("%{}%", invoice.client);
        if let Ok(mut stmt) = conn.prepare("SELECT phone, company FROM contacts WHERE name LIKE ?1")
        {
            let rows = stmt.query_map([&search_name], |row| {
                Ok((row.get::<_, String>(0)?, row.get::<_, Option<String>>(1)?))
            });

            if let Ok(mapped_rows) = rows {
                for r in mapped_rows {
                    if let Ok((p, c)) = r {
                        if phone.is_none() {
                            phone = Some(p);
                        }
                        if company.is_none() {
                            company = c;
                        }
                        break;
                    }
                }
            }
        }
    }

    conn.execute(
        "INSERT INTO invoices (id, client, amount, status, description, client_phone, client_company) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        &[&invoice.id, &invoice.client, &invoice.amount.to_string(), status, &invoice.description, &phone.unwrap_or_default(), &company.unwrap_or_default()],
    ).map_err(|e| e.to_string())?;
    Ok("Saved".to_string())
}

#[tauri::command]
fn confirm_task(task: Task, state: State<'_, AppState>) -> Result<String, String> {
    let path_guard = state.db_path.lock().unwrap();
    let conn = Connection::open(path_guard.as_str()).map_err(|e| e.to_string())?;
    let status = if task.status == "DRAFT" {
        "TODO"
    } else {
        &task.status
    };
    conn.execute("INSERT INTO tasks (id, description, status, created_at, due_date) VALUES (?1, ?2, ?3, ?4, ?5)", 
        &[&task.id, &task.description, status, &task.created_at, &task.due_date.unwrap_or_default()]
    ).map_err(|e| e.to_string())?;
    Ok("Saved".to_string())
}

#[tauri::command]
fn confirm_contact(contact: Contact, state: State<'_, AppState>) -> Result<String, String> {
    let path_guard = state.db_path.lock().unwrap();
    let conn = Connection::open(path_guard.as_str()).map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT INTO contacts (id, name, phone, company, created_at) VALUES (?1, ?2, ?3, ?4, ?5)",
        &[
            &contact.id,
            &contact.name,
            &contact.phone,
            &contact.company.unwrap_or_default(),
            &contact.created_at,
        ],
    )
    .map_err(|e| e.to_string())?;
    Ok("Saved".to_string())
}

#[tauri::command]
fn confirm_expense(expense: Expense, state: State<'_, AppState>) -> Result<String, String> {
    let path_guard = state.db_path.lock().unwrap();
    let conn = Connection::open(path_guard.as_str()).map_err(|e| e.to_string())?;
    let status = if expense.status == "DRAFT" {
        "PENDING"
    } else {
        &expense.status
    };
    conn.execute("INSERT INTO expenses (id, merchant, amount, category, date, image_path, status) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)", 
        &[&expense.id, &expense.merchant, &expense.amount.to_string(), &expense.category, &expense.date, &expense.image_path.unwrap_or_default(), status]
    ).map_err(|e| e.to_string())?;
    Ok("Saved".to_string())
}

#[tauri::command]
fn init_db(state: State<'_, AppState>) -> Result<String, String> {
    let home = dirs::home_dir().ok_or("No Home")?;
    let db_path = home.join(".construction-os").join("construction.db");
    if let Some(parent) = db_path.parent() {
        let _ = fs::create_dir_all(parent);
    }
    let conn = Connection::open(&db_path).map_err(|e| e.to_string())?;
    conn.execute("CREATE TABLE IF NOT EXISTS invoices (id TEXT PRIMARY KEY, client TEXT, amount REAL, status TEXT, description TEXT, client_phone TEXT, client_company TEXT)", []).map_err(|e| e.to_string())?;
    let _ = conn.execute("ALTER TABLE invoices ADD COLUMN description TEXT", []);
    let _ = conn.execute("ALTER TABLE invoices ADD COLUMN client_phone TEXT", []);
    let _ = conn.execute("ALTER TABLE invoices ADD COLUMN client_company TEXT", []);
    conn.execute("CREATE TABLE IF NOT EXISTS tasks (id TEXT PRIMARY KEY, description TEXT, status TEXT, created_at TEXT, due_date TEXT)", []).map_err(|e| e.to_string())?;
    let _ = conn.execute("ALTER TABLE tasks ADD COLUMN created_at TEXT", []);
    let _ = conn.execute("ALTER TABLE tasks ADD COLUMN due_date TEXT", []);
    conn.execute("CREATE TABLE IF NOT EXISTS contacts (id TEXT PRIMARY KEY, name TEXT, phone TEXT, company TEXT, created_at TEXT)", []).map_err(|e| e.to_string())?;
    conn.execute("CREATE TABLE IF NOT EXISTS expenses (id TEXT PRIMARY KEY, merchant TEXT, amount REAL, category TEXT, date TEXT, image_path TEXT, status TEXT)", []).map_err(|e| e.to_string())?;
    *state.db_path.lock().unwrap() = db_path.to_string_lossy().to_string();
    Ok("Ready".to_string())
}

#[tauri::command]
fn get_invoices(state: State<'_, AppState>) -> Result<Vec<Invoice>, String> {
    let path_guard = state.db_path.lock().unwrap();
    let conn = Connection::open(path_guard.as_str()).map_err(|e| e.to_string())?;
    let home = dirs::home_dir().ok_or("No Home")?;
    let mut stmt = conn.prepare("SELECT id, client, amount, status, COALESCE(description, ''), COALESCE(client_phone, ''), COALESCE(client_company, '') FROM invoices ORDER BY rowid DESC").map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map([], |row| {
            let id: String = row.get(0)?;
            let pdf_path = home
                .join(".construction-os")
                .join("invoices")
                .join(format!("{}.pdf", id));
            Ok(Invoice {
                id: id,
                client: row.get(1)?,
                amount: row.get(2)?,
                status: row.get(3)?,
                description: row.get(4)?,
                client_phone: Some(row.get(5)?),
                client_company: Some(row.get(6)?),
                pdf_path: if pdf_path.exists() {
                    Some(pdf_path.to_string_lossy().to_string())
                } else {
                    None
                },
            })
        })
        .map_err(|e| e.to_string())?;
    let mut results = Vec::new();
    for row in rows {
        results.push(row.map_err(|e| e.to_string())?);
    }
    Ok(results)
}

#[tauri::command]
fn get_tasks(state: State<'_, AppState>) -> Result<Vec<Task>, String> {
    let path_guard = state.db_path.lock().unwrap();
    let conn = Connection::open(path_guard.as_str()).map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare(
            "SELECT id, description, status, created_at, due_date FROM tasks ORDER BY rowid DESC",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |row| {
            Ok(Task {
                id: row.get(0)?,
                description: row.get(1)?,
                status: row.get(2)?,
                created_at: row.get(3)?,
                due_date: row.get(4)?,
            })
        })
        .map_err(|e| e.to_string())?;
    let mut results = Vec::new();
    for row in rows {
        results.push(row.map_err(|e| e.to_string())?);
    }
    Ok(results)
}

#[tauri::command]
fn get_contacts(state: State<'_, AppState>) -> Result<Vec<Contact>, String> {
    let path_guard = state.db_path.lock().unwrap();
    let conn = Connection::open(path_guard.as_str()).map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare("SELECT id, name, phone, company, created_at FROM contacts ORDER BY rowid DESC")
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |row| {
            Ok(Contact {
                id: row.get(0)?,
                name: row.get(1)?,
                phone: row.get(2)?,
                company: row.get(3)?,
                created_at: row.get(4)?,
            })
        })
        .map_err(|e| e.to_string())?;
    let mut results = Vec::new();
    for row in rows {
        results.push(row.map_err(|e| e.to_string())?);
    }
    Ok(results)
}

#[tauri::command]
fn get_expenses(state: State<'_, AppState>) -> Result<Vec<Expense>, String> {
    let path_guard = state.db_path.lock().unwrap();
    let conn = Connection::open(path_guard.as_str()).map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare("SELECT id, merchant, amount, category, date, image_path, status FROM expenses ORDER BY rowid DESC").map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |row| {
            Ok(Expense {
                id: row.get(0)?,
                merchant: row.get(1)?,
                amount: row.get(2)?,
                category: row.get(3)?,
                date: row.get(4)?,
                image_path: row.get(5).ok(),
                status: row.get(6)?,
            })
        })
        .map_err(|e| e.to_string())?;
    let mut results = Vec::new();
    for row in rows {
        results.push(row.map_err(|e| e.to_string())?);
    }
    Ok(results)
}

#[tauri::command]
fn get_financial_summary(state: State<'_, AppState>) -> Result<FinancialSummary, String> {
    let path_guard = state.db_path.lock().unwrap();
    let conn = Connection::open(path_guard.as_str()).map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare("SELECT COALESCE(SUM(amount), 0.0) FROM invoices WHERE status != 'DRAFT'")
        .map_err(|e| e.to_string())?;
    let revenue: f64 = stmt.query_row([], |row| row.get(0)).unwrap_or(0.0);
    let mut stmt_exp = conn
        .prepare("SELECT COALESCE(SUM(amount), 0.0) FROM expenses WHERE status != 'DRAFT'")
        .map_err(|e| e.to_string())?;
    let expenses: f64 = stmt_exp.query_row([], |row| row.get(0)).unwrap_or(0.0);
    Ok(FinancialSummary {
        revenue,
        expenses,
        profit: revenue - expenses,
    })
}

#[tauri::command]
fn get_recent_activity(state: State<'_, AppState>) -> Result<Vec<ActivityItem>, String> {
    let mut activity = Vec::new();
    let invoices = get_invoices(state.clone())?;
    for inv in invoices {
        if inv.status == "DRAFT" {
            continue;
        }
        let parts: Vec<&str> = inv.id.split('-').collect();
        let ts = if parts.len() > 1 {
            parts[1].parse::<i64>().unwrap_or(0)
        } else {
            0
        };
        let date_str = if ts > 0 {
            chrono::DateTime::<Utc>::from_timestamp(ts as i64, 0)
                .map(|d| d.with_timezone(&Local).format("%Y-%m-%d").to_string())
                .unwrap_or("Unknown".to_string())
        } else {
            "Unknown".to_string()
        };
        activity.push(ActivityItem {
            id: inv.id,
            intent: "INVOICE".to_string(),
            description: inv.client,
            amount: inv.amount,
            date: date_str,
            timestamp: ts,
            file_path: inv.pdf_path,
        });
    }
    let expenses = get_expenses(state)?;
    for exp in expenses {
        if exp.status == "DRAFT" {
            continue;
        }
        let parts: Vec<&str> = exp.id.split('-').collect();
        let ts = if parts.len() > 1 {
            parts[1].parse::<i64>().unwrap_or(0)
        } else {
            0
        };
        activity.push(ActivityItem {
            id: exp.id,
            intent: "EXPENSE".to_string(),
            description: format!("{} ({})", exp.merchant, exp.category),
            amount: exp.amount,
            date: exp.date,
            timestamp: ts,
            file_path: None,
        });
    }
    activity.sort_by(|a, b| b.timestamp.cmp(&a.timestamp));
    Ok(activity.into_iter().take(5).collect())
}

#[tauri::command]
fn save_audio_blob(audio_data: Vec<u8>) -> Result<String, String> {
    let home = dirs::home_dir().ok_or("No Home")?;
    let path = home.join(".construction-os").join("inbox").join(format!(
        "voice_{}.webm",
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_millis()
    ));
    if let Some(parent) = path.parent() {
        let _ = fs::create_dir_all(parent);
    }
    fs::write(&path, audio_data).map_err(|e| e.to_string())?;
    Ok(path.to_string_lossy().to_string())
}

#[tauri::command]
fn save_image(image_data: String) -> Result<String, String> {
    let home = dirs::home_dir().ok_or("No Home")?;
    let path = home.join(".construction-os").join("receipts").join(format!(
        "img_{}.jpg",
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_millis()
    ));
    if let Some(parent) = path.parent() {
        let _ = fs::create_dir_all(parent);
    }
    let clean_base64 = if let Some(index) = image_data.find(',') {
        &image_data[index + 1..]
    } else {
        &image_data
    };
    let decoded = general_purpose::STANDARD
        .decode(clean_base64)
        .map_err(|e| e.to_string())?;
    fs::write(&path, decoded).map_err(|e| e.to_string())?;
    Ok(path.to_string_lossy().to_string())
}

#[tauri::command]
fn get_recordings() -> Result<Vec<String>, String> {
    let home = dirs::home_dir().ok_or("No Home")?;
    let inbox = home.join(".construction-os").join("inbox");
    let mut files = Vec::new();
    if inbox.exists() {
        for entry in fs::read_dir(inbox).map_err(|e| e.to_string())? {
            let path = entry.map_err(|e| e.to_string())?.path();
            if path.extension().and_then(|s| s.to_str()) == Some("webm") {
                files.push(path.to_string_lossy().to_string());
            }
        }
    }
    Ok(files)
}

#[tauri::command]
async fn save_invoice_pdf(id: String, pdf_data: String) -> Result<String, String> {
    let home = dirs::home_dir().ok_or("No Home directory found")?;
    let folder_path = home.join(".construction-os").join("invoices");

    if !folder_path.exists() {
        tokio::fs::create_dir_all(&folder_path)
            .await
            .map_err(|e| e.to_string())?;
    }

    let file_path = folder_path.join(format!("{}.pdf", id));

    println!("DEBUG: Received PDF data request for ID: {}", id);

    // Remove data URI prefix if present
    let clean_base64 = if let Some(index) = pdf_data.find(',') {
        &pdf_data[index + 1..]
    } else {
        &pdf_data
    };

    println!(
        "DEBUG: Processing PDF data of length: {}",
        clean_base64.len()
    );

    let decoded = general_purpose::STANDARD
        .decode(clean_base64)
        .map_err(|e| format!("Base64 decode error: {}", e))?;

    tokio::fs::write(&file_path, decoded)
        .await
        .map_err(|e| format!("File write error: {}", e))?;

    println!("DEBUG: Saved PDF to {:?}", file_path);
    Ok(file_path.to_string_lossy().to_string())
}

#[tauri::command]
async fn transcribe_audio(app: AppHandle, audio_data: Vec<u8>) -> Result<String, String> {
    println!("Rust: Received {} bytes of audio", audio_data.len());
    // 1. Decode WAV to Samples (Critical Step)
    let cursor = Cursor::new(audio_data);
    let mut reader = hound::WavReader::new(cursor).map_err(|e| e.to_string())?;

    // Convert to 16-bit Mono Samples for Whisper
    let samples: Vec<i16> = reader.samples::<i16>().map(|s| s.unwrap_or(0)).collect();

    // Convert i16 to f32 (Whisper expects floats between -1.0 and 1.0)
    let audio_f32: Vec<f32> = samples.iter().map(|&s| s as f32 / 32768.0).collect();

    // 2. Load Model
    // Use your 'ensure_model_exists' function from Task 1 here to get the path
    let model_path = crate::model_manager::ensure_model_exists(&app).map_err(|e| e.to_string())?;

    let ctx = WhisperContext::new_with_params(&model_path, Default::default())
        .map_err(|_| "Failed to load model".to_string())?;
    let mut state = ctx.create_state().expect("failed to create state");

    // 3. Configure Whisper Params
    let mut params = FullParams::new(SamplingStrategy::Greedy { best_of: 1 });
    params.set_language(Some("en"));
    params.set_print_special(false);
    params.set_print_progress(false);

    // 4. Run Inference
    state
        .full(params, &audio_f32[..])
        .map_err(|_| "failed to run model".to_string())?;

    // 5. Extract Text
    let num_segments = state
        .full_n_segments()
        .map_err(|_| "failed to get segments".to_string())?;
    let mut result = String::new();
    for i in 0..num_segments {
        let segment = state
            .full_get_segment_text(i)
            .map_err(|_| "failed to get text".to_string())?;
        result.push_str(&segment);
        result.push(' ');
    }
    println!("Rust: Transcription complete: '{}'", result.trim());
    Ok(result.trim().to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    dotenv().ok();
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            match model_manager::ensure_model_exists(app.handle()) {
                Ok(path) => println!("Whisper model ready at: {}", path),
                Err(e) => println!("Warning: Failed to ensure Whisper model: {}", e),
            }
            Ok(())
        })
        .manage(AppState {
            db_path: Mutex::new(String::new()),
        })
        .invoke_handler(tauri::generate_handler![
            init_db,
            save_audio_blob,
            save_image,
            get_recordings,
            analyze_audio,
            analyze_image,
            confirm_invoice,
            confirm_task,
            confirm_contact,
            confirm_expense,
            save_invoice_pdf,
            get_invoices,
            get_tasks,
            get_contacts,
            get_expenses,
            get_financial_summary,
            get_recent_activity,
            open_system_link,
            open_invoice_pdf,
            transcribe_audio
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

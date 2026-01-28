use std::fs;
use std::io::Write;

use tauri::AppHandle;
use tauri::Manager;

const MODEL_URL: &str =
    "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.en.bin";
const MODEL_FILENAME: &str = "ggml-base.en.bin";

pub fn ensure_model_exists(app_handle: &AppHandle) -> Result<String, String> {
    let app_data_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to resolve app data dir: {}", e))?;

    let models_dir = app_data_dir.join("models");

    if !models_dir.exists() {
        fs::create_dir_all(&models_dir)
            .map_err(|e| format!("Failed to create models dir: {}", e))?;
    }

    let model_path = models_dir.join(MODEL_FILENAME);

    if model_path.exists() {
        println!("DEBUG: Model found at {:?}", model_path);
        return Ok(model_path.to_string_lossy().to_string());
    }

    println!("DEBUG: Model not found. Downloading from {}", MODEL_URL);

    // Download the model
    let client = reqwest::blocking::Client::builder()
        .user_agent("ConstructionOS/1.0")
        .build()
        .map_err(|e| e.to_string())?;

    let response = client
        .get(MODEL_URL)
        .send()
        .map_err(|e| format!("Failed to request model: {}", e))?;

    if !response.status().is_success() {
        return Err(format!(
            "Failed to download model: HTTP {}",
            response.status()
        ));
    }

    let bytes = response
        .bytes()
        .map_err(|e| format!("Failed to get model bytes: {}", e))?;

    let mut file =
        fs::File::create(&model_path).map_err(|e| format!("Failed to create model file: {}", e))?;

    file.write_all(&bytes)
        .map_err(|e| format!("Failed to write model file: {}", e))?;

    println!("DEBUG: Model downloaded successfully to {:?}", model_path);

    Ok(model_path.to_string_lossy().to_string())
}

use axum::{
    extract::State,
    response::Html,
    routing::get,
    Json, Router,
};
use local_ip_address::local_ip;
use qr_code::QrCode;
use serde::Serialize;
use std::{
    fs,
    net::SocketAddr,
    sync::Mutex,
};
use tauri::{AppHandle, Manager};
use tokio::net::TcpListener;
use tower_http::{cors::CorsLayer, services::ServeDir};
use base64::Engine;

// Shared state for the Axum server
#[derive(Clone)]
struct ServerState {
    root_dir: String,
}

// Global state to manage the background server task
pub struct ServerManager {
    shutdown_tx: Mutex<Option<tokio::sync::oneshot::Sender<()>>>,
}

impl ServerManager {
    pub fn new() -> Self {
        Self {
            shutdown_tx: Mutex::new(None),
        }
    }
}

#[derive(Serialize)]
pub struct ServerInfo {
    ip: String,
    port: u16,
    qr_code: String, // Base64 encoded PNG
}

#[derive(Serialize)]
pub struct FileInfo {
    name: String,
    path: String,
    is_dir: bool,
    mime_type: String,
}

#[tauri::command]
pub async fn start_server(
    app: AppHandle,
    path: String,
    port: u16,
) -> Result<ServerInfo, String> {
    let state = app.state::<ServerManager>();
    let mut shutdown_guard = state.shutdown_tx.lock().map_err(|e| e.to_string())?;

    if shutdown_guard.is_some() {
        return Err("Server is already running".into());
    }

    let (tx, rx) = tokio::sync::oneshot::channel();
    *shutdown_guard = Some(tx);

    let root_path = path.clone();

    // Spawn the server task
    tauri::async_runtime::spawn(async move {
        let app_state = ServerState {
            root_dir: root_path.clone(),
        };

        // Create router
        let app = Router::new()
            .route("/", get(serve_root))
            .route("/api/files", get(list_files))
            .nest_service("/content", ServeDir::new(root_path))
            .layer(CorsLayer::permissive())
            .with_state(app_state);

        let addr = SocketAddr::from(([0, 0, 0, 0], port));
        let listener = TcpListener::bind(addr).await.unwrap();
        
        axum::serve(listener, app)
            .with_graceful_shutdown(async {
                rx.await.ok();
            })
            .await
            .unwrap();
    });

    // Get Local IP
    let my_local_ip = local_ip().map_err(|e| e.to_string())?;
    let ip_str = my_local_ip.to_string();

    // Generate QR Code
    let url = format!("http://{}:{}", ip_str, port);
    let qr = QrCode::new(&url).map_err(|e| e.to_string())?;
    
    // Create QR image
    let width = qr.width();
    let mut image = image::GrayImage::new(width as u32 * 4, width as u32 * 4);
    
    for y in 0..width {
        for x in 0..width {
            let pixel = qr[(y, x)];
            // qr_code::Color enum - Dark = true, Light = false
            let is_dark = pixel == qr_code::Color::Dark;
            let color = if is_dark { image::Luma([0u8]) } else { image::Luma([255u8]) };
            for dy in 0..4 {
                for dx in 0..4 {
                    image.put_pixel((x as u32 * 4 + dx), (y as u32 * 4 + dy), color);
                }
            }
        }
    }
    
    // Convert QR to Base64
    let mut buffer = std::io::Cursor::new(Vec::new());
    image.write_to(&mut buffer, image::ImageOutputFormat::Png)
         .map_err(|e: image::ImageError| e.to_string())?;
    let base64_qr = base64::engine::general_purpose::STANDARD.encode(buffer.get_ref());

    Ok(ServerInfo {
        ip: ip_str,
        port,
        qr_code: format!("data:image/png;base64,{}", base64_qr),
    })
}

#[tauri::command]
pub async fn stop_server(app: AppHandle) -> Result<(), String> {
    let state = app.state::<ServerManager>();
    let mut shutdown_guard = state.shutdown_tx.lock().map_err(|e| e.to_string())?;

    if let Some(tx) = shutdown_guard.take() {
        let _ = tx.send(());
    }

    Ok(())
}

async fn serve_root() -> Html<&'static str> {
    Html(include_str!("../../src/mobile/index.html"))
}

async fn list_files(State(state): State<ServerState>) -> Json<Vec<FileInfo>> {
    let mut files = Vec::new();
    
    if let Ok(entries) = fs::read_dir(&state.root_dir) {
        for entry in entries {
            if let Ok(entry) = entry {
                let path = entry.path();
                if path.is_file() {
                    let name = entry.file_name().to_string_lossy().to_string();
                    let extension = path.extension().and_then(|e| e.to_str()).unwrap_or("").to_lowercase();
                    
                    let mime_type = match extension.as_str() {
                        "jpg" | "jpeg" | "png" | "gif" | "webp" => "image",
                        "mp4" | "webm" | "mov" | "mkv" => "video",
                        _ => continue, // Skip unsupported files
                    };

                    files.push(FileInfo {
                        name,
                        path: format!("/content/{}", entry.file_name().to_string_lossy()),
                        is_dir: false,
                        mime_type: mime_type.to_string(),
                    });
                }
            }
        }
    }
    
    // Sort files? simple alphabetical for now
    files.sort_by(|a, b| a.name.cmp(&b.name));
    
    Json(files)
}

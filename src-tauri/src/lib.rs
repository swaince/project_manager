use base64::{engine::general_purpose::STANDARD, Engine as _};
use calamine::{open_workbook_auto, Data, Reader};
use serde::Serialize;
use std::path::{Path, PathBuf};
use tauri::Manager;
use tauri_plugin_sql::{Migration, MigrationKind};

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ExcelRow {
    row: usize,
    cells: Vec<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ExcelSheet {
    sheet: String,
    rows: Vec<ExcelRow>,
}

fn excel_cell_text(cell: &Data) -> String {
    match cell {
        Data::Empty => String::new(),
        Data::String(value) => value.clone(),
        Data::Float(value) => {
            if value.fract() == 0.0 {
                format!("{}", *value as i64)
            } else {
                value.to_string()
            }
        }
        Data::Int(value) => value.to_string(),
        Data::Bool(value) => {
            if *value {
                "TRUE".to_string()
            } else {
                "FALSE".to_string()
            }
        }
        Data::DateTime(value) => value.to_string(),
        Data::DateTimeIso(value) => value.clone(),
        Data::DurationIso(value) => value.clone(),
        Data::Error(value) => format!("{value:?}"),
    }
}

fn validate_excel_path(path: &str) -> Result<(), String> {
    let source = Path::new(path);
    if !source.is_file() {
        return Err("文件不存在".to_string());
    }
    let extension = source
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or("")
        .to_lowercase();
    if !matches!(extension.as_str(), "xlsx" | "xls" | "ods") {
        return Err("只支持 .xlsx、.xls 或 .ods 文件".to_string());
    }
    let metadata = std::fs::metadata(source).map_err(|error| error.to_string())?;
    if metadata.len() > 20 * 1024 * 1024 {
        return Err("文件超过 20MB，请拆分后再导入".to_string());
    }
    Ok(())
}

#[tauri::command]
fn list_excel_sheets(path: String) -> Result<Vec<String>, String> {
    validate_excel_path(&path)?;
    let workbook = open_workbook_auto(&path).map_err(|error| error.to_string())?;
    Ok(workbook.sheet_names().to_vec())
}

#[tauri::command]
fn read_excel_sheet(path: String, sheet: String) -> Result<ExcelSheet, String> {
    validate_excel_path(&path)?;
    let mut workbook = open_workbook_auto(&path).map_err(|error| error.to_string())?;
    let range = workbook
        .worksheet_range(&sheet)
        .map_err(|error| error.to_string())?;

    let rows = range
        .rows()
        .take(5000)
        .enumerate()
        .map(|(index, cells)| ExcelRow {
            row: index + 1,
            cells: cells
                .iter()
                .take(40)
                .map(excel_cell_text)
                .collect::<Vec<String>>(),
        })
        .collect::<Vec<ExcelRow>>();

    Ok(ExcelSheet { sheet, rows })
}

#[tauri::command]
fn copy_source_document(
    app: tauri::AppHandle,
    project_id: String,
    path: String,
) -> Result<String, String> {
    validate_excel_path(&path)?;
    let safe_project_id = project_id
        .chars()
        .filter(|value| value.is_ascii_alphanumeric() || *value == '-')
        .collect::<String>();
    if safe_project_id.is_empty() {
        return Err("项目标识无效".to_string());
    }

    let source = Path::new(&path);
    let file_name = source
        .file_name()
        .and_then(|value| value.to_str())
        .ok_or_else(|| "文件名无效".to_string())?;
    let app_dir = app
        .path()
        .app_data_dir()
        .map_err(|error| error.to_string())?;
    let directory = app_dir.join("source_documents").join(&safe_project_id);
    std::fs::create_dir_all(&directory).map_err(|error| error.to_string())?;

    let stamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_err(|error| error.to_string())?
        .as_millis();
    let destination = directory.join(format!("{stamp}_{file_name}"));
    std::fs::copy(source, &destination).map_err(|error| error.to_string())?;
    Ok(destination.to_string_lossy().to_string())
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct SavedAttachment {
    file_name: String,
    file_path: String,
    mime_type: String,
    file_size: u64,
}

fn attachment_mime(file_name: &str) -> &'static str {
    let extension = Path::new(file_name)
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or("")
        .to_lowercase();
    match extension.as_str() {
        "png" => "image/png",
        "jpg" | "jpeg" | "jfif" => "image/jpeg",
        "gif" => "image/gif",
        "webp" => "image/webp",
        "bmp" => "image/bmp",
        "svg" => "image/svg+xml",
        "pdf" => "application/pdf",
        "doc" => "application/msword",
        "docx" => "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "xls" => "application/vnd.ms-excel",
        "xlsx" => "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "ppt" => "application/vnd.ms-powerpoint",
        "pptx" => "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "txt" => "text/plain",
        "csv" => "text/csv",
        "m4a" => "audio/mp4",
        "mp3" => "audio/mpeg",
        "wav" => "audio/wav",
        "webm" => "audio/webm",
        "ogg" => "audio/ogg",
        "aac" => "audio/aac",
        "zip" => "application/zip",
        _ => "application/octet-stream",
    }
}

fn sanitize_attachment_name(file_name: &str) -> String {
    let base = Path::new(file_name)
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or("attachment");
    let cleaned = base
        .chars()
        .map(|value| {
            if value.is_control()
                || matches!(
                    value,
                    '/' | '\\' | ':' | '*' | '?' | '"' | '<' | '>' | '|'
                )
            {
                '_'
            } else {
                value
            }
        })
        .collect::<String>();
    let cleaned = cleaned.trim();
    if cleaned.is_empty() {
        "attachment".to_string()
    } else {
        cleaned.to_string()
    }
}

fn safe_segment(value: &str) -> Result<String, String> {
    let safe = value
        .chars()
        .filter(|character| character.is_ascii_alphanumeric() || *character == '-')
        .collect::<String>();
    if safe.is_empty() {
        Err("目录标识无效".to_string())
    } else {
        Ok(safe)
    }
}

fn attachment_directory(
    app: &tauri::AppHandle,
    project_id: &str,
    communication_id: &str,
) -> Result<PathBuf, String> {
    let app_dir = app
        .path()
        .app_data_dir()
        .map_err(|error| error.to_string())?;
    let directory = app_dir
        .join("attachments")
        .join(safe_segment(project_id)?)
        .join(safe_segment(communication_id)?);
    std::fs::create_dir_all(&directory).map_err(|error| error.to_string())?;
    Ok(directory)
}

fn unique_attachment_path(directory: &Path, file_name: &str) -> Result<PathBuf, String> {
    let stamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_err(|error| error.to_string())?
        .as_millis();
    Ok(directory.join(format!("{stamp}_{file_name}")))
}

fn validate_attachment_source(path: &str) -> Result<u64, String> {
    let source = Path::new(path);
    if !source.is_file() {
        return Err("附件文件不存在".to_string());
    }
    let metadata = std::fs::metadata(source).map_err(|error| error.to_string())?;
    if metadata.len() > 50 * 1024 * 1024 {
        return Err("单个附件不能超过 50MB".to_string());
    }
    Ok(metadata.len())
}

#[tauri::command]
fn copy_attachment(
    app: tauri::AppHandle,
    project_id: String,
    communication_id: String,
    source_path: String,
) -> Result<SavedAttachment, String> {
    let file_size = validate_attachment_source(&source_path)?;
    let source = Path::new(&source_path);
    let file_name = sanitize_attachment_name(
        source
            .file_name()
            .and_then(|value| value.to_str())
            .unwrap_or("attachment"),
    );
    let directory = attachment_directory(&app, &project_id, &communication_id)?;
    let destination = unique_attachment_path(&directory, &file_name)?;
    std::fs::copy(source, &destination).map_err(|error| error.to_string())?;
    Ok(SavedAttachment {
        file_name: file_name.clone(),
        file_path: destination.to_string_lossy().to_string(),
        mime_type: attachment_mime(&file_name).to_string(),
        file_size,
    })
}

#[tauri::command]
fn save_attachment_bytes(
    app: tauri::AppHandle,
    project_id: String,
    communication_id: String,
    file_name: String,
    data_base64: String,
) -> Result<SavedAttachment, String> {
    let bytes = STANDARD
        .decode(data_base64.as_bytes())
        .map_err(|error| format!("附件数据解析失败：{error}"))?;
    if bytes.len() > 100 * 1024 * 1024 {
        return Err("附件不能超过 100MB".to_string());
    }
    let file_name = sanitize_attachment_name(&file_name);
    let directory = attachment_directory(&app, &project_id, &communication_id)?;
    let destination = unique_attachment_path(&directory, &file_name)?;
    std::fs::write(&destination, &bytes).map_err(|error| error.to_string())?;
    Ok(SavedAttachment {
        file_name: file_name.clone(),
        file_path: destination.to_string_lossy().to_string(),
        mime_type: attachment_mime(&file_name).to_string(),
        file_size: bytes.len() as u64,
    })
}

#[tauri::command]
fn read_attachment_data_url(app: tauri::AppHandle, path: String) -> Result<String, String> {
    let app_dir = app
        .path()
        .app_data_dir()
        .map_err(|error| error.to_string())?;
    let attachments_root = app_dir.join("attachments");
    let canonical_path = Path::new(&path)
        .canonicalize()
        .map_err(|error| error.to_string())?;
    let canonical_root = attachments_root
        .canonicalize()
        .map_err(|error| error.to_string())?;
    if !canonical_path.starts_with(&canonical_root) {
        return Err("附件路径无效".to_string());
    }
    let metadata = std::fs::metadata(&canonical_path).map_err(|error| error.to_string())?;
    if metadata.len() > 10 * 1024 * 1024 {
        return Err("图片超过 10MB，无法预览".to_string());
    }
    let file_name = canonical_path
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or("");
    let mime_type = attachment_mime(file_name);
    if !mime_type.starts_with("image/") {
        return Err("这个附件不是图片".to_string());
    }
    let bytes = std::fs::read(&canonical_path).map_err(|error| error.to_string())?;
    Ok(format!(
        "data:{mime_type};base64,{}",
        STANDARD.encode(bytes)
    ))
}



fn migrations() -> Vec<Migration> {
    vec![
        Migration {
            version: 1,
            description: "create_clients",
            sql: r#"
                CREATE TABLE IF NOT EXISTS clients (
                    id          TEXT PRIMARY KEY,
                    name        TEXT NOT NULL,
                    contact     TEXT,
                    phone       TEXT,
                    notes       TEXT NOT NULL DEFAULT '',
                    created_at  TEXT NOT NULL,
                    updated_at  TEXT NOT NULL
                )
            "#,
            kind: MigrationKind::Up,
        },
        Migration {
            version: 2,
            description: "create_projects",
            sql: r#"
                CREATE TABLE IF NOT EXISTS projects (
                    id          TEXT PRIMARY KEY,
                    client_id   TEXT REFERENCES clients(id) ON DELETE SET NULL,
                    name        TEXT NOT NULL,
                    code        TEXT NOT NULL UNIQUE,
                    description TEXT NOT NULL DEFAULT '',
                    status      TEXT NOT NULL DEFAULT 'active'
                                CHECK (status IN ('negotiating', 'active', 'paused', 'delivered', 'archived')),
                    start_date  TEXT,
                    target_date TEXT,
                    req_seq     INTEGER NOT NULL DEFAULT 0,
                    cr_seq      INTEGER NOT NULL DEFAULT 0,
                    created_at  TEXT NOT NULL,
                    updated_at  TEXT NOT NULL
                )
            "#,
            kind: MigrationKind::Up,
        },
        Migration {
            version: 3,
            description: "index_projects_client",
            sql: "CREATE INDEX IF NOT EXISTS idx_projects_client ON projects(client_id)",
            kind: MigrationKind::Up,
        },
        Migration {
            version: 4,
            description: "index_projects_updated",
            sql: "CREATE INDEX IF NOT EXISTS idx_projects_updated ON projects(updated_at)",
            kind: MigrationKind::Up,
        },
        Migration {
            version: 5,
            description: "rename_clients_to_stakeholders",
            sql: "ALTER TABLE clients RENAME TO stakeholders",
            kind: MigrationKind::Up,
        },
        Migration {
            version: 6,
            description: "create_project_stakeholders",
            sql: r#"
                CREATE TABLE IF NOT EXISTS project_stakeholders (
                    project_id     TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
                    stakeholder_id TEXT NOT NULL REFERENCES stakeholders(id) ON DELETE CASCADE,
                    PRIMARY KEY (project_id, stakeholder_id)
                )
            "#,
            kind: MigrationKind::Up,
        },
        Migration {
            version: 7,
            description: "migrate_project_client_to_stakeholders",
            sql: r#"
                INSERT OR IGNORE INTO project_stakeholders (project_id, stakeholder_id)
                SELECT id, client_id FROM projects WHERE client_id IS NOT NULL
            "#,
            kind: MigrationKind::Up,
        },
        // projects.client_id 和 stakeholders.contact 保留为遗留列但不再使用。
        // SQLite 的 DROP COLUMN 对参与外键/旧数据的列有限制，重建表不值得，
        // 新代码写入时不会设置这两个列。
        Migration {
            version: 8,
            description: "drop_legacy_projects_client_index",
            sql: "DROP INDEX IF EXISTS idx_projects_client",
            kind: MigrationKind::Up,
        },
        Migration {
            version: 9,
            description: "add_stakeholder_role",
            sql: "ALTER TABLE stakeholders ADD COLUMN role TEXT",
            kind: MigrationKind::Up,
        },
        Migration {
            version: 10,
            description: "add_stakeholder_company",
            sql: "ALTER TABLE stakeholders ADD COLUMN company TEXT",
            kind: MigrationKind::Up,
        },
        Migration {
            version: 11,
            description: "convert_stakeholder_role_codes_to_text",
            sql: r#"
                UPDATE stakeholders
                SET role = CASE role
                    WHEN 'client_contact' THEN '客户联系人'
                    WHEN 'decision_maker' THEN '决策人'
                    WHEN 'tech_lead' THEN '技术负责人'
                    WHEN 'acceptance' THEN '验收人'
                    WHEN 'other' THEN '其他'
                    ELSE role
                END
                WHERE role IN ('client_contact', 'decision_maker', 'tech_lead', 'acceptance', 'other')
            "#,
            kind: MigrationKind::Up,
        },
        Migration {
            version: 12,
            description: "create_stakeholder_contacts",
            sql: r#"
                CREATE TABLE IF NOT EXISTS stakeholder_contacts (
                    id             TEXT PRIMARY KEY,
                    stakeholder_id TEXT NOT NULL REFERENCES stakeholders(id) ON DELETE CASCADE,
                    type           TEXT NOT NULL DEFAULT 'phone',
                    value          TEXT NOT NULL,
                    sort_order     INTEGER NOT NULL DEFAULT 0,
                    created_at     TEXT NOT NULL
                )
            "#,
            kind: MigrationKind::Up,
        },
        Migration {
            version: 13,
            description: "migrate_stakeholder_phone_to_contacts",
            sql: r#"
                INSERT INTO stakeholder_contacts (id, stakeholder_id, type, value, sort_order, created_at)
                SELECT
                    lower(hex(randomblob(16))),
                    id,
                    'phone',
                    phone,
                    0,
                    strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
                FROM stakeholders
                WHERE phone IS NOT NULL AND trim(phone) <> ''
            "#,
            kind: MigrationKind::Up,
        },
        Migration {
            version: 14,
            description: "add_project_stakeholder_role",
            sql: "ALTER TABLE project_stakeholders ADD COLUMN role TEXT",
            kind: MigrationKind::Up,
        },
        Migration {
            version: 15,
            description: "migrate_stakeholder_role_to_project",
            sql: r#"
                UPDATE project_stakeholders
                SET role = (
                    SELECT s.role
                    FROM stakeholders s
                    WHERE s.id = project_stakeholders.stakeholder_id
                )
                WHERE role IS NULL
            "#,
            kind: MigrationKind::Up,
        },
        // projects.status 带有旧的 CHECK 约束，无法直接写入 pending_start。
        // 新状态写入 lifecycle_status，旧 status 列保留为遗留列。
        Migration {
            version: 16,
            description: "add_project_lifecycle_status",
            sql: "ALTER TABLE projects ADD COLUMN lifecycle_status TEXT",
            kind: MigrationKind::Up,
        },
        Migration {
            version: 17,
            description: "migrate_project_status_to_lifecycle_status",
            sql: "UPDATE projects SET lifecycle_status = status WHERE lifecycle_status IS NULL",
            kind: MigrationKind::Up,
        },
        Migration {
            version: 18,
            description: "create_requirements",
            sql: r#"
                CREATE TABLE IF NOT EXISTS requirements (
                    id                  TEXT PRIMARY KEY,
                    project_id          TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
                    parent_id           TEXT REFERENCES requirements(id) ON DELETE SET NULL,
                    depth               INTEGER NOT NULL DEFAULT 0,
                    code                TEXT NOT NULL UNIQUE,
                    title               TEXT NOT NULL,
                    description         TEXT NOT NULL DEFAULT '',
                    acceptance_criteria TEXT NOT NULL DEFAULT '',
                    design_notes        TEXT NOT NULL DEFAULT '',
                    type                TEXT NOT NULL DEFAULT 'feature',
                    source              TEXT NOT NULL DEFAULT 'client',
                    priority            INTEGER NOT NULL DEFAULT 1,
                    status              TEXT NOT NULL DEFAULT 'draft',
                    estimate_days       REAL,
                    current_revision_no INTEGER NOT NULL DEFAULT 1,
                    confirmed_at        TEXT,
                    dev_started_at      TEXT,
                    dev_completed_at    TEXT,
                    cancelled_at        TEXT,
                    cancel_reason       TEXT,
                    sort_order          INTEGER NOT NULL DEFAULT 0,
                    created_at          TEXT NOT NULL,
                    updated_at          TEXT NOT NULL
                )
            "#,
            kind: MigrationKind::Up,
        },
        Migration {
            version: 19,
            description: "create_requirement_revisions",
            sql: r#"
                CREATE TABLE IF NOT EXISTS requirement_revisions (
                    id             TEXT PRIMARY KEY,
                    requirement_id TEXT NOT NULL REFERENCES requirements(id) ON DELETE CASCADE,
                    revision_no    INTEGER NOT NULL,
                    snapshot_json  TEXT NOT NULL,
                    change_summary TEXT NOT NULL DEFAULT '',
                    created_at     TEXT NOT NULL,
                    UNIQUE (requirement_id, revision_no)
                )
            "#,
            kind: MigrationKind::Up,
        },
        Migration {
            version: 20,
            description: "index_requirements_project",
            sql: "CREATE INDEX IF NOT EXISTS idx_requirements_project ON requirements(project_id)",
            kind: MigrationKind::Up,
        },
        Migration {
            version: 21,
            description: "index_requirements_parent",
            sql: "CREATE INDEX IF NOT EXISTS idx_requirements_parent ON requirements(parent_id)",
            kind: MigrationKind::Up,
        },
        Migration {
            version: 22,
            description: "create_communications",
            sql: r#"
                CREATE TABLE IF NOT EXISTS communications (
                    id           TEXT PRIMARY KEY,
                    project_id   TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
                    occurred_at  TEXT NOT NULL,
                    channel      TEXT NOT NULL DEFAULT 'meeting',
                    participants TEXT NOT NULL DEFAULT '',
                    summary      TEXT NOT NULL DEFAULT '',
                    decisions    TEXT NOT NULL DEFAULT '',
                    follow_ups   TEXT NOT NULL DEFAULT '',
                    created_at   TEXT NOT NULL,
                    updated_at   TEXT NOT NULL
                )
            "#,
            kind: MigrationKind::Up,
        },
        Migration {
            version: 23,
            description: "create_communication_requirements",
            sql: r#"
                CREATE TABLE IF NOT EXISTS communication_requirements (
                    communication_id TEXT NOT NULL REFERENCES communications(id) ON DELETE CASCADE,
                    requirement_id   TEXT NOT NULL REFERENCES requirements(id) ON DELETE CASCADE,
                    PRIMARY KEY (communication_id, requirement_id)
                )
            "#,
            kind: MigrationKind::Up,
        },
        Migration {
            version: 24,
            description: "index_communications_project",
            sql: "CREATE INDEX IF NOT EXISTS idx_communications_project ON communications(project_id)",
            kind: MigrationKind::Up,
        },
        Migration {
            version: 25,
            description: "index_communication_requirements_requirement",
            sql: "CREATE INDEX IF NOT EXISTS idx_communication_requirements_requirement ON communication_requirements(requirement_id)",
            kind: MigrationKind::Up,
        },
        Migration {
            version: 26,
            description: "create_source_documents",
            sql: r#"
                CREATE TABLE IF NOT EXISTS source_documents (
                    id          TEXT PRIMARY KEY,
                    project_id  TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
                    doc_no      INTEGER NOT NULL,
                    title       TEXT NOT NULL,
                    version     TEXT NOT NULL DEFAULT '',
                    file_name   TEXT NOT NULL,
                    file_path   TEXT NOT NULL,
                    sheet_name  TEXT NOT NULL DEFAULT '',
                    note        TEXT NOT NULL DEFAULT '',
                    imported_at TEXT NOT NULL,
                    created_at  TEXT NOT NULL,
                    UNIQUE (project_id, doc_no)
                )
            "#,
            kind: MigrationKind::Up,
        },
        Migration {
            version: 27,
            description: "create_source_requirements",
            sql: r#"
                CREATE TABLE IF NOT EXISTS source_requirements (
                    id           TEXT PRIMARY KEY,
                    project_id   TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
                    document_id  TEXT NOT NULL REFERENCES source_documents(id) ON DELETE CASCADE,
                    module_name  TEXT NOT NULL DEFAULT '',
                    code         TEXT NOT NULL,
                    title        TEXT NOT NULL,
                    description  TEXT NOT NULL DEFAULT '',
                    source_row   INTEGER NOT NULL DEFAULT 0,
                    sort_order   INTEGER NOT NULL DEFAULT 0,
                    created_at   TEXT NOT NULL,
                    UNIQUE (document_id, code)
                )
            "#,
            kind: MigrationKind::Up,
        },
        Migration {
            version: 28,
            description: "create_requirement_sources",
            sql: r#"
                CREATE TABLE IF NOT EXISTS requirement_sources (
                    requirement_id        TEXT NOT NULL REFERENCES requirements(id) ON DELETE CASCADE,
                    source_requirement_id TEXT NOT NULL REFERENCES source_requirements(id) ON DELETE CASCADE,
                    PRIMARY KEY (requirement_id, source_requirement_id)
                )
            "#,
            kind: MigrationKind::Up,
        },
        Migration {
            version: 29,
            description: "create_communication_source_requirements",
            sql: r#"
                CREATE TABLE IF NOT EXISTS communication_source_requirements (
                    communication_id      TEXT NOT NULL REFERENCES communications(id) ON DELETE CASCADE,
                    source_requirement_id TEXT NOT NULL REFERENCES source_requirements(id) ON DELETE CASCADE,
                    PRIMARY KEY (communication_id, source_requirement_id)
                )
            "#,
            kind: MigrationKind::Up,
        },
        Migration {
            version: 30,
            description: "add_requirement_origin",
            sql: "ALTER TABLE requirements ADD COLUMN origin TEXT NOT NULL DEFAULT 'direct'",
            kind: MigrationKind::Up,
        },
        Migration {
            version: 31,
            description: "add_requirement_origin_communication",
            sql: "ALTER TABLE requirements ADD COLUMN origin_communication_id TEXT REFERENCES communications(id) ON DELETE SET NULL",
            kind: MigrationKind::Up,
        },
        Migration {
            version: 32,
            description: "index_source_documents_project",
            sql: "CREATE INDEX IF NOT EXISTS idx_source_documents_project ON source_documents(project_id)",
            kind: MigrationKind::Up,
        },
        Migration {
            version: 33,
            description: "index_source_requirements_project",
            sql: "CREATE INDEX IF NOT EXISTS idx_source_requirements_project ON source_requirements(project_id)",
            kind: MigrationKind::Up,
        },
        Migration {
            version: 34,
            description: "index_source_requirements_document",
            sql: "CREATE INDEX IF NOT EXISTS idx_source_requirements_document ON source_requirements(document_id)",
            kind: MigrationKind::Up,
        },
        Migration {
            version: 35,
            description: "index_requirement_sources_source",
            sql: "CREATE INDEX IF NOT EXISTS idx_requirement_sources_source ON requirement_sources(source_requirement_id)",
            kind: MigrationKind::Up,
        },
        Migration {
            version: 36,
            description: "index_communication_source_requirements_source",
            sql: "CREATE INDEX IF NOT EXISTS idx_communication_source_requirements_source ON communication_source_requirements(source_requirement_id)",
            kind: MigrationKind::Up,
        },
        Migration {
            version: 37,
            description: "index_requirements_project_origin",
            sql: "CREATE INDEX IF NOT EXISTS idx_requirements_project_origin ON requirements(project_id, origin)",
            kind: MigrationKind::Up,
        },
        Migration {
            version: 38,
            description: "add_source_document_is_manual",
            sql: "ALTER TABLE source_documents ADD COLUMN is_manual INTEGER NOT NULL DEFAULT 0",
            kind: MigrationKind::Up,
        },
        Migration {
            version: 39,
            description: "index_source_documents_manual",
            sql: "CREATE INDEX IF NOT EXISTS idx_source_documents_manual ON source_documents(project_id, is_manual)",
            kind: MigrationKind::Up,
        },
        Migration {
            version: 40,
            description: "add_communication_title",
            sql: "ALTER TABLE communications ADD COLUMN title TEXT NOT NULL DEFAULT ''",
            kind: MigrationKind::Up,
        },
        Migration {
            version: 41,
            description: "add_communication_status",
            sql: "ALTER TABLE communications ADD COLUMN status TEXT NOT NULL DEFAULT 'completed'",
            kind: MigrationKind::Up,
        },
        Migration {
            version: 42,
            description: "add_communication_completed_at",
            sql: "ALTER TABLE communications ADD COLUMN completed_at TEXT",
            kind: MigrationKind::Up,
        },
        Migration {
            version: 43,
            description: "add_communication_archived_at",
            sql: "ALTER TABLE communications ADD COLUMN archived_at TEXT",
            kind: MigrationKind::Up,
        },
        Migration {
            version: 44,
            description: "create_communication_sessions",
            sql: r#"
                CREATE TABLE IF NOT EXISTS communication_sessions (
                    id               TEXT PRIMARY KEY,
                    communication_id TEXT NOT NULL REFERENCES communications(id) ON DELETE CASCADE,
                    occurred_at      TEXT NOT NULL,
                    channel          TEXT NOT NULL DEFAULT 'meeting',
                    participants     TEXT NOT NULL DEFAULT '',
                    summary          TEXT NOT NULL DEFAULT '',
                    decisions        TEXT NOT NULL DEFAULT '',
                    follow_ups       TEXT NOT NULL DEFAULT '',
                    sort_order       INTEGER NOT NULL DEFAULT 0,
                    created_at       TEXT NOT NULL,
                    updated_at       TEXT NOT NULL
                )
            "#,
            kind: MigrationKind::Up,
        },
        Migration {
            version: 45,
            description: "migrate_communications_to_sessions",
            sql: r#"
                INSERT INTO communication_sessions
                    (id, communication_id, occurred_at, channel, participants, summary,
                     decisions, follow_ups, sort_order, created_at, updated_at)
                SELECT lower(hex(randomblob(16))), id, occurred_at, channel, participants,
                       summary, decisions, follow_ups, 0, created_at, updated_at
                FROM communications c
                WHERE NOT EXISTS (
                    SELECT 1 FROM communication_sessions s
                    WHERE s.communication_id = c.id
                )
            "#,
            kind: MigrationKind::Up,
        },
        Migration {
            version: 46,
            description: "backfill_communication_titles",
            sql: r#"
                UPDATE communications
                SET title = CASE
                        WHEN trim(summary) <> '' THEN substr(summary, 1, 80)
                        ELSE '沟通记录 ' || occurred_at
                    END,
                    status = 'completed',
                    completed_at = COALESCE(updated_at, created_at)
                WHERE title = ''
            "#,
            kind: MigrationKind::Up,
        },
        Migration {
            version: 47,
            description: "create_communication_attachments",
            sql: r#"
                CREATE TABLE IF NOT EXISTS communication_attachments (
                    id               TEXT PRIMARY KEY,
                    communication_id TEXT NOT NULL REFERENCES communications(id) ON DELETE CASCADE,
                    session_id       TEXT REFERENCES communication_sessions(id) ON DELETE CASCADE,
                    file_name        TEXT NOT NULL,
                    file_path        TEXT NOT NULL,
                    mime_type        TEXT NOT NULL DEFAULT '',
                    file_size        INTEGER NOT NULL DEFAULT 0,
                    source           TEXT NOT NULL DEFAULT 'file',
                    deleted_at       TEXT,
                    created_at       TEXT NOT NULL
                )
            "#,
            kind: MigrationKind::Up,
        },
        Migration {
            version: 48,
            description: "index_communication_sessions_communication",
            sql: "CREATE INDEX IF NOT EXISTS idx_communication_sessions_communication ON communication_sessions(communication_id, sort_order)",
            kind: MigrationKind::Up,
        },
        Migration {
            version: 49,
            description: "index_communication_attachments_communication",
            sql: "CREATE INDEX IF NOT EXISTS idx_communication_attachments_communication ON communication_attachments(communication_id, session_id)",
            kind: MigrationKind::Up,
        },
        Migration {
            version: 50,
            description: "add_communication_session_todos",
            sql: "ALTER TABLE communication_sessions ADD COLUMN todos TEXT NOT NULL DEFAULT '[]'",
            kind: MigrationKind::Up,
        },
    ]
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations("sqlite:project_manager.db", migrations())
                .build(),
        )
        .invoke_handler(tauri::generate_handler![
            list_excel_sheets,
            read_excel_sheet,
            copy_source_document,
            copy_attachment,
            save_attachment_bytes,
            read_attachment_data_url
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

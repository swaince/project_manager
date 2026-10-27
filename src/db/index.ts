import Database from "@tauri-apps/plugin-sql";

const DATABASE_URL = "sqlite:project_manager.db";

let databasePromise: Promise<Database> | null = null;

/**
 * 懒加载数据库连接。首次调用时创建 project_manager.db，
 * 后续调用复用同一个连接。
 */
export function getDatabase(): Promise<Database> {
  if (!databasePromise) {
    databasePromise = Database.load(DATABASE_URL);
  }
  return databasePromise;
}

import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";

export interface ExcelRow {
  row: number;
  cells: string[];
}

export interface ExcelSheetData {
  sheet: string;
  rows: ExcelRow[];
}

export async function chooseExcelFile(): Promise<string | null> {
  const selected = await open({
    multiple: false,
    directory: false,
    filters: [
      {
        name: "Excel",
        extensions: ["xlsx", "xls", "ods"],
      },
    ],
  });
  if (Array.isArray(selected)) return selected[0] ?? null;
  return selected ?? null;
}

export async function listExcelSheets(path: string): Promise<string[]> {
  return invoke<string[]>("list_excel_sheets", { path });
}

export async function readExcelSheet(
  path: string,
  sheet: string,
): Promise<ExcelSheetData> {
  return invoke<ExcelSheetData>("read_excel_sheet", { path, sheet });
}

export async function copySourceDocument(
  projectId: string,
  path: string,
): Promise<string> {
  return invoke<string>("copy_source_document", { projectId, path });
}

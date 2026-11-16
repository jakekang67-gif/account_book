import * as XLSX from "xlsx";
import { koreaToday } from "@/lib/date";

export type ExcelExpenseRow = {
  date: string;
  amount: number;
  description: string;
  category: string | null;
  subcategory: string | null;
};

/** 지출 목록을 엑셀 워크북으로 변환 */
export function expensesToWorkbook(expenses: ExcelExpenseRow[]) {
  const rows = expenses.map((item) => ({
    날짜: item.date,
    금액: item.amount,
    내용: item.description,
    대분류: item.category ?? "",
    소분류: item.subcategory ?? "",
  }));

  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "지출내역");
  return workbook;
}

/** 브라우저에서 .xlsx 다운로드 */
export function downloadExpensesExcel(expenses: ExcelExpenseRow[]) {
  const workbook = expensesToWorkbook(expenses);
  const stamp = koreaToday();
  XLSX.writeFile(workbook, `가계부_${stamp}.xlsx`);
}

/** Gmail 첨부용 base64 (표준) */
export function expensesToExcelBase64(expenses: ExcelExpenseRow[]) {
  const workbook = expensesToWorkbook(expenses);
  const buffer = XLSX.write(workbook, {
    type: "base64",
    bookType: "xlsx",
  }) as string;
  return {
    fileName: `가계부_${koreaToday()}.xlsx`,
    base64: buffer,
  };
}

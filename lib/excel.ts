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
    대분류: item.category ?? "",
    소분류: item.subcategory ?? "",
    내용: item.description,
  }));

  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "지출내역");
  return workbook;
}

/** 브라우저에서 .xlsx 다운로드 (오늘 이후 날짜는 제외) */
export function downloadExpensesExcel(expenses: ExcelExpenseRow[]) {
  const today = koreaToday();
  const occurred = expenses.filter((item) => item.date <= today);
  const workbook = expensesToWorkbook(occurred);
  const stamp = today;
  XLSX.writeFile(workbook, `가계부_${stamp}.xlsx`);
}

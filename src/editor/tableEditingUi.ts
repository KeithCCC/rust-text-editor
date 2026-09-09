export function tableEditingUi(language: "ja" | "en") {
  return language === "ja" ? {
    source: "ソースを編集", rendered: "表に戻す", invalid: "表の記法を修正すると表に戻せます",
    actions: "表の操作", addRow: "下に行を追加", deleteRow: "行を削除",
    addColumn: "右に列を追加", deleteColumn: "列を削除",
    left: "左揃え", center: "中央揃え", right: "右揃え", exit: "表の後へ移動",
    cell: (row: number, column: number) => `${row === 0 ? "見出し" : `行 ${row}`}、列 ${column + 1}`,
  } : {
    source: "Edit source", rendered: "Show table", invalid: "Fix the table syntax to show the table",
    actions: "Table actions", addRow: "Add row below", deleteRow: "Delete row",
    addColumn: "Add column after", deleteColumn: "Delete column",
    left: "Align left", center: "Align center", right: "Align right", exit: "Move after table",
    cell: (row: number, column: number) => `${row === 0 ? "Header" : `Row ${row}`}, column ${column + 1}`,
  };
}

(async()=>{
 const {EditorView}=await import('/node_modules/@codemirror/view/dist/index.js');
 const view=EditorView.findFromDOM(document.querySelector('.cm-content'));window.tableTestView=view;
 const source='# 表をそのまま編集\n\n本文はいつものMarkdownで編集できます。\n\n| 方針 |\n| --- |\n| **既存 CodeMirror に表専用の編集機能を追加**<br><br>セルをクリックして編集できます。 |\n\n## 実装の確認\n\n| 項目 | 状態 |\n| --- | --- |\n| 日本語の入力 | 本文へ反映 |\n| セル間の移動 | Tab / Shift+Tab |\n| セル内の改行 | Shift+Enter |';
 view.dispatch({changes:{from:0,to:view.state.doc.length,insert:source},selection:{anchor:0}});
 return {tableCount:document.querySelectorAll('.koharu-table').length};
})()

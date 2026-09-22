async (page) => {
  const html = await page.evaluate(async () => {
    const { createPdfHtml } = await import('/src/exportPdf.tsx');
    return await createPdfHtml({ content: '# 日本語 PDF 検証\n\n<section><p>構造タグ内の本文</p></section>\n\n| 項目 | 結果 |\n|---|---|\n| 表 | 正常 |\n\n- [x] タスク\n\n```mermaid\ngraph LR; A[開始]-->B[完了]\n```\n\n' + Array.from({length:80}, (_, i) => '段落 ' + (i+1) + '：複数ページの日本語文書を検証します。').join('\n\n'), currentFile: null, title:'日本語 PDF 検証', language:'ja' });
  });
  return {html};
}

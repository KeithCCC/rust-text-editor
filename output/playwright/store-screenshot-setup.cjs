async page => {
  await page.setViewportSize({width:1600,height:1000});
  await page.evaluate(() => {
    localStorage.setItem('koharu-theme','light');
    localStorage.setItem('koharu-language','ja');
    localStorage.setItem('koharu-editor-font-size','18');
    localStorage.setItem('koharu-preview-font-size','19');
    localStorage.setItem('koharu-ui-font-size','15');
    localStorage.setItem('koharu-toolbar-hint-dismissed','true');
  });
  await page.reload();
  await page.getByRole('textbox').fill('# 今日のメモ\n\nKoharuで、アイデアを読みやすい文書にまとめましょう。\n\n## やること\n\n- 思いついたことを書き留める\n- 見出しとリストで整理する\n- プレビューで仕上がりを確認する\n\n**大切なことは太字で**、読み手に伝わりやすく。\n\n> 書くことに集中できる、シンプルな道具。\n\n## アイデアを図にする\n\n```mermaid\nflowchart LR\n  A[アイデア] --> B[書く]\n  B --> C[整える]\n  C --> D[共有する]\n```');
  await page.getByRole('button',{name:'分割',exact:true}).click();
  await page.getByRole('button',{name:'表示',exact:true}).click();
}

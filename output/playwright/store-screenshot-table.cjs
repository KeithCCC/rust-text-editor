async page => {
  await page.reload();
  await page.getByRole('textbox').fill('# 今週の制作プラン\n\n予定を表にまとめて、セルをそのまま編集できます。\n\n## タスク一覧\n\n| タスク | 進捗 | 予定日 |\n| --- | --- | --- |\n| アイデアを整理 | <!--koharu:align=center-->完了 | <!--koharu:align=right-->9月21日 |\n| 記事の下書き | <!--koharu:align=center-->作業中 | <!--koharu:align=right-->9月22日 |\n| 図と表を追加 | <!--koharu:align=center-->未着手 | <!--koharu:align=right-->9月23日 |\n| 内容を確認 | <!--koharu:align=center-->未着手 | <!--koharu:align=right-->9月24日 |\n\n## 編集のヒント\n\n- セルをクリックして、内容を直接編集\n- 「…」から行・列の追加や削除\n- セルごとに左・中央・右揃えを選択\n\n**Tab**で次のセルへ、**Shift+Enter**でセル内改行。\n\n> 仕上がった文書は、PDFでも共有できます。');
  await page.getByRole('button', {name:'分割',exact:true}).click();
  await page.getByRole('button', {name:'表示',exact:true}).click();
  await page.getByRole('menuitemcheckbox', {name:'アウトライン',exact:true}).click();
}

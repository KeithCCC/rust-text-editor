async page => {
  await page.setViewportSize({width:1600,height:1000});
  await page.evaluate(() => {
    localStorage.setItem('koharu-theme','light');
    localStorage.setItem('koharu-language','en');
    localStorage.setItem('koharu-editor-font-size','18');
    localStorage.setItem('koharu-preview-font-size','19');
    localStorage.setItem('koharu-ui-font-size','15');
    localStorage.setItem('koharu-toolbar-hint-dismissed','true');
  });
  await page.reload();
  await page.getByRole('textbox').fill('# Today’s notes\n\nTurn your ideas into clear, readable documents with Koharu.\n\n## Things to do\n\n- Capture ideas as they come\n- Organize them with headings and lists\n- Check the result in Preview\n\n**Make important points stand out** with bold text.\n\n> A simple space to focus on your writing.\n\n## Turn ideas into diagrams\n\n```mermaid\nflowchart LR\n  A[Ideas] --> B[Write]\n  B --> C[Refine]\n  C --> D[Share]\n```');
  await page.getByRole('button',{name:'Split',exact:true}).click();
  await page.getByRole('button',{name:'View',exact:true}).click();
}

async page => {
  await page.reload();
  await page.getByRole('textbox').fill('# This week’s writing plan\n\nOrganize your tasks in a table and edit each cell directly.\n\n## Task overview\n\n| Task | Status | Due date |\n| --- | --- | --- |\n| Organize ideas | <!--koharu:align=center-->Done | <!--koharu:align=right-->Sep 21 |\n| Draft the article | <!--koharu:align=center-->In progress | <!--koharu:align=right-->Sep 22 |\n| Add diagrams | <!--koharu:align=center-->To do | <!--koharu:align=right-->Sep 23 |\n| Review the draft | <!--koharu:align=center-->To do | <!--koharu:align=right-->Sep 24 |\n\n## Editing tips\n\n- Click a cell to edit its content\n- Use “…” to add or delete rows and columns\n- Set left, center, or right alignment for each cell\n\n**Tab** moves to the next cell. **Shift+Enter** adds a line.\n\n> Share your finished document as a PDF.');
  await page.getByRole('button',{name:'Split',exact:true}).click();
  await page.getByRole('button',{name:'View',exact:true}).click();
  await page.getByRole('menuitemcheckbox',{name:'Outline',exact:true}).click();
}

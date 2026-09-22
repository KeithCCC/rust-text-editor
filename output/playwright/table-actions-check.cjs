async page => {
  await page.reload();
  await page.getByRole('button', {name: '表', exact:true}).click();
  await page.getByRole('textbox', {name:'行 1、列 2', exact:true}).click();
  await page.getByText('配置', {exact:true}).click();
  await page.getByRole('menuitemradio', {name:'右揃え', exact:true}).click();
  const align = await page.getByRole('textbox', {name:'行 1、列 2', exact:true}).evaluate(el => getComputedStyle(el).textAlign);
  if (align !== 'right') throw new Error('Right alignment failed: ' + align);
  await page.getByText('列', {exact:true}).click();
  await page.getByRole('menuitem', {name:'列を削除', exact:true}).click();
  if (await page.getByRole('columnheader').count() !== 1) throw new Error('Column deletion failed');
  await page.getByText('行', {exact:true}).click();
  await page.getByRole('menuitem', {name:'行を削除', exact:true}).click();
  if (await page.locator('.koharu-table tbody tr').count() !== 0) throw new Error('Row deletion failed');
  await page.screenshot({path:'output/playwright/table-actions-fixed.png'});
}

async page => {
  await page.getByRole('menuitemradio', {name:'右揃え', exact:true}).click();
  const target = page.getByRole('textbox', {name:'行 1、列 2', exact:true});
  if (await target.evaluate(el => getComputedStyle(el).textAlign) !== 'right') throw new Error('Cell alignment failed');
  const header = page.getByRole('textbox', {name:'見出し、列 2', exact:true});
  if (await header.evaluate(el => getComputedStyle(el).textAlign) === 'right') throw new Error('Alignment leaked into header');
  await target.fill('セルだけ右揃え');
  await page.getByRole('button', {name:'行 1、列 2: 表の操作', exact:true}).click();
  await page.screenshot({path:'output/playwright/cell-popup.png'});
  await page.getByRole('menuitem', {name:'列を削除', exact:true}).click();
  if (await page.getByRole('columnheader').count() !== 1) throw new Error('Column deletion failed');
  await page.getByRole('button', {name:'行 1、列 1: 表の操作', exact:true}).click();
  await page.getByRole('menuitem', {name:'行を削除', exact:true}).click();
  if (await page.locator('.koharu-table tbody tr').count() !== 0) throw new Error('Row deletion failed');
}

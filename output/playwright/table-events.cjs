async page => {
  await page.evaluate(() => {
    window.tableEvents = [];
    for (const name of ['pointerdown', 'mousedown', 'focusin', 'focusout', 'mouseup', 'click'])
      document.addEventListener(name, e => window.tableEvents.push([name, e.target.tagName, e.target.textContent?.slice(0,40)]), true);
  });
  await page.getByRole('textbox', {name: '行 1、列 2', exact: true}).click();
  await page.getByText('列', {exact:true}).click();
  await page.getByRole('menuitem', {name:'列を削除', exact:true}).click();
  console.log(await page.evaluate(() => window.tableEvents));
}

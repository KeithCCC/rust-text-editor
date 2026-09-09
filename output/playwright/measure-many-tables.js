(async () => {
 const view=window.tableTestView;
 const raw='| A | B |\n| --- | --- |\n| x | y |';
 view.dispatch({changes:{from:0,to:view.state.doc.length,insert:Array(50).fill(raw).join('\n\n')},selection:{anchor:0}});
 await new Promise(r=>setTimeout(r,300));
 const area=document.querySelectorAll('[data-table-cell="1:0"]')[0]; area.focus(); const timings=[];
 for(let i=0;i<30;i++){const start=performance.now(); area.value='表の編集'+i; area.dispatchEvent(new Event('input',{bubbles:true})); timings.push(performance.now()-start); await new Promise(r=>requestAnimationFrame(r));}
 timings.sort((a,b)=>a-b);
 return {tables:document.querySelectorAll('.koharu-table').length,p95:timings[28],focusPreserved:document.activeElement===area,docUpdated:view.state.doc.toString().includes('表の編集29')};
})()

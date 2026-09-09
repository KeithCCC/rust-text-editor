(async () => {
 const {EditorView}=await import('/node_modules/@codemirror/view/dist/index.js');
 const view=EditorView.findFromDOM(document.querySelector('.cm-content')); window.tableTestView=view;
 const raw='| '+Array.from({length:10},(_,i)=>'列'+i).join(' | ')+' |\n| '+Array(10).fill('---').join(' | ')+' |\n'+Array.from({length:200},(_,r)=>'| '+Array.from({length:10},(_,c)=>'項目'+r+':'+c).join(' | ')+' |').join('\n');
 view.dispatch({changes:{from:0,to:view.state.doc.length,insert:'# Performance\n\n'+raw},selection:{anchor:0}});
 await new Promise(r=>setTimeout(r,500));
 const area=document.querySelector('[data-table-cell="1:0"]'); area.focus(); const timings=[];
 for(let i=0;i<30;i++){ const t=performance.now(); area.value='編集'+i; area.dispatchEvent(new Event('input',{bubbles:true})); timings.push(performance.now()-t); await new Promise(r=>requestAnimationFrame(r)); }
 timings.sort((a,b)=>a-b);
 return {cells:document.querySelectorAll('.koharu-table-cell').length,p95:timings[28],max:Math.max(...timings),focusPreserved:document.activeElement===area,docUpdated:view.state.doc.toString().includes('編集29')};
})()

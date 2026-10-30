export function letterClaim(run) {
  let at=run.state.opensAt+100;
  const press=color=>{run.tap(color,run.start+at);at+=50;};
  for(const letter of run.state.target){
    const target=letter.charCodeAt(0)-65;
    const left=(run.cursor-target+27)%27,right=(target-run.cursor+27)%27;
    for(let i=0;i<Math.min(left,right);i++)press(left<right?0:2);
    press(1);
  }
  return run.claim;
}

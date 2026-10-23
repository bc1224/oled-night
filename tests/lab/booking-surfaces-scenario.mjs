export async function bookingSurfacesScenario(){
  const color=id=>getComputedStyle(document.getElementById(id)).backgroundColor;
  const fade=getComputedStyle(document.getElementById('booking-description'),'::after').backgroundImage;
  const checks=[
    {name:'Calendar flat slot rows match the black page canvas',ok:color('booking-slot')==='rgb(0, 0, 0)',detail:color('booking-slot')},
    {name:'Calendar description fade ends in the black canvas',ok:/rgb\(0, 0, 0\)\)$/.test(fade),detail:fade},
    {name:'Calendar rounded raised card remains separate from the canvas',ok:color('booking-card')!=='rgb(0, 0, 0)',detail:color('booking-card')},
    {name:'Calendar multicolor gradient keeps separate red and blue hues',ok:(()=>{const stops=(getComputedStyle(document.getElementById('booking-art')).backgroundImage.match(/rgba?\([^)]*\)/g)||[]).map(s=>s.match(/[\d.]+/g).slice(0,3).map(Number));return stops.length===2&&stops[0][0]>stops[0][2]&&stops[1][2]>stops[1][0]})()}
  ];
  const button=document.getElementById('booking-time');button.focus();await new Promise(r=>setTimeout(r,450));
  checks.push({name:'Calendar time button keeps keyboard focus and a distinct focus surface',ok:document.activeElement===button&&getComputedStyle(button).outlineStyle!=='none'&&color('booking-time')!=='rgba(0, 0, 0, 0)'});
  button.blur();await new Promise(r=>setTimeout(r,450));
  checks.push({name:'Calendar slot canvas remains coherent after focus restoration',ok:color('booking-slot')==='rgb(0, 0, 0)'});
  return checks;
}
export function bookingSurfacesRestored(){
  const c=id=>getComputedStyle(document.getElementById(id));
  return {name:'Calendar disable restores white rows, native fade, buttons and card',ok:c('booking-slot').backgroundColor==='rgb(255, 255, 255)'&&c('booking-card').backgroundColor==='rgb(255, 255, 255)'&&c('booking-time').backgroundColor==='rgba(0, 0, 0, 0)'&&getComputedStyle(document.getElementById('booking-description'),'::after').backgroundImage==='linear-gradient(rgba(255, 255, 255, 0), rgb(255, 255, 255))'};
}

const groups = {
  'Interactions': ['dropdowns','dark-dropdowns','state-surfaces','shadow-hover','interaction-layout','media-navigation','frame-mutation'],
  'Text & surfaces': ['light','dark','explicit-light','ink','surfaces','scope-light','scope-dark','scope-scheme','svg-outline'],
  'Media & data': ['indicators','chart','canvas','shop','ad-overlays'],
  'App reproductions': ['youtube','gmail','reddit-res','shadow-stability','apple-auth'],
  'Isolation & loading': ['components','protected','challenge','challenge-inline','frame','transparent-frame','slow','efficiency','report-fields']
};
const descriptions = {
  'frame-mutation':'Navigation replaced inside an animation callback: dark, readable surfaces before another frame',
  'shadow-hover':'CVS-style nested navigation: sibling pointer moves and focus in adopted stylesheets',
  'state-surfaces':'Apple Ads-style sibling cells and row hover',
  'media-navigation':'Apple-style media headings and animated navigation',
  'shadow-stability':'Reddit-style comment controls during ancestor hydration',
  'youtube':'Description text, chapter links, search and SVG button paint',
  'ad-overlays':'Ralphs-style bright and dark creatives with authored text',
  'indicators':'App Store Connect-style rating bars, tracks, charts and progress',
  'interaction-layout':'Amazon-style icons, dropdowns and large containers',
  'protected':'Password manager overlays and protected widgets',
  'challenge':'Challenge frames and CAPTCHA exclusions',
  'challenge-inline':'Inline challenge exclusions',
  'report-fields':'Diagnostic privacy: fake private-field sentinels',
  'apple-auth':'Synthetic login fields and native text fill',
  'components':'Open/closed shadow roots, replaced stylesheets and protected widgets'
};
export const cases = [
  {id:'cvs-hover',title:'CVS · repeated navigation hover',category:'Interactions',file:'cvs-hover.html',covers:['Late nested-root creation, pointer entry, sibling moves, delayed hover classes and replaced stylesheets','Whole hover interval sampled in Chrome; anonymous live CVS result shown separately'],limit:'Synthetic CVS-style stress case for the late-root fix in 0.6.38. A passing run does not guarantee every live page state; check the separate live receipt.'},
  {id:'matrix',title:'Component state matrix',category:'Interactions',file:'matrix.html',covers:['Rest, hover, focus, pressed, disabled and opened states','Cards, tables, dialogs, menus, forms, icons and nested roots'],limit:'Synthetic UI. Provider authentication and real CAPTCHA completion require separate live checks.'},
  ...Object.entries(groups).flatMap(([category, names]) => names.map(id => ({id, category, file:id+'.html', title:id.split('-').map(s=>s[0].toUpperCase()+s.slice(1)).join(' '),covers:[descriptions[id] || `${id.replaceAll('-',' ')} rendering and update behavior`],limit:id==='slow'?'Network-delay assertion requires the local test server; static gallery only illustrates the document.':id==='gmail'?'Static gallery uses same-origin synthetic artwork. Cross-origin image handling is verified by the original local browser regression.':'Minimal synthetic reproduction; not a saved website or proof of current live-site compatibility.'})))
];

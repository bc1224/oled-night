const groups = {
  'Interactions': ['dropdowns','dark-dropdowns','state-surfaces','shadow-hover','cold-shadow','interaction-layout','media-navigation','frame-mutation','paint-updates','large-updates'],
  'Text & surfaces': ['light','dark','explicit-light','ink','surfaces','scope-light','scope-dark','scope-scheme','svg-outline'],
  'Media & data': ['indicators','chart','canvas','shop','ad-overlays','wide-wordmarks'],
  'App reproductions': ['youtube','gmail','email-newsletter','native-banner','booking-form','checkout','chatgpt-controls','google-sheets-colors','reddit-res','shadow-stability','apple-auth','apple-recovery','dmv-hero-text'],
  'Isolation & loading': ['components','protected','challenge','challenge-inline','frame','transparent-frame','slow','efficiency','report-fields','report-preview','generated-style']
};
const descriptions = {
  'wide-wordmarks':'Synthetic compact navigation graphics: wide wordmarks and thin hamburger/close strokes at rest, focus, expanded and disabled states; late paths, colored logos, larger artwork and adjacent opacity motion preserved',
  'google-sheets-colors':'Synthetic Google-style fill-color palette: exact grayscale, saturated and pastel swatches, custom colors, dynamic updates and selection while the surrounding menu stays dark. Chrome and Firefox extension regressions; not a live document capture',
  'apple-recovery':'Issue #4: Apple-style account recovery with an editable captcha-input, readable floating label, protected provider widget and unchanged verification artwork',
  'large-updates':'2,500 fake inbox rows: native/active frame throughput, script/style/collected-memory budgets, bounded ownership, inherited text, background-only selection, CSSOM invalidation and animated fallback',
  'paint-updates':'Synthetic mail updates: paired native/active animation frame pacing, CPU and style work, bounded heap growth and prompt release of detached shadow components',
  'checkout':'Stripe-style fake checkout: monochrome payment icons, preserved payment brand colors, filled fields and animated accordion opening without pale frames; no payments or real customer data',
  'chatgpt-controls':'Synthetic chat interface: filled/stroked Send and Stop sprites, voice, disabled and focus states, sidebar/response actions, menus/dialogs, late controls and narrow layouts; colored artwork preserved. Not a live ChatGPT audit',
  'generated-style':'Late CSSOM color and width transitions plus generated labels in document, adopted shadow sheets and exported parts; authored scopes are reconsidered after updates',
  'report-preview':'Public issue preview omits private text, field values, selectors, frame origins and URL paths; nothing sends before a click',
  'cold-shadow':'Roots attached after their hosts were scanned: resting nested controls become readable without hover or focus',
  'email-newsletter':'Gmail-style dark reader: authored HTML headings, paragraphs, nested light panels and preserved artwork',
  'native-banner':'Robinhood-style native dark application with a light onboarding banner and tour controls',
  'booking-form':'SynXis-style filled fields, placeholders, focus outlines, colored hotel logo and back icon',
  'frame-mutation':'Navigation replaced or focused inside an animation callback: dark surfaces and readable native-dark focus ink before another frame',
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
  'components':'Open/closed shadow roots, replaced stylesheets and protected widgets',
  'dmv-hero-text':'Synthetic DMV-style carousel: absolutely positioned caption over a nested picture/image wrapper and colorful fake artwork; verifies painted text contrast without live DMV assets'
};
export const cases = [
  {id:'cvs-hover',title:'CVS · repeated navigation hover',category:'Interactions',file:'cvs-hover.html',covers:['Late nested-root creation, pointer entry, sibling moves, delayed hover classes and replaced stylesheets','Whole hover interval sampled in Chrome; anonymous live CVS result shown separately'],limit:'Synthetic CVS-style stress case for the late-root fix in 0.6.38. A passing run does not guarantee every live page state; check the separate live receipt.'},
  {id:'matrix',title:'Component state matrix',category:'Interactions',file:'matrix.html',covers:['Rest, hover, focus, pressed, disabled and opened states','Cards, tables, dialogs, menus, forms, icons and nested roots'],limit:'Synthetic UI. Provider authentication and real CAPTCHA completion require separate live checks.'},
  ...Object.entries(groups).flatMap(([category, names]) => names.map(id => ({id, category, file:id+'.html', title:id.split('-').map(s=>s[0].toUpperCase()+s.slice(1)).join(' '),covers:[descriptions[id] || `${id.replaceAll('-',' ')} rendering and update behavior`],limit:id==='slow'?'Network-delay assertion requires the local test server; static gallery only illustrates the document.':id==='gmail'?'Static gallery uses same-origin synthetic artwork. Cross-origin image handling is verified by the original local browser regression.':'Minimal synthetic reproduction; not a saved website or proof of current live-site compatibility.'})))
];

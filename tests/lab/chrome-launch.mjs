export function chromeTestArgs(args,{platform=process.platform,sandbox=process.env.OLED_WINDOWS_OUTER_SANDBOX}={}){
  return platform==='win32'&&sandbox==='mxc'?[...args,'--no-sandbox']:[...args];
}

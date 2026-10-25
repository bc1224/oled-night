// Node adapter for the external platform base class. The real Worker, routes,
// Durable Object methods and storage calls run unchanged in the routing tests.
export async function resolve(specifier,context,nextResolve){
  if(specifier==='cloudflare:workers')return {url:'data:text/javascript,export class DurableObject { constructor(ctx, env) { this.ctx = ctx; this.env = env; } }',shortCircuit:true};
  return nextResolve(specifier,context);
}

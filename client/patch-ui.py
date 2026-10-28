#!/usr/bin/env python3
# Patche l'UI (build .webhapp) d'une hApp type "syn/holochain-apps" pour la faire
# tourner en navigateur nu contre notre conducteur : ports + autorisation de signature.
#   patch-ui.py <fichier index-*.js> [appPort=4455] [adminPort=4444]
import sys, re

f = sys.argv[1]
appport = sys.argv[2] if len(sys.argv) > 2 else "4455"
adminport = sys.argv[3] if len(sys.argv) > 3 else "4444"
s = open(f, encoding="utf-8").read()
done = []

a = "{}.VITE_APP_PORT ? {}.VITE_APP_PORT : 8888"
if a in s:
    s = s.replace(a, a.replace("8888", appport)); done.append("appPort->" + appport)

a = "const adminPort = {}.VITE_ADMIN_PORT;"
if a in s:
    s = s.replace(a, "const adminPort = %s;" % adminport); done.append("adminPort->" + adminport)

a = "await adminWebsocket.authorizeSigningCredentials(cellIds[0]);"
if a in s:
    s = s.replace(a, "for (const __cid of cellIds) { await adminWebsocket.authorizeSigningCredentials(__cid); }")
    done.append("authz-all-cells")

p = re.compile(r"const adminWebsocket = await AdminWebsocket\.connect\(\{ url: new URL\(url2\) \}\);")
if p.search(s):
    s = p.sub(lambda m: m.group(0) + " window.__KD_ADMIN__ = adminWebsocket;", s, count=1)
    done.append("stash-admin")

p2 = re.compile(r"async createCloneCell\(args\)\s*\{\s*const clonedCell = this\.createCloneCellRequester\(\{\s*\.\.\.args\s*\}\);\s*this\.cachedAppInfo = void 0;\s*return clonedCell;\s*\}")
if p2.search(s):
    repl = ("async createCloneCell(args) { const clonedCell = await this.createCloneCellRequester({ ...args }); "
            "this.cachedAppInfo = void 0; try { if (globalThis.window && window.__KD_ADMIN__ && clonedCell && clonedCell.cell_id) "
            "{ await window.__KD_ADMIN__.authorizeSigningCredentials(clonedCell.cell_id); } } catch (e) { console.error('authz clone', e); } "
            "return clonedCell; }")
    s = p2.sub(repl, s, count=1); done.append("authz-clone")

open(f, "w", encoding="utf-8").write(s)
print("patched [%s]: %s" % (f.split('/')[-1], ", ".join(done) or "RIEN"))

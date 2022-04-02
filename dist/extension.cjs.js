"use strict";
Object.defineProperties(exports, { __esModule: { value: true }, [Symbol.toStringTag]: { value: "Module" } });
var path = require("path");
var vscode = require("vscode");
var vscodeLanguageclient = require("vscode-languageclient");
function _interopDefaultLegacy(e) {
  return e && typeof e === "object" && "default" in e ? e : { "default": e };
}
var path__default = /* @__PURE__ */ _interopDefaultLegacy(path);
function getVirtualDocumentTextSections({
  documentText,
  regions,
  languageId
}) {
  let currentPos = 0;
  const oldContent = documentText;
  const virtualDocumentTextSections = [];
  for (const region of regions) {
    if (region.languageId === languageId) {
      virtualDocumentTextSections.push(substituteWithWhitespace(oldContent.slice(currentPos, region.start)), oldContent.slice(region.start, region.end));
      currentPos = region.end;
    }
  }
  virtualDocumentTextSections.push(substituteWithWhitespace(oldContent.slice(currentPos)));
  return virtualDocumentTextSections;
}
function substituteWithWhitespace(string) {
  let whitespaceString = "";
  for (const char of string) {
    if (char === "\r" || char === "\n") {
      whitespaceString += char;
    }
  }
  return whitespaceString;
}
function getDocumentTextRegions(documentText) {
  const regions = [];
  const ejsBeginTag = String.raw`<\?[_=-]?`;
  const ejsEndTag = String.raw`[_-]?\?>`;
  const tagMatches = [
    ...documentText.matchAll(new RegExp(`(${ejsBeginTag})|(${ejsEndTag})`, "g"))
  ];
  let insideEjsSection = false;
  let currentSectionBeginTagMatch;
  let lastSectionEndTagMatch;
  for (const tagMatch of tagMatches) {
    const isBeginTag = tagMatch[1] !== void 0;
    const isEndTag = tagMatch[2] !== void 0;
    const tag = tagMatch[0];
    if (isBeginTag && !insideEjsSection) {
      regions.push({
        start: lastSectionEndTagMatch === void 0 ? 0 : lastSectionEndTagMatch.index + tag.length,
        end: tagMatch.index,
        languageId: "latex"
      });
      insideEjsSection = true;
      currentSectionBeginTagMatch = tagMatch;
    } else if (isEndTag && insideEjsSection) {
      if (currentSectionBeginTagMatch === void 0)
        continue;
      regions.push({
        start: currentSectionBeginTagMatch.index,
        end: tagMatch.index + tag.length,
        languageId: "js"
      });
      insideEjsSection = false;
      lastSectionEndTagMatch = tagMatch;
    }
  }
  regions.push({
    start: lastSectionEndTagMatch === void 0 ? 0 : lastSectionEndTagMatch.index + lastSectionEndTagMatch[0].length,
    end: documentText.length,
    languageId: "latex"
  });
  return regions;
}
function isInsideEjsRegion({
  documentText,
  offset
}) {
  const documentTextRegions = getDocumentTextRegions(documentText);
  for (const textRegion of documentTextRegions.filter((region) => region.languageId === "js")) {
    if (offset > textRegion.start && offset <= textRegion.end) {
      return true;
    }
  }
  return false;
}
function getJavascriptVirtualContent(documentText) {
  const regions = getDocumentTextRegions(documentText);
  const javascriptVirtualContentSections = getVirtualDocumentTextSections({
    documentText,
    languageId: "js",
    regions
  }).map((section) => section.replace(/^<\?[_=-]?/, "").replace(/[_-]?\?>$/, "")).join("");
  return javascriptVirtualContentSections;
}
let client;
async function activate(context) {
  await vscode.commands.executeCommand("latex-workshop.tab");
  const serverPath = "server.cjs";
  const serverModule = context.asAbsolutePath(serverPath);
  const debugOptions = { execArgv: ["--nolazy", "--inspect=6009"] };
  const serverOptions = {
    run: { module: serverModule, transport: vscodeLanguageclient.TransportKind.ipc },
    debug: {
      module: serverModule,
      transport: vscodeLanguageclient.TransportKind.ipc,
      options: debugOptions
    }
  };
  const virtualDocumentContents = /* @__PURE__ */ new Map();
  vscode.workspace.registerTextDocumentContentProvider("jslatex-embedded-content", {
    provideTextDocumentContent(uri) {
      const filePath = uri.path.slice(8);
      const filename = path__default["default"].parse(filePath).name;
      const originalUri = uri.path.slice(1, 8) + path__default["default"].join(path__default["default"].parse(filePath).dir, filename);
      const decodedUri = decodeURIComponent(originalUri);
      const virtualDocumentText = virtualDocumentContents.get(decodedUri);
      return virtualDocumentText;
    }
  });
  const clientOptions = {
    documentSelector: [{ scheme: "file", language: "latex" }],
    middleware: {
      async provideCompletionItem(document, position, context2, token, next) {
        if (!isInsideEjsRegion({
          documentText: document.getText(),
          offset: document.offsetAt(position)
        })) {
          return next(document, position, context2, token);
        }
        const originalUri = document.uri.toString();
        const virtualDocumentText = getJavascriptVirtualContent(document.getText());
        const vdocUriString = `jslatex-embedded-content://js/${encodeURIComponent(originalUri)}.js`;
        virtualDocumentContents.set(originalUri, virtualDocumentText);
        const vdocUri = vscode.Uri.parse(vdocUriString);
        const completionList = await vscode.commands.executeCommand("vscode.executeCompletionItemProvider", vdocUri, position, context2.triggerCharacter);
        return completionList;
      }
    }
  };
  client = new vscodeLanguageclient.LanguageClient("jslatex-language-server", "JSLaTeX Language Server", serverOptions, clientOptions);
  client.start();
  console.info("Client started.");
}
async function deactivate() {
  if (client !== void 0) {
    await client.stop();
  }
}
exports.activate = activate;
exports.deactivate = deactivate;

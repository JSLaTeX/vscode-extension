"use strict";
var vscodeLanguageserver = require("vscode-languageserver");
const connection = vscodeLanguageserver.createConnection(vscodeLanguageserver.ProposedFeatures.all);
const triggerCharacters = [".", '"', "'", "`", "/", "@", "#", " "];
connection.onInitialize((_params) => ({
  capabilities: {
    textDocumentSync: vscodeLanguageserver.TextDocumentSyncKind.Full,
    completionProvider: {
      triggerCharacters,
      resolveProvider: true
    }
  }
}));
connection.onCompletion(() => null);
connection.onCompletionResolve(() => void 0);
connection.listen();

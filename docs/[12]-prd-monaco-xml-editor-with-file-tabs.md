<!-- Source: DITA_Converter_PRD_Pack.docx.md -->

# PRD-12 — Monaco XML editor with file tabs

## **Summary**

Implement the Monaco editor that streams Agent 1 XML output live during generation, then populates file tabs with the final validated files from Agent 2\.

## **Context**

Uses @monaco-editor/react. The live streaming (xmlBuffer) and the final tabbed view (files) are two distinct display modes driven by conversion state.

## **Acceptance criteria**

| Criterion | Definition of done |
| :---- | :---- |
| Monaco renders | Editor is visible with language="xml" and a dark theme. |
| Live streaming | During state.stage \=== "generating", state.xmlBuffer is set as Monaco value in real time. |
| File tabs appear | After state.files is populated, tabs appear for each filename (c\_\*.dita, t\_\*.dita, r\_\*.dita, \*.ditamap). |
| Tab switching | Clicking a tab shows that file's content in the editor. |
| Ditamap tab last | The .ditamap tab is always the rightmost tab. |
| Syntax highlighting | XML keywords, tags, and attributes are syntax-highlighted. |
| Read-only | The editor is readOnly={true} — judges should not accidentally edit the output. |

## **Tasks**

80. Create /app/components/XmlEditor.tsx

81. Lazy-import Monaco: const MonacoEditor \= dynamic(() \=\> import("@monaco-editor/react"), { ssr: false })

82. When state.stage \=== "generating" and state.files is empty, pass state.xmlBuffer as value

83. When state.files is populated, show file tabs and pass selectedFile content as value

84. Sort tabs: concept files first, then task, then reference, then ditamap

85. Set options={{ readOnly: true, minimap: { enabled: false }, fontSize: 13 }}

## **Notes**

| *Monaco must be dynamically imported with ssr: false — it uses browser APIs and will crash on SSR. The dynamic import adds \~200ms first-render latency which is acceptable.* |
| :---- |


